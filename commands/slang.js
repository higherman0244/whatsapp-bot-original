const { teachSlang } = require("../utils/localAi");

module.exports = {
  name: "slang",
  aliases: [],
  description: "Manage slang: .slang add term | meaning",
  adminOnly: true,
  async execute(ctx) {
    const action = (ctx.args[0] || "").toLowerCase();
    const rest = ctx.args.slice(1).join(" ").trim();

    if (action === "list") {
      const entries = Object.entries(ctx.state.brain.slang || {});
      if (!entries.length) return ctx.reply("No slang stored yet.");
      const lines = entries
        .sort((a, b) => Number(b[1]?.uses || 0) - Number(a[1]?.uses || 0))
        .slice(0, 30)
        .map(([term, info]) => `${term} -> ${info?.meaning || ""}`);
      return ctx.reply(lines.join("\n"));
    }

    if (action === "remove") {
      const term = rest.toLowerCase().trim();
      if (!term) return ctx.reply("Usage: .slang remove term");
      if (!ctx.state.brain.slang[term]) return ctx.reply("Slang term not found.");
      delete ctx.state.brain.slang[term];
      ctx.persistBrain();
      return ctx.reply(`Removed slang: ${term}`);
    }

    if (action === "add") {
      const splitAt = rest.indexOf("|");
      if (splitAt < 1 || splitAt === rest.length - 1) {
        return ctx.reply("Usage: .slang add term | meaning");
      }
      const term = rest.slice(0, splitAt).trim();
      const meaning = rest.slice(splitAt + 1).trim();
      const { brain, updated } = teachSlang(ctx.state.brain, term, meaning, "manual");
      ctx.state.brain = brain;
      ctx.persistBrain();
      return ctx.reply(updated ? "Slang updated." : "Slang added.");
    }

    return ctx.reply("Usage: .slang add|remove|list");
  },
};
