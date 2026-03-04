function getMessageType(message = {}) {
  return Object.keys(message).find((key) => key !== "messageContextInfo") || null;
}

function extractText(message = {}) {
  if (!message) return "";
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  return "";
}

function extractQuotedMessage(message = {}) {
  return message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
}

function getSenderJid(msg) {
  return msg?.key?.participant || msg?.key?.remoteJid;
}

function getPhoneNumberFromJid(jid = "") {
  return jid.split("@")[0] || jid;
}

function isStatusMessage(msg) {
  return msg?.key?.remoteJid === "status@broadcast";
}

module.exports = {
  getMessageType,
  extractText,
  extractQuotedMessage,
  getSenderJid,
  getPhoneNumberFromJid,
  isStatusMessage,
};
