(function () {
  "use strict";
  var core = window.GameReleasesCore;
  function createPage(archive) {
    var root, data, controller, timeout, dateTimer, renderedDate, generation = 0, platform = "all", query = "", includeReleased = false, dialog, opener;
    var archivePage = 1, bootstrapPartial = false;
    var cachedData = null, preparation = null, preparationController = null, preparationTimeout = null, preparationFailed = false, preparedFresh = false;
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
      var box = node("div", "release-empty card page-chunk"); box.setAttribute("data-reveal-order", "4");
      box.append(node("span", "release-empty__icon", "◈"), node("h2", "", title), node("p", "", message));
      list.append(box); reveal();
    }
    function reveal() {
      if (window.ClaudeOne && window.ClaudeOne.refreshReveal) window.ClaudeOne.refreshReveal();
    }
    function render() {
      if (!root || !data || bootstrapPartial) return;
      var date = core.today(data.timeZone);
      renderedDate = date;
      var future = core.filter(data.items, { today: date });
      var allItems = core.filter(data.items, { today: date, platform: platform, query: query, includeReleased: includeReleased, archive: archive });
      if (archive) allItems.sort(function (a, b) { return b.releaseDate.localeCompare(a.releaseDate) || a.searchName.localeCompare(b.searchName); });
      var pageCount = Math.max(1, Math.ceil(allItems.length / 60));
      if (archivePage > pageCount) { changePage(pageCount, true); return; }
      var items = archive ? allItems.slice((archivePage - 1) * 60, archivePage * 60) : allItems;
      find("[data-release-more]").hidden = true;
      var pager = find("[data-release-pagination]");
      if (pager) pager.innerHTML = archive ? window.ReleaseHTML.pagination(archivePage, pageCount) : "";
      find("[data-release-count]").textContent = String(archive ? data.items.length : future.length).padStart(2, "0");
      find("[data-release-next]").textContent = archive ? (data.items[0] ? data.items[0].releaseDate.slice(5).replace("-", "/") : "—") : future.length ? future[0].releaseDate.slice(5).replace("-", "/") : "—";
      find("[data-release-result]").textContent = "显示 " + items.length + (items.length < allItems.length ? " / " + allItems.length : "") + " 款";
      find("[data-release-updated]").textContent = archive ? "按发售日期由近到远排列" : data.date ? "本期 " + data.date + " · 每周二更新" : "每周二更新";
      find("[data-release-poster-open]").disabled = !data.weeklyPoster;
      find("[data-release-refresh]").disabled = false;
      find("[data-release-filters]").hidden = !data.items.length;
      if (!data.items.length) { status("发售日期以官方公布为准"); showEmpty(archive ? "往期记录，陆续收录中" : "下一期速报，正在路上", archive ? "清单中已过发售日的游戏会保留在这里，之后每周更新也不会清空。" : "首期游戏清单发布后会显示在这里，每周二更新未来约 8 周的发售信息。"); return; }
      var age = core.daysBetween(data.date, date);
      status(archive ? "历期清单中已过发售日的游戏会自动保留；日期按已公布信息判断，可查看来源核对。" : age > 8 ? "本期已 " + age + " 天未更新，发售日期请以官方页面为准。" : "发售安排可能调整，点击卡片来源可核对最新信息。");
      if (!items.length) { showEmpty(archive || future.length || query || platform !== "all" ? "没有匹配的游戏" : "本期游戏均已发售", archive ? "试试其他平台或关键词。" : "试试其他平台或关键词；已发售游戏可查看往期记录，或勾选显示本期已发售游戏。"); return; }
      var list = find("[data-release-list]");
      list.innerHTML = window.ReleaseHTML.list(items, date);
      reveal();
    }
    function checkDate() {
      if (!root || !data || bootstrapPartial || document.hidden) return;
      if (core.today(data.timeZone) !== renderedDate) { render(); if (archive) load(true); }
    }
    function watchDate() {
      clearInterval(dateTimer); dateTimer = null;
      if (root) root.setAttribute("data-release-motion", document.hidden ? "paused" : "running");
      if (document.hidden) return;
      checkDate();
      // Only rebuild cards when the edition's local calendar date changes.
      dateTimer = setInterval(checkDate, 60000);
    }
    async function readSnapshot(signal) {
      var base = window.CLAUDE_ONE_CONFIG.api.baseUrl || "";
      var response = await fetch(base + "/api/game-releases" + (archive ? "/archive" : ""), { signal: signal, cache: "no-cache" });
      if (!response.ok) throw new Error("http");
      var next = await response.json();
      if (!core.valid(next, archive)) throw new Error("data");
      return next;
    }
    function cancelPrepare() {
      if (preparationController) preparationController.abort();
    }
    function prepare() {
      preparedFresh = false;
      if (cachedData) return Promise.resolve();
      if (preparation) return preparation;
      preparationFailed = false;
      var request = new AbortController(); preparationController = request;
      preparationTimeout = setTimeout(function () { request.abort(); }, 12000);
      preparation = readSnapshot(request.signal).then(function (next) {
        if (!request.signal.aborted) { cachedData = next; preparedFresh = true; }
      }).catch(function () { preparationFailed = true; }).finally(function () {
        clearTimeout(preparationTimeout); preparationTimeout = null;
        preparationController = null; preparation = null;
      });
      return preparation;
    }
    async function load(quiet) {
      if (controller) controller.abort(); clearTimeout(timeout);
      var token = ++generation, request = new AbortController(); controller = request;
      find("[data-release-refresh]").disabled = true;
      if (!quiet) status(archive ? "正在读取往期记录…" : "正在读取发售清单…");
      if (!data) showEmpty("正在加载", archive ? "马上为你带来往期已发售游戏。" : "马上为你带来本期发售清单。");
      timeout = setTimeout(function () { request.abort(); }, 12000);
      try {
        var next = await readSnapshot(request.signal);
        if (generation !== token || !root) return;
        cachedData = next;
        if (quiet && data && !bootstrapPartial && data.revision === next.revision) {
          data = next; checkDate(); find("[data-release-refresh]").disabled = false;
        } else { data = next; bootstrapPartial = false; render(); }
      } catch (_) {
        if (generation !== token || !root) return;
        if (!data) showEmpty(archive ? "暂时无法读取往期记录" : "暂时无法读取速报", "请点击刷新重试。");
        status(data ? "刷新失败，仍显示上次读取的清单。请稍后重试。" : (archive ? "往期记录读取失败，请稍后重试。" : "发售清单读取失败，请稍后重试。"), true);
        find("[data-release-refresh]").disabled = false;
      } finally { if (generation === token) { clearTimeout(timeout); controller = null; } }
    }
    function closePoster() { if (dialog.open) dialog.close(); }
    function changePage(number, replace) {
      archivePage = number;
      if (archive && window.__ClaudeOneRouter) window.__ClaudeOneRouter.go("game-releases-archive", { search: number > 1 ? "?page=" + number : "", replace: !!replace });
      else render();
    }
    function setPage(number) { archivePage = number; render(); }
    function onImageError(event) {
      if (event.target.matches && event.target.matches(".release-card__cover")) event.target.remove();
    }
    function onClick(event) {
      var button = event.target.closest("[data-release-platform]");
      if (button && root.contains(button)) {
        platform = button.dataset.releasePlatform;
        archivePage = 1;
        root.querySelectorAll("[data-release-platform]").forEach(function (el) { el.setAttribute("aria-pressed", String(el === button)); }); changePage(1, true);
      }
      if (event.target.closest("[data-release-refresh]")) load(false);
      if (event.target.closest("[data-release-more]")) changePage(archivePage + 1);
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
    function onInput(event) { if (event.target.matches("[data-release-search]")) { query = event.target.value; changePage(1, true); } }
    function onChange(event) { if (event.target.matches("[data-release-history]")) { includeReleased = event.target.checked; render(); } }
    function onClose() { if (opener && opener.isConnected) opener.focus(); find("[data-release-poster]").removeAttribute("src"); }
    function onPosterError() { find("[data-release-poster-error]").hidden = false; }
    function mount(container) {
      unmount(); root = container.querySelector("[data-releases]"); if (!root) return;
      platform = "all"; query = ""; includeReleased = false; archivePage = archive ? window.SitePages.pageNumber(window.location && window.location.search) || 1 : 1; bootstrapPartial = false; data = cachedData; renderedDate = data ? core.today(data.timeZone) : null;
      var boot;
      try {
        var bootNode = container.querySelector("script[data-release-bootstrap]");
        if (bootNode && typeof bootNode.textContent === "string") {
          boot = JSON.parse(bootNode.textContent);
          if (!core.valid(boot.data, archive)) boot = null;
          else { data = boot.data; archivePage = boot.page; bootstrapPartial = boot.partial; if (!boot.partial) cachedData = data; }
        }
      } catch (_) { boot = null; }
      root.setAttribute("data-release-view", archive ? "archive" : "current");
      find("[data-release-heading]").textContent = archive ? "往期已发售游戏" : "下一款，玩什么？";
      find("[data-release-intro]").textContent = archive ? "每周清单持续留存，回看那些已经发售的游戏。" : "每周二更新未来约 8 周的新游戏发售清单。";
      find("[data-release-count-label]").textContent = archive ? "款已发售游戏" : "款即将发售";
      find("[data-release-next-label]").textContent = archive ? "最近收录发售日" : "最近发售日";
      var link = find("[data-release-view-link]"); link.href = window.SitePages.href(archive ? "game-releases" : "game-releases-archive");
      link.textContent = archive ? "← 返回本期发售" : "往期已发售 →";
      link.title = archive ? "返回本期游戏发售清单" : "查看往期已发售的游戏";
      find("[data-release-poster-open]").hidden = archive;
      find("[data-release-history-label]").hidden = archive;
      find("[data-release-history]").checked = false;
      dialog = find("[data-release-dialog]");
      root.addEventListener("error", onImageError, true); root.addEventListener("click", onClick); root.addEventListener("input", onInput); root.addEventListener("change", onChange);
      dialog.addEventListener("close", onClose); find("[data-release-poster]").addEventListener("error", onPosterError);
      document.addEventListener("visibilitychange", watchDate); window.addEventListener("focus", checkDate);
      watchDate();
      if (boot) { load(true); }
      else if (data) { render(); if (!preparedFresh) load(true); preparedFresh = false; }
      else if (preparationFailed) {
        showEmpty(archive ? "暂时无法读取往期记录" : "暂时无法读取速报", "请点击刷新重试。");
        status((archive ? "往期记录读取失败，请稍后重试。" : "发售清单读取失败，请稍后重试。"), true);
        find("[data-release-refresh]").disabled = false;
      } else load(false);
    }
    function unmount() {
      ++generation; if (controller) controller.abort(); clearTimeout(timeout); controller = null;
      clearInterval(dateTimer); dateTimer = null;
      document.removeEventListener("visibilitychange", watchDate); window.removeEventListener("focus", checkDate);
      if (root) {
        if (dialog.open) dialog.close();
        root.removeEventListener("error", onImageError, true); root.removeEventListener("click", onClick); root.removeEventListener("input", onInput); root.removeEventListener("change", onChange);
        dialog.removeEventListener("close", onClose); find("[data-release-poster]").removeEventListener("error", onPosterError);
        find("[data-release-poster]").removeAttribute("src");
      }
      root = null; data = null; dialog = null; opener = null; renderedDate = null;
    }
    return { prepare: prepare, cancelPrepare: cancelPrepare, mount: mount, unmount: unmount, setPage: setPage };
  }
  window.__page_game_releases = createPage(false);
  window.__page_game_releases_archive = createPage(true);
})();
