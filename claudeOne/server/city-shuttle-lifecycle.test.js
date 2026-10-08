const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Core = require("../js/city-shuttle-core.js");
const Scene = require("../js/city-shuttle-scene.js");

function fixture() {
  const frames = new Map(), workers = [], observers = [];
  let nextFrame = 0, deletedTextures = 0;
  class Element extends EventTarget {
    constructor() { super(); this.dataset = {}; this.hidden = false; this.disabled = false; this.value = "1"; this.children = []; }
    matches() { return false; }
    setAttribute() {}
    appendChild(child) { this.children.push(child); }
    replaceChildren() { this.children = []; }
    focus() { document.activeElement = this; }
    getBoundingClientRect() { return { width: 1280, height: 720 }; }
  }
  const classes = new Set();
  const document = new Element();
  const window = new Element();
  window.innerWidth = 1440;
  window.matchMedia = () => ({ matches: false });
  window.devicePixelRatio = 1;
  window.CityShuttleCore = Core;
  window.CityShuttleScene = Scene;
  window.CityShuttleEngineUrl = "libs/test-engine.wasm";
  document.currentScript = { src: "http://localhost/js/city-shuttle.js" };
  document.baseURI = "http://localhost/";
  document.body = { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } };
  document.hidden = false;
  const gl = new Proxy({
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    deleteTexture: () => deletedTextures++,
  }, { get: (target, name) => name in target ? target[name] : /^(create|get)/.test(name) ? () => ({}) : () => {} });
  const context2d = { fillRect() {}, fillText() {} };
  document.createElement = type => {
    const element = new Element();
    if (type === "canvas") element.getContext = kind => kind === "2d" ? context2d : gl;
    return element;
  };
  const nodes = new Map();
  const selectors = ["stage", "canvas", "overlay", "overlay-title", "overlay-text", "start", "pause", "district", "altitude", "speed", "status", "sensitivity", "startpoint", "hud-toggle", "reset"];
  selectors.forEach(name => nodes.set(`[data-cs-${name}]`, new Element()));
  const canvas = nodes.get("[data-cs-canvas]");
  canvas.getContext = () => gl;
  canvas.requestPointerLock = () => { document.pointerLockElement = canvas; document.dispatchEvent(new Event("pointerlockchange")); };
  document.exitPointerLock = () => { document.pointerLockElement = null; document.dispatchEvent(new Event("pointerlockchange")); };
  const stage = nodes.get("[data-cs-stage]");
  stage.requestFullscreen = () => { document.fullscreenElement = stage; document.dispatchEvent(new Event("fullscreenchange")); return Promise.resolve(); };
  document.exitFullscreen = () => { document.fullscreenElement = null; document.dispatchEvent(new Event("fullscreenchange")); return Promise.resolve(); };
  const qualities = [new Element(), new Element()], fullscreens = [new Element(), new Element()];
  const root = new Element();
  root.querySelector = selector => nodes.get(selector);
  root.querySelectorAll = selector => selector === "[data-cs-quality]" ? qualities : fullscreens;
  const scope = { querySelector: () => root };
  class Worker extends Element {
    constructor() { super(); this.messages = []; this.terminated = false; workers.push(this); }
    postMessage(message) { this.messages.push(message); }
    terminate() { this.terminated = true; }
    emit(data) { this.dispatchEvent(new MessageEvent("message", { data })); }
  }
  class ResizeObserver {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  const sandbox = {
    window, document, Worker, ResizeObserver, AbortController, URL,
    localStorage: { getItem: () => null, setItem() {} },
    performance: { now: () => 0 },
    requestAnimationFrame: fn => { const id = ++nextFrame; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/city-shuttle.js"), "utf8"), sandbox);
  function key(type, code, modifiers = {}) { const event = new Event(type, { cancelable: true }); event.code = code; event.repeat = false; Object.assign(event, modifiers); window.dispatchEvent(event); }
  function reply(worker) { worker.emit({ type: "frame", pixels: new Uint8Array(144 * 55 * 4), columns: 144, rows: 55, state: [0, 10, 335, 0, 0, 0, 0, 0], elapsed: 3 }); }
  function step(time) { const [id, callback] = frames.entries().next().value; frames.delete(id); callback(time); }
  function ready(worker) { worker.emit({ type: "ready", objects: 965 }); reply(worker); }
  return { api: window.__page_city_shuttle, scope, root, nodes, qualities, fullscreens, window, document, frames, workers, observers, key, reply, step, ready, classes, deletedTextures: () => deletedTextures };
}

test("leaving the page stops its worker, animation, observer and input listeners", () => {
  const f = fixture();
  f.api.mount(f.scope); const first = f.workers[0]; f.ready(first);
  f.nodes.get("[data-cs-start]").dispatchEvent(new Event("click"));
  assert.equal(f.frames.size, 1);
  const messages = first.messages.length;
  f.api.unmount();
  assert.equal(first.terminated, true);
  assert.equal(f.frames.size, 0);
  assert.equal(f.observers[0].disconnected, true);
  assert.equal(f.deletedTextures(), 2);
  assert.equal(f.classes.has("city-shuttle-route"), false);
  f.key("keydown", "KeyW");
  first.emit({ type: "ready", objects: 965 });
  assert.equal(first.messages.length, messages);
});

test("a brief movement key survives a render-only frame, and pause clears it", () => {
  const f = fixture(); f.api.mount(f.scope); const worker = f.workers[0]; f.ready(worker);
  f.nodes.get("[data-cs-start]").dispatchEvent(new Event("click"));
  f.key("keydown", "KeyW"); f.key("keyup", "KeyW"); f.step(100);
  assert.equal(worker.messages.at(-1).dt, 0); assert.equal(worker.messages.at(-1).flags, 1);
  f.reply(worker); f.step(116);
  assert.ok(worker.messages.at(-1).dt > 0); assert.equal(worker.messages.at(-1).flags, 1);
  f.reply(worker); f.step(132); assert.equal(worker.messages.at(-1).flags, 0);
  f.key("keydown", "KeyW"); f.key("keydown", "KeyP");
  assert.equal(f.frames.size, 0); assert.equal(f.nodes.get("[data-cs-overlay]").hidden, false);
  f.api.unmount();
});

test("paused keyboard controls can enter and leave fullscreen while focus is on the resume button", () => {
  const f = fixture(); f.api.mount(f.scope); f.ready(f.workers[0]);
  f.nodes.get("[data-cs-start]").dispatchEvent(new Event("click")); f.key("keydown", "KeyP");
  f.window.matches = selector => selector === "button";
  f.key("keydown", "KeyF");
  assert.equal(f.document.fullscreenElement, f.nodes.get("[data-cs-stage]"));
  assert.equal(f.fullscreens[0].textContent, "退出全屏 (F)");
  f.key("keydown", "KeyF"); assert.equal(f.document.fullscreenElement, null);
  assert.equal(f.fullscreens[0].textContent, "全屏 (F)");
  f.key("keydown", "KeyH"); assert.equal(f.root.dataset.hud, "false");
  assert.equal(f.frames.size, 0); f.api.unmount();
});

test("backgrounding and losing focus pause flight, clear movement and require an explicit resume", () => {
  const f = fixture(); f.api.mount(f.scope); f.ready(f.workers[0]);
  const start = f.nodes.get("[data-cs-start]"), overlay = f.nodes.get("[data-cs-overlay]");
  start.dispatchEvent(new Event("click")); f.key("keydown", "KeyW");
  f.document.hidden = true; f.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(f.frames.size, 0); assert.equal(overlay.hidden, false); assert.equal(f.document.pointerLockElement, null);
  f.document.hidden = false; f.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(f.frames.size, 0, "returning to the tab must not resume automatically");
  start.dispatchEvent(new Event("click")); f.step(100);
  assert.equal(f.workers[0].messages.at(-1).flags, 0, "held movement must not survive backgrounding");
  f.reply(f.workers[0]); f.window.dispatchEvent(new Event("blur"));
  assert.equal(f.frames.size, 0); assert.equal(overlay.hidden, false); f.api.unmount();
});

test("queued quality refresh and resizing never start a second live worker", () => {
  const f = fixture(); f.api.mount(f.scope); const first = f.workers[0]; first.emit({ type: "ready", objects: 965 });
  f.qualities[0].dispatchEvent(new Event("click"));
  f.reply(first); assert.ok(first.messages.at(-1).columns > 200);
  f.window.innerWidth = 390; f.window.dispatchEvent(new Event("resize"));
  assert.equal(first.terminated, true); assert.equal(f.root.dataset.unsupported, "true");
  f.window.innerWidth = 1440; f.window.dispatchEvent(new Event("resize"));
  assert.equal(f.workers.length, 2); assert.equal(f.workers.filter(w => !w.terminated).length, 1);
  assert.equal(f.nodes.get("[data-cs-startpoint]").children.length, Scene.SPAWNS.length);
  f.api.unmount();
});

test("load failure releases the pointer and loading-time location selection is respected", () => {
  const f = fixture(); f.api.mount(f.scope); const worker = f.workers[0];
  assert.equal(f.nodes.get("[data-cs-start]").disabled, true);
  f.nodes.get("[data-cs-startpoint]").value = "window";
  worker.emit({ type: "ready", objects: 1200 });
  const reset = worker.messages.find(message => message.type === "reset");
  assert.equal(reset.spawn.id, "window");
  f.reply(worker); f.nodes.get("[data-cs-start]").dispatchEvent(new Event("click"));
  assert.equal(f.document.pointerLockElement, f.nodes.get("[data-cs-canvas]"));
  worker.emit({ type: "error", message: "core load failed" });
  assert.equal(f.document.pointerLockElement, null);
  assert.equal(worker.terminated, true); assert.equal(f.frames.size, 0);
  assert.equal(f.nodes.get("[data-cs-start]").disabled, true);
  assert.equal(f.nodes.get("[data-cs-pause]").disabled, true);
  assert.equal(f.nodes.get("[data-cs-overlay-text]").textContent, "core load failed");
  f.api.unmount();
});

test("browser modifier shortcuts do not become flight input", () => {
  const f = fixture(); f.api.mount(f.scope); const worker = f.workers[0]; f.ready(worker);
  f.nodes.get("[data-cs-start]").dispatchEvent(new Event("click"));
  f.key("keydown", "KeyW", { ctrlKey: true }); f.key("keyup", "KeyW");
  f.key("keydown", "KeyF", { metaKey: true });
  f.step(100); assert.equal(worker.messages.at(-1).flags, 0);
  f.reply(worker); f.step(116); assert.equal(worker.messages.at(-1).flags, 0);
  assert.notEqual(f.nodes.get("[data-cs-status]").textContent, "此浏览器暂不支持全屏");
  f.api.unmount();
});
