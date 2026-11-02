"use strict";
const fs = require("node:fs");
const path = require("node:path");
const html = require("parse5");
const site = require("../js/site-pages");
const cards = require("../js/tool-cards");
const releases = require("../js/game-releases-render");
const core = require("../js/game-releases-core");

function walk(node, visit) { visit(node); for (const child of node.childNodes || []) walk(child, visit); if (node.content) walk(node.content, visit); }
function attr(node, name, value) {
  if (!node || !node.attrs) return undefined;
  const existing = node.attrs.find(a => a.name === name);
  if (value === undefined) return existing?.value;
  if (value === null) { node.attrs = node.attrs.filter(a => a.name !== name); return; }
  if (existing) existing.value = String(value); else node.attrs.push({ name, value: String(value) });
}
function find(node, predicate) { let result; walk(node, n => { if (!result && predicate(n)) result = n; }); return result; }
function marked(node, name) { return find(node, n => attr(n, name) !== undefined); }
function content(node, source) { if (!node) return; node.childNodes = html.parseFragment(source).childNodes; node.childNodes.forEach(n => { n.parentNode = node; }); }
function text(node, value) { content(node, site.escape(value)); }
function origin(value) { const u = new URL(value || site.origin); if (!/^https?:$/.test(u.protocol) || u.username || u.password || u.pathname !== "/" || u.search || u.hash) throw new Error("PUBLIC_SITE_URL 必须是无路径的 HTTP(S) 站点地址"); return u.origin; }

