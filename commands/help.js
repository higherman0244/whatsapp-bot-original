module.exports = {
  name: "help",
  aliases: [],
  description: "Show command menu",
  async execute(ctx) {
    const menu = ctx.commands.get("menu");
    if (menu) return menu.execute(ctx);
    await ctx.reply("Use .menu");
  },
};
