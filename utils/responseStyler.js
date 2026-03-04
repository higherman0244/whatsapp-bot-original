function normalize(text) {
  return String(text || "").toLowerCase();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function vibePrefix(gender = "neutral") {
  const g = String(gender || "neutral").toLowerCase();
  if (g === "male") return pick(["Bro", "Champion", "My guy"]);
  if (g === "female") return pick(["Sis", "Queen", "Star girl"]);
  return pick(["Buddy", "Legend", "Superstar"]);
}

function emojiPack(text) {
  const t = normalize(text);
  if (t.includes("error") || t.includes("failed") || t.includes("issue")) return "⚠️";
  if (t.includes("love") || t.includes("heart")) return "💖";
  if (t.includes("money") || t.includes("profit") || t.includes("sales")) return "💸";
  if (t.includes("code") || t.includes("api") || t.includes("bot")) return "🤖";
  if (t.includes("study") || t.includes("learn") || t.includes("exam")) return "📚";
  return pick(["😄", "🔥", "✨", "🚀"]);
}

function humorTag(text) {
  const t = normalize(text);
  if (t.includes("code") || t.includes("debug")) return "Tiny bug, big drama. Classic coding life 😅";
  if (t.includes("love")) return "Heart logic is stronger than JavaScript logic today 😄";
  if (t.includes("business") || t.includes("sales")) return "Profit first, panic never 😎";
  return pick([
    "Short answer, big results 😎",
    "No long story, just useful gist 😄",
    "Smart move asking that 🔥",
  ]);
}

function styleReply({ text, gender = "neutral", withHumor = true, withEmoji = true }) {
  const base = String(text || "").trim();
  if (!base) return base;
  const prefix = `${vibePrefix(gender)}, `;
  const emoji = withEmoji ? ` ${emojiPack(base)}` : "";
  const humor = withHumor ? `\n\n${humorTag(base)}` : "";
  if (/^(bro|sis|buddy|legend|champion|my guy|queen|star girl|superstar)[,\s]/i.test(base)) {
    return `${base}${emoji}${humor}`;
  }
  return `${prefix}${base}${emoji}${humor}`;
}

module.exports = {
  styleReply,
};
