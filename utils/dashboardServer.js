const fs = require("fs");
const path = require("path");
const http = require("http");
const { askSmartAI } = require("./smartAi");

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(text);
}

function topActiveUsers(users, limit = 8) {
  return Object.entries(users || {})
    .map(([jid, info]) => ({
      jid,
      messageCount: Number(info?.messageCount || 0),
      lastSeen: info?.lastSeen || null,
      isAdmin: Boolean(info?.isAdmin),
      gender: info?.gender || "neutral",
    }))
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, limit);
}

function recentMemory(lastMessages, limit = 25) {
  return (lastMessages || [])
    .slice(-limit)
    .map((x) => ({
      at: x?.at || Date.now(),
      sender: x?.sender || "",
      remoteJid: x?.remoteJid || "",
      text: String(x?.text || ""),
      type: x?.type || "",
    }));
}

function escapeCsv(value) {
  const raw = String(value ?? "");
  const escaped = raw.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const keys = [...new Set(rows.flatMap((x) => Object.keys(x || {})))];
  const head = keys.map(escapeCsv).join(",");
  const body = rows
    .map((row) => keys.map((k) => escapeCsv(row[k])).join(","))
    .join("\n");
  return `${head}\n${body}`;
}

function isAuthorized(req, config) {
  if (!config.dashboardAuthRequired) return true;
  const expected = String(config.dashboardToken || "").trim();
  if (!expected) return false;
  const token = String(req.headers["x-dashboard-token"] || "").trim();
  return token === expected;
}

function readHtml() {
  const htmlPath = path.join(__dirname, "..", "dashboard", "index.html");
  if (!fs.existsSync(htmlPath)) return "<h1>Dashboard missing</h1>";
  return fs.readFileSync(htmlPath, "utf-8");
}

function filterThread(lastMessages, jid, q) {
  const lowerQ = String(q || "").toLowerCase();
  return (lastMessages || [])
    .filter((m) => (jid ? m.remoteJid === jid || m.sender === jid : true))
    .filter((m) => (lowerQ ? String(m.text || "").toLowerCase().includes(lowerQ) : true))
    .slice(-200);
}

function getExportData(type, state) {
  if (type === "memory") return state.lastMessages || [];
  if (type === "assist") return state.assistQueue?.items || [];
  if (type === "events") return state.securityEvents || [];
  if (type === "longterm") return Object.entries(state.longterm?.users || {}).map(([jid, data]) => ({ jid, ...data }));
  return [];
}

