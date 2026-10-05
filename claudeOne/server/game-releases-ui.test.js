"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const core = require("../js/game-releases-core");

function target() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type); },
    emit(type, event = {}) { listeners.get(type)?.(event); }
  };
}
function element(tag = "div") {
  const el = Object.assign(target(), {
    tag, children: [], attributes: {}, className: "", value: "", checked: false,
    classList: { toggle() {} }, replacements: 0,
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; this.replacements++; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    matches(selector) { return this.selector === selector; }
  });
  Object.defineProperty(el, "textContent", {
    get() { return this.value + this.children.map(child => child.textContent).join(""); },
    set(value) { this.value = value; this.children = []; }
  });
  return el;
}
function harness() {
  let now = "2026-10-05T15:59:59Z"; // One second before midnight in Shanghai.
  const controls = new Map();
  for (const name of ["status", "list", "count", "next", "result", "updated", "poster-open", "refresh", "filters", "history", "dialog", "poster", "poster-error", "poster-download"]) {
    const selector = `[data-release-${name}]`, control = element();
    control.selector = selector; controls.set(selector, control);
  }
  const root = Object.assign(element(), { querySelector: selector => controls.get(selector) });
  const document = Object.assign(target(), { hidden: false, createElement: element });
  const intervals = new Map(); let timerId = 0, fetches = 0;
  const items = ["2026-10-05", "2026-10-06"].map((releaseDate, index) => ({
    id: String(index + 1).repeat(24), title: "验证样例 " + index, searchName: "Fixture " + index,
    releaseDate, platforms: ["PC"], summary: "仅用于回归测试。", sourceUrls: ["https://store.steampowered.com/"], cover: null
  }));
  const snapshot = { schemaVersion: 1, date: "2026-10-05", timeZone: "Asia/Shanghai", revision: "a".repeat(64), weeklyPoster: "/api/game-releases/assets/" + "a".repeat(64) + ".png", items };
  assert.equal(core.valid(snapshot), true);
  const window = Object.assign(target(), {
    GameReleasesCore: { ...core, today: zone => core.today(zone, new Date(now)) },
    CLAUDE_ONE_CONFIG: { api: { baseUrl: "" } }
  });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/game-releases.js"), "utf8"), {
    window, document, URL, AbortController,
    fetch: async () => { fetches++; return { ok: true, json: async () => snapshot }; },
    setTimeout: () => ++timerId, clearTimeout() {},
    setInterval: (callback, delay) => { const id = ++timerId; intervals.set(id, { callback, delay }); return id; },
    clearInterval: id => intervals.delete(id)
  });
  const get = name => controls.get(`[data-release-${name}]`);
  function badges() {
    const result = [];
    function visit(el) { if (el.className === "release-card__badge") result.push(el.textContent); el.children.forEach(visit); }
    visit(get("list")); return result;
  }
  return { window, document, root, get, badges, intervals, page: window.__page_game_releases,
    container: { querySelector: () => root }, setNow: value => { now = value; },
    tick: () => [...intervals.values()].forEach(timer => timer.callback()), fetches: () => fetches };
}

test("release cards default to including history and advance across Shanghai midnight without refetching", async () => {
  const h = harness(); h.page.mount(h.container);
  await new Promise(setImmediate);
  assert.equal(h.get("history").checked, true);
  assert.deepEqual(h.badges(), ["今日发售", "1天后"]);
  assert.equal([...h.intervals.values()][0].delay, 60000);
  const renders = h.get("list").replacements; h.tick();
  assert.equal(h.get("list").replacements, renders, "same-day checks must not replace cards");
  h.setNow("2026-10-05T16:00:00Z"); h.tick();
  assert.deepEqual(h.badges(), ["已发售", "今日发售"]);
  assert.equal(h.get("count").textContent, "01");
  h.setNow("2026-10-06T16:00:00Z"); h.window.emit("focus");
  assert.deepEqual(h.badges(), ["已发售", "已发售"]);
  assert.equal(h.get("count").textContent, "00");
  assert.equal(h.fetches(), 1, "calendar updates do not need another weekly publish or network fetch");
  h.page.unmount();
});

test("hidden tabs stop date checks, resume immediately, retain the checkbox choice and clean up on unmount", async () => {
  const h = harness(); h.page.mount(h.container); await new Promise(setImmediate);
  h.get("history").checked = false; h.root.emit("change", { target: h.get("history") });
  h.document.hidden = true; h.document.emit("visibilitychange");
  assert.equal(h.intervals.size, 0);
  h.setNow("2026-10-06T16:00:00Z"); h.window.emit("focus");
  assert.deepEqual(h.badges(), ["今日发售", "1天后"]);
  h.document.hidden = false; h.document.emit("visibilitychange");
  assert.deepEqual(h.badges(), []);
  assert.equal(h.get("result").textContent, "显示 0 款");
  assert.equal(h.get("history").checked, false);
  assert.equal(h.intervals.size, 1);
  h.page.unmount();
  assert.equal(h.intervals.size, 0);
  assert.equal(h.document.listeners.size, 0);
  assert.equal(h.window.listeners.size, 0);
  h.page.mount(h.container); await new Promise(setImmediate);
  assert.equal(h.get("history").checked, true);
  assert.deepEqual(h.badges(), ["已发售", "已发售"]);
  assert.equal(h.intervals.size, 1);
  h.page.unmount();
});
