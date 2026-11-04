"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const read = name => fs.readFileSync(path.join(__dirname, "../js/" + name), "utf8");

test("device policy covers small and touch screens, resolves legacy routes and preserves desktop resolution", () => {
  const site = require("../js/site-pages");
  for (const phone of [false, true]) {
    const window = { matchMedia: () => ({ matches: phone }) };
    vm.runInNewContext(read("device-support.js"), { window });
    const policy = window.ClaudeOneDevice;
    assert.equal(!!policy.support(site.pages.doom), phone);
    assert.equal(!!policy.support(site.pages[site.key("anomaly-bureau")]), phone);
    assert.equal(!!policy.support(site.pages[site.key("ascii-void")]), phone);
    assert.equal(!!policy.support(site.pages.beads), phone);
    assert.equal(policy.support(site.pages.compress), null);
    assert.equal(policy.canvasPixelRatio(3), phone ? 1.5 : 3);
    assert.equal(policy.canvasPixelRatio(1), 1);
  }
});

test("phone backgrounds allocate no WebGL renderer; changing viewport releases and restores desktop resources", () => {
  const compact = new EventTarget(); compact.matches = true;
  const reduced = new EventTarget(); reduced.matches = false;
  const body = { dataset: { theme: "neumorphism" }, setAttribute() {} };
  const canvas = { width: 300, height: 150 }, root = { dataset: {}, querySelector: () => canvas };
  const document = Object.assign(new EventTarget(), { body, hidden: false, querySelector: () => root });
  let allocations = 0, destroyed = 0, lastUpdate;
  const window = Object.assign(new EventTarget(), {
    matchMedia: query => query.includes("max-width") ? compact : reduced,
    createSoftUIWash(_canvas, ready) { allocations++; ready(true); return { update: next => { lastUpdate = next; }, destroy() { destroyed++; } }; }
  });
  let disconnected = false;
  class MutationObserver { observe() {} disconnect() { disconnected = true; } }
  vm.runInNewContext(read("softui-background.js"), { window, document, MutationObserver });
  assert.equal(allocations, 0); assert.equal(root.dataset.renderer, "css");
  assert.equal(root.dataset.flowing, "false"); assert.equal(canvas.width * canvas.height, 1);
  compact.matches = false; compact.dispatchEvent(new Event("change"));
  assert.equal(allocations, 1); assert.equal(lastUpdate.moving, true);
  reduced.matches = true; reduced.dispatchEvent(new Event("change"));
  assert.equal(lastUpdate.moving, false);
  compact.matches = true; compact.dispatchEvent(new Event("change"));
  assert.equal(destroyed, 1); assert.equal(root.dataset.renderer, "css");
  window.dispatchEvent(new Event("pagehide"));
  assert.equal(disconnected, true);
});

test("cancelled pool gestures and lost pointer capture cannot fire a shot", () => {
  const marker = "  host.__page_billiards =";
  const source = read("billiards.js");
  assert.ok(source.includes(marker));
  const window = {};
  vm.runInNewContext(source.replace(marker, `
    window.__poolTest = {
      setup: function () {
        game = { state: ST_AIMING, aim: { active: true, power: .7 } };
        els = {}; updateUI = function () {}; setMessage = function () {};
        beginShot = function () { throw new Error('Unexpected shot'); };
      },
      release: onPointerUp,
      idle: function () { return game.state === ST_IDLE && !game.aim.active; }
    };
  host.__page_billiards =`), { window });
  for (const type of ["pointercancel", "lostpointercapture"]) {
    window.__poolTest.setup(); window.__poolTest.release({ type });
    assert.equal(window.__poolTest.idle(), true);
  }
});

test("pixel image errors are visible and an abandoned read cannot update a newer upload or remounted page", () => {
  const readers = [], messages = [];
  class FileReader {
    constructor() { readers.push(this); this.readyState = 0; }
    readAsDataURL() { this.readyState = 1; }
    abort() { this.readyState = 2; this.aborted = true; }
  }
  const sourceImage = { removeAttribute() {}, src: "" }, preview = { removeAttribute() {}, src: "" }, name = {};
  const window = { CLAUDE_ONE_CONFIG: {}, ClaudeOne: { storage: { get() { return null; } }, toast: text => messages.push(text) } };
  const marker = "  window.__page_pixel = { mount: mount, unmount: unmount };";
  const source = read("pixel.js"); assert.ok(source.includes(marker));
  vm.runInNewContext(source.replace(marker, marker + `
    window.__pixelTest = {
      setup: function (image, preview, name) { container = {}; pixelitSrcImg = image; previewImg = preview; previewName = name; },
      read: handleFile
    };`), { window, FileReader, clearTimeout, console });
  window.__pixelTest.setup(sourceImage, preview, name);
  window.__pixelTest.read({ type: "image/png", name: "old.png" });
  const oldCallback = readers[0].onload;
  window.__pixelTest.read({ type: "image/png", name: "new.png" });
  assert.equal(readers[0].aborted, true);
  oldCallback({ target: { result: "old-data" } });
  assert.notEqual(preview.src, "old-data");
  readers[1].onload({ target: { result: "invalid-image-data" } });
  sourceImage.onerror();
  assert.ok(messages.some(text => text.includes("无法解码")));
  window.__pixelTest.read({ type: "image/png", name: "pending.png" });
  const lateCallback = readers[2].onload;
  window.__page_pixel.unmount();
  assert.equal(readers[2].aborted, true);
  window.__pixelTest.setup(sourceImage, preview, name);
  lateCallback({ target: { result: "late-data" } });
  assert.notEqual(preview.src, "late-data");
});
