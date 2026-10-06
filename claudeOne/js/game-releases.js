(function () {
  "use strict";
  var core = window.GameReleasesCore;
  var root, data, controller, timeout, dateTimer, renderedDate, generation = 0, platform = "all", query = "", includeReleased = true, dialog, opener;
  function find(selector) { return root.querySelector(selector); }
  function node(tag, className, value) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined) el.textContent = value;
    return el;
  }
  function status(message, error) {
    find("[data-release-status]").textContent = message;
    find("[data-release-status]").classList.toggle("release-status--error", !!error);
  }
  function showEmpty(title, message) {
    var list = find("[data-release-list]"); list.replaceChildren();
    var box = node("div", "release-empty card");
    box.append(node("span", "release-empty__icon", "◈"), node("h2", "", title), node("p", "", message));
    list.append(box);
  }
  function card(item, date) {
    var el = node("article", "release-card card");
    var media = node("div", "release-card__media");
    var fallback = node("div", "release-card__fallback"); fallback.append(node("span", "", "GAME RELEASE"), node("strong", "", item.title));
    media.append(fallback);
    if (item.cover) {
      var img = node("img", "release-card__cover"); img.alt = item.title + " 游戏封面"; img.loading = "lazy"; img.decoding = "async";
      img.addEventListener("error", function () { img.remove(); }, { once: true }); img.src = item.cover; media.append(img);
    }
    var countdown = core.daysBetween(date, item.releaseDate);
    var badge = node("span", "release-card__badge");
    badge.setAttribute("data-release-state", countdown < 0 ? "released" : countdown === 0 ? "today" : countdown === 1 ? "tomorrow" : "upcoming");
    if (countdown === 1) {
      badge.append(node("strong", "release-card__badge-text", "明天"));
      badge.setAttribute("aria-label", "明天发售");
    } else if (countdown > 1) {
      badge.append(node("strong", "release-card__badge-value", String(countdown)), node("span", "", "天后"));
      badge.setAttribute("aria-label", "还有 " + countdown + " 天发售");
    } else {
      badge.append(node("strong", "release-card__badge-text", countdown === 0 ? "今日发售" : "已发售"));
    }
    el.append(media);
    var body = node("div", "release-card__body");
    var time = node("time", "release-card__date"); time.dateTime = item.releaseDate;
    time.append(node("span", "release-card__date-label", "发售"), node("strong", "", item.releaseDate.replace(/-/g, ".")));
    var schedule = node("div", "release-card__schedule"); schedule.append(time, badge);
    body.append(schedule, node("h3", "release-card__title", item.title));
    if (item.title !== item.searchName) body.append(node("p", "release-card__english", item.searchName));
    var platforms = node("div", "release-card__platforms"); item.platforms.forEach(function (p) { platforms.append(node("span", "release-platform", p)); }); body.append(platforms, node("p", "release-card__summary", item.summary));
    var sources = node("details", "release-card__sources"); sources.append(node("summary", "", "查看信息来源 ↗"));
    item.sourceUrls.forEach(function (url) {
      var link = node("a", "", new URL(url).hostname); link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer"; sources.append(link);
    }); body.append(sources); el.append(body); return el;
  }
  function render() {
    if (!root || !data) return;
    var date = core.today(data.timeZone);
    renderedDate = date;
    var future = core.filter(data.items, { today: date });
    var items = core.filter(data.items, { today: date, platform: platform, query: query, includeReleased: includeReleased });
    find("[data-release-count]").textContent = String(future.length).padStart(2, "0");
    find("[data-release-next]").textContent = future.length ? future[0].releaseDate.slice(5).replace("-", "/") : "—";
    find("[data-release-result]").textContent = "显示 " + items.length + " 款";
    find("[data-release-updated]").textContent = data.date ? "本期 " + data.date + " · 每周二更新" : "每周二更新";
    find("[data-release-poster-open]").disabled = !data.weeklyPoster;
    find("[data-release-refresh]").disabled = false;
    find("[data-release-filters]").hidden = !data.items.length;
    if (!data.items.length) { status("发售日期以官方公布为准"); showEmpty("下一期速报，正在路上", "首期游戏清单发布后会显示在这里，每周二更新未来约 8 周的发售信息。"); return; }
    var age = core.daysBetween(data.date, date);
    status(age > 8 ? "本期已 " + age + " 天未更新，发售日期请以官方页面为准。" : "发售安排可能调整，点击卡片来源可核对最新信息。");
    if (!items.length) { showEmpty("没有匹配的游戏", "试试其他平台或关键词；也可以勾选显示本期已发售游戏。"); return; }
    var list = find("[data-release-list]"); list.replaceChildren();
    var month = "", grid;
    items.forEach(function (item) {
      if (item.releaseDate.slice(0, 7) !== month) {
        month = item.releaseDate.slice(0, 7);
        var section = node("section", "release-month");
        section.append(node("h2", "release-month__title", month.slice(0, 4) + " / " + month.slice(5) + " 月发售"));
        grid = node("div", "release-grid"); section.append(grid); list.append(section);
      }
      grid.append(card(item, date));
    });
  }
  function checkDate() {
    if (!root || !data || document.hidden) return;
    if (core.today(data.timeZone) !== renderedDate) render();
  }
  function watchDate() {
    clearInterval(dateTimer); dateTimer = null;
    if (root) root.setAttribute("data-release-motion", document.hidden ? "paused" : "running");
    if (document.hidden) return;
    checkDate();
    // Only rebuild cards when the edition's local calendar date changes.
    dateTimer = setInterval(checkDate, 60000);
  }
  async function load() {
    if (controller) controller.abort(); clearTimeout(timeout);
    var token = ++generation, request = new AbortController(); controller = request;
    find("[data-release-refresh]").disabled = true; status("正在读取发售清单…");
    if (!data) showEmpty("正在加载", "马上为你带来本期发售清单。");
    timeout = setTimeout(function () { request.abort(); }, 12000);
    try {
      var base = window.CLAUDE_ONE_CONFIG.api.baseUrl || "";
      var response = await fetch(base + "/api/game-releases", { signal: request.signal, cache: "no-cache" });
      if (!response.ok) throw new Error("http");
      var next = await response.json();
      if (!core.valid(next)) throw new Error("data");
      if (generation !== token || !root) return;
      data = next; render();
    } catch (_) {
      if (generation !== token || !root) return;
      if (!data) showEmpty("暂时无法读取速报", "请点击刷新重试。");
      status(data ? "刷新失败，仍显示上次读取的清单。请稍后重试。" : "发售清单读取失败，请稍后重试。", true);
      find("[data-release-refresh]").disabled = false;
    } finally { if (generation === token) { clearTimeout(timeout); controller = null; } }
  }
  function closePoster() { if (dialog.open) dialog.close(); }
  function onClick(event) {
    var button = event.target.closest("[data-release-platform]");
    if (button && root.contains(button)) {
      platform = button.dataset.releasePlatform;
      root.querySelectorAll("[data-release-platform]").forEach(function (el) { el.setAttribute("aria-pressed", String(el === button)); }); render();
    }
    if (event.target.closest("[data-release-refresh]")) load();
    if (event.target.closest("[data-release-poster-close]")) closePoster();
    if (event.target === dialog) closePoster();
    if (event.target.closest("[data-release-poster-open]") && data && data.weeklyPoster) {
      opener = event.target.closest("button");
      find("[data-release-poster-error]").hidden = true;
      find("[data-release-poster]").src = data.weeklyPoster;
      var download = find("[data-release-poster-download]"); download.href = data.weeklyPoster; download.download = "game-news-weekly-" + data.date + ".png";
      dialog.showModal();
    }
  }
  function onInput(event) { if (event.target.matches("[data-release-search]")) { query = event.target.value; render(); } }
  function onChange(event) { if (event.target.matches("[data-release-history]")) { includeReleased = event.target.checked; render(); } }
  function onClose() { if (opener && opener.isConnected) opener.focus(); find("[data-release-poster]").removeAttribute("src"); }
  function onPosterError() { find("[data-release-poster-error]").hidden = false; }
  function mount(container) {
    unmount(); root = container.querySelector("[data-releases]"); if (!root) return;
    platform = "all"; query = ""; includeReleased = true; data = null; renderedDate = null;
    find("[data-release-history]").checked = true;
    dialog = find("[data-release-dialog]");
    root.addEventListener("click", onClick); root.addEventListener("input", onInput); root.addEventListener("change", onChange);
    dialog.addEventListener("close", onClose); find("[data-release-poster]").addEventListener("error", onPosterError);
    document.addEventListener("visibilitychange", watchDate); window.addEventListener("focus", checkDate);
    watchDate();
    load();
  }
  function unmount() {
    ++generation; if (controller) controller.abort(); clearTimeout(timeout); controller = null;
    clearInterval(dateTimer); dateTimer = null;
    document.removeEventListener("visibilitychange", watchDate); window.removeEventListener("focus", checkDate);
    if (root) {
      if (dialog.open) dialog.close();
      root.removeEventListener("click", onClick); root.removeEventListener("input", onInput); root.removeEventListener("change", onChange);
      dialog.removeEventListener("close", onClose); find("[data-release-poster]").removeEventListener("error", onPosterError);
      find("[data-release-poster]").removeAttribute("src");
    }
    root = null; data = null; dialog = null; opener = null; renderedDate = null;
  }
  window.__page_game_releases = { mount: mount, unmount: unmount };
})();
