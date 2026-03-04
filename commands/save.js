const path = require("path");
const { saveMediaContent } = require("../utils/downloader");
const { getMessageType, extractQuotedMessage } = require("../utils/helpers");

module.exports = {
  name: "save",
  aliases: [],
  description: "Save quoted status/media",
  async execute(ctx) {
    const quoted = extractQuotedMessage(ctx.msg.message);
    if (!quoted) return ctx.reply("Reply to a status/media message first.");
    const qType = getMessageType(quoted);
    if (!["imageMessage", "videoMessage", "audioMessage", "documentMessage"].includes(qType)) {
      return ctx.reply("Quoted message has no savable media.");
    }
    const output = await saveMediaContent(quoted[qType], qType, path.join(ctx.baseDir, "media", "status"));
    const mime = quoted[qType]?.mimetype || "application/octet-stream";

    if (qType === "videoMessage") {
      return ctx.sock.sendMessage(
        ctx.chatJid,
        { video: { url: output }, caption: "Saved successfully", mimetype: mime },
        { quoted: ctx.msg }
      );
    }

    if (qType === "imageMessage") {
      return ctx.sock.sendMessage(
        ctx.chatJid,
        { image: { url: output }, caption: "Saved successfully", mimetype: mime },
        { quoted: ctx.msg }
      );
    }

    if (qType === "audioMessage") {
      return ctx.sock.sendMessage(
        ctx.chatJid,
        { audio: { url: output }, mimetype: mime },
        { quoted: ctx.msg }
      );
    }

    return ctx.sock.sendMessage(
      ctx.chatJid,
      {
        document: { url: output },
        fileName: path.basename(output),
        caption: "Saved successfully",
        mimetype: mime,
      },
      { quoted: ctx.msg }
    );
  },
};
