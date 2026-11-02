"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const { storageDir, readSnapshot, readHistory, releasedHistory } = require("./game-releases-store");
function createReleaseReader({ dataDir, now = () => new Date() } = {}) {
  let cached, cachedKey, pending;
  let historyCache, historyKey, historyPending;
  const directory = storageDir(dataDir);
  // Avoid a rejected initialization promise becoming unhandled before the first request.
  directory.catch(() => {});
  async function snapshot() {
    const dir = await directory;
    let key;
    try { const stat = await fs.stat(path.join(dir, "current.json")); key = [stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs].join(":"); }
    catch (error) { if (error.code !== "ENOENT") throw error; key = "empty"; }
    if (cached && cachedKey === key) return cached;
    if (!pending) pending = readSnapshot(dir).then(value => { cached = value; cachedKey = key; return value; }).finally(() => { pending = null; });
    return pending;
  }
  async function archive() {
    const dir = await directory;
    const stamps = await Promise.all(["current.json", "previous.json", "history"].map(async name => {
      try { const stat = await fs.stat(path.join(dir, name)); return [stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs].join(":"); }
      catch (error) { if (error.code === "ENOENT") return "empty"; throw error; }
    }));
    const key = stamps.join("|");
    if (!historyCache || historyKey !== key) {
      if (!historyPending) historyPending = readHistory(dir).then(value => { historyCache = value; historyKey = key; return value; }).finally(() => { historyPending = null; });
      return releasedHistory(await historyPending, now());
    }
    return releasedHistory(historyCache, now());
  }
  return { snapshot, archive, directory, now };
}
module.exports = { createReleaseReader };
