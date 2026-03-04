const fs = require("fs");
const OpenAI = require("openai");

const clients = new Map();

function getClient(apiKey) {
  if (!apiKey) return null;
  if (!clients.has(apiKey)) {
    clients.set(apiKey, new OpenAI({ apiKey }));
  }
  return clients.get(apiKey);
}

async function transcribeAudioFile({ apiKey, filePath, model = "whisper-1" }) {
  if (!apiKey) throw new Error("OpenAI API key missing.");
  if (!filePath || !fs.existsSync(filePath)) throw new Error("Audio file not found for transcription.");

  const sdk = getClient(apiKey);
  const response = await sdk.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model,
  });

  return String(response?.text || "").trim();
}

module.exports = {
  transcribeAudioFile,
};
