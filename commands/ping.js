module.exports = {
  name: "ping",
  aliases: [],
  description: "Ping the bot",
  async execute(ctx) {
    const latency = Date.now() - ctx.msg.messageTimestamp * 1000;
    await ctx.reply(`Pong: ${Math.max(0, latency)}ms`);
  },
};
