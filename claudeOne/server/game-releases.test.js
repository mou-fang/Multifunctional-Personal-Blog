"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const zlib = require("node:zlib");
const express = require("express");
const { publish, readSnapshot, readHistory, releasedHistory, storageDir, addDays, sourceUrl } = require("./game-releases-store");
const { createGameReleasesRouter, blockPrivateStatic } = require("./game-releases");
const core = require("../js/game-releases-core");
const { verify } = require("./game-releases-verification");
function png(width, height, shade = 0) {
  function chunk(type, value) {
    const name = Buffer.from(type), size = Buffer.alloc(4); size.writeUInt32BE(value.length);
    let crc = 0xffffffff;
    for (const byte of Buffer.concat([name, value])) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, name, value, checksum]);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const pixels = Buffer.alloc((width * 3 + 1) * height, shade);
  for (let row = 0; row < height; row++) pixels[row * (width * 3 + 1)] = 0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
}
async function fixture(t) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "release-test-"));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const coversDir = path.join(base, "covers"), dataDir = path.join(base, "private"); await fs.mkdir(coversDir);
  const date = "2026-10-06", now = new Date(date + "T04:00:00Z");
  const items = [], cards = [];
  for (let i = 0; i < 10; i++) {
    const cover = path.join(coversDir, i + ".png"); await fs.writeFile(cover, png(4, 2, i + 1));
    const item = { title: "验证样例 " + i, searchName: "Fixture Game " + i, releaseDate: addDays(date, i + 1), platforms: i % 2 ? ["PS5"] : ["PC"], summary: "仅供自动化验证的样例。", sourceUrls: ["https://store.steampowered.com/"] };
    items.push(item); cards.push({ section: i === 0 ? "🔥 重点推荐" : "近期发售", title: item.title, searchName: item.searchName, desc: `📅 ${item.releaseDate}｜🖥️ ${item.platforms.join("、")}｜${item.summary}`, tag: "发售", cover });
  }
  const input = { schemaVersion: 1, date, items }, card = { date, heroTitle: "近期游戏发售速报", heroImage: "", items: cards };
  const config = { inputFile: path.join(base, "site.json"), cardFile: path.join(base, "card.json"), imageFile: path.join(base, "poster.png"), coversDir, dataDir, now };
  const save = async () => { await fs.writeFile(config.inputFile, JSON.stringify(input)); await fs.writeFile(config.cardFile, JSON.stringify(card)); };
  const advance = async (date, change = () => {}) => {
    input.date = card.date = date;
    input.items.forEach((item, index) => { item.releaseDate = addDays(date, index + 1); });
    change(input.items);
    input.items.forEach((item, index) => {
      Object.assign(card.items[index], { title: item.title, searchName: item.searchName, desc: `📅 ${item.releaseDate}｜🖥️ ${item.platforms.join("、")}｜${item.summary}` });
    });
    config.now = new Date(date + "T04:00:00Z"); await save();
  };
  await save(); await fs.writeFile(config.imageFile, png(1440, 2));
  return { ...config, config, base, input, card, save, advance };
}
test("local publish preserves exact PNG, is idempotent, creates backup, and never clears good data on bad input", async t => {
  const f = await fixture(t); const result = await publish(f.config); assert.equal(result.count, 10); assert.equal(result.covers, 10);
  const first = await readSnapshot(f.dataDir);
  assert.deepEqual(await fs.readFile(path.join(f.dataDir, "assets", first.weeklyPoster.split("/").pop())), await fs.readFile(f.imageFile));
  assert.equal((await publish(f.config)).unchanged, true);
  f.input.items[0].summary = "更新后的验证样例。"; f.card.items[0].desc = `📅 ${f.input.items[0].releaseDate}｜🖥️ PC｜更新后的验证样例。`; await f.save();
  await publish(f.config); assert.equal((JSON.parse(await fs.readFile(path.join(f.dataDir, "previous.json")))).revision, first.revision);
  const good = await fs.readFile(path.join(f.dataDir, "current.json"));
  f.input.items = []; await f.save(); await assert.rejects(publish(f.config), /不一致|10–15/);
  assert.deepEqual(await fs.readFile(path.join(f.dataDir, "current.json")), good);
  await assert.rejects(fs.stat(path.join(f.dataDir, "publish.lock")), { code: "ENOENT" });
});
test("publisher rejects guessed/invalid dates, out-of-window dates, inconsistent platforms, duplicate covers, corrupt PNG and escaped paths", async t => {
  const f = await fixture(t);
  f.input.items[0].releaseDate = "2026-02-30"; await f.save(); await assert.rejects(publish(f.config), /日期/);
  f.input.items[0].releaseDate = "2027-01-01"; f.card.items[0].desc = `📅 2027-01-01｜🖥️ PC｜${f.input.items[0].summary}`; await f.save(); await assert.rejects(publish(f.config), /日期/);
  f.card.items[0].desc = `📅 2026-10-07｜🖥️ PC｜${f.input.items[0].summary}`;
  f.input.items[0].releaseDate = "2026-10-07"; f.input.items[0].platforms = ["PS5"]; await f.save(); await assert.rejects(publish(f.config), /desc/);
  f.input.items[0].platforms = ["PC"]; f.card.items[1].cover = f.card.items[0].cover; await f.save(); await assert.rejects(publish(f.config), /重复使用/);
  f.card.items[1].cover = path.join(f.coversDir, "1.png"); f.card.items[0].cover = f.imageFile; await f.save(); await assert.rejects(publish(f.config), /越出/);
  f.card.items[0].cover = path.join(f.coversDir, "0.png"); await f.save();
  const corrupt = await fs.readFile(f.imageFile); corrupt[45] ^= 1; await fs.writeFile(f.imageFile, corrupt); await assert.rejects(publish(f.config), /CRC/);
});
test("today and day 56 are valid boundaries; older jobs cannot overwrite newer editions", async t => {
  const f = await fixture(t);
  f.input.items[0].releaseDate = f.input.date;
  f.card.items[0].desc = `📅 ${f.input.date}｜🖥️ PC｜${f.input.items[0].summary}`;
  f.input.items[9].releaseDate = addDays(f.input.date, 56);
  f.card.items[9].desc = `📅 ${f.input.items[9].releaseDate}｜🖥️ PS5｜${f.input.items[9].summary}`;
  await f.save(); await publish(f.config);
  const previous = await fs.readFile(path.join(f.dataDir, "current.json"));
  f.input.date = f.card.date = "2026-10-05";
  // Keep all selected games valid for the earlier run; the last one moves one day earlier.
  f.input.items[9].releaseDate = "2026-11-30"; f.card.items[9].desc = `📅 2026-11-30｜🖥️ PS5｜${f.input.items[9].summary}`;
  await f.save(); await assert.rejects(publish({ ...f.config, now: new Date("2026-10-05T04:00:00Z") }), /较新/);
  assert.deepEqual(await fs.readFile(path.join(f.dataDir, "current.json")), previous);
});
test("private storage cannot be located under the webroot; dry run writes nothing; lock never overwritten", async t => {
  await assert.rejects(storageDir(path.join(__dirname, "data/releases")), /静态目录之外/);
  const f = await fixture(t); assert.equal((await publish({ ...f.config, dryRun: true })).dryRun, true);
  await assert.rejects(fs.stat(f.dataDir), { code: "ENOENT" });
  await fs.mkdir(f.dataDir); await fs.writeFile(path.join(f.dataDir, "publish.lock"), "test lock");
  await assert.rejects(publish(f.config), /发布任务|残留锁/); assert.equal(await fs.readFile(path.join(f.dataDir, "publish.lock"), "utf8"), "test lock");
});
test("symlinked covers cannot escape the allowed root", async t => {
  const f = await fixture(t); const link = path.join(f.coversDir, "escaped");
  await fs.symlink(f.base, link, process.platform === "win32" ? "junction" : "dir");
  f.card.items[0].cover = path.join(link, "poster.png"); await f.save(); await assert.rejects(publish(f.config), /越出/);
});
test("public API only reads, guards private files and serves only committed image assets", async t => {
  const f = await fixture(t); await publish(f.config);
  const app = express(); app.use("/api/game-releases", createGameReleasesRouter({ dataDir: f.dataDir })); app.use(blockPrivateStatic); app.use(express.static(path.resolve(__dirname, "..")));
  const server = await new Promise(resolve => { const value = app.listen(0, "127.0.0.1", () => resolve(value)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = "http://127.0.0.1:" + server.address().port;
  const response = await fetch(base + "/api/game-releases"); assert.equal(response.status, 200); const snapshot = await response.json(); assert.equal(snapshot.items.length, 10);
  assert.equal(core.valid(snapshot), true);
  assert.equal(core.valid({ ...snapshot, timeZone: "Unknown/Invalid" }), false);
  for (const source of ["https://localhost./", "https://foo.local./", "https://127.1/", "https://[::1]/", "https://example.com:8443/"]) {
    const unsafe = structuredClone(snapshot); unsafe.items[0].sourceUrls = [source]; assert.equal(core.valid(unsafe), false);
  }
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const poster = await fetch(base + snapshot.weeklyPoster); assert.equal(poster.headers.get("content-type"), "image/png"); assert.deepEqual(Buffer.from(await poster.arrayBuffer()), await fs.readFile(f.imageFile));
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const denied = await fetch(base + "/api/game-releases", { method, body: "malicious input" }); assert.equal(denied.status, 405); assert.equal(denied.headers.get("allow"), "GET, HEAD");
  }
  for (const url of ["/server/server.js", "/%73erver/data/current.json", "/scripts/publish-game-releases.js", "/test-results/a", "/api/game-releases/assets/" + "a".repeat(64) + ".png", "/api/game-releases/import"]) assert.equal((await fetch(base + url)).status, 404, url);
  const head = await fetch(base + "/api/game-releases", { method: "HEAD" }); assert.equal(head.status, 200); assert.equal(await head.text(), "");
  app.use("/empty", createGameReleasesRouter({ dataDir: path.join(f.base, "empty") }));
  const empty = await fetch(base + "/empty"); assert.equal(empty.status, 200); const initial = await empty.json(); assert.equal(core.valid(initial), true); assert.deepEqual(initial.items, []);
  const emptyArchive = await fetch(base + "/empty/archive"); assert.equal(emptyArchive.status, 200);
  const initialArchive = await emptyArchive.json(); assert.equal(core.valid(initialArchive, true), true); assert.deepEqual(initialArchive.items, []);
  await fs.writeFile(path.join(f.dataDir, "current.json"), "corrupt");
  // Cached content must invalidate immediately after a disk change.
  const broken = await fetch(base + "/api/game-releases"); assert.equal(broken.status, 503); assert.ok(!(await broken.text()).includes(f.dataDir));
});
test("source URLs are HTTPS without credentials or local targets", () => {
  for (const url of ["javascript:alert(1)", "http://example.com", "https://127.0.0.1/a", "https://127.1/", "https://[::1]/", "https://localhost/a", "https://localhost./a", "https://foo.local./", "https://user:pass@example.com/", "https://foo.internal/", "https://example.com:8443/a"]) assert.throws(() => sourceUrl(url));
  assert.equal(sourceUrl("https://store.steampowered.com/app/123/"), "https://store.steampowered.com/app/123/");
});
test("website verifier compares the committed version, every entry, sources and exact original PNG", async t => {
  const f = await fixture(t), report = await publish(f.config), snapshot = await readSnapshot(f.dataDir);
  const reportFile = path.join(f.base, "report.json"); await fs.writeFile(reportFile, JSON.stringify(report));
  let incorrect = false;
  const fetchFn = async url => url.endsWith("/api/game-releases") ? new Response(JSON.stringify(snapshot)) : new Response(incorrect ? Buffer.from("wrong image") : await fs.readFile(f.imageFile));
  const config = { reportFile, inputFile: f.inputFile, imageFile: f.imageFile, url: "https://releases.example.com", fetchFn };
  assert.equal((await verify(config)).verified, true);
  incorrect = true; await assert.rejects(verify(config), /字节不一致/);
  incorrect = false; snapshot.items[0].summary = "tampered"; await assert.rejects(verify(config), /内容校验/);
});
test("date window, title search, mobile platform filtering and expired entries behave consistently", () => {
  const items = [
    { title: "旧游戏", searchName: "Old", summary: "旧", releaseDate: "2026-10-03", platforms: ["PC"] },
    { title: "新游戏", searchName: "New Game", summary: "介绍", releaseDate: "2026-10-05", platforms: ["PC", "PS5"] },
    { title: "手机游戏", searchName: "Mobile", summary: "介绍", releaseDate: "2026-10-06", platforms: ["iOS"] },
    { title: "远期", searchName: "Far", summary: "介绍", releaseDate: "2027-01-01", platforms: ["PC"] }
  ];
  assert.equal(core.filter(items, { today: "2026-10-04" }).length, 2);
  assert.equal(core.filter(items, { today: "2026-10-04", platform: "PC", query: "NEW" }).length, 1);
  assert.equal(core.filter(items, { today: "2026-10-04", platform: "mobile" })[0].searchName, "Mobile");
  assert.equal(core.filter(items, { today: "2026-10-04", includeReleased: true }).length, 3);
  assert.equal(core.today("Asia/Shanghai", new Date("2026-10-03T20:00:00Z")), "2026-10-04");
});

test("weekly history survives multiple replacements, seeds legacy previous.json, and keeps dropped upcoming entries until release", async t => {
  const f = await fixture(t); await publish(f.config);
  const first = await readSnapshot(f.dataDir);
  await f.advance("2026-10-13", items => items.forEach((item, index) => { item.searchName = "Second Game " + index; }));
  await publish(f.config);
  // Simulate upgrading a pre-history installation, which only has current/previous.
  const historyDir = path.join(f.dataDir, "history");
  await fs.unlink(path.join(historyDir, first.revision + ".json"));
  const migrated = releasedHistory(await readHistory(f.dataDir), new Date("2026-10-13T04:00:00Z"));
  assert.equal(migrated.items.length, 6, "today and future releases stay out of the archive");
  assert.equal(core.valid(migrated, true), true);
  const second = await readSnapshot(f.dataDir);
  await f.advance("2026-10-20", items => items.forEach((item, index) => { item.searchName = "Third Game " + index; }));
  await publish(f.config);
  const catalogue = await readHistory(f.dataDir);
  const archived = releasedHistory(catalogue, new Date("2026-11-01T04:00:00Z"));
  assert.equal(archived.items.length, 30, "history grows beyond the weekly 15-item limit");
  assert.equal(new Set(archived.items.map(item => item.id)).size, 30);
  assert.ok(archived.items.some(item => item.id === first.items[9].id), "a dropped future item is preserved after its date passes");
  assert.equal(core.valid(archived, true), true);
  assert.equal(core.valid(archived), false);
  assert.deepEqual((await fs.readdir(historyDir)).sort(), [first.revision + ".json", second.revision + ".json"].sort());
  const filesBefore = await fs.readdir(historyDir);
  assert.equal((await publish(f.config)).unchanged, true);
  assert.deepEqual(await fs.readdir(historyDir), filesBefore);
});

test("later dates correct earlier announcements without duplicating a game; different platform launches remain", async t => {
  const f = await fixture(t);
  f.input.items[0].platforms = ["PC", "PS5"];
  f.card.items[0].desc = `📅 ${f.input.items[0].releaseDate}｜🖥️ PC、PS5｜${f.input.items[0].summary}`;
  await f.save(); await publish(f.config);
  await f.advance("2026-10-13", items => {
    items[0].platforms = ["PS5"]; items[0].summary = "主机延期后的日期。";
    items.slice(1).forEach((item, index) => { item.searchName = "New Selection " + index; });
  });
  await publish(f.config);
  const firstId = (await readSnapshot(f.dataDir)).items[0].id;
  const catalogue = await readHistory(f.dataDir);
  let games = releasedHistory(catalogue, new Date("2026-10-13T04:00:00Z")).items.filter(item => item.id === firstId);
  assert.equal(games.length, 1); assert.equal(games[0].releaseDate, "2026-10-07"); assert.deepEqual(games[0].platforms, ["PC"]);
  games = releasedHistory(catalogue, new Date("2026-10-15T04:00:00Z")).items.filter(item => item.id === firstId);
  assert.equal(games.length, 2); assert.deepEqual(games.map(item => item.platforms), [["PS5"], ["PC"]]);
  assert.equal(new Set(catalogue.items.filter(item => item.id === firstId).flatMap(item => item.platforms)).size, 2);
});

test("same-date platform updates merge once and use the newest summary", async t => {
  const f = await fixture(t);
  f.input.items[0].releaseDate = "2026-10-15";
  f.input.items.forEach((item, index) => { item.releaseDate = addDays("2026-10-15", index); });
  f.input.items[0].platforms = ["PC", "PS5"];
  f.input.items.forEach((item, index) => { f.card.items[index].desc = `📅 ${item.releaseDate}｜🖥️ ${item.platforms.join("、")}｜${item.summary}`; });
  await f.save(); await publish(f.config);
  const first = await readSnapshot(f.dataDir);
  await f.advance("2026-10-13", items => {
    items.forEach((item, index) => { item.releaseDate = addDays("2026-10-15", index); });
    items[0].platforms = ["PS5"]; items[0].summary = "已更新的游戏简介。";
  });
  await publish(f.config);
  const games = releasedHistory(await readHistory(f.dataDir), new Date("2026-10-16T04:00:00Z")).items.filter(item => item.id === first.items[0].id);
  assert.equal(games.length, 1); assert.deepEqual(games[0].platforms, ["PC", "PS5"]); assert.equal(games[0].summary, "已更新的游戏简介。");
});

test("archive API invalidates after publishing and midnight, keeps old covers readable, and exposes no write interface", async t => {
  const f = await fixture(t); await publish(f.config);
  const first = await readSnapshot(f.dataDir);
  let now = new Date("2026-10-13T04:00:00Z");
  const app = express(); app.use("/api/game-releases", createGameReleasesRouter({ dataDir: f.dataDir, now: () => now }));
  const server = await new Promise(resolve => { const value = app.listen(0, "127.0.0.1", () => resolve(value)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = "http://127.0.0.1:" + server.address().port;
  const getArchive = async () => { const response = await fetch(base + "/api/game-releases/archive"); assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store"); return response.json(); };
  assert.equal((await getArchive()).items.length, 6);
  await f.advance("2026-10-13", items => items.forEach((item, index) => { item.searchName = "Next Week " + index; }));
  const originalCover = await fs.readFile(path.join(f.coversDir, "0.png"));
  for (let index = 0; index < 10; index++) await fs.writeFile(path.join(f.coversDir, index + ".png"), png(4, 2, index + 31));
  await publish(f.config);
  assert.equal((await getArchive()).items.length, 6);
  const cover = await fetch(base + first.items[0].cover); assert.equal(cover.status, 200);
  assert.deepEqual(Buffer.from(await cover.arrayBuffer()), originalCover);
  now = new Date("2026-10-13T16:00:00Z");
  assert.equal((await getArchive()).items.length, 7, "midnight promotes yesterday's release without publishing");
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) assert.equal((await fetch(base + "/api/game-releases/archive", { method })).status, 405);
  const good = await fs.readFile(path.join(f.dataDir, "current.json"));
  f.input.items = []; await f.save(); await assert.rejects(publish(f.config));
  assert.deepEqual(await fs.readFile(path.join(f.dataDir, "current.json")), good);
  assert.equal((await getArchive()).items.length, 7);
});

test("archive filtering excludes today/future and supports old dates, platform and English-name searches", () => {
  const items = [
    { title: "去年游戏", searchName: "Archive Game", summary: "回顾", releaseDate: "2025-01-01", platforms: ["PC"] },
    { title: "今日游戏", searchName: "Today", summary: "", releaseDate: "2026-10-24", platforms: ["PS5"] },
    { title: "未来游戏", searchName: "Future", summary: "", releaseDate: "2026-11-01", platforms: ["PC"] }
  ];
  const options = { archive: true, today: "2026-10-24" };
  assert.deepEqual(core.filter(items, options), [items[0]]);
  assert.equal(core.filter(items, { ...options, query: "ARCHIVE", platform: "PC" }).length, 1);
  assert.equal(core.filter(items, { ...options, platform: "PS5" }).length, 0);
});
