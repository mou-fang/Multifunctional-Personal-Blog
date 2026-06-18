// Validate the unlock-music wasm against the user's actual encrypted file +
// the EKey we already captured.  If this prints "OggS" / "fLaC" / "ID3" at
// the start of decrypted bytes, we know the wasm is the right tool.
const fs = require("fs");
const path = require("path");

const M = require("../claudeOne/server/package/dist/loader-inline.js");

const FILE = path.join(__dirname, "周杰伦 - 晴天.mgg");
const EKEY = "bGo4Tk12ZlLZ0tQgXaW8T4emz6iAGHYT5+7PZXC009mhX9vJlz32eURy0EDe4/TfDQZJwDyBj8wJGOxyXpPVxa/3UQYsTvNY7Eq8Lrwg3xrd2ydkGpr5EcyhyAuk6Oz7LTE/ZTDgPGlbntolYNgffPPNqlEamX/24JDzjCI5mnN0LxffABHN/7MlgAO6p9F+D5BuXJzdAz8jr49R2QosznslBIcJjfnzIE4KRc5/QrxbJzgxij2k+808AjJrGChqlWeNtHV2EZ+B5dWnly9tlNu5Ymk3K4UANKNz2LSRxIWUUGGY4B3NXEe8059XL/yfRB6jZZB+otNtfegpCnmsdhE3IdEYsKbKmC4P/dR5CeOw31GdZf2TAo6g8wHfdo1XHX8ZGh/xV3Z96mrXkpl/z6YiDZEUo4smsds+HQCX8L5keCXCbxeLALUgbPHmNJk1bozmfBumtgaXf1/pUA4XtbN2UIcyz9fMQg6fNAW1ZecPg3KG37T7dXY9d62X0/cEeEmCGiGALQs6uVKe4Viwn7surUswf1My9BYwN/8rsZy+QRLWcVd55uup4apfa9T3zEGhl99kgw3qv4sQnMBFn5bztO9MwyQctGNRBuuTKBD7EFJ2bSzBSOqkv7EzxNe9Nmxov7GV1hl8jWvX1QUMesVzG9ByC8CcXJkJssPUUXPopjX8R7nXWPZljw3sNvrX";

(async () => {
  await M.ready;
  console.log("wasm ready, version:", M.getUmcVersion?.());

  const buf = fs.readFileSync(FILE);
  const fileSize = buf.length;
  console.log("file size:", fileSize);

  // Parse footer to get audio size and (potentially) embedded ekey.
  const footerBlob = buf.subarray(Math.max(0, fileSize - 1024));
  const footer = M.QMCFooter.parse(footerBlob);
  if (!footer) {
    console.log("QMCFooter.parse returned undefined");
    return;
  }
  console.log("footer.size:", footer.size);
  console.log("footer.mediaName:", footer.mediaName);
  console.log("footer.ekey:", footer.ekey ? footer.ekey.slice(0, 60) + "..." : "(none, will use external)");

  const audioSize = fileSize - footer.size;
  console.log("audio size:", audioSize);

  // Construct cipher with our externally-fetched ekey.
  const cipher = new M.QMC2(EKEY);

  // Decrypt the first 64 bytes to check magic.
  const head = new Uint8Array(buf.subarray(0, Math.min(64, audioSize)));
  cipher.decrypt(head, 0);
  console.log("decrypted head 64 hex:", Buffer.from(head).toString("hex"));

  // Pretty interpretation
  const ascii = String.fromCharCode(...head.slice(0, 4));
  console.log("first 4 bytes ASCII:", JSON.stringify(ascii));

  if (head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53) {
    console.log("\x1b[32m✓ OggS — wasm CAN decrypt this file!\x1b[0m");
  } else if (head[0] === 0x66 && head[1] === 0x4c && head[2] === 0x61 && head[3] === 0x43) {
    console.log("\x1b[32m✓ fLaC — wasm CAN decrypt this file!\x1b[0m");
  } else if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {
    console.log("\x1b[32m✓ ID3 — wasm CAN decrypt this file!\x1b[0m");
  } else {
    console.log("\x1b[31m✗ no audio magic — wasm did NOT solve this file either\x1b[0m");
  }
})();
