const { trainBrain } = require("../utils/localAi");

module.exports = {
  name: "answerping",
  aliases: ["assistreply", "replyping"],
  description: "Reply to assist ping and train AI: .answerping id | message",
  adminOnly: true,
  async execute(ctx) {
    const input = ctx.args.join(" ").trim();
    const split = input.indexOf("|");
    if (!input || split < 1 || split === input.length - 1) {
      return ctx.reply("Usage: .answerping <assistId> | <reply message>");
    }

    const assistId = input.slice(0, split).trim();
    const replyText = input.slice(split + 1).trim();
    if (!assistId || !replyText) {
      return ctx.reply("Usage: .answerping <assistId> | <reply message>");
    }

    const queue = ctx.state.assistQueue?.items || [];
    const item = queue.find((x) => x.id === assistId);
    if (!item) {
      const pending = queue
        .filter((x) => x.status === "pending")
        .slice(-5)
        .map((x) => `${x.id} -> ${x.senderJid}`)
        .join("\n");
      return ctx.reply(`Assist ID not found.\nRecent pending:\n${pending || "none"}`);
    }

    try {
      await ctx.sock.sendMessage(item.chatJid, { text: replyText });
      item.status = "sent";
      item.updatedAt = new Date().toISOString();
      item.note = "Sent via .answerping";
      ctx.persistAssistQueue();

      if (item.originalText) {
        const learned = trainBrain(ctx.state.brain, item.originalText, replyText);
        ctx.state.brain = learned.brain;
        ctx.persistBrain();
      }

      await ctx.reply(`Sent and trained from assist ${assistId}.`);
    } catch (error) {
      ctx.logger.error(
        { err: error, message: error?.message || String(error), assistId },
        "answerping failed"
      );
      await ctx.reply("Failed to send assist reply.");
    }
  },
};
