"use strict";
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");
const { ASSET_NAME, MAX_ASSET, inside, storageDir, readSnapshot, readHistory, releasedHistory } = require("./game-releases-store");

function blockPrivateStatic(req, res, next) {
  let pathname;
  try { pathname = path.posix.normalize(decodeURIComponent(req.path).replace(/\\/g, "/")).toLowerCase(); }
  catch { return res.sendStatus(400); }
  if (/^\/(server|scripts|test-results)(\/|$)/.test(pathname)) return res.sendStatus(404);
  next();
}
function createGameReleasesRouter({ dataDir, now = () => new Date() } = {}) {
  const router = express.Router();
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
  router.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.method !== "GET" && req.method !== "HEAD") { res.setHeader("Allow", "GET, HEAD"); return res.status(405).json({ error: "此接口仅供读取；发布只能在服务器本地执行" }); }
    next();
  });
  router.get("/", async (req, res) => {
    try {
      const data = await snapshot();
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("ETag", '"' + (data.revision || "empty") + '"');
      res.json(data);
    } catch { res.status(503).json({ error: "发售清单暂时无法读取，请稍后重试" }); }
  });
  router.get("/archive", async (_req, res) => {
    try {
      const data = await archive();
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("ETag", '"' + data.revision + '"');
      res.json(data);
    } catch { res.status(503).json({ error: "往期发售记录暂时无法读取，请稍后重试" }); }
  });
  router.get("/assets/:name", async (req, res) => {
    try {
      const name = req.params.name;
      if (!ASSET_NAME.test(name)) return res.sendStatus(404);
      const data = await snapshot(), url = "/api/game-releases/assets/" + name;
      if (data.weeklyPoster !== url && !data.items.some(item => item.cover === url) && !(await archive()).items.some(item => item.cover === url)) return res.sendStatus(404);
      const dir = await directory, root = await fs.realpath(path.join(dir, "assets"));
      const file = await fs.realpath(path.join(root, name));
      if (!inside(dir, root) || !inside(root, file)) return res.sendStatus(404);
      const stat = await fs.stat(file);
      if (!stat.isFile() || stat.size > MAX_ASSET) return res.sendStatus(404);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      res.type(name.endsWith(".jpg") ? "jpeg" : path.extname(name).slice(1));
      res.sendFile(name, { root, dotfiles: "deny" }, error => { if (error && !res.headersSent) res.sendStatus(404); });
    } catch { if (!res.headersSent) res.sendStatus(404); }
  });
  router.use((_req, res) => res.sendStatus(404));
  return router;
}
module.exports = { createGameReleasesRouter, blockPrivateStatic };
