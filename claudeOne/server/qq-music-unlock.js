/*
 * QQ Music musicex/QMC2 unlock support.
 *
 * The format parsing and cipher behavior are adapted from qmdec:
 * https://github.com/Sophomoresty/qmdec
 * qmdec is published as MIT licensed in its README. This port uses only
 * Node.js built-ins plus the project's existing music-metadata dependency.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const MUSICEX_MAGIC = Buffer.from([0x6d, 0x75, 0x73, 0x69, 0x63, 0x65, 0x78, 0x00]);
const QTAG_MAGIC = Buffer.from("QTag", "ascii");
const STAG_MAGIC = Buffer.from("STag", "ascii");
const ENCV2_PREFIX = Buffer.from("QQMusic EncV2,Key:", "ascii");
const ENCV2_KEY1 = Buffer.from([
  0x33, 0x38, 0x36, 0x5a, 0x4a, 0x59, 0x21, 0x40,
  0x23, 0x2a, 0x24, 0x25, 0x5e, 0x26, 0x29, 0x28,
]);
const ENCV2_KEY2 = Buffer.from([
  0x2a, 0x24, 0x25, 0x5e, 0x26, 0x29, 0x28, 0x23,
  0x40, 0x21, 0x33, 0x38, 0x36, 0x5a, 0x4a, 0x59,
]);
const CACHE_DIR = path.join(__dirname, ".music-key-cache");
const QQ_API_URL = "https://u.y.qq.com/cgi-bin/musicu.fcg";

const AUDIO_TYPES = Object.freeze({
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
});

class QQMusicUnlockError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "QQMusicUnlockError";
    this.code = code;
    this.status = status;
  }
}

function readExactly(fd, length, position) {
  const buffer = Buffer.alloc(length);
  const bytesRead = fs.readSync(fd, buffer, 0, length, position);
  if (bytesRead !== length) {
    throw new QQMusicUnlockError("INVALID_QQ_FILE", "QQ 音乐文件尾部不完整或已损坏");
  }
  return buffer;
}

function decodeUtf16Field(buffer) {
  return buffer.toString("utf16le").split("\0", 1)[0].trim();
}

function parseFileTail(filePath) {
  const fileSize = fs.statSync(filePath).size;
  if (fileSize < 16) return null;

  const fd = fs.openSync(filePath, "r");
  try {
    const tail8 = readExactly(fd, 8, fileSize - 8);
    if (tail8.equals(MUSICEX_MAGIC)) {
      const tailSize = readExactly(fd, 4, fileSize - 16).readUInt32LE(0);
      const audioSize = fileSize - 16 - tailSize;
      if (tailSize < 184 || tailSize > 1024 * 1024 || audioSize <= 0) {
        throw new QQMusicUnlockError("INVALID_QQ_FILE", "musicex 文件尾部长度无效");
      }
      const tail = readExactly(fd, tailSize, audioSize);
      return {
        format: "musicex",
        songMid: decodeUtf16Field(tail.subarray(28, 88)),
        filename: decodeUtf16Field(tail.subarray(88, 184)),
        audioSize,
        ekey: null,
      };
    }

    const tail4 = tail8.subarray(4);
    if (!tail4.equals(QTAG_MAGIC) && !tail4.equals(STAG_MAGIC)) return null;

    const ekeyLength = tail8.readUInt32LE(0);
    const audioSize = fileSize - 8 - ekeyLength;
    if (ekeyLength <= 0 || ekeyLength > 4096 || audioSize <= 0) return null;
    const ekeyData = readExactly(fd, ekeyLength, audioSize);
    let songMid = "";
    let ekey = "";
    if (tail4.equals(QTAG_MAGIC)) {
      const comma = ekeyData.indexOf(0x2c);
      songMid = ekeyData.subarray(0, comma < 0 ? ekeyData.length : comma).toString("utf8");
      ekey = comma < 0 ? "" : ekeyData.subarray(comma + 1).toString("utf8");
    } else {
      ekey = ekeyData.toString("utf8");
    }
    return { format: "legacy", songMid, filename: "", audioSize, ekey: ekey.trim() };
  } finally {
    fs.closeSync(fd);
  }
}

function simpleMakeKey(salt, length) {
  const output = Buffer.alloc(length);
  for (let i = 0; i < length; i += 1) {
    output[i] = Math.trunc(Math.abs(Math.tan(salt + i * 0.1)) * 100) & 0xff;
  }
  return output;
}

function teaDecryptBlock(block, key) {
  let v0 = block.readUInt32BE(0);
  let v1 = block.readUInt32BE(4);
  const k0 = key.readUInt32BE(0);
  const k1 = key.readUInt32BE(4);
  const k2 = key.readUInt32BE(8);
  const k3 = key.readUInt32BE(12);
  const delta = 0x9e3779b9;
  let total = (delta * 16) >>> 0;

  for (let i = 0; i < 16; i += 1) {
    const mix1 = ((((v0 << 4) + k2) ^ (v0 + total) ^ ((v0 >>> 5) + k3))) >>> 0;
    v1 = (v1 - mix1) >>> 0;
    const mix0 = ((((v1 << 4) + k0) ^ (v1 + total) ^ ((v1 >>> 5) + k1))) >>> 0;
    v0 = (v0 - mix0) >>> 0;
    total = (total - delta) >>> 0;
  }

  const output = Buffer.alloc(8);
  output.writeUInt32BE(v0, 0);
  output.writeUInt32BE(v1, 4);
  return output;
}

function decryptTencentTea(input, key) {
  if (key.length !== 16 || input.length < 16 || input.length % 8 !== 0) return null;

  let dest = teaDecryptBlock(input.subarray(0, 8), key);
  const padLength = dest[0] & 0x07;
  const outputLength = input.length - padLength - 10;
  if (outputLength <= 0) return null;

  const output = Buffer.alloc(outputLength);
  let ivPrevious = Buffer.alloc(8);
  let ivCurrent = input.subarray(0, 8);
  let inputPosition = 8;
  let destIndex = 1 + padLength;

  function decryptNextBlock() {
    if (inputPosition + 8 > input.length) return false;
    ivPrevious = ivCurrent;
    ivCurrent = input.subarray(inputPosition, inputPosition + 8);
    const mixed = Buffer.alloc(8);
    for (let i = 0; i < 8; i += 1) mixed[i] = dest[i] ^ input[inputPosition + i];
    dest = teaDecryptBlock(mixed, key);
    inputPosition += 8;
    destIndex = 0;
    return true;
  }

  for (let skipped = 0; skipped < 2;) {
    if (destIndex < 8) {
      destIndex += 1;
      skipped += 1;
    } else if (!decryptNextBlock()) {
      return null;
    }
  }

  for (let outputPosition = 0; outputPosition < outputLength;) {
    if (destIndex < 8) {
      output[outputPosition] = dest[destIndex] ^ ivPrevious[destIndex];
      outputPosition += 1;
      destIndex += 1;
    } else if (!decryptNextBlock()) {
      return null;
    }
  }
  return output;
}

function decodeBase64(value) {
  const compact = String(value || "").replace(/\s+/g, "");
  if (!compact || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) return null;
  const output = Buffer.from(compact, "base64");
  return output.length ? output : null;
}

function decryptEncV2(rawKey) {
  const first = decryptTencentTea(rawKey.subarray(ENCV2_PREFIX.length), ENCV2_KEY1);
  if (!first) return null;
  const second = decryptTencentTea(first, ENCV2_KEY2);
  return second ? decodeBase64(second.toString("ascii")) : null;
}

function deriveKey(rawKey) {
  let keyMaterial = rawKey;
  if (keyMaterial.subarray(0, ENCV2_PREFIX.length).equals(ENCV2_PREFIX)) {
    keyMaterial = decryptEncV2(keyMaterial);
  }
  if (!keyMaterial || keyMaterial.length < 24 || (keyMaterial.length - 8) % 8 !== 0) return null;

  const simpleKey = simpleMakeKey(106, 8);
  const teaKey = Buffer.alloc(16);
  for (let i = 0; i < 8; i += 1) {
    teaKey[i * 2] = simpleKey[i];
    teaKey[i * 2 + 1] = keyMaterial[i];
  }
  const remainder = decryptTencentTea(keyMaterial.subarray(8), teaKey);
  return remainder ? Buffer.concat([keyMaterial.subarray(0, 8), remainder]) : null;
}

class MapCipher {
  constructor(key) {
    this.key = key;
    this.length = key.length;
  }

  mask(offset) {
    let normalized = offset;
    if (normalized > 0x7fff) normalized %= 0x7fff;
    const index = (normalized * normalized + 71214) % this.length;
    const shift = ((index & 0x07) + 4) % 8;
    const value = this.key[index];
    return ((value << shift) | (value >>> shift)) & 0xff;
  }

  decrypt(buffer, offset) {
    for (let i = 0; i < buffer.length; i += 1) buffer[i] ^= this.mask(offset + i);
  }
}

class RC4Cipher {
  static SEGMENT_SIZE = 5120;
  static FIRST_SEGMENT_SIZE = 128;

  constructor(key) {
    this.key = key;
    this.length = key.length;
    this.box = Array.from({ length: this.length }, (_value, index) => index & 0xff);
    let j = 0;
    for (let i = 0; i < this.length; i += 1) {
      j = (j + this.box[i] + key[i]) % this.length;
      [this.box[i], this.box[j]] = [this.box[j], this.box[i]];
    }
    this.hash = this.computeHash();
  }

  computeHash() {
    let hash = 1;
    for (const value of this.key) {
      if (value === 0) continue;
      const next = Math.imul(hash, value) >>> 0;
      if (next === 0 || next <= hash) break;
      hash = next;
    }
    return hash;
  }

  segmentSkip(id) {
    const seed = this.key[id % this.length];
    if (seed === 0) return 0;
    return Math.trunc((this.hash / ((id + 1) * seed)) * 100) % this.length;
  }

  decrypt(buffer, offset) {
    let remaining = buffer.length;
    let processed = 0;
    let streamOffset = offset;

    if (streamOffset < RC4Cipher.FIRST_SEGMENT_SIZE) {
      const blockSize = Math.min(remaining, RC4Cipher.FIRST_SEGMENT_SIZE - streamOffset);
      for (let i = 0; i < blockSize; i += 1) {
        buffer[i] ^= this.key[this.segmentSkip(streamOffset + i)];
      }
      processed += blockSize;
      streamOffset += blockSize;
      remaining -= blockSize;
    }

    if (remaining > 0 && streamOffset % RC4Cipher.SEGMENT_SIZE !== 0) {
      const blockSize = Math.min(remaining, RC4Cipher.SEGMENT_SIZE - (streamOffset % RC4Cipher.SEGMENT_SIZE));
      this.decryptSegment(buffer, processed, blockSize, streamOffset);
      processed += blockSize;
      streamOffset += blockSize;
      remaining -= blockSize;
    }

    while (remaining > RC4Cipher.SEGMENT_SIZE) {
      this.decryptSegment(buffer, processed, RC4Cipher.SEGMENT_SIZE, streamOffset);
      processed += RC4Cipher.SEGMENT_SIZE;
      streamOffset += RC4Cipher.SEGMENT_SIZE;
      remaining -= RC4Cipher.SEGMENT_SIZE;
    }
    if (remaining > 0) this.decryptSegment(buffer, processed, remaining, streamOffset);
  }

  decryptSegment(buffer, bufferOffset, length, streamOffset) {
    const box = this.box.slice();
    let j = 0;
    let k = 0;
    const skipLength = (streamOffset % RC4Cipher.SEGMENT_SIZE) +
      this.segmentSkip(Math.trunc(streamOffset / RC4Cipher.SEGMENT_SIZE));
    for (let i = -skipLength; i < length; i += 1) {
      j = (j + 1) % this.length;
      k = (box[j] + k) % this.length;
      [box[j], box[k]] = [box[k], box[j]];
      if (i >= 0) buffer[bufferOffset + i] ^= box[(box[j] + box[k]) % this.length];
    }
  }
}

function createCipher(key) {
  if (!key.length) throw new QQMusicUnlockError("KEY_DERIVATION_FAILED", "QQ 音乐解密密钥为空");
  return key.length > 300 ? new RC4Cipher(key) : new MapCipher(key);
}

function sniffAudio(buffer) {
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from("fLaC"))) return ".flac";
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from("OggS"))) return ".ogg";
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from("ID3"))) return ".mp3";
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return ".mp3";
  if (buffer.length >= 8 && buffer.subarray(4, 8).equals(Buffer.from("ftyp"))) return ".m4a";
  return null;
}

function decryptAudioFile(inputPath, outputBasePath, key, audioSize) {
  const cipher = createCipher(key);
  const preview = readFilePrefix(inputPath, Math.min(16, audioSize));
  cipher.decrypt(preview, 0);
  const extension = sniffAudio(preview);
  if (!extension) {
    throw new QQMusicUnlockError(
      "INVALID_DECRYPTED_AUDIO",
      "密钥解密后的文件头仍不是有效音频，请确认 QQ 音乐账号拥有该歌曲权限",
      422,
    );
  }

  const outputPath = `${outputBasePath}${extension}`;
  const inputFd = fs.openSync(inputPath, "r");
  const outputFd = fs.openSync(outputPath, "w");
  try {
    const streamingCipher = createCipher(key);
    let offset = 0;
    while (offset < audioSize) {
      const requested = Math.min(5120 * 10, audioSize - offset);
      const chunk = Buffer.allocUnsafe(requested);
      const bytesRead = fs.readSync(inputFd, chunk, 0, requested, offset);
      if (bytesRead <= 0) throw new QQMusicUnlockError("INVALID_QQ_FILE", "QQ 音乐文件内容提前结束");
      const data = chunk.subarray(0, bytesRead);
      streamingCipher.decrypt(data, offset);
      let written = 0;
      while (written < data.length) written += fs.writeSync(outputFd, data, written);
      offset += bytesRead;
    }
  } catch (error) {
    fs.closeSync(inputFd);
    fs.closeSync(outputFd);
    fs.rmSync(outputPath, { force: true });
    throw error;
  }
  fs.closeSync(inputFd);
  fs.closeSync(outputFd);
  return { outputPath, extension, mime: AUDIO_TYPES[extension] || "application/octet-stream" };
}

function readFilePrefix(filePath, length) {
  const fd = fs.openSync(filePath, "r");
  try {
    return readExactly(fd, length, 0);
  } finally {
    fs.closeSync(fd);
  }
}

function cachePath(cacheKey) {
  const digest = crypto.createHash("sha256").update(cacheKey).digest("hex");
  return path.join(CACHE_DIR, `${digest}.txt`);
}

function loadCachedEkey(cacheKey) {
  try {
    const value = fs.readFileSync(cachePath(cacheKey), "utf8").trim();
    return value || null;
  } catch (_error) {
    return null;
  }
}

function saveCachedEkey(cacheKey, ekey) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePath(cacheKey), ekey, { encoding: "utf8", mode: 0o600 });
}

function parseCookie(rawCookie) {
  const cookie = String(rawCookie || "").split(/[\r\n\0]/, 1)[0].trim();
  const uinMatch = cookie.match(/(?:^|;\s*)(?:qqmusic_uin|uin|musicid|userid|wxuin)=o?0*(\d+)/);
  return { cookie, uin: uinMatch ? uinMatch[1] : "" };
}

const COOKIE_SCAN_SCRIPT = String.raw`
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -TypeDefinition @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
public class ClaudeOneQQMusicCookie {
    [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(int a, bool b, int p);
    [DllImport("kernel32.dll")] static extern bool ReadProcessMemory(IntPtr h, IntPtr a, byte[] b, int s, out int r);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
    [DllImport("kernel32.dll")] static extern int VirtualQueryEx(IntPtr h, IntPtr a, out MBI m, int l);
    [StructLayout(LayoutKind.Sequential)] public struct MBI {
        public IntPtr BaseAddress, AllocationBase; public uint AllocationProtect;
        public IntPtr RegionSize; public uint State, Protect, Type;
    }
    public static string Run() {
        var processes = Process.GetProcessesByName("QQMusic");
        if (processes.Length == 0) return "ERROR:not_running";
        IntPtr handle = OpenProcess(0x0410, false, processes[0].Id);
        if (handle == IntPtr.Zero) return "ERROR:access_denied";
        try {
            byte[] marker = Encoding.ASCII.GetBytes("qqmusic_key=");
            IntPtr address = IntPtr.Zero; MBI mbi;
            while (VirtualQueryEx(handle, address, out mbi, Marshal.SizeOf(typeof(MBI))) != 0) {
                long size = mbi.RegionSize.ToInt64();
                if (mbi.State == 0x1000 && size >= 0x1000 && size < 50 * 1024 * 1024) {
                    uint protection = mbi.Protect & 0xFF;
                    if (protection == 2 || protection == 4 || protection == 6 || protection == 0x20 || protection == 0x40 || protection == 0x60 || protection == 0x80) {
                        byte[] buffer = new byte[(int)size]; int read;
                        if (ReadProcessMemory(handle, mbi.BaseAddress, buffer, buffer.Length, out read)) {
                            for (int i = 0; i <= read - marker.Length; i++) {
                                bool found = true;
                                for (int j = 0; j < marker.Length; j++) if (buffer[i + j] != marker[j]) { found = false; break; }
                                if (found) {
                                    int end = Math.Min(i + 512, read);
                                    return Encoding.UTF8.GetString(buffer, i, end - i).Split('\0')[0];
                                }
                            }
                        }
                    }
                }
                long next = mbi.BaseAddress.ToInt64() + size;
                if (size <= 0 || next <= address.ToInt64()) break;
                address = new IntPtr(next);
            }
            return "ERROR:not_found";
        } finally { CloseHandle(handle); }
    }
}
"@
[Console]::Write([ClaudeOneQQMusicCookie]::Run())
`;

function extractQQMusicAuth() {
  const environmentAuth = parseCookie(process.env.QQMUSIC_COOKIE || "");
  if (environmentAuth.cookie) {
    environmentAuth.uin = process.env.QQMUSIC_UIN || environmentAuth.uin;
    if (environmentAuth.uin) return Promise.resolve(environmentAuth);
  }

  if (process.platform !== "win32") {
    return Promise.reject(new QQMusicUnlockError(
      "QQ_AUTH_REQUIRED",
      "新版 QQ 音乐文件需要在 Windows 上启动并登录 QQ 音乐客户端",
      401,
    ));
  }

  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(COOKIE_SCAN_SCRIPT, "utf16le").toString("base64");
    const child = spawn("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded,
    ], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const output = [];
    const errors = [];
    const timer = setTimeout(() => child.kill(), 30000);
    child.stdout.on("data", chunk => output.push(chunk));
    child.stderr.on("data", chunk => errors.push(chunk));
    child.on("error", error => {
      clearTimeout(timer);
      reject(new QQMusicUnlockError("QQ_AUTH_REQUIRED", `无法读取 QQ 音乐登录状态: ${error.message}`, 401));
    });
    child.on("close", () => {
      clearTimeout(timer);
      const raw = Buffer.concat(output).toString("utf8").trim();
      if (raw.startsWith("ERROR:not_running")) {
        reject(new QQMusicUnlockError("QQ_AUTH_REQUIRED", "请先启动 QQ 音乐客户端，登录拥有歌曲权限的账号后重试", 401));
        return;
      }
      if (raw.startsWith("ERROR:access_denied")) {
        reject(new QQMusicUnlockError("QQ_AUTH_REQUIRED", "无法读取 QQ 音乐进程，请尝试以管理员身份启动本工具", 401));
        return;
      }
      if (raw.startsWith("ERROR:not_found")) {
        reject(new QQMusicUnlockError("QQ_AUTH_REQUIRED", "未找到 QQ 音乐登录凭据，请确认客户端已经登录", 401));
        return;
      }
      const auth = parseCookie(raw);
      if (!auth.cookie || !auth.uin) {
        const detail = Buffer.concat(errors).toString("utf8").trim();
        reject(new QQMusicUnlockError(
          "QQ_AUTH_REQUIRED",
          detail ? "读取 QQ 音乐登录状态失败" : "QQ 音乐登录凭据无效，请重新登录客户端",
          401,
        ));
        return;
      }
      resolve(auth);
    });
  });
}

async function postQQApi(payload, cookie = "") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(QQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "QQMusic/21",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    throw new QQMusicUnlockError("QQ_API_FAILED", `连接 QQ 音乐接口失败: ${error.message}`, 502);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchEkey(meta, auth) {
  const fileMid = meta.filename.replace(/\.(?:mflac|mgg)$/i, "");
  if (!fileMid || !meta.songMid) {
    throw new QQMusicUnlockError("INVALID_QQ_FILE", "musicex 文件缺少歌曲或文件标识");
  }
  const extension = fileMid.startsWith("F0") ? ".mflac" : ".mgg";
  const result = await postQQApi({
    comm: {
      cv: 4747474, ct: 24, format: "json", inCharset: "utf-8", outCharset: "utf-8",
      notice: 0, platform: "yqq.json", needNewCode: 1, uin: Number(auth.uin),
      g_tk_new_20200303: 5381, g_tk: 5381,
    },
    req_1: {
      module: "vkey.GetVkeyServer",
      method: "CgiGetVkey",
      param: {
        filename: [`${fileMid}${extension}`], guid: "10000", songmid: [meta.songMid],
        songtype: [0], uin: auth.uin, loginflag: 1, platform: "20",
      },
    },
  }, auth.cookie);
  const item = result?.req_1?.data?.midurlinfo?.[0];
  if (!item?.ekey) {
    throw new QQMusicUnlockError(
      "QQ_VIP_REQUIRED",
      "QQ 音乐没有返回解密密钥，请确认当前登录账号拥有该歌曲的下载/会员权限",
      403,
    );
  }
  return item.ekey;
}

async function getEkey(meta, auth = null, options = {}) {
  const cacheKey = meta.songMid || meta.filename;
  if (meta.ekey) {
    if (cacheKey && options.allowSharedEkeyCache !== false) saveCachedEkey(cacheKey, meta.ekey);
    return { ekey: meta.ekey, auth: null };
  }
  const sessionCache = options.sessionEkeyCache;
  const sessionCached = cacheKey && sessionCache && typeof sessionCache.get === "function"
    ? sessionCache.get(cacheKey)
    : null;
  if (sessionCached) return { ekey: sessionCached, auth };

  const useSharedCache = options.allowSharedEkeyCache ?? !auth;
  const cached = cacheKey && useSharedCache ? loadCachedEkey(cacheKey) : null;
  if (cached) return { ekey: cached, auth: null };

  const effectiveAuth = auth || await extractQQMusicAuth();
  const ekey = await fetchEkey(meta, effectiveAuth);
  if (cacheKey && sessionCache && typeof sessionCache.set === "function") {
    sessionCache.set(cacheKey, ekey);
  } else if (cacheKey && useSharedCache) {
    saveCachedEkey(cacheKey, ekey);
  }
  return { ekey, auth: effectiveAuth };
}

function stripMarkup(value) {
  return String(value || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
}

async function fetchSongMetadata(songMid, auth) {
  if (!songMid) return null;
  try {
    const result = await postQQApi({
      comm: { cv: 4747474, ct: 24, format: "json", uin: Number(auth?.uin || 0) },
      req_1: {
        module: "music.search.SearchCgiService",
        method: "DoSearchForQQMusicDesktop",
        param: { query: songMid, page_num: 1, num_per_page: 1, search_type: 0 },
      },
    }, auth?.cookie || "");
    const song = result?.req_1?.data?.body?.song?.list?.[0];
    if (!song) return null;
    const albumMid = song.album?.mid || "";
    return {
      title: stripMarkup(song.title || song.name),
      artist: (song.singer || []).map(item => stripMarkup(item.title || item.name)).filter(Boolean).join("/"),
      album: stripMarkup(song.album?.title || song.album?.name),
      coverUrl: albumMid ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumMid}.jpg` : "",
    };
  } catch (_error) {
    return null;
  }
}

function detectImageMime(buffer, fallback = "image/jpeg") {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return fallback;
}

async function fetchCover(url) {
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: controller.signal });
    if (!response.ok) return null;
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length < 1000 || data.length > 10 * 1024 * 1024) return null;
    return { data, mime: detectImageMime(data, response.headers.get("content-type") || "image/jpeg") };
  } catch (_error) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readAudioMetadata(filePath) {
  try {
    const { parseFile } = await import("music-metadata");
    const parsed = await parseFile(filePath, { duration: false, skipCovers: false });
    const picture = parsed.common.picture?.[0];
    return {
      title: parsed.common.title || "",
      artist: parsed.common.artist || parsed.common.artists?.join("/") || "",
      album: parsed.common.album || "",
      cover: picture?.data ? {
        data: Buffer.from(picture.data),
        mime: picture.format || detectImageMime(Buffer.from(picture.data)),
      } : null,
    };
  } catch (_error) {
    return { title: "", artist: "", album: "", cover: null };
  }
}

function parseImageDimensions(buffer, mime) {
  if (mime === "image/png" && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), depth: 32 };
  }
  if (mime === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5), depth: buffer[offset + 4] * 8 };
      }
      if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) break;
      offset += length + 2;
    }
  }
  return { width: 0, height: 0, depth: 0 };
}

function buildVorbisComment(metadata) {
  const vendor = Buffer.from("claudeOne qq-music-unlock", "utf8");
  const comments = [];
  if (metadata.title) comments.push(`TITLE=${metadata.title}`);
  if (metadata.artist) comments.push(`ARTIST=${metadata.artist}`);
  if (metadata.album) comments.push(`ALBUM=${metadata.album}`);
  const parts = [];
  const vendorLength = Buffer.alloc(4);
  vendorLength.writeUInt32LE(vendor.length);
  parts.push(vendorLength, vendor);
  const count = Buffer.alloc(4);
  count.writeUInt32LE(comments.length);
  parts.push(count);
  for (const comment of comments) {
    const data = Buffer.from(comment, "utf8");
    const length = Buffer.alloc(4);
    length.writeUInt32LE(data.length);
    parts.push(length, data);
  }
  return Buffer.concat(parts);
}

function buildFlacPicture(cover) {
  const mime = Buffer.from(cover.mime || detectImageMime(cover.data), "ascii");
  const dimensions = parseImageDimensions(cover.data, mime.toString("ascii"));
  const output = Buffer.alloc(4 + 4 + mime.length + 4 + 16 + 4 + cover.data.length);
  let offset = 0;
  output.writeUInt32BE(3, offset); offset += 4;
  output.writeUInt32BE(mime.length, offset); offset += 4;
  mime.copy(output, offset); offset += mime.length;
  output.writeUInt32BE(0, offset); offset += 4;
  output.writeUInt32BE(dimensions.width, offset); offset += 4;
  output.writeUInt32BE(dimensions.height, offset); offset += 4;
  output.writeUInt32BE(dimensions.depth, offset); offset += 4;
  output.writeUInt32BE(0, offset); offset += 4;
  output.writeUInt32BE(cover.data.length, offset); offset += 4;
  cover.data.copy(output, offset);
  return output;
}

function readFlacBlocks(filePath) {
  const fd = fs.openSync(filePath, "r");
  try {
    if (!readExactly(fd, 4, 0).equals(Buffer.from("fLaC"))) return null;
    const blocks = [];
    let offset = 4;
    let last = false;
    while (!last) {
      const header = readExactly(fd, 4, offset);
      last = Boolean(header[0] & 0x80);
      const type = header[0] & 0x7f;
      const length = header.readUIntBE(1, 3);
      if (length > 0xffffff) throw new QQMusicUnlockError("INVALID_DECRYPTED_AUDIO", "FLAC 元数据块无效");
      const data = readExactly(fd, length, offset + 4);
      blocks.push({ type, data });
      offset += 4 + length;
      if (blocks.length > 128) throw new QQMusicUnlockError("INVALID_DECRYPTED_AUDIO", "FLAC 元数据块过多");
    }
    return { blocks, audioOffset: offset };
  } finally {
    fs.closeSync(fd);
  }
}

function blockHeader(type, length, last) {
  if (length > 0xffffff) throw new QQMusicUnlockError("COVER_TOO_LARGE", "封面过大，无法写入 FLAC");
  const header = Buffer.alloc(4);
  header[0] = type | (last ? 0x80 : 0);
  header.writeUIntBE(length, 1, 3);
  return header;
}

function writeFlacMetadata(filePath, destinationPath, metadata, cover) {
  const parsed = readFlacBlocks(filePath);
  if (!parsed) return filePath;
  const retained = parsed.blocks.filter(block => block.type !== 4 && (!cover || block.type !== 6));
  const blocks = [];
  const streamInfo = retained.find(block => block.type === 0);
  if (!streamInfo) throw new QQMusicUnlockError("INVALID_DECRYPTED_AUDIO", "FLAC 缺少 STREAMINFO");
  blocks.push(streamInfo, { type: 4, data: buildVorbisComment(metadata) });
  if (cover) blocks.push({ type: 6, data: buildFlacPicture(cover) });
  blocks.push(...retained.filter(block => block !== streamInfo));

  const inputFd = fs.openSync(filePath, "r");
  const outputFd = fs.openSync(destinationPath, "w");
  let writeError = null;
  try {
    fs.writeSync(outputFd, Buffer.from("fLaC"));
    blocks.forEach((block, index) => {
      fs.writeSync(outputFd, blockHeader(block.type, block.data.length, index === blocks.length - 1));
      fs.writeSync(outputFd, block.data);
    });
    const copyBuffer = Buffer.allocUnsafe(1024 * 1024);
    let offset = parsed.audioOffset;
    while (true) {
      const bytesRead = fs.readSync(inputFd, copyBuffer, 0, copyBuffer.length, offset);
      if (!bytesRead) break;
      let written = 0;
      while (written < bytesRead) written += fs.writeSync(outputFd, copyBuffer, written, bytesRead - written);
      offset += bytesRead;
    }
  } catch (error) {
    writeError = error;
  } finally {
    fs.closeSync(inputFd);
    fs.closeSync(outputFd);
  }
  if (writeError) {
    fs.rmSync(destinationPath, { force: true });
    throw writeError;
  }
  return destinationPath;
}

async function unlockQQMusic(inputPath, workPrefix, fallbackName = "", options = {}) {
  const tail = parseFileTail(inputPath);
  if (!tail) {
    throw new QQMusicUnlockError(
      "UNSUPPORTED_QQ_FORMAT",
      "没有识别到 musicex、QTag 或 STag 文件尾部，请使用原始 QQ 音乐加密文件",
      415,
    );
  }

  const { ekey, auth } = await getEkey(tail, options.auth || null, {
    allowSharedEkeyCache: options.allowSharedEkeyCache,
    sessionEkeyCache: options.ekeyCache,
  });
  const rawKey = decodeBase64(ekey);
  if (!rawKey) throw new QQMusicUnlockError("INVALID_EKEY", "QQ 音乐返回的 EKey 编码无效", 422);
  const key = deriveKey(rawKey);
  if (!key) throw new QQMusicUnlockError("KEY_DERIVATION_FAILED", "无法从 EKey 生成 QMC2 解密密钥", 422);

  let decrypted = null;
  try {
    decrypted = decryptAudioFile(inputPath, workPrefix, key, tail.audioSize);
    const embedded = await readAudioMetadata(decrypted.outputPath);
    const remote = await fetchSongMetadata(tail.songMid, auth);
    const metadata = {
      title: embedded.title || remote?.title || fallbackName.replace(/\.[^.]+$/, ""),
      artist: embedded.artist || remote?.artist || "未知艺术家",
      album: embedded.album || remote?.album || "",
    };
    let cover = embedded.cover;
    if (!cover && remote?.coverUrl) cover = await fetchCover(remote.coverUrl);

    let outputPath = decrypted.outputPath;
    if (decrypted.extension === ".flac" && (metadata.title || metadata.artist || metadata.album || cover)) {
      const taggedPath = `${workPrefix}.tagged.flac`;
      outputPath = writeFlacMetadata(decrypted.outputPath, taggedPath, metadata, cover);
      if (outputPath !== decrypted.outputPath) fs.rmSync(decrypted.outputPath, { force: true });
    }
    return {
      outputPath,
      extension: decrypted.extension.slice(1),
      mime: decrypted.mime,
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      cover,
      songMid: tail.songMid,
    };
  } catch (error) {
    if (decrypted?.outputPath) fs.rmSync(decrypted.outputPath, { force: true });
    fs.rmSync(`${workPrefix}.tagged.flac`, { force: true });
    throw error;
  }
}

module.exports = {
  QQMusicUnlockError,
  MapCipher,
  RC4Cipher,
  decryptTencentTea,
  deriveKey,
  parseFileTail,
  simpleMakeKey,
  sniffAudio,
  unlockQQMusic,
  writeFlacMetadata,
};
