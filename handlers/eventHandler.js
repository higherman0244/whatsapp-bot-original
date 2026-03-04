const { DisconnectReason } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");

function registerConnectionHandlers({ sock, state, logger, reconnect }) {
  let reconnectTimer = null;

  const scheduleReconnect = (delayMs) => {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      try {
        await reconnect();
      } catch (error) {
        logger.error({ err: error, message: error?.message || String(error) }, "Reconnect failed");
      }
    }, delayMs);
  };

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) qrcode.generate(qr, { small: true });

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      logger.warn({ statusCode }, "Connection closed");
      if (shouldReconnect) {
        const isReplaced = statusCode === DisconnectReason.connectionReplaced;
        if (isReplaced) {
          logger.warn("Session was replaced. Reconnecting with backoff.");
        }
        scheduleReconnect(isReplaced ? 5000 : 2000);
      }
    } else if (connection === "open") {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      logger.info("WhatsApp connection opened");
    }
  });

  sock.ev.on("creds.update", state.saveCreds);
}

module.exports = {
  registerConnectionHandlers,
};
