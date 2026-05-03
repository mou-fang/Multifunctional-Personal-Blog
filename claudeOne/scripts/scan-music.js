/* scan-music.js — scan music/ folder, extract metadata + cover art, generate playlist.js
 * Requires: Node.js (same as the server)
 * Usage: node scripts/scan-music.js
 */

const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const MUSIC_DIR = path.join(__dirname, "..", "music");
const OUTPUT = path.join(MUSIC_DIR, "playlist.js");

const AUDIO_EXTS = new Set([
  ".mp3", ".flac", ".wav", ".ogg", ".aac", ".m4a", ".wma", ".opus", ".webm", ".aiff"
]);

// Will be loaded in main()

async function extractMeta(filePath, mm) {
  if (!mm || !mm.parseBuffer) return null;
  try {
    const buffer = fs.readFileSync(filePath);
    const meta = await mm.parseBuffer(buffer, { duration: true, skipCovers: false });
    const common = meta.common || {};
    const format = meta.format || {};

    // Duration in "mm:ss" or "hh:mm:ss"
    let durStr = "";
    const dur = format.duration;
    if (dur && dur > 0) {
      const totalSec = Math.round(dur);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      durStr = h > 0
        ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`
        : `${m}:${String(s).padStart(2,"0")}`;
    }

    let cover = "";
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0];
      const mime = pic.format || "image/jpeg";
      const buf = Buffer.from(pic.data);
      cover = `data:${mime};base64,${buf.toString("base64")}`;
    }

    return {
      title: common.title || "",
      artist: common.artist || "",
      album: common.album || "",
      cover: cover,
      duration: durStr
    };
  } catch (e) {
    console.log(`    Warning: cannot read metadata for ${path.basename(filePath)}: ${e.message}`);
    return null;
  }
}

function parseFilename(fileName) {
  const ext = path.extname(fileName);
  const base = fileName.slice(0, -ext.length);
  const dash = base.indexOf(" - ");
  if (dash > 0) {
    return {
      title: base.slice(dash + 3).trim(),
      artist: base.slice(0, dash).trim()
    };
  }
  return { title: base.trim(), artist: "Unknown Artist" };
}

function findCoverImage(audioPath) {
  const dir = path.dirname(audioPath);
  const baseName = path.basename(audioPath, path.extname(audioPath));
  const names = [
    `${baseName}.jpg`, `${baseName}.png`, `${baseName}.jpeg`,
    "cover.jpg", "cover.png", "cover.jpeg",
    "folder.jpg", "folder.png"
  ];
  for (const name of names) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) {
      try {
        const buf = fs.readFileSync(p);
        const ext = path.extname(p).toLowerCase();
        const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
        return `data:${mime};base64,${buf.toString("base64")}`;
      } catch (_) {}
    }
  }
  return "";
}

async function main() {
  // Load music-metadata (ES module, use direct path to core)
  let mm = null;
  try {
    mm = await import("../server/node_modules/music-metadata/lib/core.js");
  } catch (_) {
    console.log("  music-metadata not available, using filename-based metadata");
  }

  console.log("  Scanning music/ folder...");

  if (!fs.existsSync(MUSIC_DIR)) {
    fs.mkdirSync(MUSIC_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT, "window.__MUSIC_PLAYLIST = [];", "utf-8");
    console.log("  music/ folder created, playlist is empty");
    return;
  }

  const files = fs.readdirSync(MUSIC_DIR)
    .filter(f => AUDIO_EXTS.has(path.extname(f).toLowerCase()))
    .sort();

  if (files.length === 0) {
    fs.writeFileSync(OUTPUT, "window.__MUSIC_PLAYLIST = [];", "utf-8");
    console.log("  No audio files found in music/");
    return;
  }

  console.log(`  Found ${files.length} file(s), extracting metadata...`);

  // Find default cover
  let defaultCover = "";
  for (const cn of ["cover.jpg","cover.png","cover.jpeg","folder.jpg","folder.png"]) {
    const cp = path.join(MUSIC_DIR, cn);
    if (fs.existsSync(cp)) {
      try {
        const buf = fs.readFileSync(cp);
        const ext = path.extname(cp).toLowerCase();
        const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
        defaultCover = `data:${mime};base64,${buf.toString("base64")}`;
        break;
      } catch (_) {}
    }
  }

  const entries = [];
  for (const file of files) {
    const filePath = path.join(MUSIC_DIR, file);
    const relPath = `./music/${file}`;

    // Try embedded metadata first
    let meta = await extractMeta(filePath, mm);
    const fnMeta = parseFilename(file);

    let title, artist, album, duration, cover;

    if (meta && meta.title) {
      title = meta.title;
      artist = meta.artist || fnMeta.artist;
      album = meta.album || "";
      duration = meta.duration || "";
      cover = meta.cover || "";
    } else {
      title = fnMeta.title;
      artist = fnMeta.artist;
      album = "";
      duration = meta && meta.duration ? meta.duration : "";
      cover = meta && meta.cover ? meta.cover : "";
    }

    // Fall back to external cover files
    if (!cover) cover = findCoverImage(filePath);
    if (!cover && defaultCover) cover = defaultCover;

    // Escape for JS string
    const esc = s => String(s).replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\n/g,"");

    entries.push(`  {
    file: "${esc(relPath)}",
    title: "${esc(title)}",
    artist: "${esc(artist)}",
    album: "${esc(album)}",
    duration: "${esc(duration)}",
    cover: "${esc(cover)}"
  }`);

    console.log(`    ${title} - ${artist}${cover ? ' [cover]' : ''}`);
  }

  const ts = new Date().toISOString().replace("T"," ").slice(0,19);
  const output = `// Auto-generated by scan-music.js at ${ts}
// Drop music files into music/ then run addmusic.bat to update
window.__MUSIC_PLAYLIST = [
${entries.join(",\n")}
];
`;

  fs.writeFileSync(OUTPUT, output, "utf-8");
  console.log(`  Generated music/playlist.js (${files.length} track(s))`);
  if (!mm) {
    console.log("  Hint: install music-metadata for embedded cover art extraction");
    console.log("        cd server && npm install music-metadata");
  }
}

main().catch(e => {
  console.error("  Error:", e.message);
  process.exit(1);
});
