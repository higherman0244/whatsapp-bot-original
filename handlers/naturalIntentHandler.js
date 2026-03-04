const FEATURE_ALIASES = {
  aiEnabled: ["ai", "assistant", "brain", "smart ai"],
  autosave: ["autosave", "auto save", "save media", "save"],
  autoread: ["autoread", "auto read", "read"],
  autoreact: ["autoreact", "auto react", "react"],
};

function labelFeature(key) {
  if (key === "aiEnabled") return "AI";
  if (key === "autosave") return "Auto Save";
  if (key === "autoread") return "Auto Read";
  if (key === "autoreact") return "Auto React";
  return key;
}

function extractFeatures(text) {
  const lower = String(text || "").toLowerCase();
  if (/\b(all|everything|all features)\b/.test(lower)) {
    return Object.keys(FEATURE_ALIASES);
  }
  const keys = [];
  for (const [key, aliases] of Object.entries(FEATURE_ALIASES)) {
    if (aliases.some((alias) => lower.includes(alias))) keys.push(key);
  }
  return [...new Set(keys)];
}

function settingsSummary(settings) {
  return Object.keys(FEATURE_ALIASES)
    .map((key) => `${labelFeature(key)}: ${settings[key] ? "ON" : "OFF"}`)
    .join("\n");
}

async function handleNaturalIntent({ text, context }) {
  const input = String(text || "").trim();
  const lower = input.toLowerCase();
  if (!input) return false;

  if (/\b(help|what can you do|menu|commands)\b/.test(lower)) {
    await context.reply(
      [
        "I work in normal conversation mode now.",
        "Examples:",
        "- turn on ai",
        "- show settings",
        "- show status",
        "- ask me anything",
      ].join("\n")
    );
    return true;
  }

  if (/\b(show settings|settings|show status|status)\b/.test(lower)) {
    await context.reply(`Current settings:\n${settingsSummary(context.state.settings)}`);
    return true;
  }

  const wantsEnable = /\b(enable|turn on|activate|start)\b/.test(lower);
  const wantsDisable = /\b(disable|turn off|deactivate|stop)\b/.test(lower);
  if (wantsEnable || wantsDisable) {
    const keys = extractFeatures(lower);
    if (!keys.length) return false;

    const isAdmin = context.isPrivileged(context.senderJid);
    const nonAiKeys = keys.filter((k) => k !== "aiEnabled");
    if (!isAdmin && nonAiKeys.length > 0) {
      await context.reply("Only admins can change settings other than AI.");
      return true;
    }

    for (const key of keys) context.state.settings[key] = wantsEnable;
    context.persistSettings();
    await context.reply(`${wantsEnable ? "Enabled" : "Disabled"}: ${keys.map(labelFeature).join(", ")}`);
    return true;
  }

  return false;
}

module.exports = {
  handleNaturalIntent,
};
