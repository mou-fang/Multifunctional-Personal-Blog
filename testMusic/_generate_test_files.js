// Generates synthetic QQ Music encrypted test files from a real MP3 file,
// for end-to-end testing of every decryption path supported by
// js/qq-music-decrypt.js.  Run: node _generate_test_files.js
//
// Output files (placed in this directory):
//   test_v1_static.tkm        — V1-static path (no tail, fixed 256-byte mask)
//   test_v1_static.bkcmp3     — V1-static path
//   test_v1_static.bkcflac    — V1-static path
//   test_v1_keyed.qmc0        — V1-keyed path (LE keySize trailer)
//   test_v1_keyed.qmc3        — V1-keyed path
//   test_qtag.qmcflac         — QTag path (BE keySize, embedded ekey text)
//   test_qtag.qmcogg          — QTag path
//   test_stag.qmc2            — STag path (LE keySize, embedded ekey text)
//
// All files decrypt to the same MP3 audio (the source).
//
// The cipher logic below is duplicated from js/qq-music-decrypt.js so this
// generator is self-contained and doesn't depend on the IIFE module loader.
// If you change the cipher there, sync the changes here too.

const fs = require("fs");
const path = require("path");

// Use the smallest available mp3 to keep the synthetic test files compact.
const SOURCE_MP3 = path.join(__dirname, "..", "claudeOne", "music", "開膛手嚶嚶嚶 - 莓 莓 布 丁 沙 冰.mp3");
const OUT_DIR = __dirname;
// Truncate the plaintext to keep test files small (still long enough for the
// ID3 tag, embedded cover, and ~30 seconds of audio to verify playback).
const PLAIN_MAX_BYTES = 1500000; // 1.5 MB

// ============================================================================
// QMC_STATIC_BOX (256 bytes) — same as js/qq-music-decrypt.js
// ============================================================================
const QMC_STATIC_BOX = new Uint8Array([
  0x77, 0x48, 0x32, 0x73, 0xDE, 0xF2, 0xC0, 0xC8, 0x95, 0xEC, 0x30, 0xB2, 0x51, 0xC3, 0xE1, 0xA0,
  0x9E, 0xE6, 0x9D, 0xCF, 0xFA, 0x7F, 0x14, 0xD1, 0xCE, 0xB8, 0xDC, 0xC3, 0x4A, 0x67, 0x93, 0xD6,
  0x28, 0xC2, 0x91, 0x70, 0xCA, 0x8D, 0xA2, 0xA4, 0xF0, 0x08, 0x61, 0x90, 0x7E, 0x6F, 0xA2, 0xE0,
  0xEB, 0xAE, 0x3E, 0xB6, 0x67, 0xC7, 0x92, 0xF4, 0x91, 0xB5, 0xF6, 0x6C, 0x5E, 0x84, 0x40, 0xF7,
  0xF3, 0x1B, 0x02, 0x7F, 0xD5, 0xAB, 0x41, 0x89, 0x28, 0xF4, 0x25, 0xCC, 0x52, 0x11, 0xAD, 0x43,
  0x68, 0xA6, 0x41, 0x8B, 0x84, 0xB5, 0xFF, 0x2C, 0x92, 0x4A, 0x26, 0xD8, 0x47, 0x6A, 0x7C, 0x95,
  0x61, 0xCC, 0xE6, 0xCB, 0xBB, 0x3F, 0x47, 0x58, 0x89, 0x75, 0xC3, 0x75, 0xA1, 0xD9, 0xAF, 0xCC,
  0x08, 0x73, 0x17, 0xDC, 0xAA, 0x9A, 0xA2, 0x16, 0x41, 0xD8, 0xA2, 0x06, 0xC6, 0x8B, 0xFC, 0x66,
  0x34, 0x9F, 0xCF, 0x18, 0x23, 0xA0, 0x0A, 0x74, 0xE7, 0x2B, 0x27, 0x70, 0x92, 0xE9, 0xAF, 0x37,
  0xE6, 0x8C, 0xA7, 0xBC, 0x62, 0x65, 0x9C, 0xC2, 0x08, 0xC9, 0x88, 0xB3, 0xF3, 0x43, 0xAC, 0x74,
  0x2C, 0x0F, 0xD4, 0xAF, 0xA1, 0xC3, 0x01, 0x64, 0x95, 0x4E, 0x48, 0x9F, 0xF4, 0x35, 0x78, 0x95,
  0x7A, 0x39, 0xD6, 0x6A, 0xA0, 0x6D, 0x40, 0xE8, 0x4F, 0xA8, 0xEF, 0x11, 0x1D, 0xF3, 0x1B, 0x3F,
  0x3F, 0x07, 0xDD, 0x6F, 0x5B, 0x19, 0x30, 0x19, 0xFB, 0xEF, 0x0E, 0x37, 0xF0, 0x0E, 0xCD, 0x16,
  0x49, 0xFE, 0x53, 0x47, 0x13, 0x1A, 0xBD, 0xA4, 0xF1, 0x40, 0x19, 0x60, 0x0E, 0xED, 0x68, 0x09,
  0x06, 0x5F, 0x4D, 0xCF, 0x3D, 0x1A, 0xFE, 0x20, 0x77, 0xE4, 0xD9, 0xDA, 0xF9, 0xA4, 0x2B, 0x76,
  0x1C, 0x71, 0xDB, 0x00, 0xBC, 0xFD, 0x0C, 0x6C, 0xA5, 0x47, 0xF7, 0xF6, 0x00, 0x79, 0x4A, 0x11,
]);

