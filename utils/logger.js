const pino = require("pino");

const logger = pino({
  level: process.env.LOG_LEVEL || "error",
});

module.exports = logger;
