/* ===== claudeOne :: Server =====
 * Express server that:
 *   1. Serves the frontend SPA from ../ (the claudeOne root)
 *   2. Provides /api/ascii endpoint for ASCII art conversion
 *   3. Provides /api/health for status checks
 */

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const {
  QQMusicAuthError,
  checkQQMusicQRLogin,
  createQQMusicQRLogin,
  publicAuthInfo,
} = require("./qq-music-auth");
const { QQMusicUnlockError, unlockQQMusic } = require("./qq-music-unlock");

const os = require("os");

const PORT = process.env.PORT || 3001;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_MUSIC_FILE_SIZE = 200 * 1024 * 1024; // 200 MB
const MAX_CONCURRENT = 3;
const MAX_MUSIC_CONCURRENT = Number(process.env.MUSIC_MAX_CONCURRENT || 4);
const MAX_MUSIC_CONCURRENT_PER_IP = Number(process.env.MUSIC_MAX_CONCURRENT_PER_IP || 2);
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
const QQ_MUSIC_EXTS = new Set([".mflac", ".mgg"]);
const coverCache = new Map();
const qqAuthSessions = new Map();
const QQ_AUTH_SESSION_TTL = 2 * 60 * 60 * 1000; // 2 hours
const RATE_LIMITS = {
  qqAuthCreate: {
    windowMs: 60 * 1000,
    max: Number(process.env.RATE_LIMIT_QQ_AUTH_CREATE || 20),
    message: "扫码二维码生成太频繁，请稍后再试",
  },
  qqAuthPoll: {
    windowMs: 60 * 1000,
    max: Number(process.env.RATE_LIMIT_QQ_AUTH_POLL || 240),
    message: "扫码状态查询太频繁，请稍后再试",
  },
  musicUnlock: {
    windowMs: 60 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MUSIC_UNLOCK || 100),
    message: "音乐解锁请求太频繁，请稍后再试",
  },
};

// ---- concurrent limiting ----
let activeJobs = 0;
let activeMusicJobs = 0;
const activeMusicJobsByIp = new Map();

// ---- Express app ----
const app = express();
if (process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

app.use(cors());
app.use(express.json());

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
  }
}));

