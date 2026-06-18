// Final brute force: every transform of the key × every cipher we know,
// using QQ Music's QMC2 ciphers (Map / RC4) which are the algorithms used
// for musicex files in libparakeet/unlock-music.
const fs = require("fs"); const path = require("path");

const RAW_HEX = "6c6a384e4d766652d9d2d4205da5bc4f87a6cfa880187613e7eecf6570b4d3d9a15fdbc9973df6794472d040dee3f4df0d0649c03c818fcc0918ec725e93d5c5aff751062c4ef358ec4abc2ebc20df1adddb27641a9af911cca1c80ba4e8ecfb2d313f6530e03c695b9eda2560d81f7cf3cdaa511a997ff6e090f38c22399a73742f17df0011cdffb3258003baa7d17e0f906e5c9cdd033f23af8f51d90a2cce7b250487098df9f3204e0a45ce7f42bc5b2738318a3da4fbcd3c02326b18286a95678db47576119f81e5d5a7972f6d94dbb96269372b850034a373d8b491c48594506198e01dcd5c47bcd39f572ffc9f441ea365907ea2d36d7de8290a79ac76113721d118b0a6ca982e0ffdd47909e3b0df519d65fd93028ea0f301df768d571d7f191a1ff157767dea6ad792997fcfa6220d9114a38b26b1db3e1d0097f0be647825c26f178b00b5206cf1e63499356e8ce67c1ba6b606977f5fe9500e17b5b376508732cfd7cc420e9f3405b565e70f837286dfb4fb75763d77ad97d3f7047849821a21802d0b3ab9529ee158b09fbb2ead4b307f5332f4163037ff2bb19cbe4112d6715779e6eba9e1aa5f6bd4f7cc41a197df64830deabf8b109cc0459f96f3b4ef4cc3241cb4635106eb932810fb1052766d2cc148eaa4bfb133c4d7bd366c68bfb195d6197c8d6bd7d5050c7ac5731bd0720bc09c5c9909b2c3d45173e8a635fc47b9d758f6658f0dec36fad7";
const DER_HEX = "6c6a384e4d7666524e335970426e6b4e4d4e6f41397043384e485a3454376b6147525230506c62325038385043346236463676776245777730306e556a31373835304c303354353255755a4143745773716649396e6f633456316f3951597132554a386432764852585a304748745a326d3933707839346a787a723950614a6d3942384e433537433956344f7473617a3139736c3237564c7565546b4a316e7354325a4b433133706e3670394c4f654c6d4c3830783934665a384938375650483771345950346f4752445577444a63563735686232513934395a6534326464774c63423673736a76476a3936384331394f4530766b55313034475a3861735432683270314b39335255733670415a7530596c7770796850355935683066314a636a774b34583241306c365965313273355a4d485530543534563567433730553234464336646c5472774d505161493951364736615036665a6268455670625a6c524e3256396545317379343637316374733377773048354d4978694b6c4b41316b7648465272455a73723933344562354f746e6834453667626163766a6b5233463951794e7768523052474d4f62695073366c4f4e74316a39653335724a4653316b6c346e7935446b3238634c356e53533563676676714a32427536723256377573506d664e6b786e37674f3967674a3942365a79444f38336b6e6a524b3032";
const FILE_HEAD_HEX = "d6c966cddd4b813c33dfc138988a005672ebc18e98b6e70b383801d1dcc82eccfbf3328edd79004f772a012898aec17d99e941be98bac1798bc6cebcba1a0138";

function hexToBytes(h) { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i*2,2),16); return o; }
function bytesToHex(b) { let s=""; for(let i=0;i<b.length;i++){const h=b[i].toString(16);s+=(h.length<2?"0":"")+h;} return s; }

const der = hexToBytes(DER_HEX);
const raw = hexToBytes(RAW_HEX);
const enc = hexToBytes(FILE_HEAD_HEX);

global.atob = (s) => Buffer.from(s, "base64").toString("binary");
global.TextDecoder = require("util").TextDecoder;
const code = fs.readFileSync(path.join(__dirname, "..", "claudeOne", "js", "qq-music-decrypt.js"), "utf8");
const sandbox = {};
new Function("self", code)(sandbox);

// Build ALL key transforms.
const transforms = [];
function addKey(name, key) { if (key && key.length >= 16) transforms.push({ name, key }); }

addKey("raw 528b",       raw);
addKey("raw[8..] 520b",  raw.subarray(8));
addKey("der 512b",       der);
addKey("der[8..] 504b",  der.subarray(8));

const derStr = Buffer.from(der).toString("ascii");

// base64 decoded forms
addKey("b64(der) 384b",      new Uint8Array(Buffer.from(derStr, "base64")));
addKey("b64(der[8..]) 378b", new Uint8Array(Buffer.from(derStr.substr(8), "base64")));

