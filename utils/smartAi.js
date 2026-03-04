const { askOpenAI, mapOpenAIError } = require("./openai");
const { getLocalAIReply, trainBrain } = require("./localAi");
const { searchWeb, summarizeResults } = require("./webSearch");
const { styleReply } = require("./responseStyler");

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPageExcerpt(url, maxChars = 1400) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return "";
    const html = await res.text();
    const text = stripTags(html);
    return text.slice(0, maxChars);
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

function recentChatContext(state, chatId, limit = 5) {
  const items = (state.lastMessages || [])
    .filter((x) => x.remoteJid === chatId && x.text)
    .slice(-limit)
    .map((x) => x.text);
  return items.join("\n");
}

function shouldSearchWeb(prompt) {
  const text = String(prompt || "").toLowerCase();
  if (!text) return false;
  const factualSignals = [
    "what is",
    "who is",
    "where is",
    "when is",
    "how to",
    "latest",
    "news",
    "price",
    "update",
    "explain",
    "meaning",
  ];
  return factualSignals.some((x) => text.includes(x)) || text.split(" ").length >= 7;
}

function fallbackFromResults(prompt, results) {
  if (!results || !results.length) return null;
  const top = results.slice(0, 3);
  const lines = top.map((r, i) => `${i + 1}. ${r.title}${r.snippet ? ` - ${r.snippet}` : ""}`);
  return [
    "I found this online:",
    ...lines,
    "",
    `Sources: ${top.map((r) => r.url).join(" | ")}`,
  ].join("\n");
}

function applyPersonaTone(text, state, userId) {
  const raw = String(text || "").trim();
  if (!raw) return raw;
  const user = state?.users?.[userId] || {};
  return styleReply({
    text: raw,
    gender: user.gender || "neutral",
    withHumor: true,
    withEmoji: true,
  });
}

function normalizeLegacyCommandHints(text) {
  let out = String(text || "");
  if (!out) return out;

  const rules = [
    [/\buse\s+\.(menu|help)\b/gi, "just ask me what I can do"],
    [/\buse\s+\.(enable|disable)\s+ai\b/gi, "just tell me to turn AI on or off"],
    [/\bsend\s+\.(enable|disable)\s+ai\b/gi, "just tell me to turn AI on or off"],
    [
      /\buse:\s*\.train\s+question\s*\|\s*answer\b/gi,
      "teach me naturally by saying: remember this question and answer",
    ],
    [
      /\bexample:\s*\.train\s+([^|]+)\|\s*([^\n]+)/gi,
      "example: remember this question '$1' and answer '$2'",
    ],
    [/\buse\s+\.(ai|aivn)\b/gi, "just ask your question normally"],
    [/\busage:\s*\.[a-z0-9]+\s+[^\n]+/gi, "Tell me in plain language what you want to do."],
    [/\busage:\s*\.[a-z0-9]+/gi, "Tell me in plain language what you want to do."],
  ];

  for (const [pattern, replacement] of rules) {
    out = out.replace(pattern, replacement);
  }

  const tokenMap = {
    menu: "help options",
    help: "help options",
    ai: "normal chat",
    aivn: "voice chat",
    train: "teaching mode",
    enable: "turn on",
    disable: "turn off",
    admin: "admin settings",
    autoreply: "auto reply",
    autosave: "auto save",
    autoread: "auto read",
    autoreact: "auto react",
  };
  out = out.replace(/(^|[\s(])\.([a-z][a-z0-9_-]*)\b/gi, (m, lead, cmd) => {
    const mapped = tokenMap[String(cmd || "").toLowerCase()];
    return mapped ? `${lead}${mapped}` : `${lead}${cmd}`;
  });
  out = out.replace(/\bavailable commands\b/gi, "available options");
  out = out.replace(/\bcommands\b/gi, "options");

  return out;
}

async function enrichWebResults(results) {
  const enriched = [];
  for (const item of (results || []).slice(0, 3)) {
    const excerpt = await fetchPageExcerpt(item.url);
    enriched.push({
      ...item,
      excerpt,
    });
  }
  return enriched;
}

async function askSmartAI({
  prompt,
  state,
  config,
  chatId,
  userId,
  checkAIBudget,
  recordAIBudget,
  persistBrain,
  allowWebSearch = true,
}) {
  const chatContext = recentChatContext(state, chatId, 5);
  const local = getLocalAIReply(prompt, state.brain, {
    minConfidence: 0.32,
    chatId,
    userId,
  });
  if (local?.text) {
    persistBrain();
    const normalized = normalizeLegacyCommandHints(local.text);
    return { text: applyPersonaTone(normalized, state, userId), source: "local" };
  }

  let webResults = [];
  let enrichedWeb = [];
  if (allowWebSearch && shouldSearchWeb(prompt)) {
    try {
      webResults = await searchWeb(prompt, { maxResults: 5 });
      enrichedWeb = await enrichWebResults(webResults);
    } catch {
      webResults = [];
      enrichedWeb = [];
    }
  }

  const canUseOpenAI = Boolean(config.openaiApiKey);
  if (canUseOpenAI) {
    const budget = checkAIBudget();
    if (budget.allowed) {
      const webContext = enrichedWeb.length
        ? `Web findings:\n${summarizeResults(enrichedWeb)}\n\nWeb excerpts:\n${enrichedWeb
            .map((x, i) => `[${i + 1}] ${x.excerpt || x.snippet || ""}`)
            .join("\n")}\n\n`
        : "";
      const contextBlock = chatContext ? `Recent chat context:\n${chatContext}\n\n` : "";
      const input = `${contextBlock}${webContext}User question: ${prompt}
Give a direct helpful answer. If web findings were provided, ground key claims in [1], [2], [3] style citations.`;
      try {
        const result = await askOpenAI({
          apiKey: config.openaiApiKey,
          prompt: input,
        });
        recordAIBudget(result.usage);
        const learned = trainBrain(state.brain, prompt, result.text);
        state.brain = learned.brain;
        persistBrain();
        return {
          text: applyPersonaTone(normalizeLegacyCommandHints(result.text), state, userId),
          source: enrichedWeb.length ? "openai+web+memory" : "openai+memory",
          sources: enrichedWeb.map((x) => x.url),
        };
      } catch (error) {
        const mapped = mapOpenAIError(error);
        if (!mapped.expected) throw error;
      }
    }
  }

  const fromWeb = fallbackFromResults(prompt, enrichedWeb.length ? enrichedWeb : webResults);
  if (fromWeb) {
    const learned = trainBrain(state.brain, prompt, fromWeb);
    state.brain = learned.brain;
    persistBrain();
    return {
      text: applyPersonaTone(normalizeLegacyCommandHints(fromWeb), state, userId),
      source: "web+memory",
      sources: (enrichedWeb.length ? enrichedWeb : webResults).slice(0, 3).map((x) => x.url),
    };
  }

  return {
    text: applyPersonaTone(
      "I don't know that yet, but you can teach me by chatting naturally and giving the answer you want me to remember.",
      state,
      userId
    ),
    source: "none",
  };
}

module.exports = {
  askSmartAI,
};
