// Look hard at the derived key bytes for any structure.

const fs = require("fs");
const path = require("path");

const DER_HEX = "6c6a384e4d7666524e335970426e6b4e4d4e6f41397043384e485a3454376b6147525230506c62325038385043346236463676776245777730306e556a31373835304c303354353255755a4143745773716649396e6f633456316f3951597132554a386432764852585a304748745a326d3933707839346a787a723950614a6d3942384e433537433956344f7473617a3139736c3237564c7565546b4a316e7354325a4b433133706e3670394c4f654c6d4c3830783934665a384938375650483771345950346f4752445577444a63563735686232513934395a6534326464774c63423673736a76476a3936384331394f4530766b55313034475a3861735432683270314b39335255733670415a7530596c7770796850355935683066314a636a774b34583241306c365965313273355a4d485530543534563567433730553234464336646c5472774d505161493951364736615036665a6268455670625a6c524e3256396545317379343637316374733377773048354d4978694b6c4b41316b7648465272455a73723933344562354f746e6834453667626163766a6b5233463951794e7768523052474d4f62695073366c4f4e74316a39653335724a4653316b6c346e7935446b3238634c356e53533563676676714a32427536723256377573506d664e6b786e37674f3967674a3942365a79444f38336b6e6a524b3032";

function hexToBytes(hex) {
  const o = new Uint8Array(hex.length / 2);
  for (let i = 0; i < o.length; i++) o[i] = parseInt(hex.substr(i * 2, 2), 16);
  return o;
}

const der = hexToBytes(DER_HEX);
console.log("derived length:", der.length);

// Decode as ASCII and inspect.
let s = "";
let nonAscii = 0;
let nonB64 = 0;
const b64set = new Set([..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="].map(c => c.charCodeAt(0)));
for (let i = 0; i < der.length; i++) {
  const c = der[i];
  if (c < 0x20 || c > 0x7e) nonAscii++;
  else if (!b64set.has(c)) nonB64++;
  s += (c >= 0x20 && c <= 0x7e) ? String.fromCharCode(c) : ".";
}
console.log(`non-ASCII bytes in derived: ${nonAscii}`);
console.log(`ASCII-but-not-base64 bytes: ${nonB64}`);
console.log(`derived as ASCII (full):\n${s}\n`);

// What's the byte distribution?  Are we sure it's all base64 alphabet?
const charSet = new Set(s.split(""));
console.log(`unique chars: ${charSet.size}`);
console.log(`all chars: ${[...charSet].sort().join("")}`);

// Count occurrences of each char
const counts = {};
for (const c of s) counts[c] = (counts[c] || 0) + 1;
const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
console.log("top 10 chars:", sorted.slice(0, 10));

// Try decoding with `base64-decode` ONLY part of the string at a time;
// is it valid base64 in chunks?
const fullStr = s;
console.log(`\ntry base64-decode of full string (length ${fullStr.length}):`);
try {
  const dec = Buffer.from(fullStr, "base64");
  console.log(`  decoded ${dec.length} bytes, first 16 hex: ${dec.slice(0, 16).toString("hex")}`);
} catch (e) {
  console.log(`  error: ${e.message}`);
}

// Chunked base64? E.g. is the body separated by the IV "lj8NMvfR" repeating?
const ivStr = fullStr.substr(0, 8);
const occurrences = [];
let pos = -1;
while (true) {
  pos = fullStr.indexOf(ivStr, pos + 1);
  if (pos < 0) break;
  occurrences.push(pos);
}
console.log(`\nIV string "${ivStr}" appears at positions: ${occurrences.join(", ")}`);

// Look at periodic structure
// Is the body (offset 8..end) some ASCII stream that decodes nicely with periodic length?
for (const len of [256, 504, 512, 384, 320]) {
  if (fullStr.length >= len) {
    const chunk = fullStr.substring(0, len);
    try {
      const dec = Buffer.from(chunk, "base64");
      console.log(`\nfirst ${len} chars decoded → ${dec.length} bytes, first 32 hex: ${dec.slice(0, 32).toString("hex")}`);
    } catch (e) {}
  }
}
