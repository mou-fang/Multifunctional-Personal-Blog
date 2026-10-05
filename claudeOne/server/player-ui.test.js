const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class CustomEvent extends Event {
  constructor(type, options = {}) {
    super(type, options);
    this.detail = options.detail;
  }
}

const viewKey = "claudeOne:player-minimized";
const trackKey = "claudeOne:player-last-src";
const indexKey = "claudeOne:player-last-idx";
const timeKey = "claudeOne:player-last-time";
const playerSource = fs.readFileSync(path.join(__dirname, "../js/player.js"), "utf8");
const tracks = [
  { file: "./music/first.wav", title: "First", cover: "./first.png" },
  { file: "./music/second.wav", title: "Second", cover: "./second.png" }
];

function node() {
  const el = new EventTarget();
  const attrs = new Map();
  const classes = new Set();
  Object.assign(el, {
    style: {}, children: [], textContent: "", innerHTML: "",
    setAttribute(key, value) { attrs.set(key, String(value)); },
    removeAttribute(key) { attrs.delete(key); },
    getAttribute(key) { return attrs.get(key) ?? null; },
    hasAttribute(key) { return attrs.has(key); },
    appendChild(child) { this.children.push(child); },
    classList: { add: key => classes.add(key), remove: key => classes.delete(key) }
  });
  return el;
}

function harness({ savedView, stored = {}, blockedStorage = false, blockedAutoplay = false, playlist = tracks, loading = false } = {}) {
  const nodes = new Map();
  const getNode = selector => {
    if (!nodes.has(selector)) nodes.set(selector, node());
    return nodes.get(selector);
  };
  const root = getNode("[data-global-player]");
  root.setAttribute("hidden", "");
  root.setAttribute("data-minimized", "");
  root.querySelector = getNode;
  const audio = getNode("[data-gp-audio]");
  Object.assign(audio, { src: "", currentTime: 0, duration: 120, paused: true, plays: 0, loads: 0 });
  audio.play = () => {
    audio.plays++;
    if (blockedAutoplay) return Promise.reject(new Error("Autoplay blocked"));
    audio.paused = false;
    audio.dispatchEvent(new Event("play"));
    return Promise.resolve();
  };
  audio.pause = () => { audio.paused = true; audio.dispatchEvent(new Event("pause")); };
  audio.load = () => { audio.loads++; audio.currentTime = 0; };
  const storage = new Map([
    ["claudeOne:player-volume", "37"],
    ["claudeOne:player-last-idx", "1"],
    ["claudeOne:player-last-time", "24"]
  ]);
  if (savedView !== undefined) storage.set(viewKey, savedView);
  for (const [key, value] of Object.entries(stored)) {
    if (value === null) storage.delete(key);
    else storage.set(key, String(value));
  }
  const document = Object.assign(new EventTarget(), {
    readyState: loading ? "loading" : "complete", body: node(), activeElement: null,
    querySelector: getNode, createElement: node
  });
  const window = Object.assign(new EventTarget(), { __MUSIC_PLAYLIST: playlist, CustomEvent });
  const timers = [];
  const context = vm.createContext({
    document, window, Event, CustomEvent, console: { warn() {} },
    localStorage: {
      getItem(key) { if (blockedStorage) throw new Error("Storage unavailable"); return storage.get(key) ?? null; },
      setItem(key, value) { if (blockedStorage) throw new Error("Storage unavailable"); storage.set(key, String(value)); }
    },
    setTimeout(fn, delay) { timers.push({ fn, delay }); }, URL
  });
  vm.runInContext(playerSource, context);
  return { window, document, root, audio, storage, timers, getNode, api: () => window.ClaudeOnePlayer };
}

