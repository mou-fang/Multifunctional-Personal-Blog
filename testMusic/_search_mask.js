// Search for the expected XOR mask bytes within ANY transformation of the
// keys.  If we find them, we know what shape the cipher key takes; from
// there we can work out the algorithm.
const RAW_HEX = "6c6a384e4d766652d9d2d4205da5bc4f87a6cfa880187613e7eecf6570b4d3d9a15fdbc9973df6794472d040dee3f4df0d0649c03c818fcc0918ec725e93d5c5aff751062c4ef358ec4abc2ebc20df1adddb27641a9af911cca1c80ba4e8ecfb2d313f6530e03c695b9eda2560d81f7cf3cdaa511a997ff6e090f38c22399a73742f17df0011cdffb3258003baa7d17e0f906e5c9cdd033f23af8f51d90a2cce7b250487098df9f3204e0a45ce7f42bc5b2738318a3da4fbcd3c02326b18286a95678db47576119f81e5d5a7972f6d94dbb96269372b850034a373d8b491c48594506198e01dcd5c47bcd39f572ffc9f441ea365907ea2d36d7de8290a79ac76113721d118b0a6ca982e0ffdd47909e3b0df519d65fd93028ea0f301df768d571d7f191a1ff157767dea6ad792997fcfa6220d9114a38b26b1db3e1d0097f0be647825c26f178b00b5206cf1e63499356e8ce67c1ba6b606977f5fe9500e17b5b376508732cfd7cc420e9f3405b565e70f837286dfb4fb75763d77ad97d3f7047849821a21802d0b3ab9529ee158b09fbb2ead4b307f5332f4163037ff2bb19cbe4112d6715779e6eba9e1aa5f6bd4f7cc41a197df64830deabf8b109cc0459f96f3b4ef4cc3241cb4635106eb932810fb1052766d2cc148eaa4bfb133c4d7bd366c68bfb195d6197c8d6bd7d5050c7ac5731bd0720bc09c5c9909b2c3d45173e8a635fc47b9d758f6658f0dec36fad7";
const DER_HEX = "6c6a384e4d7666524e335970426e6b4e4d4e6f41397043384e485a3454376b6147525230506c62325038385043346236463676776245777730306e556a31373835304c303354353255755a4143745773716649396e6f633456316f3951597132554a386432764852585a304748745a326d3933707839346a787a723950614a6d3942384e433537433956344f7473617a3139736c3237564c7565546b4a316e7354325a4b433133706e3670394c4f654c6d4c3830783934665a384938375650483771345950346f4752445577444a63563735686232513934395a6534326464774c63423673736a76476a3936384331394f4530766b55313034475a3861735432683270314b39335255733670415a7530596c7770796850355935683066314a636a774b34583241306c365965313273355a4d485530543534563567433730553234464336646c5472774d505161493951364736615036665a6268455670625a6c524e3256396545317379343637316374733377773048354d4978694b6c4b41316b7648465272455a73723933344562354f746e6834453667626163766a6b5233463951794e7768523052474d4f62695073366c4f4e74316a39653335724a4653316b6c346e7935446b3238634c356e53533563676676714a32427536723256377573506d664e6b786e37674f3967674a3942365a79444f38336b6e6a524b3032";
const FILE_HEAD_HEX = "d6c966cddd4b813c33dfc138988a005672ebc18e98b6e70b383801d1dcc82eccfbf3328edd79004f772a012898aec17d99e941be98bac1798bc6cebcba1a0138";

function hexToBytes(h) { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i*2,2),16); return o; }
function bytesToHex(b) { let s = ""; for (let i = 0; i < b.length; i++) { const h = b[i].toString(16); s += (h.length < 2 ? "0" : "") + h; } return s; }

const der = hexToBytes(DER_HEX);
const raw = hexToBytes(RAW_HEX);
const enc = hexToBytes(FILE_HEAD_HEX);