function staticMask(offset) {
  const off = offset > 0x7fff ? (offset % 0x7fff) : offset;
  return QMC_STATIC_BOX[(off * off + 27) & 0xff];
}

// ============================================================================
// Tencent TEA (used by deriveKey)
// ============================================================================
function readU32BE(b, o) { return ((b[o] << 24) | (b[o+1] << 16) | (b[o+2] << 8) | b[o+3]) >>> 0; }
function writeU32BE(b, o, v) { b[o]=(v>>>24)&0xff; b[o+1]=(v>>>16)&0xff; b[o+2]=(v>>>8)&0xff; b[o+3]=v&0xff; }

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

// ============================================================================
// Encrypt-side TEA: build a raw key whose deriveKey produces the desired
// derived key.  Easier approach used here: pick a random raw key, run
// deriveKey, and accept whatever derived key comes out.
// ============================================================================
function simpleMakeKey(salt, length) {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) out[i] = Math.trunc(Math.abs(Math.tan(salt + i * 0.1)) * 100) & 0xff;
  return out;
}

function deriveKey(rawKey) {
  if (rawKey.length < 24 || (rawKey.length - 8) % 8 !== 0) return null;
  const simpleKey = simpleMakeKey(106, 8);
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

// Find a random 24-byte raw key whose deriveKey() succeeds.
function findValidRawKey() {
  for (let attempt = 0; attempt < 5000; attempt++) {
    const buf = new Uint8Array(24);
    for (let i = 0; i < 24; i++) buf[i] = (Math.random() * 256) | 0;
    const k = deriveKey(buf);
    if (k && k.length >= 13) return buf;
  }
  throw new Error("could not find a valid 24-byte raw key");
}

// ============================================================================
// MapCipher (used for short keys)
// ============================================================================
function MapCipher(key) {
  this.key = key;
  this.length = key.length;
}
MapCipher.prototype.mask = function (offset) {
  let normalized = offset;
  if (normalized > 0x7fff) normalized = normalized % 0x7fff;
  const index = (normalized * normalized + 71214) % this.length;
  const shift = ((index & 0x07) + 4) % 8;
  const value = this.key[index];
  return ((value << shift) | (value >>> shift)) & 0xff;
};
MapCipher.prototype.applyXor = function (data) {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ this.mask(i);
  return out;
};

// ============================================================================
// Helpers
// ============================================================================
function writeU32LE(b, o, v) { b[o]=v&0xff; b[o+1]=(v>>>8)&0xff; b[o+2]=(v>>>16)&0xff; b[o+3]=(v>>>24)&0xff; }
function writeU32BEbuf(b, o, v) { b[o]=(v>>>24)&0xff; b[o+1]=(v>>>16)&0xff; b[o+2]=(v>>>8)&0xff; b[o+3]=v&0xff; }

function encryptStaticV1(plaintext) {
  const out = new Uint8Array(plaintext.length);
  for (let i = 0; i < plaintext.length; i++) out[i] = plaintext[i] ^ staticMask(i);
  return out;
}

// V1-keyed: encrypt audio with derived MapCipher, append <rawKey><LE keySize>.
function encryptV1Keyed(plaintext, rawKey) {
  const derived = deriveKey(rawKey);
  if (!derived) throw new Error("deriveKey failed");
  const cipher = new MapCipher(derived);
  const enc = cipher.applyXor(plaintext);
  const out = new Uint8Array(enc.length + rawKey.length + 4);
  out.set(enc, 0);
  out.set(rawKey, enc.length);
  writeU32LE(out, enc.length + rawKey.length, rawKey.length);
  return out;
}

// QTag: encrypt audio with derived MapCipher, append <ekeyText><BE keySize>"QTag".
function encryptQTag(plaintext, rawKey, songMid) {
  const derived = deriveKey(rawKey);
  if (!derived) throw new Error("deriveKey failed");
  const cipher = new MapCipher(derived);
  const enc = cipher.applyXor(plaintext);
  const ekeyB64 = Buffer.from(rawKey).toString("base64");
  // unlock-music inner format: "<ekey>,<songid>,<songmid>"
  const inner = ekeyB64 + ",1234567890," + (songMid || "001abcXYZdefGH");
  const innerBytes = Buffer.from(inner, "utf8");
  const out = new Uint8Array(enc.length + innerBytes.length + 8);
  out.set(enc, 0);
  out.set(innerBytes, enc.length);
  writeU32BEbuf(out, enc.length + innerBytes.length, innerBytes.length);
  out.set([0x51, 0x54, 0x61, 0x67], enc.length + innerBytes.length + 4); // "QTag"
  return out;
}

// STag: encrypt audio with derived MapCipher, append <ekeyText><LE keySize>"STag".
function encryptSTag(plaintext, rawKey) {
  const derived = deriveKey(rawKey);
  if (!derived) throw new Error("deriveKey failed");
  const cipher = new MapCipher(derived);
  const enc = cipher.applyXor(plaintext);
  const ekeyB64 = Buffer.from(rawKey).toString("base64");
  const innerBytes = Buffer.from(ekeyB64, "utf8");
  const out = new Uint8Array(enc.length + innerBytes.length + 8);
  out.set(enc, 0);
  out.set(innerBytes, enc.length);
  writeU32LE(out, enc.length + innerBytes.length, innerBytes.length);
  out.set([0x53, 0x54, 0x61, 0x67], enc.length + innerBytes.length + 4); // "STag"
  return out;
}

// Synthetic musicex: structure the file with the "musicex\0" trailer, a fake
// songmid + filename in the 184-byte tail block, and unencrypted plaintext as
// "audio" bytes.  The decryption pipeline will recognize the musicex format
// and prompt for a server EKey — but because the songmid is synthetic, the
// QQ Music API won't recognize it and will return an empty EKey.  This file
// is therefore primarily useful for verifying the parseFileTail dispatch and
// the "needs Cookie" UX flow, not the full decrypt round-trip.
function buildSyntheticMusicex(plaintext, songMid, filename) {
  const tailBlock = new Uint8Array(184);
  for (let i = 0; i < songMid.length && 28 + i * 2 + 1 < 88; i++) {
    tailBlock[28 + i * 2] = songMid.charCodeAt(i) & 0xff;
  }
  for (let i = 0; i < filename.length && 88 + i * 2 + 1 < 184; i++) {
    tailBlock[88 + i * 2] = filename.charCodeAt(i) & 0xff;
  }
  const trailer = new Uint8Array(16);
  writeU32LE(trailer, 0, tailBlock.length);
  trailer.set([0x6d, 0x75, 0x73, 0x69, 0x63, 0x65, 0x78, 0x00], 8); // "musicex\0"
  const out = new Uint8Array(plaintext.length + tailBlock.length + 16);
  out.set(plaintext, 0);
  out.set(tailBlock, plaintext.length);
  out.set(trailer, plaintext.length + tailBlock.length);
  return out;
}

// ============================================================================
// Driver
// ============================================================================
function main() {
  if (!fs.existsSync(SOURCE_MP3)) {
    console.error("source mp3 not found:", SOURCE_MP3);
    process.exit(1);
  }
  const plainFull = new Uint8Array(fs.readFileSync(SOURCE_MP3));
  const plain = plainFull.length > PLAIN_MAX_BYTES ? plainFull.subarray(0, PLAIN_MAX_BYTES) : plainFull;
  console.log(`source mp3: ${path.basename(SOURCE_MP3)} (${plainFull.length} bytes; using ${plain.length} for tests)`);

  // -- V1-static (3 files, one per user-listed extension) --
  const staticEnc = encryptStaticV1(plain);
  for (const ext of ["tkm", "bkcmp3", "bkcflac"]) {
    const out = path.join(OUT_DIR, `test_v1_static.${ext}`);
    fs.writeFileSync(out, Buffer.from(staticEnc.buffer, staticEnc.byteOffset, staticEnc.byteLength));
    console.log(`  wrote ${path.basename(out)} (${staticEnc.length} bytes, V1-static)`);
  }

  // -- V1-keyed (2 files, .qmc0 & .qmc3 both route through V1-keyed) --
  const rawKey1 = findValidRawKey();
  const keyedEnc = encryptV1Keyed(plain, rawKey1);
  for (const ext of ["qmc0", "qmc3"]) {
    const out = path.join(OUT_DIR, `test_v1_keyed.${ext}`);
    fs.writeFileSync(out, Buffer.from(keyedEnc.buffer, keyedEnc.byteOffset, keyedEnc.byteLength));
    console.log(`  wrote ${path.basename(out)} (${keyedEnc.length} bytes, V1-keyed)`);
  }

  // -- QTag (2 files, .qmcflac & .qmcogg) --
  const rawKey2 = findValidRawKey();
  const qtagEnc = encryptQTag(plain, rawKey2, "001testQTagXYZ");
  for (const ext of ["qmcflac", "qmcogg"]) {
    const out = path.join(OUT_DIR, `test_qtag.${ext}`);
    fs.writeFileSync(out, Buffer.from(qtagEnc.buffer, qtagEnc.byteOffset, qtagEnc.byteLength));
    console.log(`  wrote ${path.basename(out)} (${qtagEnc.length} bytes, QTag/BE)`);
  }

  // -- STag (1 file, .qmc2) --
  const rawKey3 = findValidRawKey();
  const stagEnc = encryptSTag(plain, rawKey3);
  const stagOut = path.join(OUT_DIR, "test_stag.qmc2");
  fs.writeFileSync(stagOut, Buffer.from(stagEnc.buffer, stagEnc.byteOffset, stagEnc.byteLength));
  console.log(`  wrote ${path.basename(stagOut)} (${stagEnc.length} bytes, STag/LE)`);

  // -- Legacy .mflac/.mgg (QTag-tailed, fully decryptable without Cookie) --
  // Older QQ Music desktop builds wrote .mflac and .mgg files with a QTag
  // tail rather than the modern musicex tail.  Decryption is identical to
  // the .qmcflac / .qmcogg path above.
  const rawKey4 = findValidRawKey();
  const legacyEnc = encryptQTag(plain, rawKey4, "001legacyMflacXX");
  for (const ext of ["mflac", "mgg"]) {
    const out = path.join(OUT_DIR, `test_legacy.${ext}`);
    fs.writeFileSync(out, Buffer.from(legacyEnc.buffer, legacyEnc.byteOffset, legacyEnc.byteLength));
    console.log(`  wrote ${path.basename(out)} (${legacyEnc.length} bytes, legacy QTag/BE)`);
  }

  // -- New musicex .mgg (synthetic — songmid is fake so cookie-driven decrypt
  //    won't fully succeed, but the path/dispatch and "needs Cookie" UX is
  //    exercised end-to-end). --
  const musicexEnc = buildSyntheticMusicex(plain, "001synthMggTest", "F0M0synth-MggSample.mgg");
  const musicexOut = path.join(OUT_DIR, "test_musicex.mgg");
  fs.writeFileSync(musicexOut, Buffer.from(musicexEnc.buffer, musicexEnc.byteOffset, musicexEnc.byteLength));
  console.log(`  wrote ${path.basename(musicexOut)} (${musicexEnc.length} bytes, musicex synthetic — needs Cookie, won't fully decrypt)`);

  console.log("\nAll synthetic test files generated.");
}

main();
