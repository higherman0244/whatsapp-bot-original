const path = require("path");
const fs = require("fs");
const { saveMediaContent } = require("../utils/downloader");
const { getMessageType, extractQuotedMessage } = require("../utils/helpers");
const { getRizzLoveReply } = require("./rizzLoveHandler");
const { askSmartAI } = require("../utils/smartAi");
const { transcribeAudioFile } = require("../utils/openaiStt");

function getOwnerTargets(config) {
  const out = new Set();
  for (const jid of config.ownerIds || []) {
    const value = String(jid || "").trim();
    if (value) out.add(value);
  }
  const ownerPhone = String(config.ownerNumber || "").replace(/\D/g, "");
  if (ownerPhone) out.add(`${ownerPhone}@s.whatsapp.net`);
  return [...out];
}

async function pingOwnersForReply({ context, remoteJid, sender, originalText, suggestedReply, kind }) {
  const owners = getOwnerTargets(context.config);
  let queued = null;
  if (typeof context.enqueueAssist === "function") {
    queued = context.enqueueAssist({
      accountId: context.accountId,
      chatJid: remoteJid,
      senderJid: sender,
      originalText,
      suggestedReply,
      kind,
    });
  }

  if (!owners.length) return;
  const assistId = queued?.id || "n/a";
  const body = [
    `Owner Assist (${kind})`,
    `Assist ID: ${assistId}`,
    `Chat: ${remoteJid}`,
    `Sender: ${sender}`,
    `Message: ${originalText}`,
    "",
    `Suggested reply: ${suggestedReply}`,
    "",
    `Reply with: .answerping ${assistId} | your message`,
  ].join("\n");

  for (const ownerJid of owners) {
    try {
      await context.sock.sendMessage(ownerJid, { text: body });
    } catch {}
  }
}

async function handleIntelligence({
  msg,
  text,
  context,
  baseDir,
  settings,
  replies,
  logEvent,
}) {
  const type = getMessageType(msg.message);
  const quoted = extractQuotedMessage(msg.message);
  const sender = context.senderJid;
  const remoteJid = msg.key.remoteJid;

  context.state.lastMessages.push({
    at: Date.now(),
    sender,
    remoteJid,
    type,
    hasQuoted: Boolean(quoted),
    text: text || "",
  });
  if (context.state.lastMessages.length > 100) context.state.lastMessages.shift();

  if (settings.autosave && ["imageMessage", "videoMessage", "audioMessage", "documentMessage"].includes(type)) {
    const folderMap = {
      imageMessage: "images",
      videoMessage: "videos",
      audioMessage: "audio",
      documentMessage: "documents",
    };
    const output = await saveMediaContent(
      msg.message[type],
      type,
      path.join(baseDir, "media", folderMap[type])
    );
    logEvent("media", { sender, type, output });

    if (type === "imageMessage") await context.reply("Image saved successfully");
    if (type === "videoMessage") await context.reply("Video saved successfully");
    if (type === "audioMessage") await context.reply("Audio saved successfully");
    if (type === "documentMessage") await context.reply("Document saved successfully");
    return true;
  }

  if (!text && settings.aiEnabled && type === "audioMessage") {
    if (!context.config.openaiApiKey) return false;

    const budget = context.checkAIBudget();
    if (!budget.allowed) return false;

    let audioPath = "";
    try {
      audioPath = await saveMediaContent(
        msg.message.audioMessage,
        type,
        path.join(baseDir, "media", "temp")
      );

      const transcript = await transcribeAudioFile({
        apiKey: context.config.openaiApiKey,
        filePath: audioPath,
        model: context.config.sttModel,
      });

      if (!transcript) return false;

      const result = await askSmartAI({
        prompt: transcript,
        state: context.state,
        config: context.config,
        chatId: remoteJid,
        userId: sender,
        checkAIBudget: context.checkAIBudget,
        recordAIBudget: context.recordAIBudget,
        persistBrain: context.persistBrain,
        allowWebSearch: true,
      });
      if (settings.aiOwnerPing && !context.isOwner(sender)) {
        await pingOwnersForReply({
          context,
          remoteJid,
          sender,
          originalText: transcript,
          suggestedReply: result.text,
          kind: "voice-note",
        });
        return true;
      }

      await context.reply(`Heard: ${transcript}\n\n${result.text}`);
      return true;
    } catch (error) {
      context.logger.error(
        { err: error, message: error?.message || String(error) },
        "Voice note transcription failed"
      );
      logEvent("errors", {
        type: "stt",
        message: error?.message || String(error),
      });
      return false;
    } finally {
      if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    }
  }

  if (!text) return false;

  if (settings.aiEnabled) {
    try {
      const rizzLoveReply = getRizzLoveReply(text);
      if (rizzLoveReply) {
        if (settings.aiOwnerPing && !context.isOwner(sender)) {
          await pingOwnersForReply({
            context,
            remoteJid,
            sender,
            originalText: text,
            suggestedReply: rizzLoveReply,
            kind: "text",
          });
          return true;
        }
        await context.reply(rizzLoveReply);
        return true;
      }

      const result = await askSmartAI({
        prompt: text,
        state: context.state,
        config: context.config,
        chatId: remoteJid,
        userId: sender,
        checkAIBudget: context.checkAIBudget,
        recordAIBudget: context.recordAIBudget,
        persistBrain: context.persistBrain,
        allowWebSearch: true,
      });
      if (settings.aiOwnerPing && !context.isOwner(sender)) {
        await pingOwnersForReply({
          context,
          remoteJid,
          sender,
          originalText: text,
          suggestedReply: result.text,
          kind: "text",
        });
        return true;
      }
      await context.reply(result.text);
      return true;
    } catch (error) {
      context.logger.error(
        { err: error, message: error?.message || String(error) },
        "AI auto reply failed"
      );
      logEvent("errors", {
        type: "ai",
        message: "AI auto reply failed",
      });
    }
  }

  return false;
}

module.exports = {
  handleIntelligence,
};
