module.exports = {
  name: "setgender",
  aliases: ["gender"],
  description: "Set your AI style gender: male|female|neutral",
  async execute(ctx) {
    const value = (ctx.args[0] || "").toLowerCase();
    if (!["male", "female", "neutral"].includes(value)) {
      return ctx.reply("Usage: .setgender male|female|neutral");
    }

    if (!ctx.state.users[ctx.senderJid]) {
      return ctx.reply("Profile not found yet. Send a normal message first.");
    }

    ctx.state.users[ctx.senderJid].gender = value;
    ctx.persistUsers();
    await ctx.reply(`Gender style saved: ${value}`);
  },
};
