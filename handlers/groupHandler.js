async function registerGroupHandlers({ sock, logger, logEvent }) {
  sock.ev.on("group-participants.update", async (event) => {
    const { id, participants, action } = event;
    logEvent("group", { id, participants, action });
    logger.info({ id, participants, action }, "Group participant update");
  });
}

module.exports = {
  registerGroupHandlers,
};
