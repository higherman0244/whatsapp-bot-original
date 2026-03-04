module.exports = {
  name: "autosave",
  aliases: [],
  description: "Toggle autosave",
  adminOnly: true,
  async execute(ctx) {
    const state = (ctx.args[0] || "").toLowerCase();
    if (!["on", "off"].includes(state)) return ctx.reply("Usage: .autosave on|off");
    ctx.state.settings.autosave = state === "on";
    ctx.persistSettings();
    await ctx.reply(`Autosave ${state}`);
  },
};

