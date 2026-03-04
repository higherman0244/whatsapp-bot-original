module.exports = {
  name: "forward",
  aliases: [],
  description: "Forward quoted message to jid",
  async execute(ctx) {
    const jid = ctx.args[0];
    if (!jid) return ctx.reply("Usage: .forward 1234567890@s.whatsapp.net");
    const quoted = ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) return ctx.reply("Reply to a message to forward it.");
    await ctx.sock.sendMessage(jid, quoted);
    await ctx.reply("Forwarded.");
  },
};

