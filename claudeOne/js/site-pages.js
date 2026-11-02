/* Shared, DOM-free route and page-content contract for Express and the SPA. */
(function (root, factory) {
  var api = factory(typeof module === "object" && module.exports ? require("./page-registry") : root.__CLAUDEONE_PAGES);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SitePages = api;
})(typeof window !== "undefined" ? window : null, function (pages) {
  "use strict";
  var origin = "https://moufang.xyz", brand = "魔方的妙妙工具";
  function escape(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function has(id) { return Object.prototype.hasOwnProperty.call(pages, id); }
  function key(id) { return has(id) && pages[id].aliasOf || id; }
  function href(id, page) {
    var meta = has(key(id)) ? pages[key(id)] : null;
    return (meta && meta.path || "/") + (key(id) === "game-releases-archive" && page > 1 ? "?page=" + page : "");
  }
  function resolve(value) {
    var hash = typeof value === "string" && value.indexOf("#/") === 0 ? value : value.hash || "";
    if (hash.indexOf("#/") === 0) { var old = hash.slice(2).split("?")[0] || "home"; return has(old) ? key(old) : null; }
    var pathname = typeof value === "string" ? value.split(/[?#]/)[0] : value.pathname || "/";
    if (pathname.length > 1) pathname = pathname.replace(/\/+$/, "");
    return Object.keys(pages).find(function (id) { return pages[id].path === pathname; }) || null;
  }
  function pageNumber(search) { var n = new URLSearchParams(search || "").get("page"); return n === null ? 1 : /^[1-9]\d*$/.test(n) && Number.isSafeInteger(Number(n)) ? Number(n) : 0; }
  function title(id, page) { return (id === "home" ? "在线工具、网页小游戏与游戏发售" : pages[key(id)].title) + (page > 1 ? " · 第 " + page + " 页" : "") + " - " + brand; }
  function nav(id) {
    return '<nav class="site-nav" aria-label="主导航">' + [["home", "首页"], ["games", "游戏"], ["game-releases", "游戏发售"], ["tools", "工具箱"]].map(function (item) {
      return '<a href="' + href(item[0]) + '" data-nav-link' + (pages[key(id)].navSection === item[0] ? ' aria-current="page"' : "") + '>' + item[1] + '</a>';
    }).join("") + '</nav>';
  }
  function help(id) {
    var meta = pages[key(id)], h = meta.help;
    if (!h) return "";
    return '<details class="page-help card page-chunk" data-page-help data-reveal-order="7"><summary>使用帮助<span>用途、操作步骤与常见问题</span></summary><div class="page-help__body"><h2>' + escape(meta.title) + '怎么使用？</h2><p>' + escape(meta.description) + '</p><h3>操作步骤</h3><ol>' + h.steps.map(function (s) { return '<li>' + escape(s) + '</li>'; }).join("") + '</ol><h3>使用范围与限制</h3><ul>' + h.limits.map(function (s) { return '<li>' + escape(s) + '</li>'; }).join("") + '</ul>' + h.faq.map(function (q) { return '<h3>' + escape(q[0]) + '</h3><p>' + escape(q[1]) + '</p>'; }).join("") + '</div></details>';
  }
  function structured(id, page, siteOrigin) {
    var meta = pages[key(id)], url = (siteOrigin || origin) + href(id, page);
    return { "@context": "https://schema.org", "@type": id === "home" ? "WebSite" : ["games", "tools", "game-releases", "game-releases-archive"].includes(id) ? "CollectionPage" : "WebPage", name: id === "home" ? brand : meta.title, description: meta.description, url: url, inLanguage: "zh-CN" };
  }
  function json(value) { return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029"); }
  return Object.freeze({ pages: pages, origin: origin, brand: brand, escape: escape, has: has, key: key, href: href, resolve: resolve, pageNumber: pageNumber, title: title, nav: nav, help: help, structured: structured, json: json });
});
