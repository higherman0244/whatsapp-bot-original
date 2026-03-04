const RIZZ_BANK = {
  smooth: [
    "Are you a Wi-Fi signal? Because I feel a strong connection.",
    "You must be a keyboard, because you're just my type.",
    "If charm was code, you'd be my favorite function.",
    "You walked in and my whole timeline improved.",
    "You're the kind of energy that upgrades a whole day.",
    "If I had one wish, I'd spend all my good moments with you.",
    "You make ordinary days feel premium.",
    "You are the best part of every conversation.",
    "You don't need a filter; you are the highlight already.",
    "Even my best lines sound better when they are about you.",
    "If smiles had a source code, yours would be perfect.",
    "You make calm feel exciting.",
    "You're my favorite notification.",
    "You make simple things look magical.",
    "You turn timing into destiny.",
    "If confidence had a face, it would look a lot like you.",
    "You are effortlessly unforgettable.",
    "You are the reason good moods exist.",
    "Every room improves when you enter it.",
    "You are elegant and dangerous at the same time.",
  ],
  cute: [
    "You are cuter than my favorite song.",
    "You make my heart do happy coding.",
    "Your smile should be protected by law.",
    "You look like comfort and sunshine.",
    "I hope your day is as sweet as your vibe.",
    "You are the human version of a perfect morning.",
    "You're too adorable for one timeline.",
    "If joy had a face, it would look like you.",
    "Your energy is pure soft power.",
    "You make kind look cool.",
    "You bring peace and butterflies at the same time.",
    "You make normal moments feel special.",
    "You are a whole warm hug in human form.",
    "Everything about you feels like home.",
    "You are soft spoken and loud in beauty.",
  ],
  bold: [
    "Let's skip the small talk. You and I would be iconic.",
    "You are exactly the kind of person people write songs about.",
    "I don't chase often, but for you I'd sprint.",
    "You're not my type. You're my upgrade.",
    "You're dangerous in the best possible way.",
    "If confidence is attractive, we're both in trouble.",
    "You bring pressure in a very beautiful way.",
    "You are the main character and I noticed immediately.",
    "One look from you and my focus is gone.",
    "You don't need to flirt; your presence already wins.",
    "I'm trying to be calm, but you are making that impossible.",
    "You're the reason eye contact feels risky.",
    "Your aura is premium and I am not pretending otherwise.",
    "You look like a beautiful bad decision.",
    "You're way too fine for this app.",
  ],
};

const LOVE_BANK = {
  advice: [
    "Real love is respect, patience, and showing up consistently.",
    "Love grows best where communication is honest and kind.",
    "The right person brings peace, not confusion.",
    "Love is not just words; it's daily actions.",
    "Care, trust, and effort make love last.",
    "Healthy love has boundaries and emotional safety.",
    "Choose the person who chooses you clearly.",
    "Consistency beats intensity every time.",
    "Love should feel secure, not exhausting.",
    "Apologies matter, but changed behavior matters more.",
    "Good love is teamwork, not competition.",
    "Clarity is kinder than mixed signals.",
    "Mutual effort is the real love language.",
    "Love deepens where honesty is protected.",
    "Respect is the backbone of any lasting relationship.",
  ],
  soft: [
    "You deserve a love that feels gentle and certain.",
    "May your heart find someone who listens with care.",
    "You are worthy of patient, honest love.",
    "Love should feel like home, not a battlefield.",
    "May your person choose you loudly and daily.",
    "The best love lets you be fully yourself.",
    "You deserve tenderness without confusion.",
    "Your heart is not too much for the right one.",
    "Being loved right should not feel like guessing.",
    "You deserve loyalty and peace together.",
  ],
  heartbreak: [
    "Healing is not linear. Be kind to yourself while you rebuild.",
    "Missing someone does not always mean they were right for you.",
    "Protect your peace even when your heart is loud.",
    "Closure is often a decision, not a message.",
    "You can love someone and still choose yourself.",
    "Heartbreak is painful, but it can also reset your standards.",
    "Take your time. Soft hearts recover with patience.",
    "Grief and growth can happen at the same time.",
    "You are not hard to love. You were just in the wrong place.",
    "One day this pain will become wisdom.",
  ],
};

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function normalize(text) {
  return String(text || "").toLowerCase().trim();
}

function pickBank(bank, style, fallback) {
  const key = normalize(style);
  if (bank[key] && bank[key].length) return bank[key];
  return bank[fallback];
}

function getRizzLoveReply(text) {
  const t = normalize(text);
  if (!t) return null;

  const asksRizz =
    t.includes("rizz") ||
    t.includes("pick up line") ||
    t.includes("pickup line") ||
    t.includes("flirt") ||
    t.includes("line for crush");
  if (asksRizz) {
    const style = t.includes("cute") ? "cute" : t.includes("bold") ? "bold" : "smooth";
    return styleReply({
      text: randomFrom(pickBank(RIZZ_BANK, style, "smooth")),
      gender: "neutral",
      withHumor: true,
      withEmoji: true,
    });
  }

  const asksLove =
    t.includes("love me") ||
    t.includes("i love you") ||
    t.includes("talk about love") ||
    t.includes("relationship advice") ||
    t.includes("heartbreak") ||
    t.includes("breakup");
  if (asksLove) {
    let style = "advice";
    if (t.includes("heartbreak") || t.includes("breakup")) style = "heartbreak";
    if (t.includes("soft")) style = "soft";
    return styleReply({
      text: randomFrom(pickBank(LOVE_BANK, style, "advice")),
      gender: "neutral",
      withHumor: true,
      withEmoji: true,
    });
  }

  return null;
}

function makeRizz(name = "", style = "smooth") {
  const line = randomFrom(pickBank(RIZZ_BANK, style, "smooth"));
  const base = !name ? line : `${name}, ${line}`;
  return styleReply({ text: base, gender: "neutral", withHumor: true, withEmoji: true });
}

function makeLove(name = "", style = "advice") {
  const line = randomFrom(pickBank(LOVE_BANK, style, "advice"));
  const base = !name ? line : `${name}, ${line}`;
  return styleReply({ text: base, gender: "neutral", withHumor: true, withEmoji: true });
}

module.exports = {
  getRizzLoveReply,
  makeRizz,
  makeLove,
};
const { styleReply } = require("../utils/responseStyler");
