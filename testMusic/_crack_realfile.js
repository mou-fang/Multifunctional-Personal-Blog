// Brute-forcer for the actual cipher used by the user's musicex .mgg.
// Given the EKey, full rawKey, full derivedKey, and the encrypted file head,
// try a wide range of cipher / key transformations.  The first one whose
// XOR mask matches OggS / fLaC / ID3 / ftyp wins.

const fs = require("fs");
const path = require("path");

global.atob = (s) => Buffer.from(s, "base64").toString("binary");
global.TextDecoder = require("util").TextDecoder;

const code = fs.readFileSync(path.join(__dirname, "..", "claudeOne", "js", "qq-music-decrypt.js"), "utf8");
const sandbox = {};
new Function("self", code)(sandbox);

// User-supplied data ---------------------------------------------------------

const EKEY = "bGo4Tk12ZlLZ0tQgXaW8T4emz6iAGHYT5+7PZXC009mhX9vJlz32eURy0EDe4/TfDQZJwDyBj8wJGOxyXpPVxa/3UQYsTvNY7Eq8Lrwg3xrd2ydkGpr5EcyhyAuk6Oz7LTE/ZTDgPGlbntolYNgffPPNqlEamX/24JDzjCI5mnN0LxffABHN/7MlgAO6p9F+D5BuXJzdAz8jr49R2QosznslBIcJjfnzIE4KRc5/QrxbJzgxij2k+808AjJrGChqlWeNtHV2EZ+B5dWnly9tlNu5Ymk3K4UANKNz2LSRxIWUUGGY4B3NXEe8059XL/yfRB6jZZB+otNtfegpCnmsdhE3IdEYsKbKmC4P/dR5CeOw31GdZf2TAo6g8wHfdo1XHX8ZGh/xV3Z96mrXkpl/z6YiDZEUo4smsds+HQCX8L5keCXCbxeLALUgbPHmNJk1bozmfBumtgaXf1/pUA4XtbN2UIcyz9fMQg6fNAW1ZecPg3KG37T7dXY9d62X0/cEeEmCGiGALQs6uVKe4Viwn7surUswf1My9BYwN/8rsZy+QRLWcVd55uup4apfa9T3zEGhl99kgw3qv4sQnMBFn5bztO9MwyQctGNRBuuTKBD7EFJ2bSzBSOqkv7EzxNe9Nmxov7GV1hl8jWvX1QUMesVzG9ByC8CcXJkJssPUUXPopjX8R7nXWPZljw3sNvrX";
const RAW_HEX = "6c6a384e4d766652d9d2d4205da5bc4f87a6cfa880187613e7eecf6570b4d3d9a15fdbc9973df6794472d040dee3f4df0d0649c03c818fcc0918ec725e93d5c5aff751062c4ef358ec4abc2ebc20df1adddb27641a9af911cca1c80ba4e8ecfb2d313f6530e03c695b9eda2560d81f7cf3cdaa511a997ff6e090f38c22399a73742f17df0011cdffb3258003baa7d17e0f906e5c9cdd033f23af8f51d90a2cce7b250487098df9f3204e0a45ce7f42bc5b2738318a3da4fbcd3c02326b18286a95678db47576119f81e5d5a7972f6d94dbb96269372b850034a373d8b491c48594506198e01dcd5c47bcd39f572ffc9f441ea365907ea2d36d7de8290a79ac76113721d118b0a6ca982e0ffdd47909e3b0df519d65fd93028ea0f301df768d571d7f191a1ff157767dea6ad792997fcfa6220d9114a38b26b1db3e1d0097f0be647825c26f178b00b5206cf1e63499356e8ce67c1ba6b606977f5fe9500e17b5b376508732cfd7cc420e9f3405b565e70f837286dfb4fb75763d77ad97d3f7047849821a21802d0b3ab9529ee158b09fbb2ead4b307f5332f4163037ff2bb19cbe4112d6715779e6eba9e1aa5f6bd4f7cc41a197df64830deabf8b109cc0459f96f3b4ef4cc3241cb4635106eb932810fb1052766d2cc148eaa4bfb133c4d7bd366c68bfb195d6197c8d6bd7d5050c7ac5731bd0720bc09c5c9909b2c3d45173e8a635fc47b9d758f6658f0dec36fad7";
const DER_HEX = "6c6a384e4d7666524e335970426e6b4e4d4e6f41397043384e485a3454376b6147525230506c62325038385043346236463676776245777730306e556a31373835304c303354353255755a4143745773716649396e6f633456316f3951597132554a386432764852585a304748745a326d3933707839346a787a723950614a6d3942384e433537433956344f7473617a3139736c3237564c7565546b4a316e7354325a4b433133706e3670394c4f654c6d4c3830783934665a384938375650483771345950346f4752445577444a63563735686232513934395a6534326464774c63423673736a76476a3936384331394f4530766b55313034475a3861735432683270314b39335255733670415a7530596c7770796850355935683066314a636a774b34583241306c365965313273355a4d485530543534563567433730553234464336646c5472774d505161493951364736615036665a6268455670625a6c524e3256396545317379343637316374733377773048354d4978694b6c4b41316b7648465272455a73723933344562354f746e6834453667626163766a6b5233463951794e7768523052474d4f62695073366c4f4e74316a39653335724a4653316b6c346e7935446b3238634c356e53533563676676714a32427536723256377573506d664e6b786e37674f3967674a3942365a79444f38336b6e6a524b3032";
const FILE_HEAD_HEX = "d6c966cddd4b813c33dfc138988a005672ebc18e98b6e70b383801d1dcc82eccfbf3328edd79004f772a012898aec17d99e941be98bac1798bc6cebcba1a0138";

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
function bytesToHex(b) {
  let s = "";
  for (let i = 0; i < b.length; i++) {
    const h = b[i].toString(16);
    s += (h.length < 2 ? "0" : "") + h;
  }
  return s;
}