// base62 decoded forms (big int)
function base62(s) {
  const a = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let n = 0n;
  for (const c of s) { const v = a.indexOf(c); if (v < 0) return null; n = n * 62n + BigInt(v); }
  if (n === 0n) return new Uint8Array([0]);
  const hex = n.toString(16);
  return hexToBytes(hex.length % 2 ? "0" + hex : hex);
}
const b62full = base62(derStr);
const b62body = base62(derStr.substr(8));
if (b62full) addKey("base62(der) " + b62full.length + "b",        b62full);
if (b62body) addKey("base62(der[8..]) " + b62body.length + "b",   b62body);

// urlsafe base64 (treat alphabet differently — but ours has no - or _ so same as base64)
// hex of der as ascii (since der is alphanumeric ASCII, hex would be 1024 hex chars = 512 bytes — same as der itself)

// Custom: deriveKey applied AGAIN to the derived bytes
// Need to expose deriveKey from sandbox. Easier: re-implement here.
function readU32BE(b,o){return ((b[o]<<24)|(b[o+1]<<16)|(b[o+2]<<8)|b[o+3])>>>0;}
function writeU32BE(b,o,v){b[o]=(v>>>24)&0xff;b[o+1]=(v>>>16)&0xff;b[o+2]=(v>>>8)&0xff;b[o+3]=v&0xff;}
function teaDecBlock(blk,k){let v0=readU32BE(blk,0),v1=readU32BE(blk,4);const k0=readU32BE(k,0),k1=readU32BE(k,4),k2=readU32BE(k,8),k3=readU32BE(k,12);const d=0x9e3779b9;let t=(d*16)>>>0;for(let i=0;i<16;i++){const m1=(((v0<<4)+k2)^(v0+t)^((v0>>>5)+k3))>>>0;v1=(v1-m1)>>>0;const m0=(((v1<<4)+k0)^(v1+t)^((v1>>>5)+k1))>>>0;v0=(v0-m0)>>>0;t=(t-d)>>>0;}const o=new Uint8Array(8);writeU32BE(o,0,v0);writeU32BE(o,4,v1);return o;}
function teaDec(input,key){if(key.length!==16||input.length<16||input.length%8!==0)return null;let dest=teaDecBlock(input.subarray(0,8),key);const pad=dest[0]&7;const olen=input.length-pad-10;if(olen<=0)return null;const out=new Uint8Array(olen);let ivp=new Uint8Array(8);let ivc=input.subarray(0,8);let ip=8;let di=1+pad;function nx(){if(ip+8>input.length)return false;ivp=ivc;ivc=input.subarray(ip,ip+8);const m=new Uint8Array(8);for(let j=0;j<8;j++)m[j]=dest[j]^input[ip+j];dest=teaDecBlock(m,key);ip+=8;di=0;return true;}for(let s=0;s<2;){if(di<8){di++;s++;}else if(!nx())return null;}for(let op=0;op<olen;){if(di<8){out[op]=dest[di]^ivp[di];op++;di++;}else if(!nx())return null;}return out;}
function deriveKey(rk){if(rk.length<24||(rk.length-8)%8!==0)return null;const sk=new Uint8Array(8);for(let i=0;i<8;i++)sk[i]=Math.trunc(Math.abs(Math.tan(106+i*0.1))*100)&0xff;const tk=new Uint8Array(16);for(let i=0;i<8;i++){tk[i*2]=sk[i];tk[i*2+1]=rk[i];}const r=teaDec(rk.subarray(8),tk);if(!r)return null;const o=new Uint8Array(8+r.length);o.set(rk.subarray(0,8),0);o.set(r,8);return o;}

// deriveKey(deriveKey(rawKey)) — apply twice
{
  const d1 = deriveKey(raw);
  if (d1) {
    const d2 = deriveKey(d1);
    if (d2) addKey("deriveKey^2(raw) " + d2.length + "b", d2);
  }
}

// deriveKey(b64(der))
{
  const b = new Uint8Array(Buffer.from(derStr, "base64"));
  const d = deriveKey(b);
  if (d) addKey("deriveKey(b64(der)) " + d.length + "b", d);
}

// deriveKey(b62(der))
if (b62full) {
  const d = deriveKey(b62full);
  if (d) addKey("deriveKey(b62(der)) " + d.length + "b", d);
}

console.log(`Built ${transforms.length} key transforms`);

// Cipher implementations to try
const RC4_SEG = 5120, RC4_FIRST = 128;

