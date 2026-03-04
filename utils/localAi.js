const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "we",
  "what",
  "when",
  "where",
  "who",
  "why",
  "with",
  "you",
  "your",
]);

const SYNONYMS = {
  u: "you",
  ur: "your",
  pls: "please",
  plz: "please",
  cuz: "because",
  msg: "message",
  pic: "photo",
  pix: "photo",
  vid: "video",
  ai: "artificial intelligence",
  ml: "machine learning",
  cv: "resume",
  biz: "business",
  wifi: "wi fi",
};

function normalizeToken(token) {
  let t = String(token || "").toLowerCase().trim();
  if (!t) return "";
  if (SYNONYMS[t]) t = SYNONYMS[t];
  if (t.endsWith("ies") && t.length > 4) t = `${t.slice(0, -3)}y`;
  else if (t.endsWith("ing") && t.length > 5) t = t.slice(0, -3);
  else if (t.endsWith("ed") && t.length > 4) t = t.slice(0, -2);
  else if (t.endsWith("s") && t.length > 3) t = t.slice(0, -1);
  return t;
}

function defaultBrain() {
  return {
    intents: [
      {
        patterns: ["hello", "hi", "hey", "good morning", "good evening"],
        response: "Hello. How can I help?",
      },
      {
        patterns: ["who are you", "what are you", "your name"],
        response: "I am your custom bot assistant.",
      },
      {
        patterns: ["thanks", "thank you"],
        response: "You're welcome.",
      },
    ],
    memory: [],
    slang: {},
    usage: {
      global: { words: {}, phrases: {} },
      chats: {},
      users: {},
    },
  };
}

function normalizeText(text, slangMap) {
  const clean = String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  if (!slangMap || typeof slangMap !== "object") return clean;

  const out = [];
  for (const token of clean.split(" ")) {
    out.push(token);
    const entry = slangMap[token];
    const meaning = entry?.meaning
      ? String(entry.meaning)
      : typeof entry === "string"
      ? entry
      : "";
    if (!meaning) continue;
    const normalizedMeaning = String(meaning)
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalizedMeaning || normalizedMeaning === token) continue;
    out.push(...normalizedMeaning.split(" "));
  }
  return out.join(" ").trim();
}

function tokenize(text, slangMap) {
  const clean = normalizeText(text, slangMap);
  if (!clean) return [];
  return clean
    .split(" ")
    .map(normalizeToken)
    .filter(Boolean);
}

function overlapScore(a, b, slangMap) {
  const at = tokenize(a, slangMap);
  const bt = tokenize(b, slangMap);
  if (!at.length || !bt.length) return 0;
  const bSet = new Set(bt);
  let common = 0;
  for (const token of at) {
    if (bSet.has(token)) common += 1;
  }
  return common / Math.max(at.length, bt.length);
}

