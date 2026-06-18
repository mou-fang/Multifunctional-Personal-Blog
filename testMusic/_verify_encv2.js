// Synthetic round-trip test for the EncV2 EKey path.  Modern QQ Music API
// endpoints (CgiGetEVkey) wrap the per-song raw key in a TEA-twice envelope:
//   inner = TEA_encrypt(base64(rawKey),       KEY2)
//   outer = TEA_encrypt(inner,                KEY1)
//   ekey  = "QQMusic EncV2,Key:" + outer
// js/qq-music-decrypt.js must invert both passes correctly.  This test
// constructs an EncV2-formatted EKey with a freshly-generated raw key, runs it
// through deriveKey(), and asserts the derived material equals deriveKey() of
// the raw key directly — which is only true if both KEY1 and KEY2 match the
// real QQ Music constants.
const fs = require("fs");
const path = require("path");

global.atob = (s) => Buffer.from(s, "base64").toString("binary");
global.TextDecoder = require("util").TextDecoder;

const code = fs.readFileSync(path.join(__dirname, "..", "claudeOne", "js", "qq-music-decrypt.js"), "utf8");
const sandbox = {};
new Function("self", code)(sandbox);
const M = sandbox.ClaudeOneQQDecrypt;

// Key constants — must match those baked into qq-music-decrypt.js.
const ENCV2_PREFIX_STR = "QQMusic EncV2,Key:";
const KEY1 = new Uint8Array([
  0x33, 0x38, 0x36, 0x5a, 0x4a, 0x59, 0x21, 0x40,
  0x23, 0x2a, 0x24, 0x25, 0x5e, 0x26, 0x29, 0x28,
]);
const KEY2 = new Uint8Array([
  0x2a, 0x2a, 0x23, 0x21, 0x28, 0x23, 0x24, 0x25,
  0x26, 0x5e, 0x61, 0x31, 0x63, 0x5a, 0x2c, 0x54,
]);

// ---- TEA primitives (same algorithm as the decrypt module) ---------------

function readU32BE(b, o) { return ((b[o] << 24) | (b[o+1] << 16) | (b[o+2] << 8) | b[o+3]) >>> 0; }
function writeU32BE(b, o, v) { b[o]=(v>>>24)&0xff; b[o+1]=(v>>>16)&0xff; b[o+2]=(v>>>8)&0xff; b[o+3]=v&0xff; }

function teaEncryptBlock(block, key) {
  let v0 = readU32BE(block, 0), v1 = readU32BE(block, 4);
  const k0 = readU32BE(key, 0), k1 = readU32BE(key, 4), k2 = readU32BE(key, 8), k3 = readU32BE(key, 12);
  const delta = 0x9e3779b9;
  let total = 0;
  for (let i = 0; i < 16; i++) {
    total = (total + delta) >>> 0;
    const m0 = (((v1 << 4) + k0) ^ (v1 + total) ^ ((v1 >>> 5) + k1)) >>> 0;
    v0 = (v0 + m0) >>> 0;
    const m1 = (((v0 << 4) + k2) ^ (v0 + total) ^ ((v0 >>> 5) + k3)) >>> 0;
    v1 = (v1 + m1) >>> 0;
  }
  const out = new Uint8Array(8);
  writeU32BE(out, 0, v0); writeU32BE(out, 4, v1);
  return out;
}

// Tencent's TEA-CBC variant with prefixed pad block.  Matches decrypt logic in
// js/qq-music-decrypt.js — see comments there for the chaining math.
function encryptTencentTea(payload, key) {
  const L = payload.length;
  // pad layout: [crypt_byte (low 3 bits = pad)] [pad rand] [2 salt] [payload] [7 zero]
  let pad = (8 - ((L + 10) & 7)) & 7;
  const total = 1 + pad + 2 + L + 7;
  const plain = new Uint8Array(total);
  // High 5 bits of byte 0 are random; low 3 bits encode the pad length.
  plain[0] = (((Math.random() * 256) | 0) & 0xf8) | pad;
  for (let i = 1; i <= pad + 2; i++) plain[i] = (Math.random() * 256) | 0;
  plain.set(payload, 1 + pad + 2);
  // Trailing 7 zero bytes are already zero.

  const cipher = new Uint8Array(total);
  let prevD = new Uint8Array(8);
  let prevC = new Uint8Array(8);
  for (let blk = 0; blk < total; blk += 8) {
    const P = plain.subarray(blk, blk + 8);
    let D, C;
    if (blk === 0) {
      D = new Uint8Array(P);
      C = teaEncryptBlock(D, key);
    } else {
      D = new Uint8Array(8);
      for (let j = 0; j < 8; j++) D[j] = P[j] ^ prevC[j];
      const E = teaEncryptBlock(D, key);
      C = new Uint8Array(8);
      for (let j = 0; j < 8; j++) C[j] = E[j] ^ prevD[j];
    }
    cipher.set(C, blk);
    prevD = D;
    prevC = C;
  }
  return cipher;
}

