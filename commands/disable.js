module.exports = {
  name: "disable",
  aliases: [],
  description: "Disable a feature",
  adminOnly: true,
  async execute(ctx) {
    const input = ctx.args.map((x) => String(x || "").toLowerCase()).filter(Boolean);
    const aliases = {
      ai: "aiEnabled",
      a: "aiEnabled",
      autosave: "autosave",
      save: "autosave",
      s: "autosave",
      ownerping: "aiOwnerPing",
      pingowner: "aiOwnerPing",
      assist: "aiOwnerPing",
      autoread: "autoread",
      read: "autoread",
      d: "autoread",
      ad: "autoread",
      autoreact: "autoreact",
      react: "autoreact",
      t: "autoreact",
    };

    if (!input.length) {
      return ctx.reply("Usage: .disable ai|a|ownerping|autosave|autoread|autoreact|all");
    }

    const keys = new Set();
    for (const feature of input) {
      if (feature === "all") {
        keys.add("aiEnabled");
        keys.add("aiOwnerPing");
        keys.add("autosave");
        keys.add("autoread");
        keys.add("autoreact");
        continue;
      }
      const key = aliases[feature];
      if (!key) {
        return ctx.reply("Usage: .disable ai|a|ownerping|autosave|autoread|autoreact|all");
      }
      keys.add(key);
    }

    for (const key of keys) ctx.state.settings[key] = false;
    ctx.persistSettings();
    await ctx.reply(`Disabled: ${[...keys].join(", ")}`);
  },
};
