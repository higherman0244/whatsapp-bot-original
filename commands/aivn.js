const fs = require("fs");
const { askSmartAI } = require("../utils/smartAi");
const { synthesizeSpeechToFile } = require("../utils/openaiTts");
const { synthesizeWithCustomVoice } = require("../utils/customTts");

module.exports = {
  name: "aivn",
  aliases: ["aivoice", "voiceai"],
  description: "AI reply as voice note",
  async execute(ctx) {
    const prompt = ctx.args.join(" ").trim();
    if (!prompt) return ctx.reply("Usage: .aivn your question");

    let result = null;
    try {
      result = await askSmartAI({
        prompt,
        state: ctx.state,
        config: ctx.config,
        chatId: ctx.chatJid,
        userId: ctx.senderJid,
        checkAIBudget: ctx.checkAIBudget,
        recordAIBudget: ctx.recordAIBudget,
        persistBrain: ctx.persistBrain,
        allowWebSearch: true,
      });

      let audioPath = "";
      try {
        // 1) Prefer custom local voice (no OpenAI billing)
        if (ctx.config.customTtsEnabled) {
          audioPath = await synthesizeWithCustomVoice({
            text: result.text,
            baseDir: ctx.baseDir,
            voice: ctx.config.customTtsVoice,
            rate: ctx.config.customTtsRate,
          });
        } else {
          throw new Error("Custom TTS disabled.");
        }

        await ctx.sock.sendMessage(
          ctx.chatJid,
          {
            audio: { url: audioPath },
            mimetype: "audio/wav",
            ptt: true,
          },
          { quoted: ctx.msg }
        );
      } catch (error) {
        // 2) Fallback to OpenAI TTS if available and within budget
        if (ctx.config.openaiApiKey) {
          const ttsBudget = ctx.checkAIBudget();
          if (ttsBudget.allowed) {
            try {
              audioPath = await synthesizeSpeechToFile({
                apiKey: ctx.config.openaiApiKey,
                text: result.text,
                baseDir: ctx.baseDir,
                model: ctx.config.ttsModel,
                voice: ctx.config.ttsVoice,
              });
              ctx.recordAIBudget({
                input_tokens: 0,
                output_tokens: 0,
                total_tokens: 0,
              });

              await ctx.sock.sendMessage(
                ctx.chatJid,
                {
                  audio: { url: audioPath },
                  mimetype: "audio/mpeg",
                  ptt: true,
                },
                { quoted: ctx.msg }
              );
              return;
            } catch {}
          }
        }

        return ctx.reply(`Voice note failed. Here is the text answer:\n\n${result.text}`);
      } finally {
        if (audioPath && fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
        }
      }
    } catch (error) {
      ctx.logger.error(
        { err: error, message: error?.message || String(error) },
        "AI voice command failed"
      );
      if (result?.text) {
        await ctx.reply(`Voice AI failed right now. Here is text instead:\n\n${result.text}`);
      } else {
        await ctx.reply("Voice AI failed right now. Try again shortly.");
      }
    }
  },
};
