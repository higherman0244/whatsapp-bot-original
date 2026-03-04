module.exports = {
  name: "profile",
  aliases: [],
  description: "Show your profile",
  async execute(ctx) {
    const jid = ctx.senderJid;
    const user = ctx.state.users[jid];
    if (!user) return ctx.reply("No profile found yet.");
    const isLid = String(jid).endsWith("@lid");
    const ownerPhone = String(ctx.config.ownerNumber || "").replace(/\D/g, "");
    const phoneLabel = isLid
      ? (user.isAdmin && ownerPhone ? `${ownerPhone} (owner)` : "Not exposed by WhatsApp (LID)")
      : user.phone;

    await ctx.reply(
      [
        `JID: ${jid}`,
        `Phone: ${phoneLabel}`,
        `Join date: ${user.joinDate}`,
        `Last seen: ${user.lastSeen}`,
        `Message count: ${user.messageCount}`,
        `Gender: ${user.gender || "neutral"}`,
        `Admin: ${user.isAdmin ? "yes" : "no"}`,
      ].join("\n")
    );
  },
};
