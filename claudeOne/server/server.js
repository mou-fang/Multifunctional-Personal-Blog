/* ===== claudeOne :: ASCII Art Converter Backend =====
 * Express + multer server that calls ascii-image-converter CLI.
 * Requires: go install github.com/TheZoraiz/ascii-image-converter@latest
 */

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const os = require("os");

const PORT = process.env.PORT || 3001;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_CONCURRENT = 3;
const UPLOADS_DIR = path.join(__dirname, "uploads");

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

// ---- concurrent limiting ----
let activeJobs = 0;

// ---- Express app ----
const app = express();

app.use(cors({ origin: ["http://localhost:8080", "http://127.0.0.1:8080"] }));
app.use(express.json());

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

// ---- Health check ----
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", activeJobs });
});

// ---- Global error handler ----
app.use((err, _req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ success: false, error: "文件大小超过限制（最大 10MB）。" });
  }
  if (err.message && err.message.includes("不支持的文件类型")) {
    return res.status(400).json({ success: false, error: err.message });
  }
  console.error("[ascii] Unhandled error:", err);
  res.status(500).json({ success: false, error: "服务器内部错误。" });
});

// Ensure uploads dir exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.listen(PORT, () => {
  console.log(`[ascii] Server running on http://localhost:${PORT}`);
  console.log(`[ascii] API: POST http://localhost:${PORT}/api/ascii`);
});
