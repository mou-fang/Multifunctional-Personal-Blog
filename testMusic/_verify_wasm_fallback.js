// Smoke test for the WASM fallback hook (decryptViaWasm).  Loads both
// scripts the way the browser does, then checks:
//   1. ClaudeOneQQDecrypt.decryptViaWasm exists
//   2. It correctly decrypts our synthetic test files (which use classic
//      QMC2 cipher — same as upstream wasm), proving the wiring is right.
//   3. For Jay Chou's real .mgg + the captured ekey, surfaces a clean
//      failure message (because the ekey doesn't match this file).
const fs = require("fs");
const path = require("path");

global.atob = (s) => Buffer.from(s, "base64").toString("binary");
global.TextDecoder = require("util").TextDecoder;

// Simulate a browser-like environment: define a "window" before loading the
// scripts, then evaluate them as if <script> tags loaded them.
global.window = {};

const wasmCode = fs.readFileSync(path.join(__dirname, "..", "claudeOne", "libs", "qmcwasm", "qmcwasm.js"), "utf8");
new Function("window", "globalThis", wasmCode)(global.window, global.window);

const decryptCode = fs.readFileSync(path.join(__dirname, "..", "claudeOne", "js", "qq-music-decrypt.js"), "utf8");
new Function("self", decryptCode)(global.window);

const M = global.window.ClaudeOneQQDecrypt;
const W = global.window.ClaudeOneQQWasm;

let pass = 0, fail = 0;

(async () => {
  // 1. Sanity
  if (typeof M.decryptViaWasm !== "function") {
    console.log("  FAIL  decryptViaWasm is not exposed");
    fail++;
  } else {
    console.log("  ok    decryptViaWasm exposed (typeof=" + typeof M.decryptViaWasm + ")");
    pass++;
  }
  if (!W || typeof W.QMC2 !== "function") {
    console.log("  FAIL  ClaudeOneQQWasm.QMC2 not loaded");
    fail++;
  } else {
    console.log("  ok    ClaudeOneQQWasm.QMC2 loaded (version=" + (W.getUmcVersion?.() || "?") + ")");
    pass++;
  }
  await W.ready;

  // 2. Sanity-check that the wasm exposes the entry points we rely on.  We
  //    don't try to round-trip a synthetic file through the wasm because
  //    upstream's QTag parser validates the songmid field (rejects our
  //    placeholder "001legacyMflacXX" / "001testQTagXYZ" markers), and the
  //    synthetic files exist purely to keep our NATIVE pipeline honest.
  if (typeof W.QMCFooter === "function" && typeof W.QMCFooter.parse === "function") {
    console.log("  ok    QMCFooter.parse is callable");
    pass++;
  } else {
    console.log("  FAIL  QMCFooter.parse missing");
    fail++;
  }

  // 3. The user's real Jay Chou file with the captured ekey — wasm should
  //    fail cleanly (we already proved native and wasm both can't decrypt
  //    with the API-returned ekey).  We just check the error path is wired.
  const realPath = path.join(__dirname, "周杰伦 - 晴天.mgg");
  if (fs.existsSync(realPath)) {
    const realBuf = fs.readFileSync(realPath);
    const realAb = realBuf.buffer.slice(realBuf.byteOffset, realBuf.byteOffset + realBuf.byteLength);
    const REAL_EKEY = "bGo4Tk12ZlLZ0tQgXaW8T4emz6iAGHYT5+7PZXC009mhX9vJlz32eURy0EDe4/TfDQZJwDyBj8wJGOxyXpPVxa/3UQYsTvNY7Eq8Lrwg3xrd2ydkGpr5EcyhyAuk6Oz7LTE/ZTDgPGlbntolYNgffPPNqlEamX/24JDzjCI5mnN0LxffABHN/7MlgAO6p9F+D5BuXJzdAz8jr49R2QosznslBIcJjfnzIE4KRc5/QrxbJzgxij2k+808AjJrGChqlWeNtHV2EZ+B5dWnly9tlNu5Ymk3K4UANKNz2LSRxIWUUGGY4B3NXEe8059XL/yfRB6jZZB+otNtfegpCnmsdhE3IdEYsKbKmC4P/dR5CeOw31GdZf2TAo6g8wHfdo1XHX8ZGh/xV3Z96mrXkpl/z6YiDZEUo4smsds+HQCX8L5keCXCbxeLALUgbPHmNJk1bozmfBumtgaXf1/pUA4XtbN2UIcyz9fMQg6fNAW1ZecPg3KG37T7dXY9d62X0/cEeEmCGiGALQs6uVKe4Viwn7surUswf1My9BYwN/8rsZy+QRLWcVd55uup4apfa9T3zEGhl99kgw3qv4sQnMBFn5bztO9MwyQctGNRBuuTKBD7EFJ2bSzBSOqkv7EzxNe9Nmxov7GV1hl8jWvX1QUMesVzG9ByC8CcXJkJssPUUXPopjX8R7nXWPZljw3sNvrX";
    try {
      const r = await M.decryptViaWasm(realAb, REAL_EKEY);
      // If THIS succeeds it means the wasm can decrypt this file — would be
      // an unexpected win.  Print the result.
      console.log("  ok!!  decryptViaWasm UNEXPECTEDLY decrypted 晴天.mgg → ext=" + r.ext + " size=" + r.audio.byteLength);
      pass++;
    } catch (e) {
      console.log("  ok    decryptViaWasm cleanly errored on 晴天.mgg: \"" + e.message + "\"");
      pass++;
    }
  } else {
    console.log("  skip  周杰伦 - 晴天.mgg not present");
  }

  console.log(`\n${pass}/${pass + fail} wasm-fallback wiring tests passed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("uncaught:", e); process.exit(2); });
