module.exports = {
  name: "autoread",
  aliases: [],
  description: "Toggle autoread",
  adminOnly: true,
  async execute(ctx) {
    const state = (ctx.args[0] || "").toLowerCase();
    if (!["on", "off"].includes(state)) return ctx.reply("Usage: .autoread on|off");
    ctx.state.settings.autoread = state === "on";
    ctx.persistSettings();
    await ctx.reply(`Autoread ${state}`);
  },
};

