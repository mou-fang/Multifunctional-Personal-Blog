// Try base62 decoding (big-integer scheme) of the derived key, plus also try
// using the derived ASCII directly with non-QMC ciphers.
const crypto = require("crypto");

const DER_HEX = "6c6a384e4d7666524e335970426e6b4e4d4e6f41397043384e485a3454376b6147525230506c62325038385043346236463676776245777730306e556a31373835304c303354353255755a4143745773716649396e6f633456316f3951597132554a386432764852585a304748745a326d3933707839346a787a723950614a6d3942384e433537433956344f7473617a3139736c3237564c7565546b4a316e7354325a4b433133706e3670394c4f654c6d4c3830783934665a384938375650483771345950346f4752445577444a63563735686232513934395a6534326464774c63423673736a76476a3936384331394f4530766b55313034475a3861735432683270314b39335255733670415a7530596c7770796850355935683066314a636a774b34583241306c365965313273355a4d485530543534563567433730553234464336646c5472774d505161493951364736615036665a6268455670625a6c524e3256396545317379343637316374733377773048354d4978694b6c4b41316b7648465272455a73723933344562354f746e6834453667626163766a6b5233463951794e7768523052474d4f62695073366c4f4e74316a39653335724a4653316b6c346e7935446b3238634c356e53533563676676714a32427536723256377573506d664e6b786e37674f3967674a3942365a79444f38336b6e6a524b3032";
const FILE_HEAD_HEX = "d6c966cddd4b813c33dfc138988a005672ebc18e98b6e70b383801d1dcc82eccfbf3328edd79004f772a012898aec17d99e941be98bac1798bc6cebcba1a0138";

function hexToBytes(hex) { const o = new Uint8Array(hex.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(hex.substr(i*2,2),16); return o; }
function bytesToHex(b) { let s=""; for(let i=0;i<b.length;i++){const h=b[i].toString(16);s+=(h.length<2?"0":"")+h;} return s; }

const der = hexToBytes(DER_HEX);
const enc = hexToBytes(FILE_HEAD_HEX);
const derStr = Buffer.from(der).toString("ascii");

const MAGICS = ["4f676753", "664c6143", "494433", "667479", "fffb", "fff3"];
function checkMagic(b) {
  const h = bytesToHex(b);
  for (const m of MAGICS) if (h.startsWith(m) || (m === "667479" && h.substr(8, 6) === m)) return m;
  return null;
}

console.log("=== try standard RC4 (256-byte box) with various keys ===\n");

function rc4Decrypt(key, ct) {
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
  }
  const out = new Uint8Array(ct.length);
  let i = 0; j = 0;
  for (let n = 0; n < ct.length; n++) {
    i = (i + 1) & 0xff;
    j = (j + S[i]) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
    out[n] = ct[n] ^ S[(S[i] + S[j]) & 0xff];
  }
  return out;
}

const keysToTry = [
  { name: "der bytes (full 512)", key: der },
  { name: "der bytes [0..16]",    key: der.subarray(0, 16) },
  { name: "der bytes [0..32]",    key: der.subarray(0, 32) },
  { name: "der bytes [0..64]",    key: der.subarray(0, 64) },
  { name: "der bytes [8..]",      key: der.subarray(8) },
  { name: "der bytes [8..40]",    key: der.subarray(8, 40) },
];

// Try base64 decoding (using only A-Za-z0-9+/= alphabet; we know there are no
// '+' or '/' so it's effectively a 62-char input — but standard base64
// decoders treat unrecognised chars as zero or skip them).
const b64dec = Buffer.from(derStr, "base64");
keysToTry.push({ name: "base64(der as ascii) → " + b64dec.length + "b", key: new Uint8Array(b64dec) });

// Try base62 big-integer decode
function base62Decode(s) {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  // Treat as big integer: result_int = sum(alphabet.indexOf(s[i]) * 62^(len-1-i))
  // Use BigInt
  let n = 0n;
  for (const c of s) {
    const v = alphabet.indexOf(c);
    if (v < 0) return null;
    n = n * 62n + BigInt(v);
  }
  // Convert to bytes (big-endian)
  if (n === 0n) return new Uint8Array([0]);
  const hex = n.toString(16);
  const padded = hex.length % 2 ? "0" + hex : hex;
  return hexToBytes(padded);
}
const b62 = base62Decode(derStr);
if (b62) {
  keysToTry.push({ name: "base62(der) → " + b62.length + "b", key: b62 });
  console.log(`base62 of full derived → ${b62.length} bytes, first 32 hex: ${bytesToHex(b62.subarray(0, 32))}`);
}

