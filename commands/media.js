const path = require("path");
const fs = require("fs");

module.exports = {
  name: "media",
  aliases: [],
  description: "Show media storage counts",
  async execute(ctx) {
    const folders = ["images", "videos", "audio", "documents", "status", "saved"];
    const lines = folders.map((name) => {
      const full = path.join(ctx.baseDir, "media", name);
      const count = fs.existsSync(full) ? fs.readdirSync(full).length : 0;
      return `${name}: ${count}`;
    });
    await ctx.reply(lines.join("\n"));
  },
};

