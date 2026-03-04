const path = require("path");
const { saveMediaContent } = require("../utils/downloader");
const { getMessageType, getSenderJid } = require("../utils/helpers");

async function handleStatusMessage({ msg, baseDir, settings, logEvent }) {
  if (!settings.autosave) return;
  const type = getMessageType(msg.message);
  if (!["imageMessage", "videoMessage", "audioMessage", "documentMessage"].includes(type)) return;

  const output = await saveMediaContent(
    msg.message[type],
    type,
    path.join(baseDir, "media", "status")
  );

  logEvent("status", {
    sender: getSenderJid(msg),
    file: output,
    type,
  });
}

module.exports = {
  handleStatusMessage,
};
