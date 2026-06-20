/* ===== claudeOne :: Server =====
 * Express server that:
 *   1. Serves the frontend SPA from ../ (the claudeOne root)
 *   2. Provides /api/ascii endpoint for ASCII art conversion
 *   3. Provides /api/health for status checks
 */

const express = require("express");
const compression = require("compression");
const cors = require("cors");
const multer = require("multer");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const {
  QQMusicUnlockError,
  QQMusicAuthError,
  authFromCookieString,
  publicAuthInfo,
  fetchEkey,
  fetchSongMetadata,
} = require("./qq-music-unlock");

const os = require("os");

const PORT = process.env.PORT || 3001;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_CONCURRENT = 3;
const UPLOADS_DIR = path.join(__dirname, "uploads");
const STATIC_DIR = path.join(__dirname, "..");  // claudeOne/ root

// Resolve ascii-image-converter binary — try full path first (Go bin)
const HOME = os.homedir();
const GO_BIN = path.join(HOME, "go", "bin");
const CLI_CMD = process.platform === "win32"
  ? path.join(GO_BIN, "ascii-image-converter.exe")
  : path.join(GO_BIN, "ascii-image-converter");

function getCliCommand() {
  if (fs.existsSync(CLI_CMD)) return CLI_CMD;
  // Fallback: rely on PATH
  return "ascii-image-converter";
}
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/tiff",
  "image/gif",
]);
const qqAuthSessions = new Map();
const QQ_AUTH_SESSION_TTL = 2 * 60 * 60 * 1000; // 2 hours
const RATE_LIMITS = {
  musicEkey: {
    windowMs: 60 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MUSIC_EKEY || 200),
    message: "EKey 请求太频繁，请稍后再试",
  },
  musicMetadata: {
    windowMs: 60 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MUSIC_METADATA || 200),
    message: "元数据请求太频繁，请稍后再试",
  },
};

// ---- concurrent limiting ----
let activeJobs = 0;

// ---- Express app ----
const app = express();
if (process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

app.use(cors());
app.use(express.json());

// ---- Compression: gzip 全站静态/JSON,DOOM wasm/data 也走压缩 ----
// 客户端 Accept-Encoding 含 gzip 时,Express 自动压缩响应(对 .wasm/.data
// 这种二进制压缩率很高,28MB 的 .data 可压到约 14MB)。开销极小。
// 注意: compression 默认 filter 会跳过 application/octet-stream(emscripten
// 的 .data),所以自定义 filter 显式放行它。
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) return false;
    const url = req.url || "";
    // emscripten preloaded .data:大块未压缩 WAD 数据,压缩率高
    if (url.endsWith(".data")) return true;
    return compression.filter(req, res);
  },
}));

// ---- Serve frontend static files (claudeOne/ root) ----
app.use(express.static(STATIC_DIR, {
  setHeaders(res, filePath) {
    // JavaScript modules and workers
    if (filePath.endsWith(".js")) {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    }
    // Audio files
    if (filePath.endsWith(".mp3")) res.setHeader("Content-Type", "audio/mpeg");
    if (filePath.endsWith(".flac")) res.setHeader("Content-Type", "audio/flac");
    if (filePath.endsWith(".ogg")) res.setHeader("Content-Type", "audio/ogg");
    if (filePath.endsWith(".wav")) res.setHeader("Content-Type", "audio/wav");
    if (filePath.endsWith(".m4a")) res.setHeader("Content-Type", "audio/mp4");

    // WebAssembly: 必须用 application/wasm 否则浏览器拒绝 streaming compile
    if (filePath.endsWith(".wasm")) {
      res.setHeader("Content-Type", "application/wasm");
    }
    // Emscripten preloaded data 包(任意二进制)
    if (filePath.endsWith(".data")) {
      res.setHeader("Content-Type", "application/octet-stream");
    }

    // 长缓存:libs/ 目录下的第三方库与 DOOM 产物哈希不变,1 年 immutable
    // 注意:Express path 在 Linux 用 /,Windows 用 \,两种都判断
    if (filePath.includes(`${path.sep}libs${path.sep}`) || filePath.includes("/libs/")) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  }
}));

