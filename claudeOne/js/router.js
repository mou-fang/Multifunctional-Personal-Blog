/* ===== claudeOne :: router.js =====
 * SPA History API router (legacy Hash addresses supported). Responsibilities:
 *   - Intercept nav clicks ([data-nav-link]) and hashchange events.
 *   - Unmount current page, load new page from <template>, mount.
 *   - Manage page-specific CSS/JS lifecycle.
 *   - Update document metadata and URL.
 *   - Animate page transitions.
 */

(function initRouter() {
  var PAGES = window.__CLAUDEONE_PAGES;
  var site = window.SitePages;
  var currentSearch = "";
  if (!PAGES) {
    console.error("[router] Page registry missing — did page-registry.js load?");
    return;
  }

  var currentPage = null;
  var currentLifecycle = null;
  var loadedCSS = {};   // url -> true
  var loadedJS = {};    // url -> true
  var isNavigating = false;
  var pendingNavigation = null;
  var readyResolvers = {};
  var preparingLifecycle = null;
  var navigatingPage = null;

  var TRANSITION_MS = 260;  // must match CSS exit animation duration

  /* ---- Helpers ------------------------------------------------------------ */
  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function updateMetaDescription(desc) {
    var meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute("content", desc);
  }

  function resolveRoute() {
    return site.resolve(window.location) || "home";
  }
  function searchForLocation() {
    var hash = window.location.hash || "";
    return hash.indexOf("#/") === 0 && hash.indexOf("?") >= 0 ? hash.slice(hash.indexOf("?")) : window.location.search || "";
  }
  function updateURL(pageName, opts) {
    var search = opts.search !== undefined ? opts.search : currentPage === pageName ? currentSearch : "";
    var target = site.href(pageName) + search;
    if (opts.history !== false && ((window.location.pathname || "/") + (window.location.search || "") !== target || window.location.hash)) {
      history[opts.replace ? "replaceState" : "pushState"](null, "", target);
    }
    currentSearch = search;
  }
  function updatePageMetadata(pageName) {
    var meta = PAGES[pageName], page = pageName === "game-releases-archive" ? site.pageNumber(currentSearch) || 1 : 1;
    document.title = site.title(pageName, page);
    updateMetaDescription(meta.description);
    var canonical = document.querySelector('link[rel="canonical"]');
    var origin = document.body.getAttribute("data-site-origin") || site.origin;
    if (canonical) canonical.setAttribute("href", origin + site.href(pageName, page));
    ["og:title", "og:description", "og:url"].forEach(function (key) {
      var el = document.querySelector('meta[property="' + key + '"]');
      if (el) el.setAttribute("content", key === "og:title" ? document.title : key === "og:description" ? meta.description : origin + site.href(pageName, page));
    });
    var data = document.querySelector('script[type="application/ld+json"]');
    if (data) data.textContent = site.json(site.structured(pageName, page, origin));
  }
  function ensureHelp(main, pageName) {
    if (!PAGES[pageName].help || main.querySelector("[data-page-help], [data-music-help]")) return;
    var host = document.createElement("div"); host.innerHTML = site.help(pageName);
    while (host.firstChild) main.appendChild(host.firstChild);
  }

  function finishNavigation() {
    isNavigating = false;
    navigatingPage = null;
    if (!pendingNavigation) return;

    var next = pendingNavigation;
    pendingNavigation = null;
    if (next.pageName !== currentPage || next.opts.search !== currentSearch) {
      setTimeout(function () {
        navigateTo(next.pageName, next.opts);
      }, 0);
    }
  }

  function resolveReady(pageName) {
    var waiters = readyResolvers[pageName] || [];
    delete readyResolvers[pageName];
    waiters.forEach(function (resolve) { resolve(pageName); });
    window.dispatchEvent(new CustomEvent("claudeone:router-ready", {
      detail: {
        page: pageName,
        lifecycle: currentLifecycle || null,
        meta: PAGES[pageName] || null,
      },
    }));
  }

  function whenReady(pageName) {
    pageName = pageName || currentPage || resolveRoute();
    if (pageName === currentPage && !isNavigating) return Promise.resolve(pageName);
    return new Promise(function (resolve) {
      if (!readyResolvers[pageName]) readyResolvers[pageName] = [];
      readyResolvers[pageName].push(resolve);
    });
  }

  /* ---- CSS loading -------------------------------------------------------- */
  function loadCSS(url) {
    url = "/" + url.replace(/^\//, "");
    if (document.querySelectorAll && Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(function (link) { return new URL(link.href, window.location.href).pathname === url.split("?")[0]; })) { loadedCSS[url] = true; return; }
    if (loadedCSS[url]) return;
    // Check if already in DOM (from initial page load)
    var existing = document.querySelector('link[href="' + url + '"], link[href="./' + url + '"]');
    if (existing) {
      loadedCSS[url] = true;
      return;
    }
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.setAttribute("data-dynamic-css", "");
    document.head.appendChild(link);
    loadedCSS[url] = true;
  }

  /* ---- JS loading --------------------------------------------------------- */
  function loadJS(url) {
    url = "/" + url.replace(/^\//, "");
    if (loadedJS[url]) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.async = false;
      script.src = url;
      script.onload = function () {
        loadedJS[url] = true;
        resolve();
      };
      script.onerror = function () {
        console.warn("[router] Failed to load script:", url);
        reject(new Error("Failed to load " + url));
      };
      document.body.appendChild(script);
    });
  }

  function loadJSSeq(urls) {
    return Promise.all(urls.map(function (url) { return loadJS(url).catch(function () {}); }));
  }

  /* ---- Lifecycle resolution ----------------------------------------------- */
  function getLifecycle(meta) {
    if (!meta || !meta.lifecycle) return null;
    var lc = window[meta.lifecycle];
    if (lc && (typeof lc.mount === "function" || typeof lc.unmount === "function")) {
      return lc;
    }
    return null;
  }

  /* ---- Core navigation ---------------------------------------------------- */
  function navigateTo(pageName, opts) {
    opts = opts || {};

    pageName = site.key(pageName);
    var meta = site.has(pageName) ? PAGES[pageName] : null;
    if (!meta) {
      console.warn("[router] Unknown page:", pageName);
      if (PAGES.home) {
        pageName = "home";
        opts = Object.assign({}, opts, { replace: true });
        meta = PAGES.home;
        if (window.ClaudeOne && typeof window.ClaudeOne.toast === "function") {
          window.ClaudeOne.toast("页面不存在，已回到首页", "err", 2200);
        }
      } else {
        return;
      }
    }

    if (isNavigating) {
      if (pageName === navigatingPage && opts.search === undefined) return;
      pendingNavigation = { pageName: pageName, opts: opts };
      if (preparingLifecycle && typeof preparingLifecycle.cancelPrepare === "function") {
        preparingLifecycle.cancelPrepare();
      }
      return;
    }
    if (pageName === currentPage) {
      updateURL(pageName, opts);
      updatePageMetadata(pageName);
      if (currentLifecycle && currentLifecycle.setPage) currentLifecycle.setPage(site.pageNumber(currentSearch) || 1);
      return;
    }

    isNavigating = true;
    navigatingPage = pageName;

    // Data-backed pages can prepare before the current page fades away.
    // Other routes keep their existing resource/exit overlap.
    var hasCurrentPage = currentPage !== null;
    (meta.css || []).forEach(function (url) { loadCSS(url); });
    var scriptsReady = loadJSSeq(meta.js || []);
    var preparationReady = Promise.resolve();
    if (meta.prepare) {
      document.body.setAttribute("data-route-state", hasCurrentPage ? "preparing" : "loading");
      preparationReady = scriptsReady.then(function () {
        if (pendingNavigation) return;
        preparingLifecycle = getLifecycle(meta);
        if (preparingLifecycle && typeof preparingLifecycle.prepare === "function") return preparingLifecycle.prepare();
      }).catch(function (error) { console.warn("[router] prepare error:", error); });
    }

    preparationReady.then(function () {
      preparingLifecycle = null;
      if (pendingNavigation && pendingNavigation.pageName !== pageName) {
        document.body.setAttribute("data-route-state", "idle");
        finishNavigation();
        return;
      }
      // Keep the outgoing page intact until preparation finishes or is cancelled.
      if (currentLifecycle && typeof currentLifecycle.unmount === "function") {
        try { currentLifecycle.unmount(); } catch (e) { console.warn("[router] unmount error:", e); }
      }
      if (hasCurrentPage) document.body.removeAttribute("data-initial-route");
      document.body.setAttribute("data-route-state", hasCurrentPage ? "exiting" : "loading");

      return sleep(hasCurrentPage ? TRANSITION_MS : 0).then(function () {
        // 3. Load CSS
        (meta.css || []).forEach(function (url) { loadCSS(url); });

        // 4. Inject page content from template
        var main = document.querySelector("[data-content-slot]");
        if (!main) {
          console.error("[router] Content slot missing");
          finishNavigation();
          return;
        }
        main.innerHTML = "";
        var template = document.getElementById(meta.templateId);
        if (template) {
          var clone = template.content.cloneNode(true);
          main.appendChild(clone);
        } else {
          main.innerHTML = '<div class="page-chunk" style="text-align:center;padding:60px"><p>页面内容加载中...</p></div>';
          console.warn("[router] Template not found:", meta.templateId);
        }

        ensureHelp(main, pageName);

        // 5. Load JS and mount
        scriptsReady.then(function () {
          // Give scripts a microtask to register their lifecycle
          setTimeout(function () {
            updateURL(pageName, opts);
            currentLifecycle = getLifecycle(meta);

            if (currentLifecycle && typeof currentLifecycle.mount === "function") {
              try { currentLifecycle.mount(main); } catch (e) { console.warn("[router] mount error:", e); }
            }

            // 6. Keep the head consistent with the address, without replacing the shell.
            document.body.setAttribute("data-page", pageName);
            updatePageMetadata(pageName);

            // 8. Re-render nav
            if (window.ClaudeOne && window.ClaudeOne.renderNav) {
              window.ClaudeOne.renderNav();
            }

            // 9. Refresh reveal observer for new .page-chunk elements
            if (window.ClaudeOne && window.ClaudeOne.refreshReveal) {
              window.ClaudeOne.refreshReveal();
            }

            // 10. Enter transition
            document.body.setAttribute("data-route-state", "idle");

            // Scroll to top
            window.scrollTo({ top: 0, behavior: "instant" });

            currentPage = pageName;
            resolveReady(pageName);
            finishNavigation();
          }, 10);
        }).catch(function () {
          document.body.setAttribute("data-route-state", "idle");
          finishNavigation();
        });
      });
    });

    return;
  }

  /* ---- Event handlers ----------------------------------------------------- */
  function onHashChange() {
    navigateTo(resolveRoute(), { replace: true, search: searchForLocation() });
  }
  function onPopState() {
    navigateTo(resolveRoute(), { history: false, search: searchForLocation() });
  }
  function onClickNav(e) {
    var a = e.target.closest("a[data-nav-link]");
    if (!a || e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.hasAttribute("download") || a.target === "_blank") return;
    var url = new URL(a.getAttribute("href"), window.location.href);
    if (url.origin !== window.location.origin) return;
    var pageName = site.resolve(url);
    if (!pageName) return;
    e.preventDefault();
    navigateTo(pageName, { search: url.hash.indexOf("#/") === 0 ? url.hash.split("?")[1] ? "?" + url.hash.split("?")[1] : "" : url.search });
  }

  /* ---- Init --------------------------------------------------------------- */
  function init() {
    // Listen for hash changes (back/forward buttons, manual hash edits)
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("popstate", onPopState);

    // Intercept nav link clicks
    document.addEventListener("click", onClickNav);

    // Load initial page
    var initialRoute = resolveRoute();
    currentSearch = searchForLocation();
    var meta = PAGES[initialRoute];
    if (meta) {
      // Load initial CSS
      (meta.css || []).forEach(function (url) { loadCSS(url); });
    }

    // For initial load, check if body already has the page content (static HTML)
    // If the content slot is empty, load from template
    var main = document.querySelector("[data-content-slot]");
    if (main && (!main.children.length || document.body.getAttribute("data-page") !== initialRoute)) {
      // Content slot empty — load from template
      navigateTo(initialRoute, { replace: true, search: currentSearch });
    } else {
      // Content is already in the DOM (from static HTML)
      // Just set up state
      if (meta) {
        updatePageMetadata(initialRoute);
        ensureHelp(main, initialRoute);
      }
      currentPage = initialRoute;
      updateURL(initialRoute, { replace: true, search: currentSearch });

      // Load page JS and try to mount
      if (meta) {
        var loadPromises = (meta.js || []).map(function (url) { return loadJS(url).catch(function () {}); });
        Promise.all(loadPromises).then(function () {
          setTimeout(function () {
            currentLifecycle = getLifecycle(meta);
            if (currentLifecycle && typeof currentLifecycle.mount === "function") {
              try { currentLifecycle.mount(main); } catch (e) { console.warn("[router] initial mount error:", e); }
            }
            resolveReady(initialRoute);
          }, 10);
        });
      }
    }

    // Expose router API
    window.__ClaudeOneRouter = {
      go: navigateTo,
      href: site.href,
      getCurrent: function () { return currentPage; },
      getLifecycle: function () { return currentLifecycle; },
      getMeta: function (pageName) { return PAGES[pageName || currentPage] || null; },
      listPages: function () {
        return Object.keys(PAGES).map(function (key) {
          return Object.assign({ route: key }, PAGES[key]);
        });
      },
      whenReady: whenReady,
      reload: function () {
        if (currentPage) navigateTo(currentPage);
      }
    };
  }

  // Boot
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