function assertMinimized(h) {
  assert.equal(h.api().isMinimized(), true);
  assert.equal(h.root.hasAttribute("data-minimized"), true);
  assert.equal(h.document.body.hasAttribute("data-player-expanded"), false);
  assert.equal(h.getNode("[data-gp-expand]").getAttribute("aria-label"), "Expand player");
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test("either saved view restores the song and position while opening minimized and paused", async () => {
  for (const savedView of [undefined, "0", "1"]) {
    const h = harness({ savedView });
    await settle();
    assertMinimized(h);
    assert.equal(h.root.hasAttribute("hidden"), false);
    assert.equal(h.audio.volume, 0.37);
    assert.equal(h.audio.plays, 0);
    assert.equal(h.audio.loads, 1);
    assert.equal(h.api().getState().playing, false);
    assert.equal(h.storage.get(viewKey), savedView);
    assert.equal(h.audio.src, tracks[1].file);
    assert.equal(h.getNode("[data-gp-title]").textContent, "Second");
    assert.equal(h.getNode("[data-gp-cover]").src, "./second.png");
    assert.equal(h.getNode("[data-gp-current-time]").textContent, "00:24");
    assert.equal(h.storage.get(timeKey), "24");
    h.audio.dispatchEvent(new Event("loadedmetadata"));
    assert.equal(h.audio.currentTime, 24);
    assert.equal(h.storage.get(trackKey), tracks[1].file);
  }
});

test("unavailable storage opens with the first song loaded and paused", async () => {
  const h = harness({ blockedStorage: true });
  await settle();
  assertMinimized(h);
  assert.equal(h.audio.plays, 0);
  assert.equal(h.audio.src, tracks[0].file);
  assert.equal(h.api().getState().playing, false);
});

test("background interactions and expansion never autoplay; play resumes at the saved position", async () => {
  const h = harness({ savedView: "0" });
  await settle();
  assertMinimized(h);
  assert.equal(h.root.hasAttribute("data-waiting-interaction"), false);
  h.document.dispatchEvent(new Event("click"));
  h.document.dispatchEvent(new Event("keydown"));
  h.document.dispatchEvent(new Event("touchstart"));
  h.getNode("[data-gp-expand]").dispatchEvent(new Event("click"));
  h.getNode("[data-gp-expand]").dispatchEvent(new Event("click"));
  h.audio.dispatchEvent(new Event("loadedmetadata"));
  await settle();
  assertMinimized(h);
  assert.equal(h.audio.plays, 0);
  h.getNode("[data-gp-play]").dispatchEvent(new Event("click"));
  await settle();
  assert.equal(h.audio.plays, 1);
  assert.equal(h.audio.currentTime, 24);
  assert.equal(h.api().getState().playing, true);
  assertMinimized(h);
  assert.equal(h.storage.get(viewKey), "0");
});

test("empty playlist starts minimized immediately without a delayed view change", () => {
  const h = harness({ playlist: [], savedView: "0" });
  assertMinimized(h);
  assert.equal(h.root.hasAttribute("hidden"), false);
  assert.equal(h.audio.plays, 0);
  assert.equal(h.root.children.length, 1);
  assert.equal(h.timers.length, 0);
});

test("SPA navigation keeps playback while cache restore returns minimized and paused at the same position", async () => {
  const h = harness({ savedView: "0" });
  await settle();
  h.audio.dispatchEvent(new Event("loadedmetadata"));
  h.api().toggle();
  await settle();
  h.getNode("[data-gp-expand]").dispatchEvent(new Event("click"));
  assert.equal(h.api().isMinimized(), false);
  assert.equal(h.document.body.hasAttribute("data-player-expanded"), true);
  h.window.dispatchEvent(new Event("hashchange"));
  h.window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: false }));
  assert.equal(h.api().isMinimized(), false);
  h.audio.currentTime = 48;
  const before = h.api().getState();
  h.window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
  assertMinimized(h);
  const after = h.api().getState();
  for (const key of ["currentIndex", "currentTime", "volume", "mode", "playlistLength"]) {
    assert.equal(after[key], before[key], key);
  }
  assert.equal(h.audio.plays, 1);
  assert.equal(after.playing, false);
  assert.equal(h.audio.paused, true);
  assert.equal(h.audio.loads, 1);
  assert.equal(h.audio.src, tracks[1].file);
  assert.equal(h.storage.get(viewKey), "0");
  h.getNode("[data-gp-expand]").dispatchEvent(new Event("click"));
  h.getNode("[data-gp-expand]").dispatchEvent(new Event("click"));
  assertMinimized(h);
  assert.equal(h.storage.get(viewKey), "0", "legacy view preference cannot affect song loading or playback");
});

