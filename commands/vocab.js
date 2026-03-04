const { getProfileSnapshot } = require("../utils/localAi");

function formatList(items) {
  if (!items.length) return "-";
  return items.map((x) => `${x.key}(${x.count})`).join(", ");
}

module.exports = {
  name: "vocab",
  aliases: ["lingo"],
  description: "Show learned words/phrases in this chat",
  async execute(ctx) {
    const snapshot = getProfileSnapshot(ctx.state.brain, {
      chatId: ctx.chatJid,
      userId: ctx.senderJid,
      limit: 8,
    });

    const text = [
      "*Chat top words:*",
      formatList(snapshot.chatWords),
      "",
      "*Chat top phrases:*",
      formatList(snapshot.chatPhrases),
      "",
      "*Your top words:*",
      formatList(snapshot.userWords),
      "",
      "*Known slang:*",
      formatList(snapshot.slang),
    ].join("\n");

    await ctx.reply(text);
  },
};
