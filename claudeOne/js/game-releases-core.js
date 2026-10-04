(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GameReleasesCore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  function today(timeZone, now) {
    return new Intl.DateTimeFormat("sv-SE", { timeZone: timeZone || "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now || new Date());
  }
  function addDays(date, days) { return new Date(Date.parse(date + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.floor((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000); }
  function filter(items, options) {
    var query = (options.query || "").trim().toLocaleLowerCase();
    var end = addDays(options.today, 56);
    return items.filter(function (item) {
      var platform = options.platform || "all";
      var matchesPlatform = platform === "all" || (platform === "mobile" ? item.platforms.some(function (p) { return p === "iOS" || p === "Android"; }) : item.platforms.indexOf(platform) !== -1);
      return matchesPlatform && item.releaseDate <= end && (options.includeReleased || item.releaseDate >= options.today) && (!query || (item.title + " " + item.searchName + " " + item.summary).toLocaleLowerCase().includes(query));
    });
  }
  function asset(value) { return typeof value === "string" && /^\/api\/game-releases\/assets\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(value); }
  function safeSource(value) {
    try {
      var url = new URL(value), host = url.hostname.toLowerCase().replace(/\.+$/, "");
      return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") && host.includes(".") && !host.includes(":") && !/^(\d{1,3}\.){3}\d{1,3}$/.test(host) && !/(^|\.)(localhost|local|internal|test|invalid)$/.test(host);
    } catch (_) { return false; }
  }
  function valid(data) {
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.items) || data.items.length > 15) return false;
    try { today(data.timeZone); } catch (_) { return false; }
    if (!data.items.length) return data.date === null && data.revision === null && data.weeklyPoster === null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !/^[a-f0-9]{64}$/.test(data.revision) || !asset(data.weeklyPoster)) return false;
    var allowed = ["PC", "PS5", "Xbox Series X|S", "Switch 2", "iOS", "Android"];
    return data.items.every(function (item) {
      if (!item || !/^[a-f0-9]{24}$/.test(item.id) || typeof item.title !== "string" || !item.title || item.title.length > 160 || typeof item.searchName !== "string" || item.searchName.length > 160 || typeof item.summary !== "string" || item.summary.length > 220 || !/^\d{4}-\d{2}-\d{2}$/.test(item.releaseDate)) return false;
      try { if (addDays(item.releaseDate, 0) !== item.releaseDate) return false; } catch (_) { return false; }
      return Array.isArray(item.platforms) && item.platforms.length > 0 && item.platforms.length <= 6 && item.platforms.every(function (p) { return allowed.includes(p); }) && Array.isArray(item.sourceUrls) && item.sourceUrls.length > 0 && item.sourceUrls.length <= 4 && item.sourceUrls.every(safeSource) && (!item.cover || asset(item.cover));
    });
  }
  return { today: today, addDays: addDays, daysBetween: daysBetween, filter: filter, asset: asset, valid: valid };
});
