const qrcode = require("qrcode");
const fs = require("fs");
const path = require("path");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");

const config = require("./config");
const logger = require("./utils/logger");
const Database = require("./utils/database");
const { ensureDir } = require("./utils/fileManager");
const {
  extractText,
  getSenderJid,
  getPhoneNumberFromJid,
  isStatusMessage,
} = require("./utils/helpers");
const { handleCommand } = require("./handlers/commandHandler");
const { registerConnectionHandlers } = require("./handlers/eventHandler");
const { registerGroupHandlers } = require("./handlers/groupHandler");
const { handleStatusMessage } = require("./handlers/statusHandler");
const { handleIntelligence } = require("./handlers/intelligenceHandler");
const { handleNaturalIntent } = require("./handlers/naturalIntentHandler");
const { defaultBrain, normalizeBrain, observeLanguage } = require("./utils/localAi");
const { normalizeUsage, checkBudget, recordUsage } = require("./utils/aiBudget");
const { startDashboardServer } = require("./utils/dashboardServer");

const baseDir = __dirname;
["auth", "database", "media", "media/images", "media/videos", "media/audio", "media/documents", "media/status", "media/saved", "media/temp"].forEach(
  (d) => ensureDir(path.join(baseDir, d))
);

const db = new Database(path.join(baseDir, "database"));
const defaultSettings = {
  autosave: config.autosave,
  autoreply: config.autoreply,
  autoread: config.autoread,
  autoreact: config.autoreact,
  aiEnabled: config.aiEnabled,
  aiOwnerPing: config.aiOwnerPing,
  admins: [],
};

function normalizeSettings(settings) {
  const merged = { ...defaultSettings, ...(settings || {}) };
  if (!Array.isArray(merged.admins)) merged.admins = [];
  return merged;
}

db.ensureFile("users.json", { users: {} });
db.ensureFile("settings.json", defaultSettings);
db.ensureFile("accounts.json", { accounts: ["main"] });
db.ensureFile("logs.json", []);
db.ensureFile("ai_usage.json", normalizeUsage({}));
db.ensureFile("brain.json", defaultBrain());
db.ensureFile("longterm.json", { users: {} });
db.ensureFile("assist_queue.json", { items: [] });
db.ensureFile("security_events.json", []);
db.ensureFile("replies.json", {
  hello: "Hello 👋",
  hi: "Hi 👋",
  thanks: "You're welcome",
});

const state = {
  startTime: Date.now(),
  commands: new Map(),
  commandList: [],
  users: db.read("users.json", { users: {} }).users || {},
  settings: normalizeSettings(db.read("settings.json", {})),
  aiUsage: normalizeUsage(db.read("ai_usage.json", normalizeUsage({}))),
  brain: normalizeBrain(db.read("brain.json", defaultBrain())),
  longterm: db.read("longterm.json", { users: {} }),
  assistQueue: db.read("assist_queue.json", { items: [] }),
  securityEvents: db.read("security_events.json", []),
  brainDirtyCount: 0,
  replies: db.read("replies.json", {}),
  lastMessages: [],
};
const activeBots = new Map();
let dashboardStarted = false;

function persistUsers() {
  db.write("users.json", { users: state.users });
}

function persistSettings() {
  db.write("settings.json", state.settings);
}

if (state.settings.aiEnabled !== true) {
  state.settings.aiEnabled = true;
}

persistSettings();
persistBrain();
persistAIUsage();
persistLongterm();
persistAssistQueue();
persistSecurityEvents();

function persistReplies() {
  db.write("replies.json", state.replies);
}

function persistBrain() {
  db.write("brain.json", state.brain);
}

function persistAIUsage() {
  db.write("ai_usage.json", state.aiUsage);
}

function persistLongterm() {
  db.write("longterm.json", state.longterm);
}

function persistAssistQueue() {
  db.write("assist_queue.json", state.assistQueue);
}

function persistSecurityEvents() {
  db.write("security_events.json", state.securityEvents);
}

function nowIso() {
  return new Date().toISOString();
}

function nextId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function pushSecurityEvent(event) {
  state.securityEvents.push({
    id: nextId("evt"),
    at: nowIso(),
    ...event,
  });
  if (state.securityEvents.length > 5000) {
    state.securityEvents = state.securityEvents.slice(state.securityEvents.length - 5000);
  }
  persistSecurityEvents();
}

