module.exports = {
  name: "restart",
  aliases: [],
  description: "Restart process",
  adminOnly: true,
  async execute(ctx) {
    await ctx.reply("Restarting...");
    process.exit(0);
  },
};

