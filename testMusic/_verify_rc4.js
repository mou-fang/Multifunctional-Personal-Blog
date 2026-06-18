// Round-trip test for the RC4 cipher path.  Synthetic test files in
// _verify_all.js all use 24-byte raw keys, which produce <= 300-byte derived
// keys → MapCipher.  Real QQ Music VIP EKeys are typically ~720 bytes raw
// → > 300-byte derived → RC4Cipher.  This is exactly the path Jay Chou's
// 周杰伦 - 晴天.mgg goes through, and it had never been exercised before.
//
// Strategy: pick a long raw key whose deriveKey succeeds, run deriveKey to
// produce the derived key, RC4-encrypt audio with it (using THE SAME
// RC4Cipher implementation that decryption uses), wrap in a synthetic
// musicex tail, and call decrypt() with the rawKey passed externally.
const fs = require("fs");
const path = require("path");

global.atob = (s) => Buffer.from(s, "base64").toString("binary");
global.TextDecoder = require("util").TextDecoder;

const code = fs.readFileSync(path.join(__dirname, "..", "claudeOne", "js", "qq-music-decrypt.js"), "utf8");
const sandbox = {};
new Function("self", code)(sandbox);
const M = sandbox.ClaudeOneQQDecrypt;

// ---- TEA primitives (identical to the decrypt module) -------------------

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

// Find a long raw key (>= 320 bytes) whose deriveKey result is > 300 bytes.
function findLongValidRawKey(minRaw = 720) {
  for (let attempt = 0; attempt < 5000; attempt++) {
    // Round to multiple of 8 + 8 (so (N-8) is divisible by 8).
    const N = minRaw + ((Math.random() * 32) | 0) * 8;
    const buf = new Uint8Array(N);
    for (let i = 0; i < N; i++) buf[i] = (Math.random() * 256) | 0;
    const k = deriveKey(buf);
    if (k && k.length > 300) return { rawKey: buf, derivedKey: k };
  }
  throw new Error("could not find a long valid raw key");
}

// ---- RC4Cipher mirror (must match qq-music-decrypt.js exactly) -----------

const RC4_SEGMENT_SIZE = 5120;
const RC4_FIRST_SEGMENT_SIZE = 128;

