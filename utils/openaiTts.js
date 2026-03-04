const fs = require("fs");
const path = require("path");

function randomId(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function synthesizeSpeechToFile({
  apiKey,
  text,
  baseDir,
  model = "gpt-4o-mini-tts",
  voice = "alloy",
}) {
  if (!apiKey) throw new Error("OpenAI API key missing.");
  const input = String(text || "").trim();
  if (!input) throw new Error("TTS input text is empty.");

  const payload = {
    model,
    voice,
    input: input.slice(0, 4000),
    response_format: "mp3",
  };

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TTS request failed (${res.status}): ${body || "unknown error"}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const outputPath = path.join(baseDir, "media", "temp", `tts_${Date.now()}_${randomId()}.mp3`);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

module.exports = {
  synthesizeSpeechToFile,
};