// SPA fallback — serve index.html for any unmatched GET (hash routes)
app.get(/^\/(home|games|tools|game|sokoban|minesweeper|snake|billiards|doom|lottery|music|playlist|ai|ascii|pixel|compress|qr|videogif)/, (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, "index.html"));
});

// ---- Multer ----
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype}。仅支持 JPG、PNG、WebP、BMP、TIFF、GIF。`));
    }
  },
});

function getQQAuthSession(id) {
  const sessionId = String(id || "").trim();
  if (!sessionId) return null;
  const session = qqAuthSessions.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) qqAuthSessions.delete(sessionId);
    throw new QQMusicUnlockError("QQ_LOGIN_REQUIRED", "QQ 音乐登录会话已过期，请重新导入 Cookie", 401);
  }
  return session;
}

function cleanupQQAuthSessions() {
  const now = Date.now();
  for (const [id, session] of qqAuthSessions) {
    if (session.expiresAt <= now) qqAuthSessions.delete(id);
  }
}

function getClientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || "unknown")
    .replace(/^::ffff:/, "")
    .trim() || "unknown";
}

function createRateLimiter({ windowMs, max, message }) {
  const buckets = new Map();
  return (req, res, next) => {
    const ip = getClientIp(req);
    const now = Date.now();
    let bucket = buckets.get(ip);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        success: false,
        code: "RATE_LIMITED",
        error: message,
        retryAfter,
      });
    }

    if (buckets.size > 5000) {
      for (const [key, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(key);
      }
    }
    next();
  };
}

const musicEkeyLimiter = createRateLimiter(RATE_LIMITS.musicEkey);
const musicMetadataLimiter = createRateLimiter(RATE_LIMITS.musicMetadata);

// ---- Validation ----
const VALID_MODES = new Set(["ascii", "braille"]);
const VALID_CHAR_SETS = new Set(["default", "simple", "complex", "custom"]);

function parseBool(val) {
  return val === "true" || val === "1";
}

function validateParams(body) {
  const errors = [];

  const mode = body.mode || "ascii";
  if (!VALID_MODES.has(mode)) errors.push(`mode 必须为 ascii 或 braille`);

  let width = parseInt(body.width, 10);
  if (isNaN(width)) width = 80;
  if (width < 20 || width > 320) errors.push("width 必须在 20-320 之间");

  let height = parseInt(body.height, 10) || 0;
  if (isNaN(height)) height = 0;
  if (height < 0 || height > 320) errors.push("height 必须在 0-320 之间（0=自动）");

  const colored = parseBool(body.colored);
  const negative = parseBool(body.negative);
  const grayscale = parseBool(body.grayscale);

  const charSet = body.charSet || "default";
  if (!VALID_CHAR_SETS.has(charSet)) errors.push("charSet 无效");

  let customMap = (body.customMap || "").trim();
  if (charSet === "custom") {
    if (!customMap || customMap.length < 1 || customMap.length > 80) {
      errors.push("customMap 长度必须在 1-80 之间");
    }
  }

  return { errors, params: { mode, width, height, colored, negative, grayscale, charSet, customMap } };
}

// ---- CLI invocation ----
function buildCliArgs(inputPath, tempDir, params) {
  const args = [inputPath];

  if (params.mode === "braille") {
    args.push("--braille");
  }

  // Width / Height (in chars)
  args.push("--width", String(params.width));
  if (params.height > 0) {
    args.push("--height", String(params.height));
  }

  // Color options
  if (params.colored) args.push("--color");
  if (params.grayscale) args.push("--grayscale");
  if (params.negative) args.push("--negative");

  // Character set
  if (params.charSet === "complex") {
    args.push("--complex");
  } else if (params.charSet === "simple") {
    args.push("--map", " .:+#@");
  } else if (params.charSet === "custom" && params.customMap) {
    args.push("--map", params.customMap);
  }

  // Save files
  args.push("--save-txt", tempDir);
  args.push("--save-img", tempDir);
  args.push("--only-save");

  return args;
}

function runConverter(inputPath, params) {
  return new Promise((resolve, reject) => {
    // Create a unique temp output directory so concurrent jobs don't clash
    const tempDir = path.join(UPLOADS_DIR, uuidv4());
    fs.mkdirSync(tempDir, { recursive: true });

    const args = buildCliArgs(inputPath, tempDir, params);
    const cliCmd = getCliCommand();
    console.log(`[ascii] spawn: ${cliCmd} ${args.map(a => `"${a}"`).join(" ")}`);

    const child = spawn(cliCmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30000,
    });

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        // Cleanup temp dir
        fs.rmSync(tempDir, { recursive: true, force: true });
        const errMsg = stderr.trim() || `ascii-image-converter 异常退出 (code=${code})`;
        reject(new Error(errMsg));
        return;
      }

      // Read output files
      const baseName = path.basename(inputPath, path.extname(inputPath));
      const txtPath = path.join(tempDir, `${baseName}-ascii-art.txt`);
      const pngPath = path.join(tempDir, `${baseName}-ascii-art.png`);

      let text = "";
      let pngBase64 = "";

      try {
        if (fs.existsSync(txtPath)) {
          text = fs.readFileSync(txtPath, "utf-8");
        }
      } catch (e) {
        console.warn("[ascii] Cannot read txt:", e.message);
      }

      try {
        if (fs.existsSync(pngPath)) {
          const pngBuf = fs.readFileSync(pngPath);
          pngBase64 = pngBuf.toString("base64");
        }
      } catch (e) {
        console.warn("[ascii] Cannot read png:", e.message);
      }

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
      resolve({ text, pngBase64 });
    });

    child.on("error", (err) => {
      // Cleanup temp dir
      fs.rmSync(tempDir, { recursive: true, force: true });
      if (err.code === "ENOENT") {
        reject(new Error(
          "未找到 ascii-image-converter 命令。请先安装：\n" +
          "  go install github.com/TheZoraiz/ascii-image-converter@latest\n" +
          "并确保 %USERPROFILE%\\go\\bin 在 PATH 中（Windows）或 $GOPATH/bin 在 PATH 中（Linux/macOS）。"
        ));
      } else {
        reject(new Error(`执行转换时出错: ${err.message}`));
      }
    });
  });
}

// ---- API endpoint ----
app.post("/api/ascii", (req, res, next) => {
  // Concurrency gate
  if (activeJobs >= MAX_CONCURRENT) {
    return res.status(503).json({
      success: false,
      error: `服务器繁忙，当前 ${MAX_CONCURRENT} 个任务执行中，请稍后重试。`,
    });
  }

  next();
}, upload.single("file"), async (req, res) => {
  activeJobs++;
  const inputPath = req.file?.path;

  try {
    // Validate file
    if (!req.file) {
      return res.status(400).json({ success: false, error: "请上传图片文件。" });
    }

    // Validate params
    const { errors, params } = validateParams(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: errors.join("; ") });
    }

    // Run converter
    const result = await runConverter(inputPath, params);

    res.json({
      success: true,
      text: result.text,
      pngBase64: result.pngBase64,
      width: params.width,
      height: params.height,
    });
  } catch (err) {
    console.error("[ascii] Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    activeJobs--;
    // Cleanup uploaded file
    if (inputPath && fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }
  }
});

// ---- QQ Music auth (cookie import) -----------------------------------------

function cleanupQQAuthSessions() {
  const now = Date.now();
  for (const [id, session] of qqAuthSessions) {
    if (session.expiresAt <= now) qqAuthSessions.delete(id);
  }
}

app.post("/api/music/auth/cookie", async (req, res, next) => {
  try {
    cleanupQQAuthSessions();
    const rawCookie = String(req.body?.cookie || "").trim();
    const auth = authFromCookieString(rawCookie);
    const id = uuidv4();
    const session = {
      id,
      expiresAt: Date.now() + QQ_AUTH_SESSION_TTL,
      auth,
    };
    qqAuthSessions.set(id, session);
    res.json({
      success: true,
      session: {
        id,
        expiresAt: session.expiresAt,
        uin: auth.uin,
        display: auth.display,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/music/auth/:id", (req, res) => {
  qqAuthSessions.delete(req.params.id);
  res.json({ success: true });
});

// ---- QQ Music ekey proxy ---------------------------------------------------

app.post("/api/music/ekey", musicEkeyLimiter, async (req, res, next) => {
  try {
    const authSessionId = String(req.body?.authSessionId || "").trim();
    const songMid = String(req.body?.songMid || "").trim();
    const filename = String(req.body?.filename || "").trim();

    if (!authSessionId) {
      throw new QQMusicUnlockError("QQ_LOGIN_REQUIRED", "请先导入 QQ 音乐 Cookie", 401);
    }
    if (!songMid) {
      throw new QQMusicUnlockError("INVALID_REQUEST", "缺少歌曲标识 songMid");
    }

    const session = getQQAuthSession(authSessionId);
    if (!session || !session.auth) {
      throw new QQMusicUnlockError("QQ_LOGIN_REQUIRED", "QQ 音乐登录会话无效或已过期", 401);
    }

    const meta = { songMid, filename, ekey: null };
    const ekey = await fetchEkey(meta, session.auth);
    res.json({ success: true, ekey });
  } catch (error) {
    next(error);
  }
});

// ---- QQ Music metadata proxy -----------------------------------------------

app.post("/api/music/metadata", musicMetadataLimiter, async (req, res, next) => {
  try {
    const songMid = String(req.body?.songMid || "").trim();
    if (!songMid) {
      return res.json({ success: true, metadata: null });
    }
    const authSessionId = String(req.body?.authSessionId || "").trim();
    const session = authSessionId ? getQQAuthSession(authSessionId) : null;
    const auth = session?.auth || null;
    const metadata = await fetchSongMetadata(songMid, auth);
    res.json({ success: true, metadata });
  } catch (error) {
    next(error);
  }
});

// ---- Cover image proxy (for CORS) ------------------------------------------

app.get("/api/music/cover/:albumMid", async (req, res, next) => {
  try {
    const albumMid = String(req.params.albumMid || "").trim();
    if (!albumMid || albumMid.length > 64) {
      return res.status(400).json({ success: false, error: "无效的专辑标识" });
    }
    const url = `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumMid}.jpg`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) {
        return res.status(404).json({ success: false, error: "封面获取失败" });
      }
      const contentType = response.headers.get("content-type") || "image/jpeg";
      const data = Buffer.from(await response.arrayBuffer());
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(data);
    } catch (fetchError) {
      clearTimeout(timer);
      res.status(502).json({ success: false, error: "封面获取失败" });
    }
  } catch (error) {
    next(error);
  }
});

// ---- Health check ----------------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    activeJobs,
    musicLimits: {
      ekeyPerHour: RATE_LIMITS.musicEkey.max,
      metadataPerHour: RATE_LIMITS.musicMetadata.max,
    },
  });
});

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// ---- Global error handler ----
app.use((err, req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ success: false, error: "文件大小超过限制（最大 10MB）。" });
  }
  if (err instanceof QQMusicUnlockError || err instanceof QQMusicAuthError || err.code === "UNSUPPORTED_QQ_FORMAT") {
    return res.status(err.status || 400).json({
      success: false,
      code: err.code,
      error: err.message,
    });
  }
  if (err.message && err.message.includes("不支持的文件类型")) {
    return res.status(400).json({ success: false, error: err.message });
  }
  console.error("[server] Unhandled error:", err);
  res.status(500).json({ success: false, error: "服务器内部错误。" });
});

// Ensure uploads dir exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[claudeOne] Server running on http://0.0.0.0:${PORT}`);
  console.log(`[claudeOne] Frontend →  http://localhost:${PORT}`);
  console.log(`[claudeOne] API     →  http://localhost:${PORT}/api/ascii`);
  console.log(`[claudeOne] Health  →  http://localhost:${PORT}/api/health`);
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`[claudeOne] Port ${PORT} is already in use. Stop the existing server or run with PORT=<another-port>.`);
    process.exit(1);
  }
  console.error("[claudeOne] Failed to start server:", err);
  process.exit(1);
});
