const OpenAI = require("openai");

let client;

function getClient(apiKey) {
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

async function askOpenAI({ apiKey, prompt, model = "gpt-4o-mini" }) {
  const sdk = getClient(apiKey);
  if (!sdk) throw new Error("OpenAI API key missing. Set OPENAI_API_KEY.");

  const response = await sdk.responses.create({
    model,
    input: [
      { role: "system", content: "You are a concise, safe WhatsApp automation assistant." },
      { role: "user", content: prompt },
    ],
  });

  return {
    text: response.output_text?.trim() || "No response generated.",
    usage: response.usage || {},
  };
}

function mapOpenAIError(error) {
  const code = error?.code || error?.error?.code || "";
  const status = Number(error?.status || error?.error?.status || 0);
  const rawMessage = error?.message || String(error || "");
  const message = rawMessage.toLowerCase();

  if (message.includes("api key missing")) {
    return {
      userMessage: "AI is not configured. Set OPENAI_API_KEY first.",
      expected: true,
    };
  }

  if (
    code === "insufficient_quota" ||
    message.includes("insufficient_quota") ||
    message.includes("exceeded your current quota") ||
    status === 429
  ) {
    return {
      userMessage: "AI is temporarily unavailable: OpenAI quota/billing limit reached.",
      expected: true,
    };
  }

  return {
    userMessage: `AI error: ${rawMessage}`,
    expected: false,
  };
}

module.exports = {
  askOpenAI,
  mapOpenAIError,
};
