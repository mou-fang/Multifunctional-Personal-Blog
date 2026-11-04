"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setTimeout(resolve, 2)); };

function harness(initial = "home", { mobile = false } = {}) {
  let complete, cancelled = 0, unmounted = 0, mounted = 0;
  const preparation = new Promise(resolve => { complete = resolve; });
  const attributes = { "data-initial-route": "true", "data-route-state": "idle" }, states = [], waits = [], scripts = [];
  let proceed, notices = 0, destroyed = 0, desktopMounts = 0, desktopUnmounts = 0;
  const main = { children: initial === "home" ? [{}] : [], rendered: initial === "home" ? "home" : null,
    appendChild(clone) { this.children.push(clone); this.rendered = clone.name; } };
  Object.defineProperty(main, "innerHTML", { set() { this.children = []; this.rendered = null; } });
  const pages = {
    home: { templateId: "home", js: ["home.js"], lifecycle: "home", title: "Home" },
    releases: { templateId: "releases", js: ["releases.js"], lifecycle: "releases", title: "Releases", prepare: true },
    tools: { templateId: "tools", js: [], title: "Tools" },
    desktop: { templateId: "desktop", js: ["desktop.js"], lifecycle: "desktop", title: "Desktop", mobile: { required: true } },
    recommended: { templateId: "recommended", js: ["recommended.js"], lifecycle: "desktop", title: "Recommended", mobile: { required: false } }
  };
  const window = Object.assign(new EventTarget(), {
    __CLAUDEONE_PAGES: pages, location: { hash: "#/" + initial, pathname: "/", search: "", href: "http://example.com/#/" + initial, origin: "http://example.com" }, scrollTo() {},
    home: { mount() {}, unmount() { unmounted++; } },
    releases: { prepare: () => preparation, cancelPrepare() { cancelled++; complete(); }, mount() { mounted++; }, unmount() {} },
    ClaudeOne: { renderNav() {}, refreshReveal() {} }
  });
  window.desktop = { mount() { desktopMounts++; }, unmount() { desktopUnmounts++; } };
  window.ClaudeOneDevice = {
    isCompact: () => mobile,
    support: meta => mobile ? meta.mobile : null,
    guard(_main, _meta, callback) { notices++; proceed = callback; return { destroy() { destroyed++; } }; }
  };
  const document = { readyState: "complete", addEventListener() {},
    body: { getAttribute(name) { return attributes[name] || (name === "data-page" ? initial : null); }, setAttribute(name, value) { attributes[name] = value; if (name === "data-route-state") states.push(value); },
      removeAttribute(name) { delete attributes[name]; }, appendChild(script) { scripts.push(script.src); queueMicrotask(() => script.onload()); } },
    head: { appendChild() {} }, createElement: () => ({ setAttribute() {} }),
    getElementById: name => ({ content: { cloneNode: () => ({ name }) } }),
    querySelector: selector => selector === "[data-content-slot]" ? main : selector.startsWith("meta") ? { setAttribute() {} } : null
  };
  Object.keys(pages).forEach(id => { pages[id].path = id === "home" ? "/" : "/" + id; });
  window.SitePages = { ...require("../js/site-pages"), has: id => Object.prototype.hasOwnProperty.call(pages, id), key: id => id, href: id => pages[id].path, title: id => pages[id].title,
    resolve: loc => loc.hash.startsWith("#/") ? loc.hash.slice(2).split("?")[0] : Object.keys(pages).find(id => pages[id].path === loc.pathname) };
  const update = value => { const next = new URL(value, window.location.href); for (const name of ["href", "pathname", "hash", "search"]) window.location[name] = next[name]; };
  const history = { pushState(_state, _title, value) { update(value); }, replaceState(_state, _title, value) { update(value); } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/router.js"), "utf8"), {
    window, document, history, console, queueMicrotask,
    CustomEvent: class extends Event { constructor(type, options) { super(type); this.detail = options.detail; } },
    setTimeout(fn, delay) { waits.push(delay); return setTimeout(fn, 0); }
  });
  return { window, document, main, attributes, states, waits, router: window.__ClaudeOneRouter,
    complete, counts: () => ({ cancelled, unmounted, mounted }), scripts, proceed: () => proceed(),
    mobileCounts: () => ({ notices, destroyed, desktopMounts, desktopUnmounts }) };
}

