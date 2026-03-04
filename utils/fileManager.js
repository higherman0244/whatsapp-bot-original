const fs = require("fs");
const path = require("path");

function extensionFromMime(mime = "") {
  if (!mime) return "bin";
  return (mime.split("/")[1] || "bin").split(";")[0];
}

function ensureDir(target) {
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
}

function listFilesSafe(folderPath) {
  if (!fs.existsSync(folderPath)) return [];
  return fs.readdirSync(folderPath).map((name) => path.join(folderPath, name));
}

function mediaFolderByMessageType(type) {
  if (type === "imageMessage") return "images";
  if (type === "videoMessage") return "videos";
  if (type === "audioMessage") return "audio";
  if (type === "documentMessage") return "documents";
  return null;
}

module.exports = {
  extensionFromMime,
  ensureDir,
  listFilesSafe,
  mediaFolderByMessageType,
};