function editDistance(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  const dp = Array.from({ length: x.length + 1 }, () => Array(y.length + 1).fill(0));
  for (let i = 0; i <= x.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= y.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= x.length; i += 1) {
    for (let j = 1; j <= y.length; j += 1) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[x.length][y.length];
}

function ensureUsage(data) {
  if (!data.usage || typeof data.usage !== "object") {
    data.usage = { global: { words: {}, phrases: {} }, chats: {}, users: {} };
  }
  if (!data.usage.global) data.usage.global = { words: {}, phrases: {} };
  if (!data.usage.global.words) data.usage.global.words = {};
  if (!data.usage.global.phrases) data.usage.global.phrases = {};
  if (!data.usage.chats || typeof data.usage.chats !== "object") data.usage.chats = {};
  if (!data.usage.users || typeof data.usage.users !== "object") data.usage.users = {};
}

function normalizeBrain(brain) {
  const merged = { ...defaultBrain(), ...(brain || {}) };
  if (!Array.isArray(merged.intents)) merged.intents = [];
  if (!Array.isArray(merged.memory)) merged.memory = [];
  if (!merged.slang || typeof merged.slang !== "object") merged.slang = {};
  ensureUsage(merged);
  return merged;
}

function trimCounter(bucket, maxKeys = 1500) {
  const keys = Object.keys(bucket);
  if (keys.length <= maxKeys) return;
  const entries = keys.map((k) => [k, Number(bucket[k] || 0)]);
  entries.sort((a, b) => b[1] - a[1]);
  const keep = new Set(entries.slice(0, Math.floor(maxKeys * 0.8)).map((x) => x[0]));
  for (const key of keys) {
    if (!keep.has(key)) delete bucket[key];
  }
}

function addCount(bucket, key, amount = 1) {
  if (!key) return;
  bucket[key] = Number(bucket[key] || 0) + amount;
}

function profileFor(container, id) {
  if (!container[id]) container[id] = { words: {}, phrases: {} };
  if (!container[id].words) container[id].words = {};
  if (!container[id].phrases) container[id].phrases = {};
  return container[id];
}

function extractPhrases(tokens) {
  const phrases = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    phrases.push(`${tokens[i]} ${tokens[i + 1]}`);
    if (i < tokens.length - 2) {
      phrases.push(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
    }
  }
  return phrases;
}

function teachSlang(brain, term, meaning, source = "manual") {
  const data = normalizeBrain(brain);
  const key = normalizeText(term);
  const value = normalizeText(meaning);
  if (!key || !value) throw new Error("Slang term and meaning are required.");
  const now = new Date().toISOString();
  const existing = data.slang[key];
  data.slang[key] = {
    meaning: value,
    uses: Number(existing?.uses || 0),
    learnedAt: existing?.learnedAt || now,
    updatedAt: now,
    source,
  };
  return { brain: data, updated: Boolean(existing) };
}

function learnSlangFromText(data, text) {
  const raw = String(text || "").trim();
  const match = raw.match(/^\s*([A-Za-z0-9][A-Za-z0-9'._-]{1,24})\s*(?:means|=|is)\s+(.{2,80})$/i);
  if (!match) return null;
  const term = match[1];
  const meaning = match[2];
  try {
    teachSlang(data, term, meaning, "chat");
    return normalizeText(term);
  } catch {
    return null;
  }
}

function observeLanguage(brain, { text, chatId, userId }) {
  const data = normalizeBrain(brain);
  const clean = normalizeText(text);
  if (!clean) return { brain: data, changed: false, learnedSlang: null };

  const words = clean.split(" ").filter((w) => w && w.length >= 2 && !STOP_WORDS.has(w));
  const phrases = extractPhrases(words);
  const chatKey = String(chatId || "unknown");
  const userKey = String(userId || "unknown");
  const chatProfile = profileFor(data.usage.chats, chatKey);
  const userProfile = profileFor(data.usage.users, userKey);

  for (const word of words) {
    addCount(data.usage.global.words, word, 1);
    addCount(chatProfile.words, word, 1);
    addCount(userProfile.words, word, 1);
  }
  for (const phrase of phrases) {
    addCount(data.usage.global.phrases, phrase, 1);
    addCount(chatProfile.phrases, phrase, 1);
    addCount(userProfile.phrases, phrase, 1);
  }

  trimCounter(data.usage.global.words, 3000);
  trimCounter(data.usage.global.phrases, 4000);
  trimCounter(chatProfile.words, 1200);
  trimCounter(chatProfile.phrases, 1600);
  trimCounter(userProfile.words, 1200);
  trimCounter(userProfile.phrases, 1600);

  const learnedSlang = learnSlangFromText(data, text);
  return { brain: data, changed: true, learnedSlang };
}

function trainBrain(brain, question, answer) {
  const data = normalizeBrain(brain);
  const q = String(question || "").trim();
  const a = String(answer || "").trim();
  if (!q || !a) throw new Error("Question and answer are required.");

  const key = normalizeText(q);
  const now = new Date().toISOString();
  const existing = data.memory.find((x) => normalizeText(x.q) === key);
  if (existing) {
    existing.a = a;
    existing.updatedAt = now;
    return { brain: data, updated: true };
  }

  data.memory.push({
    q,
    a,
    createdAt: now,
    updatedAt: now,
    uses: 0,
  });
  return { brain: data, updated: false };
}

function topEntries(bucket, limit = 8) {
  return Object.entries(bucket || {})
    .map(([key, count]) => ({ key, count: Number(count || 0) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function getProfileSnapshot(brain, { chatId, userId, limit = 8 } = {}) {
  const data = normalizeBrain(brain);
  const chatProfile = data.usage.chats[String(chatId || "unknown")] || { words: {}, phrases: {} };
  const userProfile = data.usage.users[String(userId || "unknown")] || { words: {}, phrases: {} };
  return {
    chatWords: topEntries(chatProfile.words, limit),
    chatPhrases: topEntries(chatProfile.phrases, limit),
    userWords: topEntries(userProfile.words, limit),
    userPhrases: topEntries(userProfile.phrases, limit),
    globalWords: topEntries(data.usage.global.words, limit),
    slang: topEntries(
      Object.fromEntries(
        Object.entries(data.slang || {}).map(([k, v]) => [k, Number(v?.uses || 0)])
      ),
      limit
    ),
  };
}

function bestMatch(prompt, brain, options = {}) {
  const data = normalizeBrain(brain);
  const cleanPrompt = normalizeText(String(prompt || ""), data.slang);
  if (!cleanPrompt) return null;

  let winner = null;
  for (const item of data.memory) {
    const cleanQ = normalizeText(item.q, data.slang);
    let score = overlapScore(cleanPrompt, cleanQ, data.slang);
    const distance = editDistance(cleanPrompt, cleanQ);
    if (distance <= 2) score = Math.max(score, 0.8);
    if (cleanPrompt === cleanQ) score = 1;
    else if (cleanPrompt.includes(cleanQ) || cleanQ.includes(cleanPrompt)) score = Math.max(score, 0.86);
    if (Number(item.uses || 0) > 2) {
      score = Math.min(1, score + Math.min(0.08, Number(item.uses || 0) * 0.01));
    }
    if (!winner || score > winner.score) winner = { score, response: item.a, source: "memory", ref: item };
  }

  for (const intent of data.intents) {
    const patterns = Array.isArray(intent.patterns) ? intent.patterns : [];
    for (const pattern of patterns) {
      const cleanPattern = normalizeText(pattern, data.slang);
      let score = overlapScore(cleanPrompt, cleanPattern, data.slang);
      if (cleanPrompt === cleanPattern) score = 0.98;
      else if (cleanPrompt.includes(cleanPattern) || cleanPattern.includes(cleanPrompt)) {
        score = Math.max(score, 0.84);
      }
      if (!winner || score > winner.score) winner = { score, response: intent.response, source: "intent", ref: intent };
    }
  }

  const metaPrompt = cleanPrompt;
  const wantsStats =
    metaPrompt.includes("frequent words") ||
    metaPrompt.includes("top words") ||
    metaPrompt.includes("most used words") ||
    metaPrompt.includes("slang") ||
    metaPrompt.includes("jargon");
  if (wantsStats) {
    const snapshot = getProfileSnapshot(data, options);
    const words = snapshot.chatWords.slice(0, 5).map((x) => x.key).join(", ");
    const phrases = snapshot.chatPhrases.slice(0, 3).map((x) => x.key).join(", ");
    const reply = [
      words ? `Top words here: ${words}.` : "I am still learning words in this chat.",
      phrases ? `Common phrases: ${phrases}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    if (!winner || 0.9 > winner.score) {
      winner = { score: 0.9, response: reply, source: "usage", ref: null };
    }
  }

  return winner;
}

function getLocalAIReply(prompt, brain, options = {}) {
  const { minConfidence = 0.45 } = options;
  const data = normalizeBrain(brain);
  const match = bestMatch(prompt, data, options);
  if (!match || match.score < minConfidence) return null;

  if (match.source === "memory" && match.ref) {
    match.ref.uses = Number(match.ref.uses || 0) + 1;
    match.ref.updatedAt = new Date().toISOString();
  }

  const promptTokens = tokenize(prompt, data.slang);
  for (const token of promptTokens) {
    const slangEntry = data.slang[token];
    if (slangEntry) {
      slangEntry.uses = Number(slangEntry.uses || 0) + 1;
      slangEntry.updatedAt = new Date().toISOString();
    }
  }

  return {
    text: match.response,
    confidence: match.score,
    source: match.source,
  };
}

module.exports = {
  defaultBrain,
  normalizeBrain,
  trainBrain,
  teachSlang,
  observeLanguage,
  getProfileSnapshot,
  getLocalAIReply,
};