function ensureLongtermUser(jid) {
  if (!state.longterm.users[jid]) {
    state.longterm.users[jid] = {
      facts: [],
      nickname: "",
      summary: "",
      updatedAt: nowIso(),
    };
  }
  return state.longterm.users[jid];
}

function addLongtermFact(jid, fact, type = "note") {
  const profile = ensureLongtermUser(jid);
  profile.facts.push({
    id: nextId("fact"),
    type,
    value: String(fact || "").trim(),
    at: nowIso(),
  });
  if (profile.facts.length > 100) profile.facts = profile.facts.slice(profile.facts.length - 100);
  profile.updatedAt = nowIso();
  persistLongterm();
}

function setLongtermNickname(jid, nickname) {
  const profile = ensureLongtermUser(jid);
  profile.nickname = String(nickname || "").trim();
  profile.updatedAt = nowIso();
  persistLongterm();
}

function enqueueAssist(item) {
  const queue = state.assistQueue.items || [];
  const next = {
    id: nextId("assist"),
    status: "pending",
    createdAt: nowIso(),
    ...item,
  };
  queue.push(next);
  if (queue.length > 2000) state.assistQueue.items = queue.slice(queue.length - 2000);
  else state.assistQueue.items = queue;
  persistAssistQueue();
  return next;
}

function resolveAssist(id, status, note = "") {
  const item = (state.assistQueue.items || []).find((x) => x.id === id);
  if (!item) return null;
  item.status = status;
  item.updatedAt = nowIso();
  if (note) item.note = note;
  persistAssistQueue();
  return item;
}

function logEvent(type, payload) {
  db.update("logs.json", [], (entries) => {
    entries.push({
      type,
      at: new Date().toISOString(),
      ...payload,
    });
    if (entries.length > 5000) entries = entries.slice(entries.length - 5000);
    return entries;
  });
}

function loadCommands() {
  if (state.commands.size > 0) return;
  const commandsDir = path.join(baseDir, "commands");
  const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".js"));
  const map = new Map();
  const list = [];

  files.forEach((file) => {
    const mod = require(path.join(commandsDir, file));
    if (!mod?.name || typeof mod.execute !== "function") return;
    map.set(mod.name, mod);
    (mod.aliases || []).forEach((alias) => map.set(alias, mod));
    list.push({ name: mod.name, description: mod.description || "" });
  });

  state.commands = map;
  state.commandList = list;
  logger.info(`Loaded ${list.length} commands`);
}

function normalizeAccountId(value, fallback = "main") {
  const cleaned = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .trim();
  return cleaned || fallback;
}

function normalizePhone(value = "") {
  const digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("2330")) return `233${digits.slice(4)}`;
  return digits;
}

function normalizeJid(value = "") {
  return String(value || "").trim().toLowerCase();
}

function isOwnerJid(jid) {
  const current = normalizeJid(jid);
  const configured = (config.ownerIds || []).map(normalizeJid);
  return configured.includes(current);
}

function isOwnerByPhone(phone) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedOwner = normalizePhone(config.ownerNumber);
  return normalizedPhone && normalizedOwner && normalizedPhone === normalizedOwner;
}

function isOwner(jid) {
  return isOwnerJid(jid) || isOwnerByPhone(getPhoneNumberFromJid(jid));
}

function getOwnerTargets() {
  const out = new Set();
  for (const jid of config.ownerIds || []) {
    const clean = normalizeJid(jid);
    if (clean) out.add(clean);
  }
  const ownerPhone = normalizePhone(config.ownerNumber);
  if (ownerPhone) out.add(`${ownerPhone}@s.whatsapp.net`);
  return [...out];
}

async function notifyOwners(sock, text) {
  const targets = getOwnerTargets();
  for (const jid of targets) {
    try {
      await sock.sendMessage(jid, { text });
    } catch {}
  }
}

function loadAccounts() {
  const configured = db.read("accounts.json", { accounts: ["main"] })?.accounts || [];
  const source = Array.isArray(configured) && configured.length > 0 ? configured : ["main"];
  const unique = [...new Set(source.map((x) => normalizeAccountId(x)).filter(Boolean))];
  if (unique.length === 0) unique.push("main");
  return unique;
}

