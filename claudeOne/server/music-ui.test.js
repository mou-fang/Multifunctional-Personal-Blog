const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Exercise the page controller with local audio and API doubles. No credentials
// or requests to QQ are needed to check the login-and-resume interaction.
function harness() {
  const nodes = new Map();
  function node(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {
      hidden: false, disabled: false, textContent: "", value: "",
      open: false, shown: 0,
      showModal() { this.open = true; this.shown++; },
      close() { this.open = false; },
      setAttribute() {}, querySelector() { return null; }
    });
    return nodes.get(selector);
  }
  const downloads = [];
  const requests = [];
  const context = vm.createContext({
    console: { error() {}, warn() {} }, Blob, Uint8Array, Map, Set,
    setTimeout(fn) { fn(); },
    URL: { createObjectURL() { return "blob:test-audio"; }, revokeObjectURL() {} },
    sessionStorage: { setItem() {}, removeItem() {} },
    document: {
      createElement() { return { click() { downloads.push({ name: this.download, url: this.href }); } }; },
      body: { appendChild() {}, removeChild() {} }
    },
    window: {
      CLAUDE_ONE_CONFIG: { music: {} },
      ClaudeOne: { escapeHtml: s => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"), toast() {} },
      ClaudeOneQQDecrypt: {
        parseFileTail() { return { songMid: "test-song", ekey: "" }; },
        decrypt(buffer, key) {
          if (!key) throw new Error("key required");
          return { audio: new Uint8Array([73, 68, 51, 0]).buffer, ext: ".mp3" };
        }
      }
    },
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return { ok: true, json: async () => url.endsWith("/cookie")
        ? { success: true, session: { id: "local-test-session" } }
        : { success: true, ekey: "local-test-key" } };
    },
    testNode: node
  });
  const source = fs.readFileSync(path.join(__dirname, "../js/music.js"), "utf8");
  vm.runInContext(source.replace("window.__page_music =", `
    container = { querySelector: testNode };
    fileList = testNode("files");
    emptyState = testNode("empty");
    batchActions = testNode("batch");
    downloadAllBtn = testNode("download");
    qqCallbackInput = testNode("cookie");
    qqLoginStatus = testNode("auth-status");
    globalThis.testMusic = {
      files: fileResults, updateEmptyDOM, decryptQQMusicFrontend,
      submitCookieLogin, buildCardHTML, downloadAll, downloadFile,
      setNaming(value) { namingRadios = [{ checked: true, value }]; }
    };
    window.__page_music =`), context);
  return { api: context.testMusic, node, requests, downloads };
}

test("music summary distinguishes successful, processing, login and failed files", () => {
  const { api, node } = harness();
  api.updateEmptyDOM();
  assert.equal(node("[data-music-results]").hidden, true);
  assert.equal(node("download").disabled, true);
  api.files.set("1", { status: "done" });
  api.files.set("2", { status: "decrypting" });
  api.files.set("3", { status: "error", needsAuth: true });
  api.files.set("4", { status: "error" });
  api.updateEmptyDOM();
  assert.equal(node("[data-music-results]").hidden, false);
  assert.equal(node("download").textContent, "下载全部（1）");
  assert.equal(node("[data-result-summary]").textContent, "共 4 首 · 1 首已解锁 · 1 首处理中 · 1 首待登录 · 1 首未完成");
});

test("music login resumes waiting files once and releases their source data", async () => {
  const { api, node, requests } = harness();
  const file = { name: "test.mgg", arrayBuffer: async () => new ArrayBuffer(8) };
  api.files.set("1", { status: "decrypting", sourceFile: file });
  api.files.set("2", { status: "error", error: "broken file", sourceFile: file });
  await api.decryptQQMusicFrontend("1", file);
  assert.equal(api.files.get("1").needsAuth, true);
  assert.equal(api.files.get("1").status, "error");
  assert.equal(node("[data-qq-auth-dialog]").open, true);
  assert.equal(requests.length, 0);
  node("cookie").value = "local test fixture";
  await api.submitCookieLogin();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(api.files.get("1").status, "done");
  assert.equal(api.files.get("1").sourceFile, null);
  assert.equal(api.files.get("2").status, "error");
  assert.equal(node("cookie").value, "");
  assert.equal(node("[data-qq-auth-dialog]").open, false);
  assert.equal(requests.filter(r => r.url.endsWith("/ekey")).length, 1);
  assert.equal(requests[1].body.authSessionId, "local-test-session");
});

test("a batch of new QQ files opens one login dialog without resetting focus", async () => {
  const { api, node } = harness();
  const file = { name: "test.mgg", arrayBuffer: async () => new ArrayBuffer(8) };
  for (const id of ["1", "2"]) {
    api.files.set(id, { status: "decrypting", sourceFile: file });
    await api.decryptQQMusicFrontend(id, file);
  }
  assert.equal(node("[data-qq-auth-dialog]").shown, 1);
  assert.equal(api.files.get("2").needsAuth, true);
});

test("music errors expose readable escaped advice and a login action only when needed", () => {
  const { api } = harness();
  const html = api.buildCardHTML({ name: "<song>", status: "error", needsAuth: true, errorAdvice: "<img src=x>" });
  assert.match(html, /连接 QQ 账号/);
  assert.match(html, /<details class="file-card__help">/);
  assert.match(html, /&lt;img src=x>/);
  assert.doesNotMatch(html, /<img src=x>/);
  assert.doesNotMatch(api.buildCardHTML({ name: "broken", status: "error" }), /连接 QQ 账号/);
});

test("music downloads apply the selected naming and batch includes only completed audio", () => {
  const { api, downloads } = harness();
  api.files.set("1", { status: "done", title: "Song", artist: "Artist", ext: "flac", blob: new Blob(["audio"]) });
  api.files.set("2", { status: "error" });
  api.setNaming("1");
  api.downloadFile("1");
  api.setNaming("3");
  api.downloadAll();
  assert.deepEqual(downloads.map(d => d.name), ["Song.flac", "Song - Artist.flac"]);
});
