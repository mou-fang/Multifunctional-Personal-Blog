"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function chunk(ahead = false) {
  const attributes = new Map();
  const cover = { loading: "lazy" };
  return {
    cover, attributes,
    closest: () => ahead ? {} : null,
    querySelectorAll: () => [cover],
    setAttribute: (name, value) => attributes.set(name, value)
  };
}

function harness({ observerSupported = true } = {}) {
  let chunks = [], timers = 0;
  const observers = [], listeners = new Map(), stored = new Map();
  const attrs = new Map([["data-theme", "neumorphism"]]);
  const document = {
    body: { getAttribute: key => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value) },
    querySelector: () => null,
    querySelectorAll: () => chunks.filter(c => !c.attributes.has("data-revealed")),
    addEventListener: (type, fn) => listeners.set(type, fn)
  };
  class Observer {
    constructor(callback, options) { this.callback = callback; this.options = options; this.targets = new Set(); observers.push(this); }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); }
  }
  const window = {
    location: { hash: "#/game-releases" },
    localStorage: { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) },
    addEventListener() {},
    CLAUDE_ONE_CONFIG: { theme: { storageKey: "claudeOne:theme", values: ["neumorphism", "liquid-glass"], default: "neumorphism" } }
  };
  if (observerSupported) window.IntersectionObserver = Observer;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/shell.js"), "utf8"), {
    window, document, IntersectionObserver: Observer,
    setTimeout() { timers++; }, clearTimeout() {}, requestAnimationFrame() {}, cancelAnimationFrame() {}
  });
  return {
    observers, timers: () => timers,
    boot() { listeners.get("DOMContentLoaded")(); },
    refresh(next) { chunks = next; window.ClaudeOne.refreshReveal(); }
  };
}

test("release-list chunks reveal and start covers ahead of the viewport without waiting for scrolling to stop", () => {
  const h = harness(), header = chunk(), card = chunk(true);
  h.boot(); h.refresh([header, card]);
  const normal = h.observers.find(obs => obs.targets.has(header));
  const ahead = h.observers.find(obs => obs.targets.has(card));
  assert.equal(normal.options.rootMargin, "0px 0px -40px 0px", "other pages retain their reveal timing");
  assert.equal(ahead.options.rootMargin, "0px 0px 640px 0px");
  assert.equal(ahead.options.threshold, 0, "cards start as soon as they reach the lookahead area");
  ahead.callback([{ target: card, isIntersecting: false }]);
  assert.equal(card.attributes.has("data-revealed"), false);
  ahead.callback([{ target: card, isIntersecting: true, intersectionRatio: 0 }]);
  assert.equal(card.attributes.get("data-revealed"), "true", "the observer callback reveals immediately");
  assert.equal(card.cover.loading, "eager", "nearby covers do not depend on native lazy-load scheduling");
  assert.equal(ahead.targets.has(card), false, "revealed cards stop being observed");
  assert.equal(header.attributes.has("data-revealed"), false);
  assert.equal(h.timers(), 0, "no debounce, scroll-end or idle timer delays card reveal");
});

test("filtering and navigation release old reveal targets, including when the next page has no chunks", () => {
  const h = harness(), oldCard = chunk(true), replacement = chunk(true);
  h.refresh([chunk(), oldCard]);
  h.refresh([replacement]);
  assert.equal(h.observers.length, 2, "reuse shell-owned observers");
  assert.ok(h.observers.every(obs => !obs.targets.has(oldCard)));
  assert.ok(h.observers.some(obs => obs.targets.has(replacement)));
  h.refresh([]);
  assert.ok(h.observers.every(obs => obs.targets.size === 0));
});

test("browsers without IntersectionObserver display current and archive chunks immediately", () => {
  const h = harness({ observerSupported: false }), header = chunk(), card = chunk(true);
  h.refresh([header, card]);
  for (const el of [header, card]) assert.equal(el.attributes.get("data-revealed"), "true");
  assert.equal(h.observers.length, 0);
});