function updateUserProfile(senderJid) {
  if (!senderJid || senderJid.endsWith("@g.us")) return;
  const phone = getPhoneNumberFromJid(senderJid);
  const existing = state.users[senderJid];
  const now = new Date().toISOString();
  const isAdmin = isOwner(senderJid) || state.settings.admins.includes(senderJid);

  if (!existing) {
    state.users[senderJid] = {
      phone,
      joinDate: now,
      lastSeen: now,
      messageCount: 1,
      gender: "neutral",
      isAdmin,
    };
  } else {
    existing.lastSeen = now;
    existing.messageCount += 1;
    if (!existing.gender) existing.gender = "neutral";
    existing.isAdmin = isAdmin;
  }
  persistUsers();
}

function isPrivileged(jid) {
  return isOwner(jid) || state.settings.admins.includes(jid);
}

function resolveSenderJid(sock, msg) {
  if (msg?.key?.fromMe) {
    const selfId = String(sock?.user?.id || "");
    if (selfId) {
      const base = selfId.split(":")[0];
      if (base.includes("@")) return base;
      return `${base}@s.whatsapp.net`;
    }
  }
  return getSenderJid(msg);
}

function makeContext(sock, msg, args, commandName, accountId) {
  const senderJid = resolveSenderJid(sock, msg);
  const chatJid = msg.key.remoteJid;
  return {
    sock,
    msg,
    args,
    commandName,
    chatJid,
    senderJid,
    senderPhone: getPhoneNumberFromJid(senderJid),
    state,
    commands: state.commands,
    config,
    baseDir,
    accountId,
    logger,
    db,
    logEvent,
    persistSettings,
    persistReplies,
    persistBrain,
    persistAIUsage,
    persistLongterm,
    persistAssistQueue,
    persistSecurityEvents,
    persistUsers,
    isPrivileged,
    isOwner,
    addLongtermFact,
    setLongtermNickname,
    enqueueAssist,
    resolveAssist,
    pushSecurityEvent,
    notifyOwners: async (text) => notifyOwners(sock, text),
    checkAIBudget: () => {
      const result = checkBudget(state.aiUsage, config);
      state.aiUsage = result.usage;
      persistAIUsage();
      return result;
    },
    recordAIBudget: (apiUsage) => {
      state.aiUsage = recordUsage(state.aiUsage, apiUsage);
      persistAIUsage();
    },
    reply: async (text) => {
      await sock.sendMessage(chatJid, { text }, { quoted: msg });
    },
  };
}

