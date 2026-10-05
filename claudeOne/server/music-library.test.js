const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const http = require("node:http");
const express = require("express");
const { parsePlaylist, compactPlaylist, createMusicLibraryRouter } = require("./music-library");

const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6nN8AAAAASUVORK5CYII=", "base64");
const cover = "data:image/png;base64," + image.toString("base64");

test("legacy scanner data preserves Unicode and escapes without executing scripts", () => {
  const source = '// Auto-generated\r\nwindow.__MUSIC_PLAYLIST = [\r\n  {\r\n    file: "./music/a.mp3",\r\n    title: "中文 \\\"标题\\\"",\r\n    cover: ""\r\n  }\r\n];';
  assert.equal(parsePlaylist(source)[0].title, '中文 "标题"');
  assert.deepEqual(parsePlaylist('window.__MUSIC_PLAYLIST = [];'), []);
  for (const invalid of [
    'window.__MUSIC_PLAYLIST = []; process.exit();',
    'window.__MUSIC_PLAYLIST = [getSecret()];',
    'window.__MUSIC_PLAYLIST = [null];'
  ]) assert.throws(() => parsePlaylist(invalid));
});

test("compact playlist deduplicates covers, preserves metadata, and returns exact image bytes", () => {
  const tracks = [{ file: "./music/one.mp3", title: '中文 "歌"', duration: "03:21", cover }, { file: "./music/two.mp3", cover }];
  const compact = compactPlaylist(tracks);
  assert.equal(compact.covers.size, 1);
  assert.equal(compact.playlist[0].cover, compact.playlist[1].cover);
  assert.equal(compact.playlist[0].title, tracks[0].title);
  assert.equal(compact.playlist[0].duration, "03:21");
  assert.deepEqual([...compact.covers.values()][0].bytes, image);
  assert.equal(compact.script.includes("base64"), false);
  const context = { window: {} };
  vm.runInNewContext(compact.script, context);
  assert.equal(context.window.__MUSIC_PLAYLIST[0].file, tracks[0].file);
  assert.equal(tracks[0].cover, cover, "scanner data is not mutated");
});

test("HTTP library validates caches, refreshes rescans, and serves only known image hashes", async t => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "music-library-"));
  const playlistPath = path.join(folder, "playlist.js");
  const write = tracks => fs.writeFile(playlistPath, "window.__MUSIC_PLAYLIST = " + JSON.stringify(tracks) + ";");
  await write([{ file: "./music/one.mp3", title: "One", cover }]);
  const app = express();
  app.use("/api/music-library", createMusicLibraryRouter({ playlistPath }));
  const server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await fs.rm(folder, { recursive: true, force: true }); });
  const base = "http://127.0.0.1:" + server.address().port;
  const response = await fetch(base + "/api/music-library/playlist.js");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /javascript/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("cloudflare-cdn-cache-control"), "no-store");
  const script = await response.text();
  const current = parsePlaylist(script);
  assert.equal(current[0].title, "One");
  // fetch adds Cache-Control: no-cache for conditional requests, deliberately
  // bypassing Express freshness. Use an ordinary browser-style HTTP request.
  const revalidation = await new Promise((resolve, reject) => {
    http.get(base + "/api/music-library/playlist.js", { headers: { "If-None-Match": response.headers.get("etag") } }, res => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    }).on("error", reject);
  });
  assert.equal(revalidation, 304);
  const imageResponse = await fetch(base + current[0].cover.slice(1));
  assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()), image);
  assert.match(imageResponse.headers.get("cache-control"), /31536000, immutable/);
  assert.equal((await fetch(base + "/api/music-library/covers/unknown.png")).status, 404);
  assert.equal((await fetch(base + "/api/music-library/covers/" + "0".repeat(64) + ".png")).status, 404);
  await write([{ file: "./music/two.mp3", title: "Updated song", cover: "" }]);
  const refreshed = parsePlaylist(await (await fetch(base + "/api/music-library/playlist.js")).text());
  assert.equal(refreshed[0].title, "Updated song");
  assert.equal((await fetch(base + current[0].cover.slice(1))).status, 200, "previous open page can finish its cover");
  await fs.writeFile(playlistPath, 'window.__MUSIC_PLAYLIST = [process.env];');
  assert.equal((await fetch(base + "/api/music-library/playlist.js")).status, 503);
  await fs.unlink(playlistPath);
  assert.deepEqual(parsePlaylist(await (await fetch(base + "/api/music-library/playlist.js")).text()), []);
});
