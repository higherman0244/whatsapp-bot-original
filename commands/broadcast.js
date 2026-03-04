module.exports = {
  name: "broadcast",
  aliases: [],
  description: "Broadcast text to known users",
  adminOnly: true,
  async execute(ctx) {
    const text = ctx.args.join(" ").trim();
    if (!text) return ctx.reply("Usage: .broadcast your message");
    const recipients = Object.keys(ctx.state.users).filter((jid) => jid.endsWith("@s.whatsapp.net"));
    let sent = 0;
    for (const jid of recipients) {
      try {
        await ctx.sock.sendMessage(jid, { text: `Broadcast:\n${text}` });
        sent += 1;
      } catch (_) {}
    }
    await ctx.reply(`Broadcast sent to ${sent} users.`);
  },
};