// Try base62 of body only
const b62body = base62Decode(derStr.substr(8));
if (b62body) {
  keysToTry.push({ name: "base62(der[8..]) → " + b62body.length + "b", key: b62body });
  console.log(`base62 of der[8..]    → ${b62body.length} bytes, first 32 hex: ${bytesToHex(b62body.subarray(0, 32))}`);
}

console.log();

// Test all keys with standard RC4
for (const k of keysToTry) {
  try {
    const dec = rc4Decrypt(k.key, enc);
    const m = checkMagic(dec);
    console.log(`  ${m ? "\x1b[32m✓ " + m + "\x1b[0m" : "·"}  std-RC4  ${k.name.padEnd(40)} dec=${bytesToHex(dec.subarray(0, 16))}`);
  } catch (e) { console.log(`  err  std-RC4 ${k.name}: ${e.message}`); }
}

console.log("\n=== try AES-128 ECB with various 16-byte keys ===\n");
const aesKeys16 = [
  { name: "der ASCII [0..16]", key: der.subarray(0, 16) },
  { name: "der ASCII [16..32]", key: der.subarray(16, 32) },
  { name: "der ASCII [8..24]", key: der.subarray(8, 24) },
];
if (b62) aesKeys16.push({ name: "base62(der)[0..16]", key: b62.subarray(0, 16) });

for (const k of aesKeys16) {
  if (k.key.length !== 16) continue;
  try {
    const cipher = crypto.createDecipheriv("aes-128-ecb", Buffer.from(k.key), null);
    cipher.setAutoPadding(false);
    const dec = Buffer.concat([cipher.update(Buffer.from(enc.subarray(0, 32))), Buffer.from([])]);
    const decBytes = new Uint8Array(dec);
    const m = checkMagic(decBytes);
    console.log(`  ${m ? "\x1b[32m✓ " + m + "\x1b[0m" : "·"}  aes128-ECB  ${k.name.padEnd(28)} dec=${bytesToHex(decBytes.subarray(0, 16))}`);
  } catch (e) { console.log(`  err aes ${k.name}: ${e.message}`); }
}

console.log("\n=== try plain XOR repeating with various keys ===\n");
function xorRepeat(key, ct) { const o = new Uint8Array(ct.length); for (let i = 0; i < ct.length; i++) o[i] = ct[i] ^ key[i % key.length]; return o; }
for (const k of keysToTry) {
  const dec = xorRepeat(k.key, enc);
  const m = checkMagic(dec);
  console.log(`  ${m ? "\x1b[32m✓ " + m + "\x1b[0m" : "·"}  xor      ${k.name.padEnd(40)} dec=${bytesToHex(dec.subarray(0, 16))}`);
}

// Last-resort: scan the full derived key for any 16-byte window that, used as
// AES-128-ECB key, yields a known magic.
console.log("\n=== sliding 16-byte window AES-128-ECB scan ===");
let found = 0;
for (let off = 0; off + 16 <= der.length; off++) {
  const k = Buffer.from(der.subarray(off, off + 16));
  try {
    const c = crypto.createDecipheriv("aes-128-ecb", k, null);
    c.setAutoPadding(false);
    const dec = c.update(Buffer.from(enc.subarray(0, 16)));
    const m = checkMagic(new Uint8Array(dec));
    if (m) { console.log(`  \x1b[32m✓ ${m}\x1b[0m at offset ${off}: dec=${dec.toString("hex")}`); found++; }
  } catch (e) {}
}
if (!found) console.log("  no AES-128-ECB sliding-window match");

// Same but AES-256
console.log("\n=== sliding 32-byte window AES-256-ECB scan ===");
found = 0;
for (let off = 0; off + 32 <= der.length; off++) {
  const k = Buffer.from(der.subarray(off, off + 32));
  try {
    const c = crypto.createDecipheriv("aes-256-ecb", k, null);
    c.setAutoPadding(false);
    const dec = c.update(Buffer.from(enc.subarray(0, 16)));
    const m = checkMagic(new Uint8Array(dec));
    if (m) { console.log(`  \x1b[32m✓ ${m}\x1b[0m at offset ${off}: dec=${dec.toString("hex")}`); found++; }
  } catch (e) {}
}
if (!found) console.log("  no AES-256-ECB sliding-window match");
