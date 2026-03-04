const { PACK } = require("../utils/brainBoostPack");
const { trainBrain } = require("../utils/localAi");

module.exports = {
  name: "brainboost",
  aliases: ["boostbrain", "brainup"],
  description: "Inject curated knowledge pack into local brain",
  adminOnly: true,
  async execute(ctx) {
    let added = 0;
    let updated = 0;

    for (const [q, a] of PACK) {
      const result = trainBrain(ctx.state.brain, q, a);
      ctx.state.brain = result.brain;
      if (result.updated) updated += 1;
      else added += 1;
    }

    ctx.persistBrain();
    await ctx.reply(`Brain boosted. Added: ${added}, Updated: ${updated}, Total pack: ${PACK.length}.`);
  },
};
