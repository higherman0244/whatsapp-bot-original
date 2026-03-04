module.exports = {
  name: "userinfo",
  aliases: [],
  description: "Show user info",
  async execute(ctx) {
    const target = ctx.msg.message?.extendedTextMessage?.contextInfo?.participant || ctx.senderJid;
    const user = ctx.state.users[target];
    if (!user) return ctx.reply("User not found in database.");
    const isLid = String(target).endsWith("@lid");
    const ownerPhone = String(ctx.config.ownerNumber || "").replace(/\D/g, "");
    const phoneLabel = isLid
      ? (user.isAdmin && ownerPhone ? `${ownerPhone} (owner)` : "Not exposed by WhatsApp (LID)")
      : user.phone;

    await ctx.reply(
      JSON.stringify(
        {
          jid: target,
          phone: phoneLabel,
          joinDate: user.joinDate,
          lastSeen: user.lastSeen,
          messageCount: user.messageCount,
          gender: user.gender || "neutral",
          isAdmin: Boolean(user.isAdmin),
        },
        null,
        2
      )
    );
  },
};
