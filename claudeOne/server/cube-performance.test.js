"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function harness({ reduced = false, hidden = false, compact = false } = {}) {
  let now = 0, nextId = 0;
  const frames = new Map(), timers = new Map();
  function events() {
    const listeners = new Map();
    return {
      addEventListener(name, fn, options = {}) {
        if (options.signal?.aborted) return;
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name).add(fn);
        options.signal?.cleanup.push(() => listeners.get(name).delete(fn));
      },
      emit(name, detail = {}) {
        for (const fn of [...(listeners.get(name) || [])]) fn({
          stopPropagation() {}, preventDefault() {}, ...detail
        });
      },
      listenerCount(name) { return listeners.get(name)?.size || 0; }
    };
  }
  function node(className = "") {
    const writes = {};
    const values = { setProperty(key, value) { this[key] = value; } };
    const attrs = new Map();
    const el = {
      ...events(), className, children: [], parentNode: null, dataset: {}, writes,
      style: new Proxy(values, { set(target, key, value) {
        writes[key] = (writes[key] || 0) + 1; target[key] = value; return true;
      } }),
      classList: { add() {}, toggle() {} },
      setAttribute(key, value) { attrs.set(key, String(value)); },
      getAttribute(key) { return attrs.get(key) ?? null; },
      removeAttribute(key) { attrs.delete(key); },
      appendChild(child) {
        child.parentNode?.removeChild(child);
        this.children.push(child); child.parentNode = this; return child;
      },
      removeChild(child) { this.children = this.children.filter(c => c !== child); child.parentNode = null; },
      remove() { this.parentNode?.removeChild(this); },
      closest() { return null; },
      querySelector(selector) {
        if (selector === ".cube-axis-inner") return this.axis || (this.axis = node("cube-axis-inner"));
        return null;
      },
      querySelectorAll() { return []; },
      getBoundingClientRect() { return { left: 120, top: 120, right: 480, bottom: 480, width: 360, height: 360 }; }
    };
    return el;
  }
  const stage = node(), hero = node(), root = node(), body = node(), turn = node();
  stage.closest = () => hero;
  turn.setAttribute("data-cube-turn", "U");
  root.querySelector = selector => selector === "[data-cube-stage]" ? stage : null;
  root.querySelectorAll = selector => selector === "[data-cube-turn]" ? [turn] : [];
  const motion = { ...events(), matches: reduced };
  const compactMotion = { ...events(), matches: compact };
  const document = { ...events(), body, hidden, createElement: () => node(), querySelector: () => null };
  const window = { ...events(), innerWidth: 1280, innerHeight: 800, matchMedia: query => query.includes("max-width") ? compactMotion : motion };
  let visibleCallback, disconnected = false;
  class IntersectionObserver {
    constructor(callback) { visibleCallback = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  }
  class AbortController {
    constructor() { this.signal = { aborted: false, cleanup: [] }; }
    abort() { this.signal.aborted = true; this.signal.cleanup.splice(0).forEach(fn => fn()); }
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/cube.js"), "utf8"), {
    window, document, AbortController, console, IntersectionObserver,
    getComputedStyle: () => ({ perspective: "1200px", getPropertyValue: key => key === "--cubelet" ? "64" : "4" }),
    performance: { now: () => now },
    requestAnimationFrame: fn => { frames.set(++nextId, fn); return nextId; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: (fn, delay) => { timers.set(++nextId, { fn, at: now + delay }); return nextId; },
    clearTimeout: id => timers.delete(id)
  });
  function tick(ms) {
    now += ms;
    let pending;
    do {
      pending = [...timers].filter(([, timer]) => timer.at <= now);
      for (const [id, timer] of pending) if (timers.delete(id)) timer.fn();
    } while (pending.length);
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(fn => fn(now));
  }
  const page = window.__page_home;
  return {
    page, root, stage, hero, turn, body, document, window, frames, timers, tick,
    mount() { page.mount(root); },
    state: () => page.assistant.getState(),
    sample(step, count) { for (let i = 0; i < count; i++) tick(step); },
    cube: () => stage.children.find(el => el.className === "cube"),
    scatter: () => body.children.find(el => el.className === "scatter-stage"),
    hide(value) { document.hidden = value; document.emit("visibilitychange"); },
    reduce(value) { motion.matches = value; motion.emit("change"); },
    visible(value) { visibleCallback([{ isIntersecting: value }]); },
    disconnected: () => disconnected
  };
}

function settleScatter(h) {
  h.mount(); h.tick(16); h.tick(1800); h.tick(1000);
  assert.equal(h.state().scatterMode, "scattered");
}

