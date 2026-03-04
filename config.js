const fs = require("fs");
const path = require("path");

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

function parseOwnerIds(value) {
  return String(value || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

module.exports = {
  ownerNumber: process.env.OWNER_NUMBER || "2330506216000",
  ownerIds: parseOwnerIds(process.env.OWNER_IDS || ""),
  botName: process.env.BOT_NAME || "Ultra WhatsApp Automation Bot AI",
  version: "1.0.0",
  commandPrefix: ".",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  customTtsEnabled: (process.env.CUSTOM_TTS_ENABLED || "true").toLowerCase() !== "false",
  customTtsVoice: process.env.CUSTOM_TTS_VOICE || "Microsoft Zira Desktop",
  customTtsRate: Number(process.env.CUSTOM_TTS_RATE || 0),
  ttsModel: process.env.TTS_MODEL || "gpt-4o-mini-tts",
  ttsVoice: process.env.TTS_VOICE || "alloy",
  sttModel: process.env.STT_MODEL || "whisper-1",
  aiBudgetEnabled: (process.env.AI_BUDGET_ENABLED || "true").toLowerCase() !== "false",
  aiDailyRequestCap: Number(process.env.AI_DAILY_REQUEST_CAP || 120),
  aiDailyTokenCap: Number(process.env.AI_DAILY_TOKEN_CAP || 120000),
  aiMonthlyRequestCap: Number(process.env.AI_MONTHLY_REQUEST_CAP || 3000),
  aiMonthlyTokenCap: Number(process.env.AI_MONTHLY_TOKEN_CAP || 2500000),
  dashboardEnabled: (process.env.DASHBOARD_ENABLED || "true").toLowerCase() !== "false",
  dashboardPort: Number(process.env.DASHBOARD_PORT || 3090),
  dashboardToken: process.env.DASHBOARD_TOKEN || "nana-dashboard",
  dashboardAuthRequired: (process.env.DASHBOARD_AUTH_REQUIRED || "true").toLowerCase() !== "false",
  autosave: false,
  autoreply: false,
  autoread: false,
  autoreact: false,
  aiEnabled: true,
  aiOwnerPing: true,
  autoreplyDelay: 400,
};