// Mask we want: enc XOR plaintext where plaintext is each common audio header.
const targets = [
  { name: "OggS+v0+t2 (BoS)", plain: [0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00] },
  { name: "OggS+v0+t0",      plain: [0x4f, 0x67, 0x67, 0x53, 0x00, 0x00, 0x00, 0x00] },
  { name: "fLaC streaminfo", plain: [0x66, 0x4c, 0x61, 0x43, 0x00, 0x00, 0x00, 0x22] },
  { name: "ID3v2.3 tag",     plain: [0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00] },
  { name: "ID3v2.4 tag",     plain: [0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00] },
];

const targetMasks = targets.map(t => ({
  name: t.name,
  mask: t.plain.map((p, i) => enc[i] ^ p),
}));

console.log("possible masks at file offset 0 (8 bytes):");
for (const t of targetMasks) {
  console.log(`  ${t.name.padEnd(20)} → ${bytesToHex(new Uint8Array(t.mask))}`);
}
console.log();

// Search: does any of these masks appear as a contiguous 4-byte (or 8-byte)
// subsequence inside any transformation of the key material?
function searchIn(buf, name, lookFor4, lookFor8) {
  const b = bytesToHex(buf);
  const found4 = b.indexOf(lookFor4);
  const found8 = b.indexOf(lookFor8);
  if (found4 >= 0 || found8 >= 0) {
    console.log(`  ${name}: found4 byte=${found4 >= 0 ? found4/2 : "no"}  found8 byte=${found8 >= 0 ? found8/2 : "no"}  (len=${buf.length})`);
  }
}

// All transformations of key data
const transforms = [
  { name: "raw bytes",                              data: raw },
  { name: "der bytes",                              data: der },
  { name: "raw[8..]",                               data: raw.subarray(8) },
  { name: "der[8..]",                               data: der.subarray(8) },
];

// Add base64 transforms
const derStr = Buffer.from(der).toString("ascii");
transforms.push({ name: "base64(der as ascii)", data: new Uint8Array(Buffer.from(derStr, "base64")) });
transforms.push({ name: "base64(der[8..])",    data: new Uint8Array(Buffer.from(derStr.substr(8), "base64")) });

// base62 (big int) of der
function base62Decode(s) {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let n = 0n;
  for (const c of s) { const v = alphabet.indexOf(c); if (v < 0) return null; n = n * 62n + BigInt(v); }
  if (n === 0n) return new Uint8Array([0]);
  const hex = n.toString(16);
  return hexToBytes(hex.length % 2 ? "0" + hex : hex);
}
const b62 = base62Decode(derStr);
if (b62) transforms.push({ name: "base62(der)",      data: b62 });
const b62body = base62Decode(derStr.substr(8));
if (b62body) transforms.push({ name: "base62(der[8..])", data: b62body });

console.log("\nsearch for each mask in each key transform:");
for (const t of targetMasks) {
  const m = bytesToHex(new Uint8Array(t.mask));
  console.log(`\n[${t.name}] mask=${m}`);
  for (const tr of transforms) searchIn(tr.data, "  " + tr.name.padEnd(28), m.substr(0, 8), m);
}

// Also: maybe there is a SINGLE byte mask repeating?  (Static cipher).
console.log("\nXOR(enc[i], static_byte) for each i... unlikely but cheap to check");
for (let s = 0; s < 256; s++) {
  if (enc.length < 8) continue;
  const dec = enc.slice(0, 8).map(b => b ^ s);
  if (dec[0] === 0x4f && dec[1] === 0x67 && dec[2] === 0x67 && dec[3] === 0x53) {
    console.log(`  ✓ single byte ${s.toString(16)} produces OggS prefix? dec=${bytesToHex(new Uint8Array(dec))}`);
  }
}

