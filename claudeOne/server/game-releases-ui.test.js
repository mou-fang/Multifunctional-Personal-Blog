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
  const intervals = new Map(), timeouts = new Map(); let timerId = 0, fetches = 0, fetchImpl;
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
    fetch: async (...args) => { fetches++; return fetchImpl ? fetchImpl(...args) : { ok: true, json: async () => snapshot }; },
    setTimeout: (callback, delay) => { const id = ++timerId; timeouts.set(id, { callback, delay }); return id; },
    clearTimeout: id => timeouts.delete(id),
    setInterval: (callback, delay) => { const id = ++timerId; intervals.set(id, { callback, delay }); return id; },
    clearInterval: id => intervals.delete(id)
  });
  const get = name => controls.get(`[data-release-${name}]`);
  function badges() {
    const result = [];
    function visit(el) { if (el.className === "release-card__badge") result.push(el.textContent); el.children.forEach(visit); }
    visit(get("list")); return result;
  }
  return { window, document, root, get, badges, intervals, timeouts, snapshot, setFetch: fn => { fetchImpl = fn; }, page: window.__page_game_releases,
    container: { querySelector: () => root }, setNow: value => { now = value; },
    tick: () => [...intervals.values()].forEach(timer => timer.callback()), fetches: () => fetches };
}

test("release cards default to including history and advance across Shanghai midnight without refetching", async () => {
  const h = harness(); h.page.mount(h.container);
  await new Promise(setImmediate);
  assert.equal(h.get("history").checked, true);
  assert.deepEqual(h.badges(), ["今日发售", "明天"]);
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

test("prepare renders the complete edition synchronously on entry and preserves cards during background revalidation", async () => {
  const h = harness();
  await h.page.prepare();
  assert.equal(h.fetches(), 1);
  assert.equal(h.get("list").replacements, 0, "preparation must not change the outgoing page");
  h.page.mount(h.container);
  assert.deepEqual(h.badges(), ["今日发售", "明天"], "first visible frame contains the edition, not loading text");
  assert.equal(h.fetches(), 1, "the prepared response must not be fetched twice on entry");
  assert.equal(h.timeouts.size, 0);
  h.page.unmount();
  await h.page.prepare();
  h.page.mount(h.container);
  const replacements = h.get("list").replacements;
  assert.deepEqual(h.badges(), ["今日发售", "明天"]);
  assert.doesNotMatch(h.get("status").textContent, /正在/);
  await new Promise(setImmediate);
  assert.equal(h.get("list").replacements, replacements, "an unchanged edition must not replace or flash the cards");
  assert.equal(h.fetches(), 2);
  h.page.unmount();
});

test("failed preparation enters a retryable error state, and refresh recovers without leaving the page", async () => {
  const h = harness(); h.setFetch(async () => { throw new Error("offline"); });
  await h.page.prepare(); h.page.mount(h.container);
  assert.match(h.get("list").textContent, /暂时无法读取/);
  assert.equal(h.get("refresh").disabled, false);
  assert.equal(h.fetches(), 1);
  h.setFetch(null);
  h.root.emit("click", { target: { closest: selector => selector === "[data-release-refresh]" ? h.get("refresh") : null } });
  await new Promise(setImmediate);
  assert.deepEqual(h.badges(), ["今日发售", "明天"]);
  assert.equal(h.timeouts.size, 0);
  h.page.unmount();
});

test("cancelled and timed-out preparation aborts the request and releases its deadline", async () => {
  for (const mode of ["cancel", "timeout"]) {
    const h = harness(); let signal;
    h.setFetch((_url, options) => new Promise((_resolve, reject) => {
      signal = options.signal; signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    const pending = h.page.prepare();
    assert.equal(h.page.prepare(), pending, "concurrent preparation shares one request");
    if (mode === "cancel") h.page.cancelPrepare();
    else [...h.timeouts.values()][0].callback();
    await pending;
    assert.equal(signal.aborted, true);
    assert.equal(h.timeouts.size, 0);
    h.setFetch(null); await h.page.prepare(); h.page.mount(h.container);
    assert.deepEqual(h.badges(), ["今日发售", "明天"]);
    h.page.unmount();
  }
});

test("hidden tabs stop date checks, resume immediately, retain the checkbox choice and clean up on unmount", async () => {
  const h = harness(); h.page.mount(h.container); await new Promise(setImmediate);
  h.get("history").checked = false; h.root.emit("change", { target: h.get("history") });
  h.document.hidden = true; h.document.emit("visibilitychange");
  assert.equal(h.intervals.size, 0);
  h.setNow("2026-10-06T16:00:00Z"); h.window.emit("focus");
  assert.deepEqual(h.badges(), ["今日发售", "明天"]);
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
