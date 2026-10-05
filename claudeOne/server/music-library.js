const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");

// Read the scanner's data assignment without executing JavaScript. Older
// scanner output uses unquoted field names, one per line.
function parsePlaylist(source) {
  const match = source.trim().match(/^(?:\/\/[^\n]*\n\s*)*window\.__MUSIC_PLAYLIST\s*=\s*(\[[\s\S]*\])\s*;?$/);
  if (!match) throw new Error("Unsupported playlist format");
  const json = match[1].replace(/^(\s*)(file|src|title|artist|album|duration|cover):/gm, '$1"$2":');
  const tracks = JSON.parse(json);
  if (!Array.isArray(tracks) || tracks.some(track => !track || typeof track !== "object" || Array.isArray(track))) {
    throw new Error("Invalid playlist data");
  }
  return tracks;
}

function compactPlaylist(tracks) {
  const covers = new Map();
  const playlist = tracks.map(track => {
    const result = {};
    for (const key of ["file", "src", "title", "artist", "album", "duration", "cover"]) {
      if (typeof track[key] === "string") result[key] = track[key];
    }
    const match = (result.cover || "").match(/^data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=\r\n]+)$/);
    if (match) {
      const bytes = Buffer.from(match[2], "base64");
      const extension = match[1] === "jpeg" ? "jpg" : match[1];
      const name = createHash("sha256").update(bytes).digest("hex") + "." + extension;
      covers.set(name, { bytes, type: "image/" + (extension === "jpg" ? "jpeg" : extension) });
      result.cover = "./api/music-library/covers/" + name;
    }
    return result;
  });
  return { playlist, covers, script: "window.__MUSIC_PLAYLIST = " + JSON.stringify(playlist) + ";\n" };
}

function createMusicLibraryRouter(options = {}) {
  const router = express.Router();
  const playlistPath = options.playlistPath || path.join(__dirname, "../music/playlist.js");
  let snapshot = null;
  let previousCovers = new Map();
  let pending = null;

  async function readSnapshot() {
    let stat;
    try { stat = await fs.stat(playlistPath); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      return compactPlaylist([]);
    }
    const version = stat.mtimeMs + ":" + stat.ctimeMs + ":" + stat.size;
    if (snapshot && snapshot.version === version) return snapshot;
    if (pending) { await pending; return readSnapshot(); }
    pending = fs.readFile(playlistPath, "utf8").then(source => {
      const next = compactPlaylist(parsePlaylist(source));
      // Allow a page opened before the most recent rescan to finish its images.
      previousCovers = snapshot ? snapshot.covers : new Map();
      snapshot = Object.assign(next, { version });
      return snapshot;
    });
    try { return await pending; }
    finally { pending = null; }
  }

  router.get("/playlist.js", async (_req, res) => {
    try {
      const current = await readSnapshot();
      res.set("Cache-Control", "public, no-cache");
      res.type("application/javascript").send(current.script);
    } catch (_) {
      res.status(503).type("text/plain").send("Music library unavailable");
    }
  });

  router.get("/covers/:name", async (req, res) => {
    if (!/^[a-f0-9]{64}\.(jpg|png|webp|gif)$/.test(req.params.name)) return res.sendStatus(404);
    try {
      const current = await readSnapshot();
      const cover = current.covers.get(req.params.name) || previousCovers.get(req.params.name);
      if (!cover) return res.sendStatus(404);
      res.set("Cache-Control", "public, max-age=31536000, immutable");
      res.set("ETag", '"' + req.params.name + '"');
      res.type(cover.type).send(cover.bytes);
    } catch (_) { res.sendStatus(503); }
  });

  return router;
}

module.exports = { parsePlaylist, compactPlaylist, createMusicLibraryRouter };