// Try XOR enc with derived_ASCII at every offset
console.log("\ntrying XOR enc with derived ASCII at every alignment 0..511:");
for (let off = 0; off + 4 <= der.length; off++) {
  const m = [enc[0] ^ der[off], enc[1] ^ der[off+1], enc[2] ^ der[off+2], enc[3] ^ der[off+3]];
  if (m[0] === 0x4f && m[1] === 0x67 && m[2] === 0x67 && m[3] === 0x53) {
    console.log(`  ✓ XOR enc[0..3] with der[${off}..${off+4}] = OggS!`);
  }
  if (m[0] === 0x66 && m[1] === 0x4c && m[2] === 0x61 && m[3] === 0x43) {
    console.log(`  ✓ XOR enc[0..3] with der[${off}..${off+4}] = fLaC!`);
  }
  if (m[0] === 0x49 && m[1] === 0x44 && m[2] === 0x33) {
    console.log(`  ✓ XOR enc[0..3] with der[${off}..${off+4}] = ID3!`);
  }
}

// Same for base64-decoded forms
const b64der = new Uint8Array(Buffer.from(derStr, "base64"));
console.log(`\ntrying XOR enc with base64(der) (${b64der.length}b) at every alignment 0..${b64der.length - 4}:`);
for (let off = 0; off + 4 <= b64der.length; off++) {
  const m = [enc[0] ^ b64der[off], enc[1] ^ b64der[off+1], enc[2] ^ b64der[off+2], enc[3] ^ b64der[off+3]];
  if (m[0] === 0x4f && m[1] === 0x67 && m[2] === 0x67 && m[3] === 0x53) {
    console.log(`  ✓ XOR enc[0..3] with base64(der)[${off}..${off+4}] = OggS!`);
  }
  if (m[0] === 0x66 && m[1] === 0x4c && m[2] === 0x61 && m[3] === 0x43) {
    console.log(`  ✓ XOR enc[0..3] with base64(der)[${off}..${off+4}] = fLaC!`);
  }
  if (m[0] === 0x49 && m[1] === 0x44 && m[2] === 0x33) {
    console.log(`  ✓ XOR enc[0..3] with base64(der)[${off}..${off+4}] = ID3!`);
  }
}

// And raw key
console.log(`\ntrying XOR enc with rawKey (${raw.length}b) at every alignment:`);
for (let off = 0; off + 4 <= raw.length; off++) {
  const m = [enc[0] ^ raw[off], enc[1] ^ raw[off+1], enc[2] ^ raw[off+2], enc[3] ^ raw[off+3]];
  if (m[0] === 0x4f && m[1] === 0x67 && m[2] === 0x67 && m[3] === 0x53) {
    console.log(`  ✓ XOR enc[0..3] with raw[${off}..${off+4}] = OggS!`);
  }
  if (m[0] === 0x66 && m[1] === 0x4c && m[2] === 0x61 && m[3] === 0x43) {
    console.log(`  ✓ XOR enc[0..3] with raw[${off}..${off+4}] = fLaC!`);
  }
}

if (b62) {
  console.log(`\ntrying XOR enc with base62(der) (${b62.length}b) at every alignment:`);
  for (let off = 0; off + 4 <= b62.length; off++) {
    const m = [enc[0] ^ b62[off], enc[1] ^ b62[off+1], enc[2] ^ b62[off+2], enc[3] ^ b62[off+3]];
    if (m[0] === 0x4f && m[1] === 0x67 && m[2] === 0x67 && m[3] === 0x53) {
      console.log(`  ✓ XOR enc[0..3] with base62(der)[${off}..${off+4}] = OggS!`);
    }
    if (m[0] === 0x66 && m[1] === 0x4c && m[2] === 0x61 && m[3] === 0x43) {
      console.log(`  ✓ XOR enc[0..3] with base62(der)[${off}..${off+4}] = fLaC!`);
    }
  }
}

console.log("\nDone — if nothing printed, the cipher mask isn't a direct slice of any key form.");
