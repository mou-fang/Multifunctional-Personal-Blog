const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const settle = () => new Promise(resolve => setImmediate(resolve));

test("optional downloads wait until the route paints; legacy playlist fallback still initializes the player", async () => {
  const window = new EventTarget();
  const scripts = [];
  const links = [];
  const frames = [];
  const document = {
    createElement: () => ({ remove() {} }),
    body: { appendChild: script => scripts.push(script) },
    head: { appendChild: link => links.push(link) }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/startup.js"), "utf8"), {
    window, document, console, requestAnimationFrame: fn => frames.push(fn)
  });
  assert.equal(window.__CLAUDEONE_PLAYER_LOADING, true);
  assert.equal(scripts.length, 0);
  window.dispatchEvent(new Event("claudeone:router-ready"));
  window.dispatchEvent(new Event("claudeone:router-ready"));
  assert.equal(frames.length, 1, "only initialize once across route changes");
  frames.shift()();
  assert.equal(scripts.length, 0);
  frames.shift()();
  await settle();
  assert.equal(links.length, 1);
  const library = scripts.find(script => script.src === "./api/music-library/playlist.js");
  assert.ok(library);
  assert.equal(scripts.some(script => /player.js/.test(script.src)), false);
  library.onerror();
  await settle();
  const fallback = scripts.find(script => script.src === "./music/playlist.js");
  assert.ok(fallback);
  fallback.onload();
  await settle();
  const player = scripts.find(script => /player.js/.test(script.src));
  assert.ok(player);
  player.onload();
  await settle();
  assert.equal(window.__CLAUDEONE_PLAYER_LOADING, false);
});
