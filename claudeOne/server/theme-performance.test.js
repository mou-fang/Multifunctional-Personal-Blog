const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function harness({ memory, cores, saved = "neumorphism", reducedMotion = false, adviceDisabled = false } = {}) {
  let clock = 0;
  let nextId = 0;
  const timers = new Map();
  const frames = new Map();
  const stored = new Map([["claudeOne:theme", saved]]);
  if (adviceDisabled) stored.set("claudeOne:theme-advice-disabled", "1");
  const attrs = { "data-theme": saved, "data-route-state": "idle" };
  const listeners = () => {
    const entries = new Map();
    return {
      addEventListener(name, fn) {
        if (!entries.has(name)) entries.set(name, []);
        entries.get(name).push(fn);
      },
      dispatch(name, event = {}) { for (const fn of entries.get(name) || []) fn(event); },
    };
  };
  const control = () => ({
    ...listeners(), attrs: {}, textContent: "", focused: false,
    setAttribute(k, v) { this.attrs[k] = v; },
    removeAttribute(k) { delete this.attrs[k]; },
    focus() { this.focused = true; },
  });
  const toggle = control();
  const reason = control();
  const advice = { ...control(), hidden: true, id: "theme-performance-advice", querySelector: () => reason };
  const softButton = control();
  const closeButton = control();
  const neverButton = control();
  const elements = {
    "[data-theme-toggle]": toggle,
    "[data-theme-label]": control(),
    "[data-theme-live]": control(),
    "[data-theme-advice]": advice,
    "[data-theme-use-soft]": softButton,
    "[data-theme-advice-close]": closeButton,
    "[data-theme-advice-never]": neverButton,
  };
  const document = {
    ...listeners(), hidden: false,
    body: { getAttribute: k => attrs[k], setAttribute: (k, v) => { attrs[k] = v; } },
    querySelector: selector => elements[selector] || null,
    querySelectorAll: () => [],
  };
  const window = {
    ...listeners(), navigator: { deviceMemory: memory, hardwareConcurrency: cores },
    location: { hash: "#/home" },
    localStorage: { getItem: k => stored.get(k) || null, setItem: (k, v) => stored.set(k, v), removeItem: k => stored.delete(k) },
    matchMedia: () => ({ matches: reducedMotion }),
    CLAUDE_ONE_CONFIG: { theme: { storageKey: "claudeOne:theme", values: ["neumorphism", "liquid-glass"], default: "neumorphism" } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/shell.js"), "utf8"), {
    window, document, console,
    requestAnimationFrame: fn => { frames.set(++nextId, fn); return nextId; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: (fn, ms) => { timers.set(++nextId, { fn, at: clock + ms }); return nextId; },
    clearTimeout: id => timers.delete(id),
  });
  document.dispatch("DOMContentLoaded");
  function tick(ms) {
    clock += ms;
    for (const [id, timer] of [...timers]) {
      if (timer.at <= clock && timers.delete(id)) timer.fn();
    }
    const pending = [...frames];
    frames.clear();
    for (const [, fn] of pending) fn(clock);
  }
  return {
    window, document, toggle, reason, advice, softButton, closeButton, neverButton, timers, frames, stored, attrs, tick,
    ready() { window.dispatch("claudeone:router-ready"); },
    sample(interval, count) { for (let i = 0; i < count; i++) tick(interval); },
    glass() { window.ClaudeOne.applyTheme("liquid-glass"); },
  };
}

test("hardware advice covers modest devices without treating unknown hints as low configuration", () => {
  for (const hints of [{ memory: 2 }, { cores: 2 }, { memory: 4, cores: 4 }, { memory: 0.5, cores: 8 }]) {
    const h = harness(hints);
    h.glass();
    assert.equal(h.advice.hidden, false);
    assert.equal(h.reason.textContent, "设备性能可能偏弱");
    assert.equal(h.attrs["data-theme"], "liquid-glass", "advice does not override the selection");
    assert.equal(h.toggle.attrs["aria-describedby"], h.advice.id);
    assert.equal(h.frames.size + h.timers.size, 0, "hardware advice needs no ongoing measurement");
  }
  for (const hints of [{}, { memory: 0, cores: 0 }, { memory: 4, cores: 8 }, { memory: 8, cores: 4 }]) {
    const h = harness(hints);
    h.glass();
    assert.equal(h.advice.hidden, true);
  }
});

test("saved Liquid Glass gets advice and the recommendation restores Soft UI, storage and keyboard focus", () => {
  const h = harness({ saved: "liquid-glass", cores: 2 });
  assert.equal(h.advice.hidden, false);
  assert.equal(h.toggle.checked, true);
  h.softButton.dispatch("click");
  assert.equal(h.attrs["data-theme"], "neumorphism");
  assert.equal(h.stored.get("claudeOne:theme"), "neumorphism");
  assert.equal(h.advice.hidden, true);
  assert.equal(h.toggle.checked, false);
  assert.equal(h.toggle.attrs["aria-describedby"], undefined);
  assert.equal(h.toggle.focused, true);
  assert.equal(h.frames.size + h.timers.size, 0);
});

test("frame advice requires two slow windows, waits out startup and stops after completion", () => {
  for (const interval of [50, 250, 1000]) {
    const h = harness();
    h.glass();
    assert.equal(h.timers.size, 0, "first route must be ready before sampling");
    h.ready();
    h.tick(1000);
    assert.equal(h.frames.size, 0, "do not sample the theme transition");
    h.tick(100);
    const perWindow = Math.max(3, Math.ceil(900 / interval));
    h.sample(interval, perWindow);
    assert.equal(h.advice.hidden, true, "one slow window is inconclusive");
    h.sample(interval, perWindow);
    assert.equal(h.advice.hidden, false);
    assert.equal(h.reason.textContent, "当前渲染有些卡顿");
    assert.equal(h.frames.size + h.timers.size, 0);
  }
});

test("normal, high-refresh and stable 30fps scheduling plus isolated spikes avoid frame advice", () => {
  for (const interval of [8.33, 16.67, 33.34]) {
    const h = harness();
    h.glass(); h.ready(); h.tick(1100);
    h.sample(interval, Math.ceil(2000 / interval));
    assert.equal(h.advice.hidden, true);
    assert.equal(h.frames.size + h.timers.size, 0);
  }
  const h = harness();
  h.glass(); h.ready(); h.tick(1100);
  h.tick(600);
  h.sample(16.67, 90);
  assert.equal(h.advice.hidden, true, "a single loading spike is not sustained jank");
  assert.equal(h.frames.size + h.timers.size, 0);
});

test("hidden tabs, pagehide, route transitions and rapid theme changes cancel unfinished sampling", () => {
  const h = harness();
  h.glass(); h.ready(); h.tick(1100); h.sample(50, 18);
  h.document.hidden = true;
  h.document.dispatch("visibilitychange");
  assert.equal(h.frames.size + h.timers.size, 0);
  h.tick(20000);
  assert.equal(h.advice.hidden, true);
  h.document.hidden = false;
  h.document.dispatch("visibilitychange");
  h.tick(1100); h.sample(16.67, 120);
  assert.equal(h.advice.hidden, true, "background time never contributes to slow windows");
  h.glass(); h.tick(1100);
  h.attrs["data-route-state"] = "exit";
  h.tick(100);
  assert.equal(h.frames.size + h.timers.size, 0);
  h.attrs["data-route-state"] = "idle";
  h.ready(); h.tick(1100);
  h.window.ClaudeOne.applyTheme("neumorphism");
  assert.equal(h.frames.size + h.timers.size, 0);
  h.glass();
  h.window.dispatch("pagehide");
  assert.equal(h.frames.size + h.timers.size, 0);
  h.window.dispatch("pageshow");
  assert.equal(h.timers.size, 1, "bfcache restore checks the current theme again");
  h.tick(1100);
  h.tick(7000);
  assert.equal(h.frames.size + h.timers.size, 0, "a hard deadline bounds observation");
});

test("reduced motion applies themes without creating a ripple overlay", () => {
  const h = harness({ reducedMotion: true });
  h.window.ClaudeOne.setThemeAnimated("liquid-glass");
  assert.equal(h.attrs["data-theme"], "liquid-glass");
  assert.equal(h.frames.size + h.timers.size, 0);
});

test("closing advice keeps the selected theme and stays dismissed through route, visibility and bfcache checks", () => {
  const h = harness({ saved: "liquid-glass", memory: 2 });
  h.closeButton.dispatch("click");
  assert.equal(h.advice.hidden, true);
  assert.equal(h.attrs["data-theme"], "liquid-glass");
  assert.equal(h.stored.get("claudeOne:theme-advice-disabled"), undefined, "close does not save a permanent preference");
  assert.equal(h.toggle.focused, true);
  assert.equal(h.toggle.attrs["aria-describedby"], undefined);
  h.ready();
  h.document.dispatch("visibilitychange");
  h.window.dispatch("pagehide");
  h.window.dispatch("pageshow");
  h.glass();
  assert.equal(h.advice.hidden, true);
  assert.equal(h.frames.size + h.timers.size, 0);
  h.window.ClaudeOne.applyTheme("neumorphism");
  h.glass();
  assert.equal(h.advice.hidden, false, "a new Liquid Glass visit can warn again");
  assert.equal(harness({ saved: "liquid-glass", memory: 2 }).advice.hidden, false, "a fresh page load can warn again");
});

test("never remind saves the preference and suppresses hardware and frame checks across visits and reloads", () => {
  const h = harness({ saved: "liquid-glass", cores: 2 });
  h.neverButton.dispatch("click");
  assert.equal(h.stored.get("claudeOne:theme-advice-disabled"), "1");
  assert.equal(h.attrs["data-theme"], "liquid-glass");
  assert.equal(h.advice.hidden, true);
  assert.equal(h.toggle.focused, true);
  h.window.ClaudeOne.applyTheme("neumorphism");
  h.glass(); h.ready();
  assert.equal(h.advice.hidden, true);
  assert.equal(h.frames.size + h.timers.size, 0);
  for (const hints of [{ memory: 2 }, { memory: 8, cores: 16 }, {}]) {
    const reload = harness({ ...hints, saved: "liquid-glass", adviceDisabled: true });
    reload.ready();
    reload.document.dispatch("visibilitychange");
    assert.equal(reload.advice.hidden, true);
    assert.equal(reload.frames.size + reload.timers.size, 0, "an opt-out also avoids observation overhead");
  }
});

test("dismissal cancels a pending frame check and prevents late or resumed warnings", () => {
  for (const button of ["closeButton", "neverButton"]) {
    const h = harness();
    h.glass(); h.ready(); h.tick(1100); h.sample(50, 18);
    assert.ok(h.frames.size > 0);
    h[button].dispatch("click");
    h.sample(50, 36);
    h.ready();
    assert.equal(h.advice.hidden, true);
    assert.equal(h.attrs["data-theme"], "liquid-glass");
    assert.equal(h.frames.size + h.timers.size, 0);
  }
});