function startDashboardServer({
  state,
  config,
  logger,
  persistBrain,
  persistSettings,
  checkBudget,
  recordBudget,
  sendAssistReply,
  resolveAssist,
}) {
  const server = http.createServer(async (req, res) => {
    const method = req.method || "GET";
    const url = req.url || "/";

    if (method === "GET" && url === "/") {
      return sendText(res, 200, readHtml(), "text/html; charset=utf-8");
    }

    if (!isAuthorized(req, config)) {
      return sendJson(res, 401, { error: "Unauthorized dashboard token." });
    }

    if (method === "GET" && url === "/api/stats") {
      return sendJson(res, 200, {
        aiUsage: state.aiUsage,
        brain: state.brain,
        settings: state.settings,
        memoryCount: (state.lastMessages || []).length,
        topUsers: topActiveUsers(state.users, 12),
        startedAt: state.startTime,
      });
    }

    if (method === "GET" && url.startsWith("/api/memory")) {
      let limit = 25;
      try {
        const reqUrl = new URL(url, "http://localhost");
        const parsed = Number(reqUrl.searchParams.get("limit"));
        if (Number.isFinite(parsed) && parsed > 0) limit = Math.min(300, Math.floor(parsed));
      } catch {}
      return sendJson(res, 200, {
        total: (state.lastMessages || []).length,
        recent: recentMemory(state.lastMessages, limit),
        topUsers: topActiveUsers(state.users, 20),
        longterm: state.longterm?.users || {},
      });
    }

    if (method === "GET" && url.startsWith("/api/thread")) {
      const reqUrl = new URL(url, "http://localhost");
      const jid = reqUrl.searchParams.get("jid") || "";
      const q = reqUrl.searchParams.get("q") || "";
      const rows = filterThread(state.lastMessages, jid, q);
      return sendJson(res, 200, { count: rows.length, rows });
    }

    if (method === "GET" && url.startsWith("/api/events")) {
      const reqUrl = new URL(url, "http://localhost");
      const type = reqUrl.searchParams.get("type") || "";
      const rows = (state.securityEvents || [])
        .filter((x) => (type ? x.type === type : true))
        .slice(-300);
      return sendJson(res, 200, { count: rows.length, rows });
    }

    if (method === "GET" && url.startsWith("/api/assist")) {
      const reqUrl = new URL(url, "http://localhost");
      const status = reqUrl.searchParams.get("status") || "pending";
      const rows = (state.assistQueue?.items || [])
        .filter((x) => (status === "all" ? true : x.status === status))
        .slice(-300)
        .reverse();
      return sendJson(res, 200, { count: rows.length, rows });
    }

    if (method === "POST" && url === "/api/assist/send") {
      const body = await readJsonBody(req);
      const id = String(body.id || "");
      const replyText = String(body.replyText || "").trim();
      if (!id || !replyText) return sendJson(res, 400, { error: "id and replyText are required." });
      try {
        const result = await sendAssistReply({ assistId: id, replyText });
        if (!result.ok) return sendJson(res, 400, result);
        return sendJson(res, 200, result);
      } catch (error) {
        logger.error({ err: error, message: error?.message || String(error) }, "Assist send failed");
        return sendJson(res, 500, { error: "Assist send failed." });
      }
    }

    if (method === "POST" && url === "/api/assist/reject") {
      const body = await readJsonBody(req);
      const id = String(body.id || "");
      if (!id) return sendJson(res, 400, { error: "id is required." });
      const item = resolveAssist(id, "rejected", "Rejected from dashboard");
      if (!item) return sendJson(res, 404, { error: "Assist item not found." });
      return sendJson(res, 200, { ok: true, item });
    }

    if (method === "GET" && url.startsWith("/api/export")) {
      const reqUrl = new URL(url, "http://localhost");
      const type = String(reqUrl.searchParams.get("type") || "memory");
      const format = String(reqUrl.searchParams.get("format") || "json").toLowerCase();
      const rows = getExportData(type, state);
      if (format === "csv") {
        const csv = toCsv(rows);
        return sendText(res, 200, csv, "text/csv; charset=utf-8");
      }
      return sendJson(res, 200, { type, count: rows.length, rows });
    }

    if (method === "POST" && (url === "/api/ask" || url === "/api/chat")) {
      const body = await readJsonBody(req);
      const prompt = String(body.prompt || "").trim();
      if (!prompt) return sendJson(res, 400, { error: "Prompt is required" });
      try {
        const result = await askSmartAI({
          prompt,
          state,
          config,
          chatId: "dashboard",
          userId: "dashboard",
          checkAIBudget: checkBudget,
          recordAIBudget: recordBudget,
          persistBrain,
          allowWebSearch: true,
        });
        return sendJson(res, 200, result);
      } catch (error) {
        logger.error({ err: error, message: error?.message || String(error) }, "Dashboard ask failed");
        return sendJson(res, 500, { error: "Ask failed" });
      }
    }

    sendJson(res, 404, { error: "Not found" });
  });

  server.listen(config.dashboardPort, () => {
    logger.error(
      { port: config.dashboardPort, auth: config.dashboardAuthRequired ? "token" : "disabled" },
      "AI dashboard started"
    );
  });

  return server;
}

module.exports = {
  startDashboardServer,
};
