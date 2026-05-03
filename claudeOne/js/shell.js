/* ===== claudeOne :: shell.js =====
 * Shared across every page. Responsibilities:
 *   - Read/apply theme before first paint (called inline in <head>).
 *   - Animate theme transitions (View Transitions API when available,
 *     CSS clip-path ripple fallback otherwise).
 *   - Reveal-on-scroll via IntersectionObserver for .page-chunk elements.
 *   - Smooth intra-site nav (fade out → navigate → fade in).
 *   - Escape helpers (escapeHtml, safeText).
 *   - localStorage wrapper that fails gracefully (private mode, disabled, etc).
 *   - Toast helper.
 *   - API-key modal helper (used by ai.html).
 * All state lives on window.ClaudeOne — a tiny namespace, no globals leaked.
 */

(function bootstrapShell() {
  const CFG = window.CLAUDE_ONE_CONFIG;
  if (!CFG) {
    console.error("[claudeOne] Config missing — did config.js load first?");
    return;
  }

  // --- Navigation config ----------------------------------------------------
  const NAV_ITEMS = [
    { label: "首页",   href: "#/home",   matches: ["home"] },
    { label: "游戏",   href: "#/games",  matches: ["games", "game", "sokoban"] },
    { label: "工具箱", href: "#/tools",  matches: ["tools", "lottery", "music", "ascii", "pixel", "compress", "qr", "ai"] },
  ];

  function resolveCurrentRoute() {
    var hash = window.location.hash;
    if (hash && hash.indexOf("#/") === 0) return hash.slice(2).split("?")[0];
    var page = document.body.getAttribute("data-page");
    return page || "home";
  }

  function renderNav() {
    const nav = document.querySelector(".site-nav");
    if (!nav) return;
    const here = resolveCurrentRoute();
    nav.innerHTML = NAV_ITEMS.map(function (item) {
      var isActive = item.matches.some(function (m) { return m === here; });
      return '<a href="' + item.href + '" data-nav-link' + (isActive ? ' aria-current="page"' : '') + '>' + item.label + '</a>';
    }).join("");
  }

  // --- Safe storage ---------------------------------------------------------
  const storage = (() => {
    try {
      const k = "__claudeOne_probe";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      return {
        get: (k) => {
          try { return window.localStorage.getItem(k); } catch { return null; }
        },
        set: (k, v) => {
          try { window.localStorage.setItem(k, v); return true; } catch { return false; }
        },
        remove: (k) => {
          try { window.localStorage.removeItem(k); } catch { /* no-op */ }
        },
      };
    } catch {
      const mem = new Map();
      return {
        get: (k) => (mem.has(k) ? mem.get(k) : null),
        set: (k, v) => { mem.set(k, v); return true; },
        remove: (k) => mem.delete(k),
      };
    }
  })();

  // --- Safe string helpers --------------------------------------------------
  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clamp(n, lo, hi) {
    n = Number(n);
    if (Number.isNaN(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
  }

  // --- Theme ----------------------------------------------------------------
  const THEME_KEY = CFG.theme.storageKey;
  const VALID_THEMES = CFG.theme.values;

  function resolveTheme() {
    const saved = storage.get(THEME_KEY);
    if (saved && VALID_THEMES.includes(saved)) return saved;
    return CFG.theme.default;
  }

  function applyTheme(theme, opts = {}) {
    const next = VALID_THEMES.includes(theme) ? theme : CFG.theme.default;
    document.body.setAttribute("data-theme", next);
    const toggle = document.querySelector("[data-theme-toggle]");
    if (toggle) toggle.checked = next === "liquid-glass";
    const label = document.querySelector("[data-theme-label]");
    if (label) label.textContent = next === "liquid-glass" ? "Liquid Glass" : "Soft UI";
    storage.set(THEME_KEY, next);
    if (opts.announce !== false) {
      const announcer = document.querySelector("[data-theme-live]");
      if (announcer) announcer.textContent = "Theme: " + (next === "liquid-glass" ? "Liquid Glass" : "Soft UI");
    }
  }

  // Known-good bg color per theme for the fallback overlay (can't reliably read
  // body's computed background when it's a gradient stack).
  const THEME_BG = {
    neumorphism: "#e6efff",
    "liquid-glass": "#f3f3f3",
  };

  function setThemeAnimated(nextTheme, origin) {
    // Ripple overlay: covers page with OLD theme bg, then shrinks toward
    // the toggle button origin to reveal the NEW theme underneath.
    // This masks layout shifts during theme switch better than a crossfade.
    var currentTheme = document.body.getAttribute("data-theme") || CFG.theme.default;
    var oldBg = THEME_BG[currentTheme] || THEME_BG.neumorphism;
    var overlay = document.createElement("div");
    overlay.className = "theme-transition-overlay";
    overlay.style.background = oldBg;
    if (origin) {
      overlay.style.setProperty("--tx", origin.x + "px");
      overlay.style.setProperty("--ty", origin.y + "px");
    }
    document.body.appendChild(overlay);
    // Apply new theme underneath, then start the clip-path shrink next frame.
    applyTheme(nextTheme);
    requestAnimationFrame(function () {
      overlay.setAttribute("data-anim", "true");
      setTimeout(function () { overlay.remove(); }, 820);
    });
  }

  // --- Reveal-on-scroll -----------------------------------------------------
  let revealObs = null;

  function getRevealObserver() {
    if (revealObs) return revealObs;
    if (!("IntersectionObserver" in window)) return null;
    revealObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.setAttribute("data-revealed", "true");
            revealObs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    return revealObs;
  }

  function setupReveal() {
    const chunks = document.querySelectorAll(".page-chunk");
    if (!chunks.length) return;
    const obs = getRevealObserver();
    if (!obs) {
      chunks.forEach((c) => c.setAttribute("data-revealed", "true"));
      return;
    }
    chunks.forEach((c) => obs.observe(c));
  }

  // --- Refresh reveal for dynamically added elements -----------------------
  function refreshReveal() {
    const chunks = document.querySelectorAll(".page-chunk:not([data-revealed])");
    if (!chunks.length) return;
    const obs = getRevealObserver();
    if (!obs) {
      chunks.forEach((c) => c.setAttribute("data-revealed", "true"));
      return;
    }
    chunks.forEach((c) => obs.observe(c));
  }
  // --- Toast ----------------------------------------------------------------
  function ensureToastRail() {
    let rail = document.querySelector(".toast-rail");
    if (!rail) {
      rail = document.createElement("div");
      rail.className = "toast-rail";
      document.body.appendChild(rail);
    }
    return rail;
  }

  function toast(text, kind = "info", ms = 3200) {
    const rail = ensureToastRail();
    const el = document.createElement("div");
    el.className = "toast" + (kind === "err" ? " toast--err" : kind === "ok" ? " toast--ok" : "");
    el.textContent = text;
    rail.appendChild(el);
    requestAnimationFrame(() => el.setAttribute("data-enter", "true"));
    setTimeout(() => {
      el.removeAttribute("data-enter");
      setTimeout(() => el.remove(), 400);
    }, ms);
  }

  // --- Theme toggle wiring --------------------------------------------------
  function setupThemeToggle() {
    const toggle = document.querySelector("[data-theme-toggle]");
    if (!toggle) return;
    toggle.addEventListener("change", (e) => {
      const nextTheme = e.target.checked ? "liquid-glass" : "neumorphism";
      const rect = toggle.getBoundingClientRect();
      setThemeAnimated(nextTheme, {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    });
  }

  // --- API key modal (used by ai.html) --------------------------------------
  function createApiKeyModal({ forceOpen = false, onSave } = {}) {
    const keyStorage = CFG.deepseek.storageKey;
    let existing = document.querySelector("[data-apikey-modal]");
    if (!existing) {
      existing = document.createElement("div");
      existing.className = "modal-root";
      existing.setAttribute("data-apikey-modal", "");
      existing.innerHTML = `
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="apikeyTitle">
          <h2 id="apikeyTitle">DeepSeek API Key</h2>
          <p class="muted" style="color:var(--ink-soft)">
            使用 AI 聊天需要你的 DeepSeek API Key。Key 只保存在你浏览器本地（localStorage），
            不会被上传到任何服务器、也不会写进项目代码。
          </p>
          <div class="field">
            <label class="field__label" for="apiKeyInput">API Key</label>
            <input id="apiKeyInput" class="input" type="password"
                   autocomplete="off" spellcheck="false"
                   placeholder="sk-..." />
          </div>
          <p class="muted" style="font-size:.78rem">
            没有 Key？在
            <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer"
               style="color:var(--accent); text-decoration: underline;">DeepSeek 控制台</a>
            里生成一个。
          </p>
          <div class="modal-actions">
            <button class="btn btn-ghost" data-apikey-cancel>取消</button>
            <button class="btn btn-primary" data-apikey-save>保存</button>
          </div>
        </div>
      `;
      document.body.appendChild(existing);
      const input = existing.querySelector("#apiKeyInput");
      const saveBtn = existing.querySelector("[data-apikey-save]");
      const cancelBtn = existing.querySelector("[data-apikey-cancel]");

      function close() {
        existing.setAttribute("data-open", "false");
        setTimeout(() => existing.removeAttribute("data-open"), 300);
      }
      function save() {
        const v = (input.value || "").trim();
        if (!v) {
          input.focus();
          toast("请输入有效的 Key", "err");
          return;
        }
        if (!/^sk-[A-Za-z0-9]{10,}$/.test(v)) {
          toast("Key 格式看起来不对，仍然保存", "err");
        }
        storage.set(keyStorage, v);
        close();
        if (typeof onSave === "function") onSave(v);
      }
      saveBtn.addEventListener("click", save);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") save();
      });
      function tryClose() {
        if (forceOpen && !storage.get(keyStorage)) {
          toast("需要 Key 才能使用聊天，可在顶部工具栏重新打开", "err");
        }
        close();
      }
      cancelBtn.addEventListener("click", tryClose);
      existing.addEventListener("click", (e) => {
        if (e.target === existing) tryClose();
      });
      existing.addEventListener("keydown", (e) => {
        if (e.key === "Escape") tryClose();
      });
    }

    // Pre-fill existing key if editing
    const currentKey = storage.get(keyStorage) || "";
    const input = existing.querySelector("#apiKeyInput");
    if (input) input.value = currentKey;

    requestAnimationFrame(() => {
      existing.setAttribute("data-open", "true");
      const i = existing.querySelector("#apiKeyInput");
      if (i) i.focus();
    });
    return existing;
  }

  // --- Public namespace -----------------------------------------------------
  window.ClaudeOne = Object.freeze({
    storage,
    escapeHtml,
    clamp,
    applyTheme,
    setThemeAnimated,
    toast,
    createApiKeyModal,
    renderNav,
    refreshReveal,
    NAV_ITEMS,
    getDeepSeekKey() {
      return storage.get(CFG.deepseek.storageKey) || "";
    },
    clearDeepSeekKey() {
      storage.remove(CFG.deepseek.storageKey);
    },
  });

  // --- Boot -----------------------------------------------------------------
  // applyTheme without announcing so we don't disturb screen readers on first load.
  // Theme may have already been applied by an inline <script> in <head> for flash-free
  // paint; we call again here to wire toggle state.
  applyTheme(resolveTheme(), { announce: false });

  document.addEventListener("DOMContentLoaded", () => {
    renderNav();
    setupThemeToggle();
    setupReveal();
  });

  // On page show (back/forward from bfcache), reset exit state so layout returns.
  window.addEventListener("pageshow", () => {
    document.body.setAttribute("data-route-state", "idle");
  });
})();
