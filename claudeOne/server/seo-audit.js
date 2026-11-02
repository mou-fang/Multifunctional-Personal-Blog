"use strict";
const { parse } = require("parse5");
const site = require("../js/site-pages");
const core = require("../js/game-releases-core");
const releaseHTML = require("../js/game-releases-render");
const { find, marked, attr, walk } = require("./seo");

// Combine groups of equal specificity; an appended wildcard group cannot undo a bot-specific ban.
function allowed(robots, agent, pathname) {
  const groups = []; let group = null, directed = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim(), colon = line.indexOf(":");
    if (colon < 0) continue;
    const name = line.slice(0, colon).trim().toLowerCase(), value = line.slice(colon + 1).trim();
    if (name === "user-agent") {
      if (!group || directed) { group = { agents: [], rules: [] }; groups.push(group); directed = false; }
      group.agents.push(value.toLowerCase());
    } else if (group && ["allow", "disallow"].includes(name)) { directed = true; if (value) group.rules.push({ allow: name === "allow", path: value }); }
  }
  const candidates = groups.map(g => ({ ...g, specificity: Math.max(-1, ...g.agents.map(a => a === "*" ? 0 : agent.toLowerCase().includes(a) ? a.length : -1)) }));
  const specificity = Math.max(-1, ...candidates.map(g => g.specificity)); let result = { length: -1, allow: true };
  for (const g of candidates.filter(g => g.specificity === specificity)) for (const r of g.rules) {
    const escaped = r.path.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    if (new RegExp("^" + escaped).test(pathname) && (r.path.length > result.length || r.path.length === result.length && r.allow)) result = { length: r.path.length, allow: r.allow };
  }
  return result.allow;
}
function textContent(node) { let text = ""; if (node) walk(node, n => { if (n.nodeName === "#text") text += n.value; }); return text; }
async function audit({ baseUrl, siteOrigin = site.origin, fetcher = fetch, now = () => new Date() } = {}) {
  const base = new URL(baseUrl || "http://127.0.0.1:3001").origin;
  const errors = [], results = [];
  const editions = new Map(), auditTime = now();
  const problem = (code, url, detail) => errors.push({ code, url, detail });
  async function request(pathname, options) {
    const response = await fetcher(base + pathname, { signal: AbortSignal.timeout(15000), ...options });
    return { response, body: await response.text() };
  }
  function edition(archive) {
    const pathname = "/api/game-releases" + (archive ? "/archive" : "");
    if (!editions.has(pathname)) editions.set(pathname, request(pathname).then(({ response, body }) => {
      const data = JSON.parse(body);
      if (response.status !== 200 || !core.valid(data, archive)) throw new Error("发售 API 没有返回有效清单");
      return data;
    }));
    return editions.get(pathname);
  }
  const robots = await request("/robots.txt");
  if (robots.response.status !== 200) problem("robots", "/robots.txt", "抓取规则未返回 200");
  if (!/^text\/plain/i.test(robots.response.headers.get("content-type") || "") || /^\s*</.test(robots.body)) problem("robots", "/robots.txt", "抓取规则被替换成 HTML 或错误的内容类型");
  const sitemap = await request("/sitemap.xml");
  if (sitemap.response.status !== 200 || !sitemap.body.includes("<urlset")) problem("sitemap", "/sitemap.xml", "网站地图不存在或格式错误");
  const urls = [...sitemap.body.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1].replace(/&amp;/g, "&"));
  const expected = Object.entries(site.pages).filter(([, p]) => p.indexable && !p.aliasOf);
  for (const [, meta] of expected) if (!urls.includes(siteOrigin + meta.path)) problem("missing-page", meta.path, "正式页面没有进入网站地图");
  for (const bot of ["Googlebot", "Bingbot", "Baiduspider"]) {
    const blocked = [...expected.map(([, meta]) => meta.path), "/css/base.css", "/js/router.js", "/api/game-releases/assets/"].find(pathname => !allowed(robots.body, bot, pathname));
    if (blocked) problem("blocked-bot", blocked, bot + " 被公开 robots.txt 禁止访问；检查 Cloudflare 托管规则");
  }
  if (new Set(urls).size !== urls.length) problem("duplicate", "/sitemap.xml", "网站地图出现重复地址");
  let index = 0;
  async function worker() {
    while (index < urls.length) {
      const absolute = urls[index++]; let url;
      try { url = new URL(absolute); } catch { problem("url", absolute, "地址无效"); continue; }
      if (url.origin !== siteOrigin || url.hash) { problem("origin", absolute, "网站地图含非正式域名或 Hash 地址"); continue; }
      const id = site.resolve(url), pathname = url.pathname + url.search;
      if (!id || site.pages[id].aliasOf || !site.pages[id].indexable) { problem("unregistered", pathname, "未登记的正式页面"); continue; }
      if (url.search) for (const bot of ["Googlebot", "Bingbot", "Baiduspider"]) if (!allowed(robots.body, bot, pathname)) problem("blocked-bot", pathname, bot + " 被公开 robots.txt 禁止访问此分页");
      try {
        const { response, body } = await request(pathname);
        if (response.status !== 200 || new URL(response.url).pathname !== url.pathname) problem("status", pathname, "页面没有直接返回 200 或发生意外跳转");
        const doc = parse(body), main = marked(doc, "data-content-slot"), meta = site.pages[id];
        let canonicalCount = 0; walk(doc, n => { if (n.tagName === "link" && attr(n, "rel") === "canonical") canonicalCount++; });
        if (canonicalCount !== 1) problem("canonical", pathname, "页面必须只有一个正式地址声明");
        const canonical = find(doc, n => n.tagName === "link" && attr(n, "rel") === "canonical");
        if (attr(canonical, "href") !== absolute) problem("canonical", pathname, "正式地址不一致");
        if (!main || textContent(main).trim().length < 60) problem("empty-main", pathname, "首次 HTML 正文缺失");
        let h1s = 0; if (main) walk(main, n => { if (n.tagName === "h1") h1s++; });
        if (h1s !== 1) problem("heading", pathname, "正文必须有且只有一个主标题");
        const description = find(doc, n => n.tagName === "meta" && attr(n, "name") === "description");
        if (attr(description, "content") !== meta.description) problem("description", pathname, "简介与登记信息不一致");
        if (!textContent(find(doc, n => n.tagName === "title"))?.includes(site.brand)) problem("title", pathname, "标题缺少站点名称");
        const noindex = find(doc, n => n.tagName === "meta" && attr(n, "name") === "robots");
        if (/noindex/i.test(attr(noindex, "content") || "") || /noindex/i.test(response.headers.get("x-robots-tag") || "")) problem("noindex", pathname, "正式页面被禁止收录");
        if (main && !marked(main, "data-page-help") && !marked(main, "data-music-help")) problem("help", pathname, "缺少直接包含在 HTML 中的帮助内容");
        if (main && ["game-releases", "game-releases-archive"].includes(id)) {
          try {
            const archive = id.endsWith("archive"), data = await edition(archive);
            const expected = releaseHTML.selection(data, archive, site.pageNumber(url.search), core.today(data.timeZone, auditTime)).items;
            const observed = [];
            const hasClass = (n, value) => (attr(n, "class") || "").split(" ").includes(value);
            walk(marked(main, "data-release-list"), n => {
              if (n.tagName !== "article" || !hasClass(n, "release-card")) return;
              const title = textContent(find(n, node => hasClass(node, "release-card__title"))), platforms = [], sources = [];
              walk(n, child => { if (hasClass(child, "release-platform")) platforms.push(textContent(child)); if (child.tagName === "a") sources.push(attr(child, "href")); });
              observed.push([title, textContent(find(n, node => hasClass(node, "release-card__english"))) || title, attr(find(n, node => node.tagName === "time"), "datetime"), platforms, textContent(find(n, node => hasClass(node, "release-card__summary"))), sources]);
            });
            if (JSON.stringify(observed) !== JSON.stringify(expected.map(i => [i.title, i.searchName, i.releaseDate, i.platforms, i.summary, i.sourceUrls]))) problem("release-data", pathname, "首屏发售名称、日期、平台、简介或来源与实时 API 不一致，检查旧 HTML 缓存");
          } catch (error) { problem("release-data", pathname, error.message); }
        }
        results.push({ url: absolute, status: response.status, headingCount: h1s });
      } catch (error) { problem("request", pathname, error.message); }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  for (const legacy of ["/music", "/game-releases-archive", "/anomaly-bureau"]) {
    const { response } = await request(legacy, { redirect: "manual" });
    const target = new URL(response.headers.get("location") || "/missing-redirect", base);
    if (response.status !== 301 || target.origin !== base || target.pathname !== site.href(legacy.slice(1))) problem("legacy", legacy, "旧普通路径应永久跳转到对应功能");
  }
  const missing = await request("/tools/this-page-does-not-exist", { redirect: "manual" });
  if (missing.response.status !== 404) problem("soft-404", "/tools/this-page-does-not-exist", "不存在的页面应返回 404");
  if (base.startsWith("https:")) {
    try {
      const r = await fetcher(base.replace(/^https:/, "http:") + "/", { redirect: "manual", signal: AbortSignal.timeout(15000) });
      if (![301, 308].includes(r.status) || !r.headers.get("location")?.startsWith(siteOrigin)) problem("https-redirect", "http://" + new URL(base).host, "需在 Cloudflare 或反向代理配置 HTTP 到正式 HTTPS 的永久跳转");
    } catch (error) { problem("https-redirect", base, error.message); }
  }
  return { ok: errors.length === 0, base, siteOrigin, checkedPages: results.length, status: "仅验证公开技术条件，不证明已被搜索引擎收录", errors, pages: results };
}
module.exports = { allowed, audit, textContent };
