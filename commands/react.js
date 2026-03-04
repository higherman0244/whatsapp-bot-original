module.exports = {
  name: "react",
  aliases: [],
  description: "React to quoted/current message",
  async execute(ctx) {
    const emoji = ctx.args[0] || "✅";
    const info = ctx.msg.message?.extendedTextMessage?.contextInfo;
    await ctx.sock.sendMessage(ctx.chatJid, {
      react: {
        text: emoji,
        key: {
          remoteJid: ctx.chatJid,
          id: info?.stanzaId || ctx.msg.key.id,
          participant: info?.participant || ctx.senderJid,
        },
      },
    });
  },
};