test("saved playback mode remains effective while the initial view is minimized", async () => {
  const h = harness({ savedView: "0", loading: true });
  h.storage.set("claudeOne:player-repeat", "one");
  h.document.dispatchEvent(new Event("DOMContentLoaded"));
  await settle();
  assertMinimized(h);
  assert.equal(h.api().getState().mode, "one");
  assert.equal(h.audio.loop, true);
  assert.equal(h.audio.plays, 0);
  h.api().toggle();
  await settle();
  assert.equal(h.audio.paused, false);
  h.api().toggle();
  assert.equal(h.audio.paused, true);
  assertMinimized(h);
});

test("shell markup is minimized before the player script runs", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  assert.match(html, /<div\b[^>]*data-global-player\b[^>]*data-minimized\b[^>]*>/);
  const h = harness({ loading: true });
  assert.equal(h.root.hasAttribute("data-minimized"), true);
  assert.equal(h.audio.plays, 0);
  h.document.dispatchEvent(new Event("DOMContentLoaded"));
  assertMinimized(h);
});

test("a first visit selects the first song without carrying unrelated old progress", () => {
  const h = harness({ stored: { [indexKey]: null, [timeKey]: "24" } });
  assert.equal(h.audio.src, tracks[0].file);
  assert.equal(h.api().getState().currentIndex, 0);
  h.audio.dispatchEvent(new Event("loadedmetadata"));
  assert.equal(h.audio.currentTime, 0);
  assert.equal(h.audio.plays, 0);
});

test("saved song identity survives playlist reordering and replaced songs reset progress", () => {
  const h = harness({ playlist: [tracks[1], tracks[0]], stored: { [trackKey]: tracks[1].file } });
  h.audio.dispatchEvent(new Event("loadedmetadata"));
  assert.equal(h.audio.src, tracks[1].file);
  assert.equal(h.audio.currentTime, 24);
  assert.equal(h.storage.get(indexKey), "0");
  const missing = harness({ stored: { [trackKey]: "./music/deleted.wav" } });
  missing.audio.dispatchEvent(new Event("loadedmetadata"));
  assert.equal(missing.audio.src, tracks[0].file);
  assert.equal(missing.audio.currentTime, 0);
  assert.equal(missing.audio.plays, 0);
});

test("metadata and zero-time events cannot overwrite pending saved progress", () => {
  const h = harness();
  h.audio.dispatchEvent(new Event("timeupdate"));
  h.api().expand();
  h.window.dispatchEvent(new Event("pagehide"));
  assert.equal(h.storage.get(timeKey), "24");
  assert.equal(h.api().getState().currentTime, 24);
  h.audio.dispatchEvent(new Event("loadedmetadata"));
  assert.equal(h.storage.get(timeKey), "24");
});

test("choosing another song before metadata loads cancels the pending seek", async () => {
  const h = harness();
  h.api().skipTo(0);
  await settle();
  h.audio.dispatchEvent(new Event("loadedmetadata"));
  assert.equal(h.audio.src, tracks[0].file);
  assert.equal(h.audio.currentTime, 0);
  assert.equal(h.storage.get(trackKey), tracks[0].file);
  assert.equal(h.storage.get(timeKey), "0");
});

test("pause and leaving the site save the latest position of the selected song", async () => {
  const h = harness();
  h.audio.dispatchEvent(new Event("loadedmetadata"));
  h.api().toggle();
  await settle();
  h.audio.currentTime = 47.5;
  h.api().pause();
  assert.equal(h.storage.get(timeKey), "47.5");
  h.audio.currentTime = 49;
  h.window.dispatchEvent(new Event("pagehide"));
  assert.equal(h.storage.get(timeKey), "49");
  assert.equal(h.storage.get(trackKey), tracks[1].file);
});

test("missing restored audio stays paused without automatically skipping or playing", () => {
  const h = harness();
  h.audio.dispatchEvent(new Event("error"));
  assert.equal(h.audio.plays, 0);
  assert.equal(h.timers.length, 0);
  assert.equal(h.api().getState().currentIndex, 1);
  assert.equal(h.storage.get(timeKey), "24");
});

test("invalid or completed saved positions do not seek outside the current song", () => {
  for (const time of ["NaN", "Infinity", "-1", "120", "99999"]) {
    const h = harness({ stored: { [timeKey]: time } });
    h.audio.dispatchEvent(new Event("loadedmetadata"));
    assert.equal(h.audio.currentTime, 0, time);
    assert.equal(h.audio.plays, 0, time);
  }
});
