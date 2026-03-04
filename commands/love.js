const { makeLove } = require("../handlers/rizzLoveHandler");

module.exports = {
  name: "love",
  aliases: ["romance"],
  description: "Get love lines (.love [advice|soft|heartbreak] [name])",
  async execute(ctx) {
    const styles = new Set(["advice", "soft", "heartbreak"]);
    const first = (ctx.args[0] || "").toLowerCase();
    const style = styles.has(first) ? first : "advice";
    const target = styles.has(first) ? ctx.args.slice(1).join(" ").trim() : ctx.args.join(" ").trim();
    await ctx.reply(makeLove(target, style));
  },
};
