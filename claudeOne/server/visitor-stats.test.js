"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  DEFAULT_ONLINE_WINDOW_MS,
  VisitorStore,
  hasValidHumanSignals,
  isLikelyBot,
  isLikelyHumanRequest,
} = require("./visitor-stats");

function makeStore(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "claudeone-visitors-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return new VisitorStore({ dataFile: path.join(directory, "visitor-stats.json"), ...options });
}

test("recognizes common crawler and automation user agents", () => {
  assert.equal(isLikelyBot("Googlebot/2.1 (+http://www.google.com/bot.html)"), true);
  assert.equal(isLikelyBot("Mozilla/5.0 HeadlessChrome/126.0"), true);
  assert.equal(isLikelyBot("curl/8.7.1"), true);
  assert.equal(isLikelyBot("Mozilla/5.0 Chrome/126.0 Safari/537.36"), false);
});

test("requires visible, interactive, non-webdriver browser signals", () => {
  const valid = {
    interaction: true,
    visibility: "visible",
    webdriver: false,
    languages: 2,
    screen: { width: 1440, height: 900 },
  };
  assert.equal(hasValidHumanSignals(valid), true);
  assert.equal(hasValidHumanSignals({ ...valid, interaction: false }), false);
  assert.equal(hasValidHumanSignals({ ...valid, webdriver: true }), false);
  assert.equal(hasValidHumanSignals({ ...valid, visibility: "hidden" }), false);
});

test("accepts only same-site browser heartbeats with human signals", () => {
  const signals = {
    interaction: true,
    visibility: "visible",
    webdriver: false,
    languages: 2,
    screen: { width: 1440, height: 900 },
  };
  const headers = {
    "user-agent": "Mozilla/5.0 Chrome/126.0 Safari/537.36",
    "accept-language": "zh-CN",
    "sec-fetch-site": "same-origin",
    origin: "https://example.com",
    host: "example.com",
  };
  const request = {
    body: { signals },
    get(name) { return headers[String(name).toLowerCase()]; },
  };

  assert.equal(isLikelyHumanRequest(request), true);
  headers["sec-fetch-site"] = "cross-site";
  assert.equal(isLikelyHumanRequest(request), false);
});

test("counts a browser once and persists the anonymous hash", (t) => {
  const store = makeStore(t);
  const visitorId = "6c29c98f-51cb-4e51-950c-93c4a7765249";
  assert.deepEqual(store.record(visitorId).totalVisitors, 1);
  assert.deepEqual(store.record(visitorId).totalVisitors, 1);
  assert.equal(store.data.uniqueVisitors.length, 1);
  assert.equal(store.data.uniqueVisitors[0].includes(visitorId), false);

  const restored = new VisitorStore({ dataFile: store.dataFile });
  assert.equal(restored.snapshot().totalVisitors, 1);
});

test("expires online presence after the heartbeat window", (t) => {
  let clock = Date.parse("2026-07-14T04:00:00.000Z");
  const store = makeStore(t, { now: () => clock });
  store.record("6c29c98f-51cb-4e51-950c-93c4a7765249");
  store.record("3605ed76-5c31-4cc0-9a38-7c566a924293");
  assert.equal(store.snapshot().onlineVisitors, 2);

  clock += DEFAULT_ONLINE_WINDOW_MS + 1;
  assert.equal(store.snapshot().onlineVisitors, 0);
  assert.equal(store.snapshot().totalVisitors, 2);
});
