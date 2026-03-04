const fs = require("fs");
const path = require("path");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { extensionFromMime } = require("./fileManager");

function randomId(length = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function normalizeMediaType(messageType) {
  if (messageType.includes("image")) return "image";
  if (messageType.includes("video")) return "video";
  if (messageType.includes("audio")) return "audio";
  if (messageType.includes("document")) return "document";
  return null;
}

async function saveMediaContent(content, messageType, targetDir) {
  const normalized = normalizeMediaType(messageType);
  if (!normalized) throw new Error(`Unsupported media type: ${messageType}`);
  const stream = await downloadContentFromMessage(content, normalized);
  const buffer = await streamToBuffer(stream);
  const ext = extensionFromMime(content?.mimetype);
  const fileName = `${Date.now()}_${randomId(8)}.${ext}`;
  const outputPath = path.join(targetDir, fileName);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

module.exports = {
  saveMediaContent,
};
