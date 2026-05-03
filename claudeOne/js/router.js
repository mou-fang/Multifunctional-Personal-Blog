/* ===== claudeOne :: router.js =====
 * SPA hash-based router. Responsibilities:
 *   - Intercept nav clicks ([data-nav-link]) and hashchange events.
 *   - Unmount current page, load new page from <template>, mount.
 *   - Manage page-specific CSS/JS lifecycle.
 *   - Update document metadata and URL.
 *   - Animate page transitions.
 */

(function initRouter() {
  var PAGES = window.__CLAUDEONE_PAGES;
  if (!PAGES) {
    console.error("[router] Page registry missing — did page-registry.js load?");
    return;
  }

  var currentPage = null;
  var currentLifecycle = null;
  var loadedCSS = {};   // url -> true
  var loadedJS = {};    // url -> true
  var isNavigating = false;

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
    var hash = window.location.hash;
    if (hash && hash.indexOf("#/") === 0) {
      return hash.slice(2).split("?")[0];
    }
    return "home";
  }

  function updateHash(pageName) {
    var hash = "#/" + pageName;
    if (window.location.hash !== hash) {
      history.pushState(null, "", hash);
    }
  }

  /* ---- CSS loading -------------------------------------------------------- */
  function loadCSS(url) {
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
    if (loadedJS[url]) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
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
    return urls.reduce(function (chain, url) {
      return chain.then(function () { return loadJS(url).catch(function () {}); });
    }, Promise.resolve());
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
    if (isNavigating) return;
    if (pageName === currentPage) return;

    var meta = PAGES[pageName];
    if (!meta) {
      console.warn("[router] Unknown page:", pageName);
      return;
    }

    isNavigating = true;

    // 1. Unmount current page
    if (currentLifecycle && typeof currentLifecycle.unmount === "function") {
      try { currentLifecycle.unmount(); } catch (e) { console.warn("[router] unmount error:", e); }
    }

    // 2. Exit transition
    document.body.setAttribute("data-route-state", "exiting");

    // Wait for exit animation
    sleep(TRANSITION_MS).then(function () {
      // 3. Load CSS
      (meta.css || []).forEach(function (url) { loadCSS(url); });

      // 4. Inject page content from template
      var main = document.querySelector("[data-content-slot]");
      if (!main) {
        console.error("[router] Content slot missing");
        isNavigating = false;
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

      // 5. Load JS and mount
      var jsUrls = meta.js || [];

      loadJSSeq(jsUrls).then(function () {
        // Give scripts a microtask to register their lifecycle
        setTimeout(function () {
          currentLifecycle = getLifecycle(meta);

          if (currentLifecycle && typeof currentLifecycle.mount === "function") {
            try { currentLifecycle.mount(main); } catch (e) { console.warn("[router] mount error:", e); }
          }

          // 6. Update metadata
          document.title = meta.title;
          document.body.setAttribute("data-page", pageName);
          updateMetaDescription(meta.description);

          // 7. Update hash (without triggering hashchange)
          if (!opts.replace) {
            updateHash(pageName);
          } else {
            history.replaceState(null, "", "#/" + pageName);
          }

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
          isNavigating = false;
        }, 10);
      }).catch(function () {
        document.body.setAttribute("data-route-state", "idle");
        isNavigating = false;
      });
    });

    return;
  }

  /* ---- Event handlers ----------------------------------------------------- */
  function onHashChange() {
    var route = resolveRoute();
    if (route !== currentPage) {
      navigateTo(route);
    }
  }

  function onClickNav(e) {
    var a = e.target.closest("a[data-nav-link]");
    if (!a) return;
    var href = a.getAttribute("href");
    if (!href || !href.startsWith("#/")) return;
    var pageName = href.slice(2).split("?")[0];
    // Only block if already on the exact target page
    if (a.getAttribute("aria-current") === "page" && pageName === currentPage) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    navigateTo(pageName);
  }

  /* ---- Init --------------------------------------------------------------- */
  function init() {
    // Listen for hash changes (back/forward buttons, manual hash edits)
    window.addEventListener("hashchange", onHashChange);

    // Intercept nav link clicks
    document.addEventListener("click", onClickNav);

    // Load initial page
    var initialRoute = resolveRoute();
    var meta = PAGES[initialRoute];
    if (meta) {
      // Load initial CSS
      (meta.css || []).forEach(function (url) { loadCSS(url); });
    }

    // For initial load, check if body already has the page content (static HTML)
    // If the content slot is empty, load from template
    var main = document.querySelector("[data-content-slot]");
    if (main && !main.children.length) {
      // Content slot empty — load from template
      navigateTo(initialRoute, { replace: true });
    } else {
      // Content is already in the DOM (from static HTML)
      // Just set up state
      if (meta) {
        document.title = meta.title;
        updateMetaDescription(meta.description);
      }
      currentPage = initialRoute;
      updateHash(initialRoute);

      // Load page JS and try to mount
      if (meta && meta.js && meta.js.length) {
        var loadPromises = meta.js.map(function (url) { return loadJS(url).catch(function () {}); });
        Promise.all(loadPromises).then(function () {
          setTimeout(function () {
            currentLifecycle = getLifecycle(meta);
            if (currentLifecycle && typeof currentLifecycle.mount === "function") {
              try { currentLifecycle.mount(main); } catch (e) { console.warn("[router] initial mount error:", e); }
            }
          }, 10);
        });
      }
    }

    // Expose router API
    window.__ClaudeOneRouter = {
      go: navigateTo,
      getCurrent: function () { return currentPage; },
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