test("data-backed navigation keeps the outgoing page until ready, then uses the shared exit and entry", async () => {
  const h = harness(); await settle(); h.router.go("releases"); await settle();
  let ready = false; const done = h.router.whenReady("releases").then(() => { ready = true; });
  assert.equal(h.main.rendered, "home");
  assert.equal(h.attributes["data-route-state"], "preparing");
  assert.equal(h.counts().unmounted, 0);
  assert.equal(ready, false);
  h.router.go("releases");
  assert.equal(h.counts().cancelled, 0, "repeated clicks on the same destination must not abort preparation");
  h.complete(); await settle(); await done;
  assert.equal(h.main.rendered, "releases");
  assert.equal(h.counts().mounted, 1); assert.equal(h.counts().unmounted, 1);
  assert.equal(h.attributes["data-route-state"], "idle");
  assert.ok(h.states.includes("exiting")); assert.ok(h.waits.includes(260));
  assert.equal(h.attributes["data-initial-route"], undefined);
  h.router.go("tools"); await settle();
  assert.equal(h.main.rendered, "tools");
  assert.equal(h.router.getCurrent(), "tools");
});

test("direct mobile entry keeps desktop engines unloaded and owns the notice through navigation", async () => {
  const h = harness("desktop", { mobile: true }); await settle();
  assert.equal(h.main.rendered, "desktop");
  assert.equal(h.router.getCurrent(), "desktop");
  assert.equal(h.mobileCounts().notices, 1);
  assert.equal(h.scripts.some(url => url.includes("desktop.js")), false);
  assert.equal(h.mobileCounts().desktopMounts, 0);
  h.router.go("tools"); await settle();
  assert.equal(h.mobileCounts().destroyed, 1);
  assert.equal(h.main.rendered, "tools");
  assert.equal(h.waits.includes(260), false, "small screens have no full-page exit delay");
});

test("recommended tools only load after continuing, and leave no mounted module on route exit", async () => {
  const h = harness("home", { mobile: true }); await settle();
  h.router.go("recommended"); await settle();
  assert.equal(h.scripts.some(url => url.includes("recommended.js")), false);
  h.proceed(); await settle();
  assert.equal(h.scripts.filter(url => url.includes("recommended.js")).length, 1);
  assert.equal(h.mobileCounts().desktopMounts, 1);
  h.router.go("tools"); await settle();
  assert.equal(h.mobileCounts().desktopUnmounts, 1);
});

test("desktop routes load normally and a late mobile continue cannot mount after navigation", async () => {
  const desktop = harness("desktop"); await settle();
  assert.equal(desktop.mobileCounts().notices, 0);
  assert.equal(desktop.mobileCounts().desktopMounts, 1);
  const h = harness("recommended", { mobile: true }); await settle();
  h.proceed(); h.router.go("tools"); await settle();
  assert.equal(h.main.rendered, "tools");
  assert.equal(h.mobileCounts().desktopMounts, 0);
});

test("a newer destination cancels preparation and never mounts the abandoned release page", async () => {
  const h = harness(); await settle(); h.router.go("releases"); await settle();
  h.router.go("tools"); await settle();
  assert.equal(h.counts().cancelled, 1);
  assert.equal(h.counts().mounted, 0);
  assert.equal(h.counts().unmounted, 1);
  assert.equal(h.main.rendered, "tools");
  assert.equal(h.attributes["data-route-state"], "idle");
});

test("direct entry prepares data before mounting and retains the initial-route behavior", async () => {
  const h = harness("releases"); await settle();
  assert.equal(h.main.rendered, null); assert.equal(h.counts().mounted, 0);
  h.complete(); await settle();
  assert.equal(h.main.rendered, "releases"); assert.equal(h.document.title, "Releases");
  assert.equal(h.attributes["data-initial-route"], "true");
  assert.equal(h.states.includes("exiting"), false);
  assert.equal(h.waits.includes(260), false);
});
