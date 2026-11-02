(function (root, factory) {
  var api = factory(typeof module === "object" && module.exports ? require("./game-releases-core") : root.GameReleasesCore,
    typeof module === "object" && module.exports ? require("./site-pages") : root.SitePages);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ReleaseHTML = api;
})(typeof window !== "undefined" ? window : null, function (core, site) {
  "use strict";
  var e = site.escape, size = 60;
  function selection(data, archive, page, date) {
    var all = core.filter(data.items, { today: date || core.today(data.timeZone), archive: archive });
    if (archive) all.sort(function (a, b) { return b.releaseDate.localeCompare(a.releaseDate) || a.searchName.localeCompare(b.searchName); });
    return { items: archive ? all.slice((page - 1) * size, page * size) : all, total: all.length, pages: Math.max(1, Math.ceil(all.length / size)) };
  }
  function card(item, date) {
    var days = core.daysBetween(date, item.releaseDate), state = days < 0 ? "released" : days === 0 ? "today" : days === 1 ? "tomorrow" : "upcoming";
    var badge = days > 1 ? '<strong class="release-card__badge-value">' + days + '</strong><span>天后</span>' : '<strong class="release-card__badge-text">' + (days < 0 ? "已发售" : days === 0 ? "今日发售" : "明天") + '</strong>';
    return '<article class="release-card card page-chunk" data-reveal-order="4"><div class="release-card__media"><div class="release-card__fallback"><span>GAME RELEASE</span><strong>' + e(item.title) + '</strong></div>' + (item.cover ? '<img class="release-card__cover" data-loaded="true" src="' + e(item.cover) + '" alt="' + e(item.title) + ' 游戏封面" loading="lazy" decoding="async">' : '') + '</div><div class="release-card__body"><div class="release-card__schedule"><time class="release-card__date" datetime="' + e(item.releaseDate) + '"><span class="release-card__date-label">发售</span><strong>' + e(item.releaseDate.replace(/-/g, ".")) + '</strong></time><span class="release-card__badge" data-release-state="' + state + '">' + badge + '</span></div><h3 class="release-card__title">' + e(item.title) + '</h3>' + (item.title !== item.searchName ? '<p class="release-card__english">' + e(item.searchName) + '</p>' : '') + '<div class="release-card__platforms">' + item.platforms.map(function (p) { return '<span class="release-platform">' + e(p) + '</span>'; }).join("") + '</div><p class="release-card__summary">' + e(item.summary) + '</p><details class="release-card__sources"><summary>查看信息来源 ↗</summary>' + item.sourceUrls.map(function (url) { return '<a href="' + e(url) + '" target="_blank" rel="noopener noreferrer">' + e(new URL(url).hostname) + '</a>'; }).join("") + '</details></div></article>';
  }
  function list(items, date) {
    var month = "", html = "";
    items.forEach(function (item) {
      var next = item.releaseDate.slice(0, 7);
      if (next !== month) { if (month) html += '</div></section>'; month = next; html += '<section class="release-month"><h2 class="release-month__title page-chunk" data-reveal-order="3">' + e(month.replace("-", " / ")) + ' 月发售</h2><div class="release-grid">'; }
      html += card(item, date);
    });
    return html + (month ? '</div></section>' : "");
  }
  function pagination(page, pages) {
    if (pages <= 1) return "";
    return (page > 1 ? '<a class="btn" data-nav-link href="' + site.href("game-releases-archive", page - 1) + '">← 上一页</a>' : '') + '<span>第 ' + page + ' / ' + pages + ' 页</span>' + (page < pages ? '<a class="btn" data-nav-link href="' + site.href("game-releases-archive", page + 1) + '">下一页 →</a>' : '');
  }
  function empty(title, text) { return '<div class="release-empty card page-chunk" data-reveal-order="4"><h2>' + e(title) + '</h2><p>' + e(text) + '</p></div>'; }
  return { size: size, selection: selection, list: list, pagination: pagination, empty: empty };
});
