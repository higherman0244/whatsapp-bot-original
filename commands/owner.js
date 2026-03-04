module.exports = {
  name: "owner",
  aliases: [],
  description: "Show owner number",
  async execute(ctx) {
    await ctx.reply(`Owner: ${ctx.config.ownerNumber}`);
  },
};

