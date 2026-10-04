"use strict";

// No network requests and no HTTP mutation surface. Only the local CLI publishes.
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const net = require("node:net");
const zlib = require("node:zlib");
const { constants } = require("node:fs");
const STATIC_DIR = path.resolve(__dirname, "..");
const DEFAULT_DATA_DIR = path.resolve(__dirname, "../../.game-release-data");
const PLATFORMS = ["PC", "PS5", "Xbox Series X|S", "Switch 2", "iOS", "Android"];
const ASSET_NAME = /^[a-f0-9]{64}\.(png|jpg|webp)$/;
const MAX_JSON = 256 * 1024;
const MAX_ASSET = 40 * 1024 * 1024;
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
function fail(message) { throw new Error(message); }
function text(value, max, label) {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/.test(value)) fail(`${label} 无效`);
  return value.trim();
}
function isoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail("日期必须为 YYYY-MM-DD");
  const date = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail("日期不存在");
  return value;
}
function addDays(date, days) {
  return new Date(new Date(isoDate(date) + "T00:00:00Z").getTime() + days * 86400000).toISOString().slice(0, 10);
}
function today(now = new Date(), timeZone = "Asia/Shanghai") {
  return new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
function sourceUrl(value) {
  const raw = text(value, 1200, "来源链接");
  let url;
  try { url = new URL(raw); } catch { fail("来源链接无效"); }
  const host = url.hostname.toLowerCase().replace(/\.+$/, "");
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || net.isIP(host.replace(/^\[|\]$/g, "")) || !host.includes(".") || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)) fail("来源必须是公网 HTTPS 链接");
  return url.href;
}
function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative));
}
async function canonicalPath(target) {
  let existing = path.resolve(target);
  const suffix = [];
  while (true) {
    try { return path.resolve(await fs.realpath(existing), ...suffix.reverse()); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = path.dirname(existing);
      if (parent === existing) throw error;
      suffix.push(path.basename(existing)); existing = parent;
    }
  }
}
async function storageDir(value = process.env.GAME_RELEASE_DATA_DIR || DEFAULT_DATA_DIR) {
  const dir = await canonicalPath(value);
  if (inside(await fs.realpath(STATIC_DIR), dir)) fail("发售数据目录必须位于 claudeOne 静态目录之外");
  try {
    const stat = await fs.stat(dir);
    if (!stat.isDirectory() || (process.platform !== "win32" && (stat.mode & 0o002))) fail("数据目录无效或允许其他用户写入；请由管理员配置私有目录权限");
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  return dir;
}
async function readLimited(file, limit = MAX_JSON) {
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit) fail("文件类型或大小超出限制");
    if (process.platform !== "win32" && (stat.mode & 0o002)) fail("拒绝读取允许其他用户写入的文件");
    const result = await handle.readFile();
    if (result.length > limit) fail("文件大小超出限制");
    return result;
  } finally { await handle.close(); }
}
async function readJson(file) { return JSON.parse((await readLimited(file)).toString("utf8")); }
function assetUrl(name) { if (!ASSET_NAME.test(name)) fail("资源文件名无效"); return "/api/game-releases/assets/" + name; }
function validAssetUrl(value) {
  if (typeof value !== "string" || !value.startsWith("/api/game-releases/assets/") || !ASSET_NAME.test(value.slice(26))) fail("资源地址无效");
  return value;
}
function validateSnapshot(raw, { checkRevision = true } = {}) {
  if (raw?.schemaVersion !== 1 || !/^[a-f0-9]{64}$/.test(raw.revision || "")) fail("数据版本无效");
  const date = isoDate(raw.date), windowEnd = isoDate(raw.windowEnd);
  if (windowEnd !== addDays(date, 56) || typeof raw.generatedAt !== "string" || !Number.isFinite(Date.parse(raw.generatedAt))) fail("数据时间无效");
  text(raw.timeZone, 80, "时区"); today(new Date(), raw.timeZone);
  if (!Array.isArray(raw.items) || raw.items.length < 10 || raw.items.length > 15) fail("清单必须为 10–15 条");
  const ids = new Set(), covers = new Set(); let previous = date;
  const items = raw.items.map(item => {
    const releaseDate = isoDate(item.releaseDate);
    if (releaseDate < previous || releaseDate > windowEnd) fail("游戏日期超出窗口或顺序错误");
    previous = releaseDate;
    if (!/^[a-f0-9]{24}$/.test(item.id || "") || ids.has(item.id)) fail("重复或无效游戏 ID"); ids.add(item.id);
    if (!Array.isArray(item.platforms) || !item.platforms.length || item.platforms.length > 6 || new Set(item.platforms).size !== item.platforms.length || item.platforms.some(p => !PLATFORMS.includes(p))) fail("平台无效");
    if (!Array.isArray(item.sourceUrls) || !item.sourceUrls.length || item.sourceUrls.length > 4) fail("每项需要 1–4 个来源");
    const cover = item.cover === null ? null : validAssetUrl(item.cover);
    if (cover && covers.has(cover)) fail("不能重复使用同一封面"); if (cover) covers.add(cover);
    return { id: item.id, title: text(item.title, 160, "游戏名"), searchName: text(item.searchName, 160, "英文名"), releaseDate, platforms: item.platforms.slice(), summary: text(item.summary, 220, "简介"), section: text(item.section, 80, "时段"), sourceUrls: [...new Set(item.sourceUrls.map(sourceUrl))], cover };
  });
  if (covers.size < 10) fail("至少需要 10 张不同的正确封面");
  const snapshot = { schemaVersion: 1, revision: raw.revision, date, windowEnd, timeZone: raw.timeZone, generatedAt: raw.generatedAt, weeklyPoster: validAssetUrl(raw.weeklyPoster), items };
  if (checkRevision && contentRevision(snapshot) !== snapshot.revision) fail("快照内容校验失败");
  return snapshot;
}
function contentRevision(snapshot) {
  return hash(JSON.stringify({ schemaVersion: 1, date: snapshot.date, windowEnd: snapshot.windowEnd, timeZone: snapshot.timeZone, weeklyPoster: snapshot.weeklyPoster, items: snapshot.items }));
}
function emptySnapshot() { return { schemaVersion: 1, revision: null, date: null, windowEnd: null, timeZone: "Asia/Shanghai", generatedAt: null, weeklyPoster: null, items: [] }; }
async function readSnapshot(dir) {
  try { return validateSnapshot(await readJson(path.join(dir, "current.json"))); }
  catch (error) { if (error.code === "ENOENT") return emptySnapshot(); throw error; }
}
function imageExtension(buffer, poster = false) {
  const png = buffer.length >= 33 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && buffer.toString("ascii", 12, 16) === "IHDR";
  if (poster) {
    if (!png || buffer.readUInt32BE(16) !== 1440 || buffer.readUInt32BE(20) < 1 || buffer.readUInt32BE(20) > 20000) fail("速报必须为宽 1440 的单张原始 PNG");
    verifyPng(buffer);
  }
  if (png) return "png";
  if (!poster && buffer.length > 4 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255 && buffer.at(-2) === 255 && buffer.at(-1) === 217) return "jpg";
  if (!poster && buffer.length >= 20 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP" && buffer.readUInt32LE(4) + 8 === buffer.length) return "webp";
  fail("图片只接受真实 PNG/JPEG/WebP；不接受 SVG、HTML 或远程地址");
}
function verifyPng(buffer) {
  let offset = 8, ended = false; const compressed = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset), end = offset + length + 12;
    if (end > buffer.length) fail("PNG 数据不完整");
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    let crc = 0xffffffff;
    for (const byte of buffer.subarray(offset + 4, end - 4)) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    if (((crc ^ 0xffffffff) >>> 0) !== buffer.readUInt32BE(end - 4)) fail("PNG CRC 校验失败");
    if (offset === 8 && (type !== "IHDR" || length !== 13)) fail("PNG 头无效");
    if (type === "acTL") fail("速报必须是单张静态 PNG");
    if (type === "IDAT") compressed.push(buffer.subarray(offset + 8, end - 4));
    offset = end;
    if (type === "IEND") { if (length) fail("PNG 结束块无效"); ended = true; break; }
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[buffer[25]];
  if (!ended || offset !== buffer.length || !compressed.length || buffer[24] !== 8 || !channels || buffer[26] || buffer[27] || buffer[28]) fail("PNG 编码无效或不是标准 8 位非交错图片");
  const expected = (buffer.readUInt32BE(16) * channels + 1) * buffer.readUInt32BE(20);
  const decoded = zlib.inflateSync(Buffer.concat(compressed), { maxOutputLength: expected });
  if (decoded.length !== expected) fail("PNG 像素数据不完整");
}
async function atomicFile(target, contents) {
  const temporary = target + "." + crypto.randomUUID() + ".tmp";
  let handle;
  try {
    handle = await fs.open(temporary, "wx", 0o600);
    await handle.writeFile(contents); await handle.sync(); await handle.close(); handle = null;
    await fs.rename(temporary, target);
  } finally { if (handle) await handle.close(); await fs.unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; }); }
}
async function publish({ inputFile, cardFile, imageFile, coversDir, dataDir, timeZone = process.env.GAME_NEWS_TIMEZONE || "Asia/Shanghai", now = new Date(), dryRun = false }) {
  const dir = await storageDir(dataDir);
  const [input, card] = await Promise.all([readJson(inputFile), readJson(cardFile)]);
  const date = isoDate(input.date);
  if (date !== today(now, timeZone) || card.date !== date) fail("两份清单日期必须一致且为任务执行当天");
  if (input.schemaVersion !== 1 || card.heroTitle !== "近期游戏发售速报" || !Array.isArray(input.items) || !Array.isArray(card.items) || input.items.length !== card.items.length) fail("网站清单与图片清单不一致");
  if (input.items.length < 10 || input.items.length > 15) fail("清单必须为 10–15 条");
  const coverRoot = await fs.realpath(coversDir), assets = new Map(), names = new Set();
  const addAsset = buffer => {
    const name = hash(buffer) + "." + imageExtension(buffer);
    assets.set(name, buffer); return assetUrl(name);
  };
  const posterBytes = await readLimited(imageFile, MAX_ASSET);
  imageExtension(posterBytes, true);
  const posterUrl = addAsset(posterBytes);
  const items = [];
  for (let index = 0; index < input.items.length; index++) {
    const item = input.items[index], pictureItem = card.items[index];
    const name = text(item.searchName, 160, "官方英文名");
    if (names.has(name.toLowerCase())) fail("同一游戏请合并为一条；不同平台日期不同时仅列本条日期对应的平台"); names.add(name.toLowerCase());
    if (pictureItem.searchName !== name || pictureItem.title !== item.title || pictureItem.tag !== "发售") fail(`第 ${index + 1} 条游戏与图片清单不一致`);
    const releaseDate = isoDate(item.releaseDate);
    if (!Array.isArray(item.platforms)) fail("platforms 必须为数组");
    const summary = text(item.summary, 220, "中文简介");
    const expected = `📅 ${releaseDate}｜🖥️ ${item.platforms.join("、")}｜${summary}`;
    if (pictureItem.desc !== expected) fail(`第 ${index + 1} 条 desc 必须与日期、平台和简介完全一致`);
    let cover = null;
    if (pictureItem.cover) {
      if (typeof pictureItem.cover !== "string" || /^https?:/i.test(pictureItem.cover)) fail("cover 必须是 COVERS 内的本地图片");
      const requested = path.isAbsolute(pictureItem.cover) ? pictureItem.cover : path.resolve(path.dirname(cardFile), pictureItem.cover);
      const actual = await fs.realpath(requested);
      if (!inside(coverRoot, actual)) fail("封面路径越出 COVERS");
      cover = addAsset(await readLimited(actual, MAX_ASSET));
    }
    items.push({ id: hash(name.toLowerCase()).slice(0, 24), title: item.title, searchName: name, releaseDate, platforms: item.platforms, summary, section: pictureItem.section || "近期发售", sourceUrls: item.sourceUrls, cover });
  }
  const body = { schemaVersion: 1, date, windowEnd: addDays(date, 56), timeZone, weeklyPoster: posterUrl, items };
  const snapshot = validateSnapshot({ ...body, revision: "0".repeat(64), generatedAt: now.toISOString() }, { checkRevision: false });
  snapshot.revision = contentRevision(snapshot);
  if (dryRun) return { ok: true, dryRun: true, revision: snapshot.revision, date, count: items.length, covers: items.filter(item => item.cover).length };
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const assetDir = path.join(dir, "assets");
  await fs.mkdir(assetDir, { recursive: true, mode: 0o700 });
  if (!inside(dir, await fs.realpath(assetDir))) fail("assets 目录不能指向外部");
  const lockPath = path.join(dir, "publish.lock");
  let lock;
  try { lock = await fs.open(lockPath, "wx", 0o600); }
  catch (error) { if (error.code === "EEXIST") fail("已有发布任务或残留锁；先检查任务状态，禁止盲目删除锁"); throw error; }
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: now.toISOString() }));
    const current = await readSnapshot(dir);
    if (current.date && current.date > date) fail("拒绝覆盖较新的速报");
    if (current.revision === snapshot.revision) return { ok: true, unchanged: true, revision: current.revision, date, count: items.length, covers: items.filter(item => item.cover).length };
    for (const [name, buffer] of assets) await atomicFile(path.join(assetDir, name), buffer);
    if (current.revision) await atomicFile(path.join(dir, "previous.json"), JSON.stringify(current, null, 2) + "\n");
    await atomicFile(path.join(dir, "current.json"), JSON.stringify(snapshot, null, 2) + "\n");
    return { ok: true, unchanged: false, revision: snapshot.revision, date, count: items.length, covers: items.filter(item => item.cover).length };
  } finally { await lock.close(); await fs.unlink(lockPath); }
}
module.exports = { PLATFORMS, ASSET_NAME, MAX_ASSET, DEFAULT_DATA_DIR, inside, storageDir, readLimited, readSnapshot, validateSnapshot, emptySnapshot, publish, isoDate, addDays, today, sourceUrl };