test("cube has no frame loop while waiting for idle, and reduced motion stays static until interaction", () => {
  for (const reduced of [false, true]) {
    const h = harness({ reduced }); h.mount(); h.tick(16);
    assert.equal(h.frames.size, 0);
    if (reduced) {
      h.tick(10000);
      assert.equal(h.timers.size, 0);
      assert.equal(h.state().scattered, false);
      const before = h.cube().style.transform;
      h.window.emit("pointermove", { clientX: 1000, clientY: 600 });
      h.document.emit("pointermove", { clientX: 1000, clientY: 600 });
      h.tick(16);
      assert.equal(h.cube().style.transform, before, "moving outside the cube no longer schedules decorative work");
      h.stage.emit("pointerdown", { target: { closest() { return null; } }, clientX: 200, clientY: 200 });
      h.stage.emit("pointermove", { clientX: 220, clientY: 200 });
      h.tick(16);
      assert.notEqual(h.cube().style.transform, before, "direct dragging remains available with reduced motion");
      h.stage.emit("pointercancel", { type: "pointercancel" });
      h.tick(16);
      assert.equal(h.frames.size, 0);
    }
    h.page.unmount();
  }
});

test("small screens never scatter or spin while idle, but still allow turning cube faces", async () => {
  const h = harness({ compact: true }); h.mount(); h.tick(16); h.tick(10000);
  assert.equal(h.frames.size, 0); assert.equal(h.timers.size, 0);
  assert.equal(h.state().scattered, false);
  h.turn.emit("click");
  h.tick(350); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(Array.from(h.state().history), ["U"]);
  h.page.unmount();
  assert.equal(h.disconnected(), true);
});

test("an offscreen cube releases frames and idle timers and resumes when visible", () => {
  const h = harness(); settleScatter(h);
  h.visible(false);
  assert.equal(h.frames.size, 0); assert.equal(h.timers.size, 0);
  h.sample(1000, 5);
  h.visible(true); h.tick(16);
  assert.equal(h.frames.size, 1);
  h.page.unmount();
  assert.equal(h.disconnected(), true);
});

test("background cube drift stays within 30 updates per second on high-refresh displays", () => {
  const h = harness(); settleScatter(h);
  const block = h.scatter().children[0], core = block.children[0];
  const before = block.writes.transform, coreBefore = core.writes.transform, opacityBefore = block.writes.opacity;
  h.sample(4, 250);
  assert.ok(block.writes.transform - before >= 27);
  assert.ok(block.writes.transform - before <= 30);
  assert.equal(core.writes.transform, coreBefore, "unchanged orientation does not invalidate 3D surfaces");
  assert.equal(block.writes.opacity, opacityBefore, "unchanged opacity does not invalidate the backdrop");
  h.page.unmount();
});

test("hidden pages suspend all cube work and resume an unfinished scatter without jumping to its end", () => {
  const h = harness(); h.mount(); h.tick(16); h.tick(1800); h.tick(100);
  assert.equal(h.state().scatterMode, "scattering");
  const block = h.scatter().children[0];
  h.hide(true);
  assert.equal(h.frames.size + h.timers.size, 0);
  const before = block.writes.transform;
  h.tick(10000);
  assert.equal(block.writes.transform, before);
  h.hide(false); h.tick(16);
  assert.equal(h.state().scatterMode, "scattering");
  h.tick(1000);
  assert.equal(h.state().scatterMode, "scattered");
  h.window.emit("pagehide");
  assert.equal(h.frames.size + h.timers.size, 0);
  h.window.emit("pageshow");
  assert.equal(h.frames.size, 1);
  h.page.unmount();
});

test("changing reduced motion gathers the background and releases frames, timers and listeners on unmount", () => {
  const h = harness(); settleScatter(h);
  h.reduce(true); h.tick(800); h.tick(16);
  assert.equal(h.state().scatterMode, "cube");
  assert.equal(h.frames.size + h.timers.size, 0);
  h.page.unmount();
  assert.equal(h.document.listenerCount("pointermove"), 0);
  assert.equal(h.document.listenerCount("visibilitychange"), 0);
  h.reduce(false); h.hide(true); h.hide(false); h.tick(2000);
  assert.equal(h.frames.size + h.timers.size, 0, "unmounted pages cannot restart");
  h.mount(); h.tick(16);
  assert.equal(h.document.listenerCount("visibilitychange"), 1);
  h.page.unmount();
});

test("turns still finish when the reduced-motion frame loop is asleep", async () => {
  const h = harness({ reduced: true }); h.mount(); h.tick(16);
  h.turn.emit("click");
  assert.equal(h.state().turning, true);
  h.tick(350);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.state().turning, false);
  assert.deepEqual(Array.from(h.state().history), ["U"]);
  assert.equal(h.cube().children.filter(el => el.className === "cubelet").length, 26);
  h.page.unmount();
  assert.equal(h.frames.size + h.timers.size, 0);
});