const rawKey = hexToBytes(RAW_HEX);
const derived = hexToBytes(DER_HEX);
const enc = hexToBytes(FILE_HEAD_HEX);

console.log(`rawKey=${rawKey.length}b derived=${derived.length}b enc=${enc.length}b`);

// Magic markers we want to see at offset 0 of decrypted output.
const MAGICS = [
  { name: "OggS", bytes: [0x4f, 0x67, 0x67, 0x53] },
  { name: "fLaC", bytes: [0x66, 0x4c, 0x61, 0x43] },
  { name: "ID3",  bytes: [0x49, 0x44, 0x33] },
  { name: "MP3-sync", test: (b) => b[0] === 0xff && (b[1] & 0xe0) === 0xe0 },
  // ftyp at offset 4 → check bytes [4..8] when we decrypt at offset 0
  { name: "ftyp@4", test: (b) => b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 },
];

function testMagic(decrypted) {
  for (const m of MAGICS) {
    if (m.test) { if (m.test(decrypted)) return m.name; }
    else {
      let ok = true;
      for (let i = 0; i < m.bytes.length; i++) if (decrypted[i] !== m.bytes[i]) { ok = false; break; }
      if (ok) return m.name;
    }
  }
  return null;
}

// QMC v2 RC4 / Map ciphers (lifted from qq-music-decrypt.js, kept here for
// independent testing).
const RC4_SEGMENT_SIZE = 5120;
const RC4_FIRST_SEGMENT_SIZE = 128;

class RC4Cipher {
  constructor(key) {
    this.key = key; this.length = key.length;
    this.box = new Array(this.length);
    for (let i = 0; i < this.length; i++) this.box[i] = i & 0xff;
    let j = 0;
    for (let k = 0; k < this.length; k++) {
      j = (j + this.box[k] + key[k]) % this.length;
      const t = this.box[k]; this.box[k] = this.box[j]; this.box[j] = t;
    }
    let h = 1;
    for (let i = 0; i < key.length; i++) {
      const v = key[i]; if (v === 0) continue;
      const n = Math.imul(h, v) >>> 0;
      if (n === 0 || n <= h) break;
      h = n;
    }
    this.hash = h;
  }
  segmentSkip(id) {
    const seed = this.key[id % this.length]; if (seed === 0) return 0;
    return Math.trunc((this.hash / ((id + 1) * seed)) * 100) % this.length;
  }
  decrypt(buf, offset) {
    let r = buf.length, p = 0, s = offset;
    if (s < RC4_FIRST_SEGMENT_SIZE) {
      const blk = Math.min(r, RC4_FIRST_SEGMENT_SIZE - s);
      for (let i = 0; i < blk; i++) buf[p + i] ^= this.key[this.segmentSkip(s + i)];
      p += blk; s += blk; r -= blk;
    }
    if (r > 0 && s % RC4_SEGMENT_SIZE !== 0) {
      const blk = Math.min(r, RC4_SEGMENT_SIZE - (s % RC4_SEGMENT_SIZE));
      this._segment(buf, p, blk, s); p += blk; s += blk; r -= blk;
    }
    while (r > RC4_SEGMENT_SIZE) {
      this._segment(buf, p, RC4_SEGMENT_SIZE, s); p += RC4_SEGMENT_SIZE; s += RC4_SEGMENT_SIZE; r -= RC4_SEGMENT_SIZE;
    }
    if (r > 0) this._segment(buf, p, r, s);
  }
  _segment(buf, off, len, s) {
    const box = this.box.slice();
    let j = 0, k = 0;
    const skip = (s % RC4_SEGMENT_SIZE) + this.segmentSkip(Math.trunc(s / RC4_SEGMENT_SIZE));
    for (let i = -skip; i < len; i++) {
      j = (j + 1) % this.length;
      k = (box[j] + k) % this.length;
      const t = box[j]; box[j] = box[k]; box[k] = t;
      if (i >= 0) buf[off + i] ^= box[(box[j] + box[k]) % this.length];
    }
  }
}