// ---- Helpers --------------------------------------------------------------

function base64Encode(bytes) {
  return Buffer.from(bytes).toString("base64");
}

// ---- Tests ----------------------------------------------------------------

function buildEncV2Ekey(rawKey) {
  // Real EncV2 ekeys are emitted by the QQ Music API as the ASCII string
  //   "QQMusic EncV2,Key:" + base64(TEA_encrypt(TEA_encrypt(base64(rawKey), KEY2), KEY1))
  // Match that wire format here so the test exercises decryptEncV2's
  // strip-prefix → base64-decode → TEA→TEA → base64-decode pipeline.
  const b64Inner = base64Encode(rawKey);
  const b64Bytes = new Uint8Array(Buffer.from(b64Inner, "utf8"));
  const inner = encryptTencentTea(b64Bytes, KEY2);
  const outer = encryptTencentTea(inner, KEY1);
  const outerB64 = base64Encode(outer);
  return ENCV2_PREFIX_STR + outerB64;
}

// Use the source mp3 as plaintext so a successful round-trip yields bytes
// identical to the original audio.
const SOURCE_MP3 = path.join(__dirname, "..", "claudeOne", "music", "開膛手嚶嚶嚶 - 莓 莓 布 丁 沙 冰.mp3");
const sourceFull = new Uint8Array(fs.readFileSync(SOURCE_MP3));
const plain = sourceFull.subarray(0, Math.min(800000, sourceFull.length));

// Generator helpers (lifted from _generate_test_files.js for self-containment).
function writeU32LE(b, o, v) { b[o]=v&0xff; b[o+1]=(v>>>8)&0xff; b[o+2]=(v>>>16)&0xff; b[o+3]=(v>>>24)&0xff; }

function teaDecryptBlock(block, key) {
  let v0 = readU32BE(block, 0), v1 = readU32BE(block, 4);
  const k0 = readU32BE(key, 0), k1 = readU32BE(key, 4), k2 = readU32BE(key, 8), k3 = readU32BE(key, 12);
  const delta = 0x9e3779b9;
  let total = (delta * 16) >>> 0;
  for (let i = 0; i < 16; i++) {
    const m1 = (((v0 << 4) + k2) ^ (v0 + total) ^ ((v0 >>> 5) + k3)) >>> 0;
    v1 = (v1 - m1) >>> 0;
    const m0 = (((v1 << 4) + k0) ^ (v1 + total) ^ ((v1 >>> 5) + k1)) >>> 0;
    v0 = (v0 - m0) >>> 0;
    total = (total - delta) >>> 0;
  }
  const out = new Uint8Array(8);
  writeU32BE(out, 0, v0); writeU32BE(out, 4, v1);
  return out;
}

function decryptTencentTea(input, key) {
  if (key.length !== 16 || input.length < 16 || input.length % 8 !== 0) return null;
  let dest = teaDecryptBlock(input.subarray(0, 8), key);
  const padLength = dest[0] & 0x07;
  const outputLength = input.length - padLength - 10;
  if (outputLength <= 0) return null;
  const output = new Uint8Array(outputLength);
  let ivPrevious = new Uint8Array(8);
  let ivCurrent = input.subarray(0, 8);
  let inputPosition = 8;
  let destIndex = 1 + padLength;
  function decryptNextBlock() {
    if (inputPosition + 8 > input.length) return false;
    ivPrevious = ivCurrent;
    ivCurrent = input.subarray(inputPosition, inputPosition + 8);
    const mixed = new Uint8Array(8);
    for (let j = 0; j < 8; j++) mixed[j] = dest[j] ^ input[inputPosition + j];
    dest = teaDecryptBlock(mixed, key);
    inputPosition += 8;
    destIndex = 0;
    return true;
  }
  for (let skipped = 0; skipped < 2;) {
    if (destIndex < 8) { destIndex++; skipped++; }
    else if (!decryptNextBlock()) return null;
  }
  for (let outputPosition = 0; outputPosition < outputLength;) {
    if (destIndex < 8) {
      output[outputPosition] = dest[destIndex] ^ ivPrevious[destIndex];
      outputPosition++; destIndex++;
    } else if (!decryptNextBlock()) return null;
  }
  return output;
}

