const fs = require("fs");
const path = require("path");

class Database {
  constructor(basePath) {
    this.basePath = basePath;
  }

  file(name) {
    return path.join(this.basePath, name);
  }

  ensureFile(name, defaultData) {
    const target = this.file(name);
    if (!fs.existsSync(target)) {
      fs.writeFileSync(target, JSON.stringify(defaultData, null, 2), "utf-8");
    }
  }

  read(name, fallback) {
    const target = this.file(name);
    try {
      const raw = fs.readFileSync(target, "utf-8");
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  write(name, data) {
    fs.writeFileSync(this.file(name), JSON.stringify(data, null, 2), "utf-8");
  }

  update(name, fallback, updater) {
    const current = this.read(name, fallback);
    const next = updater(current);
    this.write(name, next);
    return next;
  }
}

module.exports = Database;