class RC4Cipher {
  constructor(key) {
    this.key = key;
    this.length = key.length;
    this.box = new Array(this.length);
    for (let i = 0; i < this.length; i++) this.box[i] = i & 0xff;
    let j = 0;
    for (let k = 0; k < this.length; k++) {
      j = (j + this.box[k] + key[k]) % this.length;
      const tmp = this.box[k];
      this.box[k] = this.box[j];
      this.box[j] = tmp;
    }
    this.hash = this._computeHash();
  }
  _computeHash() {
    let hash = 1;
    for (let i = 0; i < this.key.length; i++) {
      const v = this.key[i];
      if (v === 0) continue;
      const next = Math.imul(hash, v) >>> 0;
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

    if (streamOffset < RC4_FIRST_SEGMENT_SIZE) {
      const blk = Math.min(remaining, RC4_FIRST_SEGMENT_SIZE - streamOffset);
      for (let i = 0; i < blk; i++) {
        buffer[processed + i] ^= this.key[this.segmentSkip(streamOffset + i)];
      }
      processed += blk;
      streamOffset += blk;
      remaining -= blk;
    }

    if (remaining > 0 && streamOffset % RC4_SEGMENT_SIZE !== 0) {
      const blk = Math.min(remaining, RC4_SEGMENT_SIZE - (streamOffset % RC4_SEGMENT_SIZE));
      this._decryptSegment(buffer, processed, blk, streamOffset);
      processed += blk;
      streamOffset += blk;
      remaining -= blk;
    }

    while (remaining > RC4_SEGMENT_SIZE) {
      this._decryptSegment(buffer, processed, RC4_SEGMENT_SIZE, streamOffset);
      processed += RC4_SEGMENT_SIZE;
      streamOffset += RC4_SEGMENT_SIZE;
      remaining -= RC4_SEGMENT_SIZE;
    }
    if (remaining > 0) this._decryptSegment(buffer, processed, remaining, streamOffset);
  }
  _decryptSegment(buffer, bufferOffset, length, streamOffset) {
    const box = this.box.slice();
    let j = 0, k = 0;
    const skipLength = (streamOffset % RC4_SEGMENT_SIZE) +
      this.segmentSkip(Math.trunc(streamOffset / RC4_SEGMENT_SIZE));
    for (let i = -skipLength; i < length; i++) {
      j = (j + 1) % this.length;
      k = (box[j] + k) % this.length;
      const tmp = box[j];
      box[j] = box[k];
      box[k] = tmp;
      if (i >= 0) buffer[bufferOffset + i] ^= box[(box[j] + box[k]) % this.length];
    }
  }
}

// ---- File building ------------------------------------------------------

function writeU32LE(b, o, v) { b[o]=v&0xff; b[o+1]=(v>>>8)&0xff; b[o+2]=(v>>>16)&0xff; b[o+3]=(v>>>24)&0xff; }

const SOURCE_MP3 = path.join(__dirname, "..", "claudeOne", "music", "開膛手嚶嚶嚶 - 莓 莓 布 丁 沙 冰.mp3");
const sourceFull = new Uint8Array(fs.readFileSync(SOURCE_MP3));
// Use enough bytes that decryption straddles multiple RC4 segments
// (5120 bytes each) and the 128-byte first-segment quirk.  100 KB is plenty.
const plain = sourceFull.subarray(0, Math.min(100000, sourceFull.length));

function buildMusicexRC4(plaintext, derivedKey) {
  // Encrypt audio with the SAME RC4Cipher implementation (a fresh instance,
  // so internal state is clean — same as decrypt() does for "freshCipher").
  const cipher = new RC4Cipher(derivedKey);
  const enc = new Uint8Array(plaintext);
  cipher.decrypt(enc, 0);  // RC4 is its own inverse — XOR

  const tailBlock = new Uint8Array(184);
  const songMid = "001RC4testXXXY";
  const filename = "F0M0synth-RC4.mgg";
  for (let i = 0; i < songMid.length && 28 + i * 2 + 1 < 88; i++) {
    tailBlock[28 + i * 2] = songMid.charCodeAt(i) & 0xff;
  }
  for (let i = 0; i < filename.length && 88 + i * 2 + 1 < 184; i++) {
    tailBlock[88 + i * 2] = filename.charCodeAt(i) & 0xff;
  }
  const trailer = new Uint8Array(16);
  writeU32LE(trailer, 0, tailBlock.length);
  trailer.set([0x6d, 0x75, 0x73, 0x69, 0x63, 0x65, 0x78, 0x00], 8);
  const out = new Uint8Array(enc.length + tailBlock.length + 16);
  out.set(enc, 0);
  out.set(tailBlock, enc.length);
  out.set(trailer, enc.length + tailBlock.length);
  return out;
}

// ---- Run -----------------------------------------------------------------

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

let pass = 0, fail = 0;

{
  const { rawKey, derivedKey } = findLongValidRawKey(720);
  console.log(`  setup rawKey=${rawKey.length}b derivedKey=${derivedKey.length}b → cipher=${derivedKey.length > 300 ? "RC4" : "MapCipher"}`);
  const mggFile = buildMusicexRC4(plain, derivedKey);
  const ab = mggFile.buffer.slice(mggFile.byteOffset, mggFile.byteOffset + mggFile.byteLength);
  let result, err = "";
  try {
    result = M.decrypt(ab, rawKey);  // pass raw bytes; parseEkeyText returns them as-is
  } catch (e) { err = e.message; }
  if (result && bytesEqual(new Uint8Array(result.audio), plain)) {
    console.log(`  ok    RC4 round-trip via musicex         [RC4]    decrypted ${plain.length}b mp3, ext=${result.ext}`);
    pass++;
  } else {
    console.log(`  FAIL  RC4 round-trip via musicex         [RC4]    err="${err}" resultExt=${result && result.ext}`);
    if (result) {
      // Diagnose: how many of the first 32 bytes match?
      const got = new Uint8Array(result.audio);
      let matches = 0;
      for (let i = 0; i < Math.min(32, plain.length, got.length); i++) {
        if (got[i] === plain[i]) matches++;
      }
      console.log(`        first 32 bytes match: ${matches}/32`);
      console.log(`        plain[0..16]: ${Buffer.from(plain.slice(0, 16)).toString("hex")}`);
      console.log(`        got  [0..16]: ${Buffer.from(got.slice(0, 16)).toString("hex")}`);
    }
    fail++;
  }
}

console.log(`\n${pass}/${pass + fail} RC4 tests passed`);
process.exit(fail ? 1 : 0);