function createSEO({ root, reader, versionURL = value => value, siteOrigin = process.env.PUBLIC_SITE_URL } = {}) {
  const publicOrigin = origin(siteOrigin);
  let priorSource, priorDocument;
  function document() {
    const source = fs.readFileSync(path.join(root, "index.html"), "utf8");
    if (source !== priorSource) { priorSource = source; priorDocument = html.parse(source); }
    return structuredClone(priorDocument);
  }
  function setHead(doc, tag, attribute, key, value) {
    const head = find(doc, n => n.tagName === "head");
    let el = find(head, n => n.tagName === tag && attr(n, attribute) === key);
    if (!el) { el = html.parseFragment('<' + tag + ' ' + attribute + '="' + key + '">').childNodes[0]; el.parentNode = head; head.childNodes.push(el); }
    if (tag === "script") content(el, site.json(value)); else attr(el, tag === "link" ? "href" : "content", value);
  }
  async function render(id, page = 1, status = 200) {
    const meta = site.pages[id], doc = document(), main = marked(doc, "data-content-slot"), body = find(doc, n => n.tagName === "body");
    const template = find(doc, n => n.tagName === "template" && attr(n, "id") === meta.templateId);
    if (!template) throw new Error("页面模板不存在：" + meta.templateId);
    content(main, html.serialize(template.content));
    attr(body, "data-page", id); attr(body, "data-initial-route", "true"); attr(body, "data-site-origin", publicOrigin);
    const nav = find(doc, n => n.tagName === "nav" && (attr(n, "class") || "").split(" ").includes("site-nav"));
    if (nav) content(nav, site.nav(id).replace(/^<nav[^>]*>|<\/nav>$/g, ""));
    // Category links and card order use exactly the same source as the SPA.
    for (const section of ["games", "tools"]) {
      const grid = find(main, n => attr(n, "data-card-grid") === section);
      if (grid) content(grid, cards.renderGrid(cards[section]));
    }
    if (marked(main, "data-release-entry")) content(marked(main, "data-release-entry"), cards.renderCards(cards.releases));
    if (!marked(main, "data-music-help") && !marked(main, "data-page-help")) {
      const help = html.parseFragment(site.help(id)); help.childNodes.forEach(n => { n.parentNode = main; main.childNodes.push(n); });
    }
    if (id === "game-releases" || id === "game-releases-archive") {
      const archive = id.endsWith("archive"), data = archive ? await reader.archive() : await reader.snapshot();
      const date = core.today(data.timeZone, reader.now()), selection = releases.selection(data, archive, page, date);
      if (page > selection.pages) return null;
      text(marked(main, "data-release-heading"), archive ? "往期已发售游戏" : "游戏发售日历");
      text(marked(main, "data-release-intro"), archive ? "每周清单持续留存，回看那些已经发售的游戏。" : "每周二更新未来约 8 周的新游戏发售清单。");
      attr(marked(main, "data-releases"), "data-release-view", archive ? "archive" : "current");
      const list = marked(main, "data-release-list");
      content(list, selection.items.length ? releases.list(selection.items, date) : releases.empty(data.items.length ? "本期游戏均已发售" : archive ? "往期记录，陆续收录中" : "下一期速报，正在路上", "清单按实际发布的数据展示，发售日期请以信息来源为准。"));
      text(marked(main, "data-release-count"), String(selection.total).padStart(2, "0"));
      text(marked(main, "data-release-count-label"), archive ? "款已发售游戏" : "款即将发售");
      text(marked(main, "data-release-next-label"), archive ? "最近收录发售日" : "最近发售日");
      text(marked(main, "data-release-next"), selection.items[0]?.releaseDate.slice(5).replace("-", "/") || "—");
      text(marked(main, "data-release-result"), "显示 " + selection.items.length + " / " + selection.total + " 款");
      text(marked(main, "data-release-updated"), data.date ? "本期 " + data.date + " · 每周二更新" : "每周二更新");
      text(marked(main, "data-release-status"), "发售安排可能调整，请查看卡片信息来源核对。");
      attr(marked(main, "data-release-filters"), "hidden", data.items.length ? null : "");
      attr(marked(main, "data-release-history-label"), "hidden", archive ? "" : null);
      const link = marked(main, "data-release-view-link");
      attr(link, "href", site.href(archive ? "game-releases" : "game-releases-archive"));
      text(link, archive ? "← 返回本期发售" : "往期已发售 →");
      attr(marked(main, "data-release-more"), "hidden", "");
      attr(marked(main, "data-release-poster-open"), "hidden", archive ? "" : null);
      attr(marked(main, "data-release-poster-open"), "disabled", data.weeklyPoster ? null : "");
      content(marked(main, "data-release-pagination"), archive ? releases.pagination(page, selection.pages) : "");
      // Archive bootstraps only the displayed page; the API fills the interactive filters quietly.
      const bootstrap = { page, partial: archive, data: archive ? { ...data, items: selection.items } : data, date };
      const state = html.parseFragment('<script type="application/json" data-release-bootstrap>' + site.json(bootstrap) + '</script>');
      state.childNodes.forEach(n => { n.parentNode = main; main.childNodes.push(n); });
    }
    text(find(doc, n => n.tagName === "title"), site.title(id, page));
    setHead(doc, "meta", "name", "description", meta.description);
    setHead(doc, "meta", "name", "robots", status === 200 && meta.indexable ? "index,follow" : "noindex,follow");
    setHead(doc, "link", "rel", "canonical", publicOrigin + site.href(id, page));
    for (const [name, value] of Object.entries({ "og:title": site.title(id, page), "og:description": meta.description, "og:url": publicOrigin + site.href(id, page), "og:type": "website", "og:site_name": site.brand, "og:image": publicOrigin + "/logo/workspace-logo-lossless.webp" })) setHead(doc, "meta", "property", name, value);
    setHead(doc, "script", "type", "application/ld+json", site.structured(id, page, publicOrigin));
    const head = find(doc, n => n.tagName === "head");
    for (const url of meta.css || []) head.childNodes.push(...html.parseFragment('<link rel="stylesheet" href="/' + site.escape(url.replace(/^\//, "")) + '" data-dynamic-css>').childNodes);
    walk(doc, n => {
      for (const a of n.attrs || []) {
        if (a.name !== "href" && a.name !== "src") continue;
        if (a.value.startsWith("#/")) { const route = site.resolve(a.value); if (route) a.value = site.href(route); }
        else if (/^(?:\.\/)?(?:css|js|libs|logo|music)\//.test(a.value)) a.value = "/" + a.value.replace(/^\.\//, "");
        a.value = versionURL(a.value);
      }
    });
    return html.serialize(doc);
  }
  async function sitemap() {
    const entries = Object.entries(site.pages).filter(([, p]) => p.indexable && !p.aliasOf).map(([id, p]) => ({ url: publicOrigin + p.path, updated: p.updated, id }));
    const data = await reader.archive(), count = releases.selection(data, true, 1, core.today(data.timeZone, reader.now())).pages;
    for (let page = 2; page <= count; page++) entries.push({ url: publicOrigin + site.href("game-releases-archive", page) });
    // Release membership can change at midnight without publishing; omit uncertain lastmod.
    return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + entries.map(item => '<url><loc>' + site.escape(item.url) + '</loc>' + (item.updated && !item.id.startsWith("game-releases") ? '<lastmod>' + item.updated + '</lastmod>' : '') + '</url>').join("") + '</urlset>';
  }
  function robots() {
    return "User-agent: *\nAllow: /\nDisallow: /server/\nDisallow: /scripts/\nDisallow: /test-results/\nDisallow: /uploads/\n\n" + ["GPTBot", "ClaudeBot", "CCBot", "Bytespider", "Google-Extended", "Applebot-Extended", "Amazonbot", "Diffbot", "anthropic-ai", "Claude-Web", "cohere-ai", "MistralAI-Training", "meta-externalagent", "GoogleOther", "PetalBot", "AwarioSmartBot", "AwarioRssBot", "Google-CloudVertexBot", "QualifiedBot", "Cotoyogi", "ICC-Crawler", "atlassian-bot", "FishBot", "BorderxBot", "NavuBot", "SemrushBot-SWA", "WARDBot", "magpie-crawler", "KimiBot", "CitibotSiteCrawler", "omgili"].map(bot => 'User-agent: ' + bot + '\nDisallow: /\n').join("\n") + '\nSitemap: ' + publicOrigin + '/sitemap.xml\n';
  }
  function errorPage(status, message) { return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex,follow"><title>' + status + ' - ' + site.brand + '</title><link rel="stylesheet" href="/css/base.css"><link rel="stylesheet" href="/css/components.css"></head><body><main class="card" style="margin:10vh auto;padding:28px;max-width:650px"><h1>' + status + '</h1><p>' + site.escape(message) + '</p><a href="/">回到首页</a> · <a href="/tools">工具箱</a> · <a href="/games">游戏中心</a></main></body></html>'; }
  async function middleware(req, res, next) {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    res.setHeader("Cache-Control", "public, no-cache"); res.setHeader("Cloudflare-CDN-Cache-Control", "no-cache");
    try {
      if (req.path === "/robots.txt") return res.type("text/plain").send(robots());
      if (req.path === "/sitemap.xml") return res.type("application/xml").send(await sitemap());
      if (req.path === "/index.html" || req.path === "/home") return res.redirect(301, "/" + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""));
      const id = site.resolve(req.path);
      if (!id) {
        const old = req.path.replace(/^\/|\/$/g, "");
        if (site.has(old)) return res.redirect(301, site.href(old) + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""));
        return next();
      }
      if (req.path !== site.href(id)) return res.redirect(301, site.href(id) + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""));
      const page = id === "game-releases-archive" ? site.pageNumber(req.url.split("?")[1]) : 1;
      if (!page) return res.status(400).type("html").send(errorPage(400, "分页参数无效"));
      if (id === "game-releases-archive" && req.query.page === "1") return res.redirect(301, site.href(id));
      const result = await render(id, page);
      if (result === null) return res.status(404).type("html").send(errorPage(404, "没有这一页往期记录"));
      res.type("html").send(result);
    } catch (error) {
      console.error("[pages]", error.message);
      res.setHeader("Retry-After", "60");
      res.status(503).type("html").send(errorPage(503, "页面暂时无法读取，请稍后重试。"));
    }
  }
  return { middleware, render, sitemap, robots, errorPage, publicOrigin };
}
module.exports = { createSEO, origin, walk, attr, find, marked };
