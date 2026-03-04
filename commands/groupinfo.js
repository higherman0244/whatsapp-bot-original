module.exports = {
  name: "groupinfo",
  aliases: [],
  description: "Show group information",
  async execute(ctx) {
    if (!ctx.chatJid.endsWith("@g.us")) return ctx.reply("This command only works in groups.");
    const data = await ctx.sock.groupMetadata(ctx.chatJid);
    await ctx.reply(
      [
        `Subject: ${data.subject}`,
        `Owner: ${data.owner || "unknown"}`,
        `Members: ${data.participants.length}`,
        `Creation: ${data.creation || "unknown"}`,
      ].join("\n")
    );
  },
};

