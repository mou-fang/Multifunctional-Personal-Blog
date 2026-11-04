"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");

function harness() {
  const frames = new Map(), nodes = new Map(); let id = 0, visible, disconnected = false, now = 0;
  const drawing = new Proxy({}, { get(target, key) {
    return target[key] || (key === "createRadialGradient" ? () => ({ addColorStop() {} }) : () => {});
  } });
  function node() {
    return Object.assign(new EventTarget(), {
      style: {}, dataset: {}, setAttribute() {}, removeAttribute() {}, querySelector() { return null; },
      classList: { add() {}, remove() {} }
    });
  }
  const canvas = node(), state = node(), pause = node(), status = node();
  Object.assign(canvas, { parentElement: { getBoundingClientRect: () => ({ width: 280 }) },
    getContext: () => drawing, focus(options) { this.focusOptions = options; } });
  const buttons = ["UP", "LEFT", "DOWN", "RIGHT"].map(direction => {
    const button = node(); button.dataset.snakeDir = direction; return button;
  });
  nodes.set("[data-snake-canvas]", canvas); nodes.set("[data-snake-state]", state);
  nodes.set("[data-snake-pause]", pause); nodes.set("[data-snake-status]", status);
  const root = { querySelector: selector => nodes.get(selector) || null,
    querySelectorAll: selector => selector === "[data-snake-dir]" ? buttons : [] };
  const document = Object.assign(new EventTarget(), { hidden: false });
  const window = { innerHeight: 844, devicePixelRatio: 3,
    ClaudeOneDevice: { isCompact: () => true, canvasPixelRatio: () => 1.5 } };
  class IntersectionObserver {
    constructor(callback) { visible = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  }
  const marker = "  host.__page_snake = { mount: mount, unmount: unmount };";
  const source = fs.readFileSync(path.join(__dirname, "../js/snake.js"), "utf8");
  assert.ok(source.includes(marker));
  vm.runInNewContext(source.replace(marker, marker + "\n host.__snakeState = function () { return game; };"), {
    window, document, AbortController, IntersectionObserver, console, setTimeout, clearTimeout,
    requestAnimationFrame: callback => { frames.set(++id, callback); return id; },
    cancelAnimationFrame: key => frames.delete(key)
  });
  const page = window.__page_snake; page.mount(root);
  function step(ms) { now += ms; const work = [...frames.values()]; frames.clear(); work.forEach(fn => fn(now)); }
  function touch(type, fields = {}) { canvas.dispatchEvent(Object.assign(new Event(type), fields)); }
  return { page, canvas, state, pause, buttons, frames, step, touch, document, current: window.__snakeState,
    visibility(value) { visible([{ isIntersecting: value }]); }, disconnected: () => disconnected };
}

test("mobile snake starts from direction buttons, remains still while ready/paused, and preserves the board ratio", () => {
  const h = harness(); h.step(40);
  assert.equal(h.frames.size, 0);
  assert.equal(h.canvas.style.height, "auto");
  assert.equal(h.canvas.width / h.canvas.height, 4 / 3);
  assert.ok(h.canvas.width <= 420, "render to the small board instead of a desktop-sized backing buffer");
  assert.equal(h.canvas.focusOptions.preventScroll, true);
  h.buttons[0].dispatchEvent(new Event("click"));
  assert.equal(h.current().state, "playing"); assert.equal(h.current().snakes[0].nextDir.y, -1);
  h.step(40);
  h.pause.dispatchEvent(new Event("click")); h.step(40);
  assert.equal(h.current().state, "paused"); assert.equal(h.frames.size, 0);
  h.pause.dispatchEvent(new Event("click"));
  assert.equal(h.current().state, "playing"); assert.equal(h.frames.size, 1);
  h.page.unmount(); assert.equal(h.frames.size, 0); assert.equal(h.disconnected(), true);
  h.buttons[0].dispatchEvent(new Event("click"));
  assert.equal(h.frames.size, 0, "old direction controls cannot restart an unmounted game");
});

test("cancelled swipes never start a game; offscreen and background play pause until an explicit resume", () => {
  const h = harness(); h.step(40);
  h.touch("touchstart", { touches: [{ identifier: 7, clientX: 50, clientY: 50 }] });
  h.touch("touchcancel");
  h.touch("touchend", { changedTouches: [{ identifier: 7, clientX: 50, clientY: 150 }] });
  assert.equal(h.current().state, "ready");
  h.buttons[0].dispatchEvent(new Event("click")); h.step(40);
  h.visibility(false);
  assert.equal(h.current().state, "paused"); assert.equal(h.frames.size, 0);
  h.visibility(true); h.step(40);
  assert.equal(h.current().state, "paused"); assert.equal(h.frames.size, 0);
  h.pause.dispatchEvent(new Event("click"));
  h.document.hidden = true; h.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(h.current().state, "paused"); assert.equal(h.frames.size, 0);
  h.page.unmount();
});
