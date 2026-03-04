module.exports = {
  name: "menu",
  aliases: [],
  description: "Show all commands",
  async execute(ctx) {
    const lines = [...ctx.state.commandList]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => `.${c.name} - ${c.description || "No description"}`);
    await ctx.reply(`*${ctx.config.botName}*\n\n${lines.join("\n")}`);
  },
};
