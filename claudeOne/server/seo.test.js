"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");
const { parse } = require("parse5");
const express = require("express");
const site = require("../js/site-pages");
const cards = require("../js/tool-cards");
const core = require("../js/game-releases-core");
const { createSEO, find, marked, attr, walk } = require("./seo");
const { createReleaseReader } = require("./game-releases-data");
const { emptySnapshot } = require("./game-releases-store");
const { allowed, audit, textContent } = require("./seo-audit");
const root = path.resolve(__dirname, "..");

function item(index, releaseDate = "2026-11-01") {
  return { id: index.toString(16).padStart(24, "0"), title: "回归样例 " + index, searchName: "Fixture " + index, releaseDate, platforms: ["PC"], summary: "用于自动验证的明确样例。", sourceUrls: ["https://store.steampowered.com/"], cover: "/api/game-releases/assets/" + "a".repeat(64) + ".png" };
}
function fixture() {
  let now = new Date("2026-11-02T00:00:00Z");
  const current = { ...emptySnapshot(), date: "2026-11-02", generatedAt: "2026-11-02T00:00:00Z", revision: "a".repeat(64), weeklyPoster: "/api/game-releases/assets/" + "a".repeat(64) + ".png", items: [item(200, "2026-11-02"), item(201, "2026-11-03")] };
  const history = { schemaVersion: 1, date: current.date, revision: "b".repeat(64), timeZone: "Asia/Shanghai", items: Array.from({ length: 125 }, (_, i) => item(i)) };
  const reader = { snapshot: async () => structuredClone(current), archive: async () => ({ ...history, items: history.items.filter(i => i.releaseDate < core.today(history.timeZone, now)) }), now: () => now };
  return { reader, current, history, seo: createSEO({ root, reader }), advance: date => { now = new Date(date); } };
}
async function http(t, seo) {
  const app = express(); app.use(seo.middleware); app.use(express.static(root)); app.use((_req, res) => res.status(404).send(seo.errorPage(404, "页面不存在")));
  const server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  return "http://127.0.0.1:" + server.address().port;
}
test("every public page has a unique path, real template, complete copy and a discoverable category entry", async () => {
  const source = await fs.readFile(path.join(root, "index.html"), "utf8"), doc = parse(source), paths = new Set();
  for (const [id, meta] of Object.entries(site.pages)) {
    if (meta.aliasOf) { assert.ok(site.pages[meta.aliasOf]); assert.equal(meta.indexable, false); continue; }
    assert.match(meta.path, /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/); assert.ok(!paths.has(meta.path), id + " duplicate path"); paths.add(meta.path);
    assert.ok(meta.indexable === true && meta.description.length >= 20 && meta.title.trim(), id + " metadata");
    assert.ok(meta.help.steps.length >= 2 && meta.help.limits.length >= 1 && meta.help.faq.length >= 1, id + " help");
    for (const line of [...meta.help.steps, ...meta.help.limits, ...meta.help.faq.flat()]) assert.ok(typeof line === "string" && line.trim().length >= 6, id + " help must contain real copy");
    assert.match(meta.updated, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(find(doc, n => n.tagName === "template" && attr(n, "id") === meta.templateId), id + " missing template");
    if (meta.navSection === "games" && id !== "games" || meta.navSection === "tools" && !["tools", "playlist"].includes(id)) assert.ok(cards[meta.navSection].some(card => card.page === id), id + " missing card");
  }
  for (const section of ["games", "tools"]) for (const card of cards[section].filter(c => c.page)) assert.equal(site.pages[card.page]?.navSection, section, card.page + " card needs registry metadata");
  // Playlist is reached from the global player; aliases/placeholders are not public pages.
  assert.ok((await fs.readFile(path.join(root, "js/player.js"), "utf8")).includes('go("playlist")'));
  assert.equal(paths.size, Object.values(site.pages).filter(p => p.indexable).length);
});
test("all public routes return their own readable HTML, one h1, metadata, help and crawlable navigation without JavaScript", async () => {
  const { seo } = fixture();
  for (const [id, meta] of Object.entries(site.pages).filter(([, p]) => p.indexable)) {
    const source = await seo.render(id), doc = parse(source), main = marked(doc, "data-content-slot");
    const headings = []; walk(main, n => { if (n.tagName === "h1") headings.push(n); }); assert.equal(headings.length, 1, id);
    assert.ok(textContent(main).length > 60, id); assert.ok(marked(main, "data-page-help") || marked(main, "data-music-help"), id);
    assert.equal(attr(find(doc, n => n.tagName === "link" && attr(n, "rel") === "canonical"), "href"), site.origin + meta.path);
    assert.equal(attr(find(doc, n => n.tagName === "meta" && attr(n, "name") === "description"), "content"), meta.description);
    const structured = find(doc, n => n.tagName === "script" && attr(n, "type") === "application/ld+json");
    assert.equal(JSON.parse(textContent(structured)).url, site.origin + meta.path);
    const nav = find(doc, n => n.tagName === "nav" && attr(n, "class") === "site-nav"); assert.equal((textContent(nav).match(/游戏发售/g) || []).length, 1);
    assert.doesNotMatch(source, /(?:src|href)="\.\/(?:css|js|logo|libs)\//);
  }
});
test("normal routes, permanent legacy redirects, archive page canonicals and true 404s match the HTTP contract", async t => {
  const { seo } = fixture(), base = await http(t, seo);
  for (const [old, target] of [["/music", "/tools/music-unlock"], ["/anomaly-bureau", "/games/city-shuttle"], ["/game-releases-archive", "/game-releases/archive"], ["/tools/", "/tools"], ["/index.html", "/"]]) {
    const res = await fetch(base + old, { redirect: "manual" }); assert.equal(res.status, 301, old); assert.equal(res.headers.get("location"), target);
  }
  const page = await fetch(base + "/game-releases/archive?page=2"); assert.equal(page.status, 200);
  const source = await page.text(); assert.match(source, /archive\?page=2/); assert.match(source, /第 2 页/);
  assert.match(source, /下一页/); assert.match(source, /上一页/);
  for (const pathname of ["/tools/missing", "/games/not-real", "/music-not-real", "/__proto__", "/constructor", "/game-releases/archive?page=4"]) assert.equal((await fetch(base + pathname)).status, 404, pathname);
  for (const value of ["0", "-1", "xyz", "2.5", "999999999999999999999"]) assert.equal((await fetch(base + "/game-releases/archive?page=" + value)).status, 400);
  assert.equal((await fetch(base + "/game-releases/archive?page=1", { redirect: "manual" })).status, 301);
  const head = await fetch(base + "/tools/music-unlock", { method: "HEAD" }); assert.equal(head.status, 200); assert.equal(await head.text(), "");
});
test("release HTML follows published updates, pagination, timezone rollover and source text safely", async () => {
  const f = fixture();
  let doc = parse(await f.seo.render("game-releases")); assert.equal(textContent(marked(doc, "data-release-list")).includes("Fixture 200"), true);
  f.current.items[0].title = '<script>alert("fixture")</script>'; f.current.revision = "c".repeat(64);
  const rendered = await f.seo.render("game-releases"); assert.ok(rendered.includes("&lt;script&gt;")); assert.ok(!rendered.includes('<script>alert("fixture")</script>'));
  f.advance("2026-11-02T16:00:00Z");
  doc = parse(await f.seo.render("game-releases")); assert.doesNotMatch(textContent(marked(doc, "data-release-list")), /Fixture 200/); assert.match(textContent(marked(doc, "data-release-list")), /Fixture 201/);
  doc = parse(await f.seo.render("game-releases-archive", 2)); let count = 0; walk(marked(doc, "data-release-list"), n => { if (n.tagName === "article") count++; }); assert.equal(count, 60);
  const sitemap = await f.seo.sitemap(); assert.ok(sitemap.includes('archive?page=2')); assert.ok(sitemap.includes('archive?page=3')); assert.ok(!sitemap.includes("anomaly-bureau"));
  assert.ok(!sitemap.includes("sudoku")); assert.ok(!sitemap.includes("/api/"));
});
test("missing edition is an honest waiting page; corrupt storage returns 503 without becoming an empty edition", async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "seo-data-")); t.after(() => fs.rm(dataDir, { recursive: true, force: true }));
  const reader = createReleaseReader({ dataDir }), seo = createSEO({ root, reader }), base = await http(t, seo);
  assert.match(await (await fetch(base + "/game-releases")).text(), /下一期速报，正在路上/);
  await fs.writeFile(path.join(dataDir, "current.json"), "{corrupt");
  const res = await fetch(base + "/game-releases"); assert.equal(res.status, 503); assert.equal(res.headers.get("retry-after"), "60"); assert.match(await res.text(), /noindex/);
  assert.equal((await fetch(base + "/sitemap.xml")).status, 503);
});
test("effective robots rules detect Cloudflare bot-specific bans and preserve search access to public resources", () => {
  const { seo } = fixture(), robots = seo.robots();
  for (const agent of ["Googlebot", "Bingbot", "Baiduspider"]) for (const url of ["/", "/tools/music-unlock", "/games/doom", "/js/router.js", "/api/game-releases/assets/abc.png"]) assert.equal(allowed(robots, agent, url), true);
  assert.equal(allowed('User-agent: Baiduspider\nDisallow: /\n\n' + robots, "Baiduspider", "/tools"), false);
  assert.equal(allowed(robots, "GPTBot", "/tools"), false);
  assert.equal(allowed(robots, "Googlebot", "/server/server.js"), false);
  assert.equal(allowed("User-agent: *\nDisallow: /a\nAllow: /a/public", "Googlebot", "/a/public"), true);
});
test("public audit validates every formal page and archive pagination with real HTTP responses", async t => {
  const { seo, reader } = fixture();
  const app = express();
  app.get("/api/game-releases", async (_req, res) => res.json(await reader.snapshot()));
  app.get("/api/game-releases/archive", async (_req, res) => res.json(await reader.archive()));
  app.use(seo.middleware); app.use((_req, res) => res.status(404).send(seo.errorPage(404, "不存在")));
  const server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = "http://127.0.0.1:" + server.address().port, report = await audit({ baseUrl: base, now: reader.now });
  assert.equal(report.ok, true, JSON.stringify(report.errors)); assert.equal(report.checkedPages, Object.values(site.pages).filter(p => p.indexable).length + 2);
  const blocked = await audit({ baseUrl: base, now: reader.now, fetcher: (url, options) => {
    if (url.endsWith("/robots.txt")) return Promise.resolve(new Response("User-agent: Baiduspider\nDisallow: /\n" + seo.robots(), { headers: { "Content-Type": "text/plain" } }));
    if (url.endsWith("/sitemap.xml")) return Promise.resolve(new Response("missing", { status: 404 }));
    return fetch(url, options);
  } });
  assert.equal(blocked.ok, false); assert.ok(blocked.errors.some(e => e.code === "blocked-bot" && e.detail.includes("Baiduspider"))); assert.ok(blocked.errors.some(e => e.code === "sitemap"));
});