class MapCipher {
  constructor(key) { this.key = key; this.length = key.length; }
  mask(off) {
    let n = off; if (n > 0x7fff) n = n % 0x7fff;
    const idx = (n * n + 71214) % this.length;
    const sh = ((idx & 0x07) + 4) % 8;
    const v = this.key[idx];
    return ((v << sh) | (v >>> sh)) & 0xff;
  }
  decrypt(buf, off) { for (let i = 0; i < buf.length; i++) buf[i] ^= this.mask(off + i); }
}

class StaticCipher {
  constructor() {
    this.box = new Uint8Array([
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
  }
  mask(off) { const o = off > 0x7fff ? off % 0x7fff : off; return this.box[(o * o + 27) & 0xff]; }
  decrypt(buf, off) { for (let i = 0; i < buf.length; i++) buf[i] ^= this.mask(off + i); }
}

// Build candidate keys ------------------------------------------------------

function decodeBase64(bytes) {
  // Decode as a string treating each byte as a code point.
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  try {
    const bin = Buffer.from(s, "base64");
    return new Uint8Array(bin);
  } catch (_e) { return null; }
}

const candidates = [];

function pushKey(name, key) {
  if (!key || key.length < 8) return;
  candidates.push({ name, key });
}

pushKey("derived (full 512)", derived);
pushKey("derived[8..]", derived.subarray(8));
pushKey("rawKey (full 528)", rawKey);
pushKey("rawKey[8..]", rawKey.subarray(8));

// base64-decode the entire derived key
{
  const b = decodeBase64(derived);
  if (b) pushKey(`base64(derived) → ${b.length}b`, b);
}
// base64-decode derived[8..] (skip the IV / salt bytes)
{
  const b = decodeBase64(derived.subarray(8));
  if (b) pushKey(`base64(derived[8..]) → ${b.length}b`, b);
}
// base64-decode rawKey directly (in case it's already an ASCII base64 string
// when looked at byte-for-byte)
{
  const b = decodeBase64(rawKey);
  if (b) pushKey(`base64(rawKey) → ${b.length}b`, b);
}
// base64-decode the original ekey TWICE (some envelope formats are b64 of b64)
{
  const once = Buffer.from(EKEY, "base64");
  const onceArr = new Uint8Array(once);
  pushKey(`base64(ekey) once → ${onceArr.length}b`, onceArr);
  // try treating that as a base64 string of base64 chars
  const twice = decodeBase64(onceArr);
  if (twice) pushKey(`base64(base64(ekey)) → ${twice.length}b`, twice);
}

// Now iterate all (key × cipher × stream offset 0) combinations.
function testCipher(name, key, cipher) {
  const out = new Uint8Array(enc);
  cipher.decrypt(out, 0);
  const m = testMagic(out);
  return { match: m, head: bytesToHex(out.subarray(0, 16)) };
}

console.log("\n=== brute force: which (key, cipher) gives a known audio magic at offset 0 ===\n");

const ciphers = ["RC4", "Map", "Static"];
for (const c of candidates) {
  for (const cName of ciphers) {
    let cipherObj;
    if (cName === "RC4")        cipherObj = new RC4Cipher(c.key);
    else if (cName === "Map")   cipherObj = new MapCipher(c.key);
    else if (cName === "Static") cipherObj = new StaticCipher();
    const r = testCipher(c.name + " / " + cName, c.key, cipherObj);
    const tag = r.match ? `\x1b[32m✓ ${r.match}\x1b[0m` : "·";
    console.log(`  ${tag.padEnd(20)} ${(c.name + " / " + cName).padEnd(48)} dec=${r.head}`);
  }
}

// As a final pass, try "shifted" stream offsets in case the audio doesn't
// start at byte 0 of the file (e.g. has a 16- or 32-byte preamble).
console.log("\n=== try non-zero stream offsets for the strongest candidate (derived/RC4) ===\n");
for (const off of [16, 32, 48, 64, 128, 256]) {
  const out = new Uint8Array(enc);
  const c = new RC4Cipher(derived);
  c.decrypt(out, off);
  const m = testMagic(out);
  const tag = m ? `\x1b[32m✓ ${m}\x1b[0m` : "·";
  console.log(`  ${tag.padEnd(20)} stream offset ${off.toString().padStart(3)}    dec=${bytesToHex(out.subarray(0, 16))}`);
}

console.log("\n=== expected mask (XOR enc[0..3] with OggS) ===");
const wantMask = [enc[0] ^ 0x4f, enc[1] ^ 0x67, enc[2] ^ 0x67, enc[3] ^ 0x53];
console.log(`  if file is OGG, mask[0..3] should be ${bytesToHex(new Uint8Array(wantMask))}`);
const wantMaskFlac = [enc[0] ^ 0x66, enc[1] ^ 0x4c, enc[2] ^ 0x61, enc[3] ^ 0x43];
console.log(`  if file is FLAC, mask[0..3] should be ${bytesToHex(new Uint8Array(wantMaskFlac))}`);
const wantMaskID3 = [enc[0] ^ 0x49, enc[1] ^ 0x44, enc[2] ^ 0x33];
console.log(`  if file is MP3-ID3, mask[0..2] should be ${bytesToHex(new Uint8Array(wantMaskID3))}`);
