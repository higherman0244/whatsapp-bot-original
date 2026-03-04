const { extractText, getSenderJid } = require("../utils/helpers");

async function handleCommand({ msg, commands, prefix, contextFactory }) {
  const text = extractText(msg.message);
  if (!text || !text.startsWith(prefix)) return false;

  const [rawCommand, ...args] = text.slice(prefix.length).trim().split(/\s+/);
  const commandName = (rawCommand || "").toLowerCase();
  if (!commandName) return false;

  const command = commands.get(commandName);
  if (!command) return false;

  const ctx = contextFactory({
    msg,
    args,
    commandName,
    senderJid: getSenderJid(msg),
    text,
  });

  if (command.adminOnly && !ctx.isPrivileged(ctx.senderJid)) {
    await ctx.reply("Only admins can use this command.");
    return true;
  }

  try {
    await command.execute(ctx);
  } catch (error) {
    ctx.logger.error({ err: error, message: error?.message || String(error) }, `Command failed: ${commandName}`);
    await ctx.reply("Command execution failed.");
  }

  return true;
}

module.exports = {
  handleCommand,
};