function deriveKey(rawKey) {
  if (rawKey.length < 24 || (rawKey.length - 8) % 8 !== 0) return null;
  const simpleKey = new Uint8Array(8);
  for (let i = 0; i < 8; i++) simpleKey[i] = Math.trunc(Math.abs(Math.tan(106 + i * 0.1)) * 100) & 0xff;
  const teaKey = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    teaKey[i * 2] = simpleKey[i];
    teaKey[i * 2 + 1] = rawKey[i];
  }
  const remainder = decryptTencentTea(rawKey.subarray(8), teaKey);
  if (!remainder) return null;
  const result = new Uint8Array(8 + remainder.length);
  result.set(rawKey.subarray(0, 8), 0);
  result.set(remainder, 8);
  return result;
}

// MapCipher (used for short keys) — for encrypting our test plaintext.
function mapMask(key, offset) {
  let n = offset;
  if (n > 0x7fff) n = n % 0x7fff;
  const idx = (n * n + 71214) % key.length;
  const sh = ((idx & 0x07) + 4) % 8;
  const v = key[idx];
  return ((v << sh) | (v >>> sh)) & 0xff;
}

function findValidRawKeyReal() {
  for (let attempt = 0; attempt < 5000; attempt++) {
    const buf = new Uint8Array(24);
    for (let i = 0; i < 24; i++) buf[i] = (Math.random() * 256) | 0;
    const k = deriveKey(buf);
    if (k && k.length >= 13) return buf;
  }
  throw new Error("could not find a valid 24-byte raw key");
}

// Build a synthetic musicex .mgg file whose decryption needs an EncV2 ekey
// supplied externally — this is the path real .mflac/.mgg files take after
// fetching the ekey from the QQ Music server.
function buildMusicexWithMapCipher(plaintext, rawKey) {
  const derived = deriveKey(rawKey);
  if (!derived) throw new Error("deriveKey failed");
  const enc = new Uint8Array(plaintext.length);
  for (let i = 0; i < plaintext.length; i++) enc[i] = plaintext[i] ^ mapMask(derived, i);

  // Synthetic 184-byte tail with a non-empty songMid + filename.
  const tailBlock = new Uint8Array(184);
  const songMid = "001encv2TestXX";
  const filename = "F0M0synth-EncV2.mgg";
  for (let i = 0; i < songMid.length && 28 + i * 2 + 1 < 88; i++) {
    tailBlock[28 + i * 2] = songMid.charCodeAt(i) & 0xff;
  }
  for (let i = 0; i < filename.length && 88 + i * 2 + 1 < 184; i++) {
    tailBlock[88 + i * 2] = filename.charCodeAt(i) & 0xff;
  }
  const trailer = new Uint8Array(16);
  writeU32LE(trailer, 0, tailBlock.length);
  trailer.set([0x6d, 0x75, 0x73, 0x69, 0x63, 0x65, 0x78, 0x00], 8); // "musicex\0"
  const out = new Uint8Array(enc.length + tailBlock.length + 16);
  out.set(enc, 0);
  out.set(tailBlock, enc.length);
  out.set(trailer, enc.length + tailBlock.length);
  return out;
}

// ---- Run --------------------------------------------------------------------

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

let pass = 0, fail = 0;

// Test 1: EncV2 envelope round-trip via musicex + externalEKey.
{
  const rawKey = findValidRawKeyReal();
  const ekeyText = buildEncV2Ekey(rawKey);
  const mggFile = buildMusicexWithMapCipher(plain, rawKey);
  const ab = mggFile.buffer.slice(mggFile.byteOffset, mggFile.byteOffset + mggFile.byteLength);
  let result, err = "";
  try {
    result = M.decrypt(ab, ekeyText);
  } catch (e) { err = e.message; }
  if (result && bytesEqual(new Uint8Array(result.audio), plain)) {
    console.log("  ok    EncV2 round-trip via musicex       [EncV2]  decrypted to source mp3 (" + plain.length + "b, ekey=" + ekeyText.length + "b)");
    pass++;
  } else {
    console.log("  FAIL  EncV2 round-trip via musicex       [EncV2]  err=\"" + err + "\" resultExt=" + (result && result.ext));
    fail++;
  }
}

console.log(`\n${pass}/${pass + fail} EncV2 tests passed`);
process.exit(fail ? 1 : 0);