// SPA fallback — serve index.html for any unmatched GET (hash routes)
app.get(/^\/(home|games|tools|game|sokoban|minesweeper|lottery|music|playlist|ai|ascii|pixel|compress|qr)/, (_req, res) => {
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

const musicUpload = multer({
  storage,
  limits: { fileSize: MAX_MUSIC_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (QQ_MUSIC_EXTS.has(ext)) {
      cb(null, true);
    } else {
      const error = new Error(`不支持的 QQ 音乐文件格式: ${ext || "未知"}`);
      error.code = "UNSUPPORTED_QQ_FORMAT";
      cb(error);
    }
  },
});

function publicQQAuthSession(session) {
  if (!session) return null;
  return {
    id: session.id,
    type: session.type,
    status: session.status,
    message: session.message,
    imageUrl: session.imageUrl,
    url: session.url,
    qrExpiresAt: session.qrExpiresAt,
    expiresAt: session.expiresAt,
    auth: publicAuthInfo(session.auth),
  };
}

function getQQAuthSession(id, { requireAuth = false } = {}) {
  const sessionId = String(id || "").trim();
  if (!sessionId) return null;
  const session = qqAuthSessions.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) qqAuthSessions.delete(sessionId);
    throw new QQMusicUnlockError("QQ_LOGIN_REQUIRED", "QQ 音乐登录会话已过期，请重新扫码登录", 401);
  }
  if (requireAuth && !session.auth) {
    throw new QQMusicUnlockError("QQ_LOGIN_REQUIRED", "请先完成 QQ 音乐扫码登录，再解锁新版 .mflac/.mgg", 401);
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

function withMusicConcurrency(req, res, next) {
  const ip = getClientIp(req);
  const activeForIp = activeMusicJobsByIp.get(ip) || 0;
  if (activeMusicJobs >= MAX_MUSIC_CONCURRENT) {
    return res.status(503).json({
      success: false,
      code: "MUSIC_SERVER_BUSY",
      error: `音乐解锁服务繁忙，当前最多同时处理 ${MAX_MUSIC_CONCURRENT} 个任务，请稍后再试`,
    });
  }
  if (activeForIp >= MAX_MUSIC_CONCURRENT_PER_IP) {
    return res.status(429).json({
      success: false,
      code: "MUSIC_IP_BUSY",
      error: `同一 IP 最多同时处理 ${MAX_MUSIC_CONCURRENT_PER_IP} 个音乐解锁任务，请等待当前任务完成`,
    });
  }

  activeMusicJobs += 1;
  activeMusicJobsByIp.set(ip, activeForIp + 1);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    activeMusicJobs = Math.max(0, activeMusicJobs - 1);
    const nextCount = (activeMusicJobsByIp.get(ip) || 1) - 1;
    if (nextCount > 0) activeMusicJobsByIp.set(ip, nextCount);
    else activeMusicJobsByIp.delete(ip);
  };
  res.on("finish", release);
  res.on("close", release);
  next();
}

const qqAuthCreateLimiter = createRateLimiter(RATE_LIMITS.qqAuthCreate);
const qqAuthPollLimiter = createRateLimiter(RATE_LIMITS.qqAuthPoll);
const musicUnlockLimiter = createRateLimiter(RATE_LIMITS.musicUnlock);

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

// ---- QQ Music auth / unlock ------------------------------------------------
app.post("/api/music/auth/qr", qqAuthCreateLimiter, async (req, res, next) => {
  try {
    cleanupQQAuthSessions();
    const type = String(req.body?.type || "wx").trim().toLowerCase() === "qq" ? "qq" : "wx";
    const qr = await createQQMusicQRLogin(type);
    const id = uuidv4();
    const session = {
      id,
      type: qr.type,
      key: qr.key,
      status: "waiting",
      message: type === "qq" ? "请使用 QQ 扫码，并在手机上确认登录" : "请使用微信扫码，并在手机上确认登录",
      imageUrl: qr.imageUrl,
      url: qr.url || "",
      qrExpiresAt: qr.expiresAt,
      expiresAt: Date.now() + QQ_AUTH_SESSION_TTL,
      auth: null,
      ekeyCache: new Map(),
    };
    qqAuthSessions.set(id, session);
    res.json({ success: true, session: publicQQAuthSession(session) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/music/auth/status/:id", qqAuthPollLimiter, async (req, res, next) => {
  try {
    const session = getQQAuthSession(req.params.id);
    if (!session) {
      throw new QQMusicUnlockError("QQ_LOGIN_REQUIRED", "请先创建 QQ 音乐扫码登录会话", 401);
    }
    if (session.auth) {
      return res.json({ success: true, session: publicQQAuthSession(session) });
    }
    if (session.qrExpiresAt <= Date.now()) {
      session.status = "expired";
      session.message = "二维码已过期，请重新生成";
      return res.json({ success: true, session: publicQQAuthSession(session) });
    }

    const result = await checkQQMusicQRLogin(session.type, session.key);
    session.status = result.status;
    session.message = result.message || session.message;
    if (result.status === "success" && result.auth) {
      session.auth = result.auth;
      session.message = "QQ 音乐登录成功，可以解锁该账号有权限的新版文件";
      session.expiresAt = Date.now() + QQ_AUTH_SESSION_TTL;
      session.imageUrl = "";
      session.url = "";
    }
    res.json({ success: true, session: publicQQAuthSession(session) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/music/auth/:id", (req, res) => {
  qqAuthSessions.delete(req.params.id);
  res.json({ success: true });
});

app.post("/api/music/unlock", musicUnlockLimiter, withMusicConcurrency, musicUpload.single("file"), async (req, res, next) => {
  const inputPath = req.file?.path;
  let outputPath = "";

  try {
    if (!req.file) {
      throw new QQMusicUnlockError("MISSING_FILE", "请选择 QQ 音乐加密文件");
    }

    const authSessionId = String(req.body?.authSessionId || "").trim();
    const authSession = authSessionId ? getQQAuthSession(authSessionId, { requireAuth: true }) : null;
    const workPrefix = path.join(UPLOADS_DIR, uuidv4());
    const result = await unlockQQMusic(inputPath, workPrefix, req.file.originalname, authSession ? {
      auth: authSession.auth,
      ekeyCache: authSession.ekeyCache,
      allowSharedEkeyCache: false,
    } : undefined);
    outputPath = result.outputPath;

    let coverUrl = "";
    if (result.cover?.data?.length) {
      const coverId = uuidv4();
      coverCache.set(coverId, {
        data: result.cover.data,
        mime: result.cover.mime || "image/jpeg",
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      coverUrl = `/api/music/cover/${coverId}`;
    }

    const metadata = {
      title: result.title,
      artist: result.artist,
      album: result.album,
      ext: result.extension,
      mime: result.mime,
      coverUrl,
    };
    res.setHeader("X-Music-Meta", Buffer.from(JSON.stringify(metadata), "utf8").toString("base64url"));
    res.setHeader("Access-Control-Expose-Headers", "X-Music-Meta");
    res.setHeader("Content-Type", result.mime);
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.resolve(outputPath), error => {
      fs.rmSync(outputPath, { force: true });
      outputPath = "";
      if (error && !res.headersSent) next(error);
      else if (error) console.error("[music] Response stream error:", error.message);
    });
  } catch (error) {
    if (outputPath) fs.rmSync(outputPath, { force: true });
    if (error instanceof QQMusicUnlockError && error.code === "QQ_AUTH_REQUIRED") {
      next(new QQMusicUnlockError(
        "QQ_LOGIN_REQUIRED",
        "这个文件是新版 QQ 音乐 musicex 格式，需要先在页面上扫码登录你自己的 QQ 音乐账号，再由服务器向 QQ 官方接口获取该账号可用的 EKey",
        401,
      ));
      return;
    }
    next(error);
  } finally {
    if (inputPath) fs.rmSync(inputPath, { force: true });
  }
});

app.get("/api/music/cover/:id", (req, res) => {
  const cover = coverCache.get(req.params.id);
  if (!cover || cover.expiresAt <= Date.now()) {
    coverCache.delete(req.params.id);
    return res.status(404).json({ success: false, error: "封面已过期，请重新解锁文件" });
  }
  res.setHeader("Content-Type", cover.mime);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.send(cover.data);
});

const coverCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, cover] of coverCache) {
    if (cover.expiresAt <= now) coverCache.delete(id);
  }
  cleanupQQAuthSessions();
}, 60 * 1000);
coverCleanupTimer.unref();

// ---- Health check ----
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    activeJobs,
    activeMusicJobs,
    maxMusicConcurrent: MAX_MUSIC_CONCURRENT,
    musicLimits: {
      authQrPerMinute: RATE_LIMITS.qqAuthCreate.max,
      authPollPerMinute: RATE_LIMITS.qqAuthPoll.max,
      unlockPerHour: RATE_LIMITS.musicUnlock.max,
      maxConcurrent: MAX_MUSIC_CONCURRENT,
      maxConcurrentPerIp: MAX_MUSIC_CONCURRENT_PER_IP,
      maxFileSizeMb: Math.round(MAX_MUSIC_FILE_SIZE / 1024 / 1024),
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
    const limit = req.originalUrl.startsWith("/api/music/") ? "200MB" : "10MB";
    return res.status(413).json({ success: false, error: `文件大小超过限制（最大 ${limit}）。` });
  }
  if (err instanceof QQMusicAuthError) {
    return res.status(err.status || 400).json({
      success: false,
      code: err.code,
      error: err.message,
    });
  }
  if (err instanceof QQMusicUnlockError || err.code === "UNSUPPORTED_QQ_FORMAT") {
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
