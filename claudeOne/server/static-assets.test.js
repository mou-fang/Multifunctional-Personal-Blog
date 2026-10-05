const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const express = require("express");
const { createStaticAssets } = require("./static-assets");

// Native HTTP accepts any ephemeral test port, including ports blocked by fetch.
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("error", reject);
      res.on("end", () => resolve({
        status: res.statusCode,
        headers: new Headers(res.headers),
        text: async () => Buffer.concat(chunks).toString("utf8")
      }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "static-assets-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const folder of ["css", "js", "logo"]) await fs.mkdir(path.join(root, folder));
  const write = (file, contents) => fs.writeFile(path.join(root, file), contents);
  await write("css/base.css", "body { color: blue; }");
  await write("js/page.js", "window.page = 'first';");
  await write("js/page-registry.js", 'window.pages = { css: ["css/base.css?v=manual"], js: ["js/page.js"] };');
  await write("js/startup.js", 'loadScript("./js/page.js");');
  await write("index.html", '<link href="./css/base.css?v=manual"><script src="./js/page-registry.js?v=manual"></script><script src="./js/startup.js"></script>');
  const assets = createStaticAssets(root);
  const app = express();
  app.use(assets.middleware);
  app.use(express.static(root, { setHeaders: assets.setHeaders }));
  app.get("/home", assets.sendIndex);
  const server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { root, assets, write, base: "http://127.0.0.1:" + server.address().port };
}

test("content versions retain relative URLs, queries and anchors without rewriting other origins or missing files", async t => {
  const { assets, write } = await fixture(t);
  const versioned = assets.versionURL("./css/base.css?theme=soft&v=old#palette");
  assert.match(versioned, /^\.\/css\/base\.css\?theme=soft&v=[a-f0-9]{20}#palette$/);
  assert.equal(assets.versionURL(versioned), versioned);
  for (const url of ["https://example.com/css/base.css", "//example.com/js/page.js", "./css/missing.css", "./css/../server/private.js", "./api/music-library/playlist.js"])
    assert.equal(assets.versionURL(url), url);
  await write("css/base.css", "body { color: blue; }");
  assert.equal(assets.versionURL("./css/base.css?theme=soft&v=old#palette"), versioned, "identical content keeps its cache address");
});

test("only the matching content version receives immutable caching, with HEAD and conditional HTTP support", async t => {
  const { assets, base } = await fixture(t);
  const url = assets.versionURL("/css/base.css");
  const response = await request(base + url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal(response.headers.get("cloudflare-cdn-cache-control"), response.headers.get("cache-control"));
  assert.equal(await response.text(), "body { color: blue; }");
  for (const suffix of ["/css/base.css", "/css/base.css?v=old", "/", "/index.html", "/home"]) {
    const unversioned = await request(base + suffix);
    assert.equal(unversioned.headers.get("cache-control"), "public, no-cache", suffix);
  }
  const head = await request(base + url, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal(head.headers.get("etag"), response.headers.get("etag"));
  const conditional = await request(base + url, { headers: { "If-None-Match": response.headers.get("etag") } });
  assert.equal(conditional.status, 304);
});

test("deploying a page dependency automatically changes registry, startup and HTML addresses without modifying source files", async t => {
  const { assets, base, root, write } = await fixture(t);
  const registrySource = await fs.readFile(path.join(root, "js/page-registry.js"), "utf8");
  const indexSource = await fs.readFile(path.join(root, "index.html"), "utf8");
  const firstRegistryURL = assets.versionURL("/js/page-registry.js");
  const firstStartupURL = assets.versionURL("/js/startup.js");
  const firstPageURL = assets.versionURL("js/page.js");
  const firstIndex = await (await request(base + "/")).text();
  const registry = await request(base + firstRegistryURL);
  const startup = await request(base + firstStartupURL);
  assert.equal(registry.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.ok((await registry.text()).includes('"' + firstPageURL + '"'));
  assert.ok((await startup.text()).includes('"./' + firstPageURL + '"'));
  assert.ok(firstIndex.includes(assets.versionURL("./js/page-registry.js?v=manual")));
  await write("js/page.js", "window.page = 'new deployed behavior';");
  assert.notEqual(assets.versionURL("js/page.js"), firstPageURL);
  assert.notEqual(assets.versionURL("/js/page-registry.js"), firstRegistryURL);
  assert.notEqual(assets.versionURL("/js/startup.js"), firstStartupURL);
  const newIndex = await (await request(base + "/")).text();
  assert.notEqual(newIndex, firstIndex);
  assert.ok(newIndex.includes(assets.versionURL("./js/page-registry.js?v=manual")));
  const stale = await request(base + firstRegistryURL);
  assert.equal(stale.headers.get("cache-control"), "public, no-cache", "old version is never marked immutable for new bytes");
  assert.ok((await stale.text()).includes(assets.versionURL("js/page.js")));
  assert.equal(await fs.readFile(path.join(root, "js/page-registry.js"), "utf8"), registrySource);
  assert.equal(await fs.readFile(path.join(root, "index.html"), "utf8"), indexSource);
});