function qmcRC4(key, ct, off = 0) {
  const N = key.length;
  const box = new Array(N); for (let i = 0; i < N; i++) box[i] = i & 0xff;
  let j = 0;
  for (let k = 0; k < N; k++) { j = (j + box[k] + key[k]) % N; const t = box[k]; box[k] = box[j]; box[j] = t; }
  let h = 1; for (let i = 0; i < N; i++) { const v = key[i]; if (!v) continue; const n = Math.imul(h, v) >>> 0; if (!n || n <= h) break; h = n; }
  const segSkip = (id) => { const s = key[id % N]; if (!s) return 0; return Math.trunc((h / ((id + 1) * s)) * 100) % N; };
  const out = new Uint8Array(ct);
  let r = out.length, p = 0, s = off;
  if (s < RC4_FIRST) {
    const blk = Math.min(r, RC4_FIRST - s);
    for (let i = 0; i < blk; i++) out[p+i] ^= key[segSkip(s+i)];
    p += blk; s += blk; r -= blk;
  }
  function seg(p2, len, s2) {
    const b = box.slice(); let j2=0,k2=0;
    const sk = (s2 % RC4_SEG) + segSkip(Math.trunc(s2 / RC4_SEG));
    for (let i = -sk; i < len; i++) {
      j2 = (j2+1)%N; k2 = (b[j2]+k2)%N;
      const t = b[j2]; b[j2] = b[k2]; b[k2] = t;
      if (i >= 0) out[p2+i] ^= b[(b[j2]+b[k2])%N];
    }
  }
  if (r > 0 && s % RC4_SEG !== 0) {
    const blk = Math.min(r, RC4_SEG - (s % RC4_SEG));
    seg(p, blk, s); p+=blk; s+=blk; r-=blk;
  }
  while (r > RC4_SEG) { seg(p, RC4_SEG, s); p+=RC4_SEG; s+=RC4_SEG; r-=RC4_SEG; }
  if (r > 0) seg(p, r, s);
  return out;
}

function qmcMap(key, ct, off = 0) {
  const out = new Uint8Array(ct);
  for (let i = 0; i < ct.length; i++) {
    let n = off + i; if (n > 0x7fff) n = n % 0x7fff;
    const idx = (n * n + 71214) % key.length;
    const sh = ((idx & 7) + 4) % 8;
    const v = key[idx];
    out[i] ^= ((v << sh) | (v >>> sh)) & 0xff;
  }
  return out;
}

// Standard RC4
function stdRC4(key, ct) {
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) { j = (j + S[i] + key[i % key.length]) & 0xff; [S[i], S[j]] = [S[j], S[i]]; }
  const out = new Uint8Array(ct.length);
  let i = 0; j = 0;
  for (let n = 0; n < ct.length; n++) {
    i = (i+1) & 0xff; j = (j+S[i]) & 0xff; [S[i], S[j]] = [S[j], S[i]];
    out[n] = ct[n] ^ S[(S[i]+S[j]) & 0xff];
  }
  return out;
}

// XOR repeating
function xorRepeat(key, ct) { const o = new Uint8Array(ct.length); for (let i = 0; i < ct.length; i++) o[i] = ct[i] ^ key[i % key.length]; return o; }

const ciphers = [
  { name: "QMC-RC4", fn: qmcRC4 },
  { name: "QMC-Map", fn: qmcMap },
  { name: "std-RC4", fn: stdRC4 },
  { name: "xor",     fn: xorRepeat },
];

const MAGICS = [
  ["OggS", [0x4f, 0x67, 0x67, 0x53]],
  ["fLaC", [0x66, 0x4c, 0x61, 0x43]],
  ["ID3",  [0x49, 0x44, 0x33]],
];

function checkMagic(b) {
  for (const [n, m] of MAGICS) {
    let ok = true; for (let i = 0; i < m.length; i++) if (b[i] !== m[i]) { ok = false; break; }
    if (ok) return n;
  }
  // ftyp at offset 4 for m4a
  if (b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return "ftyp";
  return null;
}

console.log("\n# brute force: every key × every cipher\n");
let hits = 0;
for (const t of transforms) {
  for (const c of ciphers) {
    let dec;
    try { dec = c.fn(t.key, enc, 0); } catch (e) { continue; }
    const m = checkMagic(dec);
    if (m) {
      console.log(`  \x1b[32m✓ ${m}\x1b[0m  ${c.name.padEnd(8)} ${t.name.padEnd(35)} dec=${bytesToHex(dec.subarray(0, 16))}`);
      hits++;
    }
  }
}
if (!hits) {
  console.log("  no hits with offset=0");
  console.log("\n# also try at QMC-RC4 stream offsets 16, 32, 64, 128, 256:");
  for (const t of transforms) {
    for (const off of [16, 32, 64, 128, 256]) {
      const dec = qmcRC4(t.key, enc, off);
      const m = checkMagic(dec);
      if (m) {
        console.log(`  \x1b[32m✓ ${m}\x1b[0m  QMC-RC4@${off}  ${t.name}  dec=${bytesToHex(dec.subarray(0, 16))}`);
        hits++;
      }
    }
  }
}

console.log(`\n${hits} match(es) out of ${transforms.length * ciphers.length} combinations`);
