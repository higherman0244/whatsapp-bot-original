const { makeRizz } = require("../handlers/rizzLoveHandler");

module.exports = {
  name: "rizz",
  aliases: ["flirt"],
  description: "Get a rizz line (.rizz [smooth|cute|bold] [name])",
  async execute(ctx) {
    const styles = new Set(["smooth", "cute", "bold"]);
    const first = (ctx.args[0] || "").toLowerCase();
    const style = styles.has(first) ? first : "smooth";
    const target = styles.has(first) ? ctx.args.slice(1).join(" ").trim() : ctx.args.join(" ").trim();
    await ctx.reply(makeRizz(target, style));
  },
};
