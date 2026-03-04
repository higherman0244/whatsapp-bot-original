const { askSmartAI } = require("../utils/smartAi");

module.exports = {
  name: "ai",
  aliases: [],
  description: "Ask AI directly",
  async execute(ctx) {
    const prompt = ctx.args.join(" ").trim();
    if (!prompt) return ctx.reply("Usage: .ai your message");

    try {
      const result = await askSmartAI({
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
      await ctx.reply(result.text);
    } catch (error) {
      ctx.logger.error(
        { err: error, message: error?.message || String(error) },
        "AI command failed"
      );
      await ctx.reply("AI failed to answer right now. Try again shortly.");
    }
  },
};
