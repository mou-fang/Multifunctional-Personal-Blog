// Verify every synthetic test file decrypts back to the original mp3 bytes.
// Uses the actual js/qq-music-decrypt.js so this validates the production
// decryption pipeline (not just the inline-copied cipher logic).
const fs = require("fs");
const path = require("path");

global.atob = (s) => Buffer.from(s, "base64").toString("binary");
global.TextDecoder = require("util").TextDecoder;

const code = fs.readFileSync(path.join(__dirname, "..", "claudeOne", "js", "qq-music-decrypt.js"), "utf8");
const sandbox = {};
new Function("self", code)(sandbox);
const { decrypt } = sandbox.ClaudeOneQQDecrypt;

const SOURCE_MP3 = path.join(__dirname, "..", "claudeOne", "music", "開膛手嚶嚶嚶 - 莓 莓 布 丁 沙 冰.mp3");
const sourceFull = new Uint8Array(fs.readFileSync(SOURCE_MP3));
const expected = sourceFull.subarray(0, Math.min(1500000, sourceFull.length));

const tests = [
  { file: "test_v1_static.tkm",      path_label: "V1-static",  mode: "decrypt-and-match" },
  { file: "test_v1_static.bkcmp3",   path_label: "V1-static",  mode: "decrypt-and-match" },
  { file: "test_v1_static.bkcflac",  path_label: "V1-static",  mode: "decrypt-and-match" },
  { file: "test_v1_keyed.qmc0",      path_label: "V1-keyed",   mode: "decrypt-and-match" },
  { file: "test_v1_keyed.qmc3",      path_label: "V1-keyed",   mode: "decrypt-and-match" },
  { file: "test_qtag.qmcflac",       path_label: "QTag",       mode: "decrypt-and-match" },
  { file: "test_qtag.qmcogg",        path_label: "QTag",       mode: "decrypt-and-match" },
  { file: "test_stag.qmc2",          path_label: "STag",       mode: "decrypt-and-match" },
  { file: "test_legacy.mflac",       path_label: "legacy QTag",mode: "decrypt-and-match" },
  { file: "test_legacy.mgg",         path_label: "legacy QTag",mode: "decrypt-and-match" },
  { file: "test_musicex.mgg",        path_label: "musicex",    mode: "needs-cookie" },
];

let pass = 0, fail = 0;
for (const t of tests) {
  const full = path.join(__dirname, t.file);
  const buf = fs.readFileSync(full);
  const arr = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  let result, err = "";
  try { result = decrypt(arr); } catch (e) { err = e.message; }

  if (t.mode === "needs-cookie") {
    // Synthetic musicex file: parseFileTail must accept it, then decrypt() must
    // throw the actionable "needs Cookie / EKey" error (no external EKey provided).
    const parsedOk = sandbox.ClaudeOneQQDecrypt.parseFileTail(arr);
    const goodTail = parsedOk && parsedOk.format === "musicex" && parsedOk.songMid && parsedOk.filename;
    const expectedErr = err && /Cookie|EKey/.test(err);
    if (goodTail && expectedErr) {
      pass++;
      console.log(`  ok    ${t.file.padEnd(28)} [${t.path_label}]  songMid=${parsedOk.songMid}, filename=${parsedOk.filename}`);
      console.log(`        decrypt-without-ekey error: "${err}"`);
    } else {
      fail++;
      console.log(`  FAIL  ${t.file.padEnd(28)} [${t.path_label}]  goodTail=${!!goodTail} errorOK=${!!expectedErr} err="${err}"`);
    }
    continue;
  }

  // decrypt-and-match: must produce mp3 bytes identical to the source.
  if (!result) {
    console.log(`  FAIL  ${t.file.padEnd(28)} [${t.path_label}]  → ${err}`);
    fail++;
    continue;
  }
  const got = new Uint8Array(result.audio);
  let identical = got.length === expected.length;
  for (let i = 0; identical && i < expected.length; i++) if (got[i] !== expected[i]) identical = false;
  const extOk = result.ext === ".mp3";
  const coverOk = result.picture && result.picture.byteLength > 0;
  if (identical && extOk && coverOk) {
    pass++;
    console.log(`  ok    ${t.file.padEnd(28)} [${t.path_label}]  ${got.length}b mp3  cover=${result.picture.byteLength}b ${result.pictureMime}`);
  } else {
    fail++;
    console.log(`  FAIL  ${t.file.padEnd(28)} [${t.path_label}]  identical=${identical} ext=${result.ext} cover=${coverOk}`);
  }
}

console.log(`\n${pass}/${tests.length} test files passed`);
process.exit(fail ? 1 : 0);
