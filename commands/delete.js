module.exports = {
  name: "delete",
  aliases: [],
  description: "Delete quoted message",
  async execute(ctx) {
    const quoted = ctx.msg.message?.extendedTextMessage?.contextInfo;
    if (!quoted?.stanzaId) return ctx.reply("Reply to a message first.");
    await ctx.sock.sendMessage(ctx.chatJid, {
      delete: {
        remoteJid: ctx.chatJid,
        fromMe: false,
        id: quoted.stanzaId,
        participant: quoted.participant,
      },
    });
  },
};