async function startBot(accountId) {
  const account = normalizeAccountId(accountId);
  if (activeBots.has(account)) return;
  activeBots.set(account, { starting: true });

  try {
    loadCommands();
    const authDir = path.join(baseDir, "auth", account);
    ensureDir(authDir);
    const { state: authState, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      auth: authState,
      version,
      printQRInTerminal: true,
      logger,
      markOnlineOnConnect: false,
      browser: ["NANA ADDO'S BOT", "NANA ADDO'S BOT", config.version],
    }); 

    activeBots.set(account, { sock, startedAt: Date.now() });
    
    registerConnectionHandlers({
      sock,
      state: { saveCreds },
      logger,
      reconnect: async () => {
        activeBots.delete(account);
        await startBot(account);
      },
    });

    registerGroupHandlers({ sock, logger, logEvent });

    sock.ev.on("messages.update", async (updates) => {
      for (const update of updates || []) {
        try {
          const remoteJid = update?.key?.remoteJid || "";
          const participant = update?.key?.participant || "";
          const isDelete =
            Number(update?.update?.messageStubType || 0) === 1 ||
            Boolean(update?.update?.messageStubParameters);
          if (!isDelete) continue;

          pushSecurityEvent({
            type: "message_delete",
            chat: remoteJid,
            sender: participant || remoteJid,
          });
          await notifyOwners(
            sock,
            `🛡 Deleted message detected\nChat: ${remoteJid}\nSender: ${participant || remoteJid}`
          );
        } catch {}
      }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
      for (const msg of messages || []) {
        try {
          if (!msg.message) continue;
          const text = extractText(msg.message);
          const isSelfCommand = Boolean(
            msg.key.fromMe && text && text.startsWith(config.commandPrefix)
          );
          if (msg.key.fromMe && !isSelfCommand) continue;

         const senderJid = resolveSenderJid(sock, msg);
          updateUserProfile(senderJid);

          const hasViewOnce =
            Boolean(msg.message?.viewOnceMessageV2) ||
            Boolean(msg.message?.viewOnceMessage) ||
            Boolean(msg.message?.viewOnceMessageV2Extension);
          if (hasViewOnce) {
            pushSecurityEvent({
              type: "view_once",
              chat: msg.key.remoteJid,
              sender: senderJid,
            });
            await notifyOwners(
              sock,
              `⚠️ View-once message detected\nChat: ${msg.key.remoteJid}\nSender: ${senderJid}`
            );
            await sock.sendMessage(msg.key.remoteJid, {
              text: "⚠️ View-once message detected. Please open it manually and respect privacy.",
            });
          }

          if (state.settings.autoread) {
            await sock.readMessages([msg.key]);
          }

          logEvent("message", {
            sender: senderJid,
            chat: msg.key.remoteJid,
            text,
          });

          if (text) {
            const learning = observeLanguage(state.brain, {
              text,
              chatId: msg.key.remoteJid,
              userId: senderJid,
            });
            if (learning.changed) {
              state.brain = learning.brain;
              state.brainDirtyCount += 1;
              if (learning.learnedSlang || state.brainDirtyCount >= 8) {
                persistBrain();
                state.brainDirtyCount = 0;
              }
            }

            const lower = text.toLowerCase().trim();
            if (lower.startsWith("call me ")) {
              const nick = text.slice(8).trim();
              if (nick) setLongtermNickname(senderJid, nick);
            }
            if (/\b(my birthday is|i like|my favorite|remember that)\b/i.test(text)) {
              addLongtermFact(senderJid, text, "user_fact");
            }
          }

          if (isStatusMessage(msg)) {
            await handleStatusMessage({
              msg,
              baseDir,
              settings: state.settings,
              logEvent,
            });
            continue;
          }

          const ctxFactory = ({ args, commandName }) =>
            makeContext(sock, msg, args, commandName, account);
          const handled = await handleCommand({
            msg,
            commands: state.commands,
            prefix: config.commandPrefix,
            contextFactory: ctxFactory,
          });
          if (handled) continue;
          if (msg.key.fromMe) continue;

          if (text) {
            const intentHandled = await handleNaturalIntent({
              text,
              context: makeContext(sock, msg, [], "", account),
            });
            if (intentHandled) continue;
          }

          await handleIntelligence({
            msg,
            text,
            context: makeContext(sock, msg, [], "", account),
            baseDir,
            settings: state.settings,
            replies: state.replies,
            logEvent,
          });
        } catch (error) {
          const message = error?.message || String(error);
          logger.error({ err: error, message, account }, "Message handling error");
          logEvent("errors", { message, stack: error?.stack || null, account });
        }
      }
    });
  } catch (error) {
    activeBots.delete(account);
    throw error;
  }
}

async function startAllBots() {
  if (config.dashboardEnabled && !dashboardStarted) {
    startDashboardServer({
      state,
      config,
      logger,
      persistBrain,
      persistSettings,
      persistLongterm,
      persistAssistQueue,
      persistSecurityEvents,
      checkBudget: () => {
        const result = checkBudget(state.aiUsage, config);
        state.aiUsage = result.usage;
        persistAIUsage();
        return result;
      },
      recordBudget: (apiUsage) => {
        state.aiUsage = recordUsage(state.aiUsage, apiUsage);
        persistAIUsage();
      },
      resolveAssist,
      sendAssistReply: async ({ assistId, replyText }) => {
        const item = (state.assistQueue.items || []).find((x) => x.id === assistId);
        if (!item) return { ok: false, error: "Assist item not found." };
        const targetAccount = item.accountId || "main";
        const bot = activeBots.get(targetAccount) || activeBots.get("main");
        if (!bot?.sock) return { ok: false, error: "No active socket available." };
        await bot.sock.sendMessage(item.chatJid, { text: replyText });
        const updated = resolveAssist(assistId, "sent", "Sent from dashboard");
        return { ok: true, item: updated };
      },
    });
    dashboardStarted = true;
  }

  const accounts = loadAccounts();
  logger.error({ accounts }, "Starting WhatsApp accounts");
  for (const account of accounts) {
    try {
      await startBot(account);
    } catch (error) {
      const message = error?.message || String(error);
      logger.error({ err: error, message, account }, "Account startup error");
    }
  }
}

startAllBots().catch((error) => {
  const message = error?.message || String(error);
  logger.error({ err: error, message }, "Fatal startup error");
  process.exit(1);
});
