module.exports = {
  name: "admin",
  aliases: [],
  description: "Manage bot admins",
  adminOnly: true,
  async execute(ctx) {
    const action = (ctx.args[0] || "").toLowerCase();
    const raw = (ctx.args[1] || "").replace(/\D/g, "");
    const jid = raw ? `${raw}@s.whatsapp.net` : "";

    if (action === "list") {
      return ctx.reply(ctx.state.settings.admins.length ? ctx.state.settings.admins.join("\n") : "No admins configured.");
    }

    if (!ctx.isOwner(ctx.senderJid)) {
      return ctx.reply("Only owner can add/remove admins.");
    }

    if (action === "add") {
      if (!jid) return ctx.reply("Usage: .admin add 1234567890");
      if (!ctx.state.settings.admins.includes(jid)) ctx.state.settings.admins.push(jid);
      ctx.persistSettings();
      return ctx.reply(`Admin added: ${jid}`);
    }

    if (action === "remove") {
      if (!jid) return ctx.reply("Usage: .admin remove 1234567890");
      ctx.state.settings.admins = ctx.state.settings.admins.filter((x) => x !== jid);
      ctx.persistSettings();
      return ctx.reply(`Admin removed: ${jid}`);
    }

    return ctx.reply("Usage: .admin add|remove|list number");
  },
};
