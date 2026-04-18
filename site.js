(function siteBootstrap() {
  const STORAGE_KEY = "site-style-mode";
  const TRANSITION_KEY = "site-transition-intent";
  const DEFAULT_STYLE = window.APP_CONFIG?.theme?.defaultStyle || "neumorphism";
  const body = document.body;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const timings = prefersReducedMotion.matches
    ? { prepare: 60, morph: 120, settle: 80, leave: 280, enter: 460 }
    : { prepare: 180, morph: 360, settle: 180, leave: 520, enter: 920 };

  let isThemeTransitioning = false;
  let queuedStyle = null;
  let queuedUrl = null;

  if (!body) return;

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function normalizeStyle(style) {
    return style === "liquid-glass" ? "liquid-glass" : "neumorphism";
  }

  function getSavedStyle() {
    return normalizeStyle(localStorage.getItem(STORAGE_KEY) || DEFAULT_STYLE);
  }

  function ensureThemeVeil() {
    let veil = document.querySelector(".theme-transition-veil");
    if (veil) return veil;

    veil = document.createElement("div");
    veil.className = "theme-transition-veil";
    veil.setAttribute("aria-hidden", "true");
    veil.innerHTML = `
      <span class="theme-transition-wash"></span>
      <span class="theme-transition-ripple"></span>
      <span class="theme-transition-grid"></span>
    `;
    body.appendChild(veil);
    return veil;
  }

  function decorateThemeToggles() {
    document.querySelectorAll(".theme-toggle-track").forEach((track) => {
      if (track.dataset.decorated === "true") return;
      track.dataset.decorated = "true";

      const rim = document.createElement("span");
      rim.className = "theme-toggle-rim";

      const flow = document.createElement("span");
      flow.className = "theme-toggle-flow";

      track.append(rim, flow);
    });
  }

  function setTransitionState(phase, locked) {
    body.dataset.themeTransition = phase;
    body.dataset.themeLock = String(locked);
  }

  function setToggleDisabled(disabled) {
    document.querySelectorAll("[data-theme-toggle]").forEach((input) => {
      input.disabled = disabled;
    });
  }

  function syncThemeControls(style) {
    const next = normalizeStyle(style);
    document.querySelectorAll("[data-theme-toggle]").forEach((input) => {
      input.checked = next === "liquid-glass";
    });
    document.querySelectorAll("[data-theme-state]").forEach((label) => {
      label.textContent = next === "liquid-glass" ? "Liquid Glass" : "Neumorphism";
    });
    document.querySelectorAll("[data-theme-mode]").forEach((label) => {
      label.textContent = next === "liquid-glass" ? "Glass" : "Soft";
    });
  }

  function syncSurfaceFilters(style) {
    const isGlass = normalizeStyle(style) === "liquid-glass";
    document.querySelectorAll(".site-shell").forEach((shell) => {
      shell.classList.toggle("fx-layer", isGlass);
    });
  }

  function applyStyle(style) {
    const next = normalizeStyle(style);
    body.dataset.style = next;
    localStorage.setItem(STORAGE_KEY, next);
    syncThemeControls(next);
    syncSurfaceFilters(next);
  }

  async function runThemeTransition(style) {
    const next = normalizeStyle(style);
    const current = normalizeStyle(body.dataset.style || getSavedStyle());
    if (next === current) {
      syncThemeControls(next);
      return;
    }

    if (isThemeTransitioning) {
      queuedStyle = next;
      syncThemeControls(next);
      return;
    }

    isThemeTransitioning = true;
    queuedStyle = null;
    ensureThemeVeil();
    setToggleDisabled(true);
    syncThemeControls(next);
    body.dataset.themeTarget = next;
    body.classList.add("theme-transition-active");

    setTransitionState("preparing", true);
    await delay(timings.prepare);

    setTransitionState("morphing", true);
    applyStyle(next);
    await delay(timings.morph);

    setTransitionState("settled", true);
    await delay(timings.settle);

    body.classList.remove("theme-transition-active");
    body.dataset.themeTarget = "";
    setTransitionState("idle", false);
    setToggleDisabled(false);
    isThemeTransitioning = false;

    if (queuedStyle && queuedStyle !== next) {
      const pendingStyle = queuedStyle;
      queuedStyle = null;
      runThemeTransition(pendingStyle);
      return;
    }

    if (queuedUrl) {
      const pendingUrl = queuedUrl;
      queuedUrl = null;
      leavePage(pendingUrl);
    }
  }

  function setStyle(style, options = {}) {
    const next = normalizeStyle(style);
    if (options.silent) {
      applyStyle(next);
      setTransitionState("idle", false);
      body.dataset.themeTarget = "";
      return;
    }
    runThemeTransition(next);
  }

  function preparePageChunks() {
    const chunks = [...document.querySelectorAll(".page-chunk")]
      .sort((left, right) => {
        const leftOrder = Number(left.dataset.revealOrder || "0");
        const rightOrder = Number(right.dataset.revealOrder || "0");
        return leftOrder - rightOrder;
      });

    chunks.forEach((chunk, index) => {
      chunk.style.setProperty("--enter-order", String(index + 1));
      chunk.style.setProperty("--leave-order", String(chunks.length - index));
    });
  }

  function handleEnterTransition() {
    const rawIntent = sessionStorage.getItem(TRANSITION_KEY);
    let shouldAnimate = false;

    if (rawIntent) {
      try {
        const intent = JSON.parse(rawIntent);
        shouldAnimate = intent?.to === location.pathname && Date.now() - intent.ts < 4000;
      } catch {
        shouldAnimate = false;
      }
    }

    if (!shouldAnimate && rawIntent) {
      sessionStorage.removeItem(TRANSITION_KEY);
    }

    body.dataset.routeState = shouldAnimate ? "entering" : "idle";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        body.classList.add("route-ready");
        if (shouldAnimate) {
          window.setTimeout(() => {
            body.dataset.routeState = "idle";
            sessionStorage.removeItem(TRANSITION_KEY);
          }, timings.enter);
        }
      });
    });
  }

  function leavePage(url) {
    if (body.dataset.routeState === "leaving") return;
    if (isThemeTransitioning || body.dataset.themeLock === "true") {
      queuedUrl = url;
      return;
    }

    body.dataset.routeState = "leaving";
    sessionStorage.setItem(
      TRANSITION_KEY,
      JSON.stringify({
        from: location.pathname,
        to: url.pathname,
        ts: Date.now(),
      }),
    );
    window.setTimeout(() => {
      window.location.href = url.href;
    }, timings.leave);
  }

  function bindRouteLinks() {
    document.querySelectorAll("a[data-nav-link]").forEach((link) => {
      link.addEventListener("click", (event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        const url = new URL(link.href, window.location.href);
        if (url.origin !== window.location.origin || url.pathname === location.pathname) return;

        event.preventDefault();
        leavePage(url);
      });
    });
  }

  function bindThemeToggles() {
    document.querySelectorAll("[data-theme-toggle]").forEach((input) => {
      input.addEventListener("change", () => {
        setStyle(input.checked ? "liquid-glass" : "neumorphism");
      });
    });
  }

  function syncCurrentNav() {
    const currentPath = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("[data-nav-item]").forEach((link) => {
      const target = link.getAttribute("href") || "";
      const targetName = target.split("/").pop() || "index.html";
      link.classList.toggle("is-current", targetName === currentPath);
    });
  }

  ensureThemeVeil();
  decorateThemeToggles();
  setStyle(getSavedStyle(), { silent: true });
  preparePageChunks();
  bindThemeToggles();
  bindRouteLinks();
  syncCurrentNav();
  handleEnterTransition();

  window.SiteTheme = {
    getStyle: getSavedStyle,
    setStyle,
  };
})();
