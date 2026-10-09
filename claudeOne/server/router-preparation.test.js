"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setTimeout(resolve, 2)); };

function harness(initial = "home") {
  let complete, cancelled = 0, unmounted = 0, mounted = 0;
  const preparation = new Promise(resolve => { complete = resolve; });
  const attributes = { "data-initial-route": "true", "data-route-state": "idle" }, states = [], waits = [];
  const main = { children: initial === "home" ? [{}] : [], rendered: initial === "home" ? "home" : null,
    appendChild(clone) { this.children.push(clone); this.rendered = clone.name; } };
  Object.defineProperty(main, "innerHTML", { set() { this.children = []; this.rendered = null; } });
  const pages = {
    home: { templateId: "home", js: ["home.js"], lifecycle: "home", title: "Home" },
    releases: { templateId: "releases", js: ["releases.js"], lifecycle: "releases", title: "Releases", prepare: true },
    tools: { templateId: "tools", js: [], title: "Tools" }
  };
  const window = Object.assign(new EventTarget(), {
    __CLAUDEONE_PAGES: pages, location: { hash: "#/" + initial }, scrollTo() {},
    home: { mount() {}, unmount() { unmounted++; } },
    releases: { prepare: () => preparation, cancelPrepare() { cancelled++; complete(); }, mount() { mounted++; }, unmount() {} },
    ClaudeOne: { renderNav() {}, refreshReveal() {} }
  });
  const document = { readyState: "complete", addEventListener() {},
    body: { setAttribute(name, value) { attributes[name] = value; if (name === "data-route-state") states.push(value); },
      removeAttribute(name) { delete attributes[name]; }, appendChild(script) { queueMicrotask(() => script.onload()); } },
    head: { appendChild() {} }, createElement: () => ({ setAttribute() {} }),
    getElementById: name => ({ content: { cloneNode: () => ({ name }) } }),
    querySelector: selector => selector === "[data-content-slot]" ? main : selector.startsWith("meta") ? { setAttribute() {} } : null
  };
  const history = { pushState(_state, _title, hash) { window.location.hash = hash; }, replaceState(_state, _title, hash) { window.location.hash = hash; } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/router.js"), "utf8"), {
    window, document, history, console, queueMicrotask,
    CustomEvent: class extends Event { constructor(type, options) { super(type); this.detail = options.detail; } },
    setTimeout(fn, delay) { waits.push(delay); return setTimeout(fn, 0); }
  });
  return { window, document, main, attributes, states, waits, router: window.__ClaudeOneRouter,
    complete, counts: () => ({ cancelled, unmounted, mounted }) };
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
