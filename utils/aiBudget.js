function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

function emptyCounter() {
  return {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
}

function normalizeUsage(raw) {
  const usage = raw || {};
  const day = usage.day || todayKey();
  const month = usage.month || monthKey();
  const daily = { ...emptyCounter(), ...(usage.daily || {}) };
  const monthly = { ...emptyCounter(), ...(usage.monthly || {}) };
  return { day, month, daily, monthly };
}

function rotateUsage(usage) {
  const next = normalizeUsage(usage);
  const nowDay = todayKey();
  const nowMonth = monthKey();
  if (next.day !== nowDay) {
    next.day = nowDay;
    next.daily = emptyCounter();
  }
  if (next.month !== nowMonth) {
    next.month = nowMonth;
    next.monthly = emptyCounter();
  }
  return next;
}

function getCap(configValue, fallback) {
  const n = Number(configValue);
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return 0;
  return n;
}

function checkBudget(usage, config) {
  const rotated = rotateUsage(usage);
  if (!config.aiBudgetEnabled) {
    return { allowed: true, usage: rotated };
  }

  const dailyRequestCap = getCap(config.aiDailyRequestCap, 120);
  const dailyTokenCap = getCap(config.aiDailyTokenCap, 120000);
  const monthlyRequestCap = getCap(config.aiMonthlyRequestCap, 3000);
  const monthlyTokenCap = getCap(config.aiMonthlyTokenCap, 2500000);

  if (dailyRequestCap > 0 && rotated.daily.requests >= dailyRequestCap) {
    return { allowed: false, usage: rotated, message: "AI paused: daily request limit reached." };
  }
  if (dailyTokenCap > 0 && rotated.daily.totalTokens >= dailyTokenCap) {
    return { allowed: false, usage: rotated, message: "AI paused: daily token limit reached." };
  }
  if (monthlyRequestCap > 0 && rotated.monthly.requests >= monthlyRequestCap) {
    return { allowed: false, usage: rotated, message: "AI paused: monthly request limit reached." };
  }
  if (monthlyTokenCap > 0 && rotated.monthly.totalTokens >= monthlyTokenCap) {
    return { allowed: false, usage: rotated, message: "AI paused: monthly token limit reached." };
  }
  return { allowed: true, usage: rotated };
}

function toInt(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function recordUsage(usage, apiUsage = {}) {
  const next = rotateUsage(usage);
  const inputTokens = toInt(apiUsage.input_tokens);
  const outputTokens = toInt(apiUsage.output_tokens);
  const totalTokens = toInt(apiUsage.total_tokens || inputTokens + outputTokens);

  next.daily.requests += 1;
  next.daily.inputTokens += inputTokens;
  next.daily.outputTokens += outputTokens;
  next.daily.totalTokens += totalTokens;

  next.monthly.requests += 1;
  next.monthly.inputTokens += inputTokens;
  next.monthly.outputTokens += outputTokens;
  next.monthly.totalTokens += totalTokens;

  return next;
}

module.exports = {
  emptyCounter,
  normalizeUsage,
  rotateUsage,
  checkBudget,
  recordUsage,
};
