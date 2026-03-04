const path = require("path");
const fs = require("fs");

module.exports = {
  name: "statuslist",
  aliases: [],
  description: "List saved status files",
  async execute(ctx) {
    const dir = path.join(ctx.baseDir, "media", "status");
    const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    if (!files.length) return ctx.reply("No saved status files.");
    await ctx.reply(files.slice(-20).join("\n"));
  },
};

