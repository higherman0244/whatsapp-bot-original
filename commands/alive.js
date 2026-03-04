module.exports = {
  name: "alive",
  aliases: [],
  description: "Health check",
  async execute(ctx) {
    await ctx.reply(`${ctx.config.botName} is running.`);
  },
};

