module.exports = {
  name: "uptime",
  aliases: [],
  description: "Show process uptime",
  async execute(ctx) {
    const sec = Math.floor((Date.now() - ctx.state.startTime) / 1000);
    await ctx.reply(`Uptime: ${sec}s`);
  },
};

