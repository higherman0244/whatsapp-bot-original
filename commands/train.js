const { trainBrain } = require("../utils/localAi");

module.exports = {
  name: "train",
  aliases: ["teach"],
  description: "Train local AI: .train question | answer",
  adminOnly: true,
  async execute(ctx) {
    const input = ctx.args.join(" ").trim();
    const splitAt = input.indexOf("|");
    if (!input || splitAt < 1 || splitAt === input.length - 1) {
      return ctx.reply("Usage: .train question | answer");
    }

    const question = input.slice(0, splitAt).trim();
    const answer = input.slice(splitAt + 1).trim();
    if (!question || !answer) return ctx.reply("Usage: .train question | answer");

    const { brain, updated } = trainBrain(ctx.state.brain, question, answer);
    ctx.state.brain = brain;
    ctx.persistBrain();

    await ctx.reply(updated ? "Training updated." : "Training added.");
  },
};
