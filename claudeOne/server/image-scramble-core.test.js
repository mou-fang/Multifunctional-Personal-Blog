const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const PixelFlux = require("../js/image-scramble-core.js");

function makePixels(width, height, salt = 0) {
  return Uint8Array.from({ length: width * height * 4 }, (_, index) => {
    // Includes low and zero alpha values so PNG packing is tested without
    // relying on canvas premultiplication behavior.
    return (index * 73 + salt * 41 + Math.floor(index / 7) * 19) & 0xff;
  });
}

test("PixelFlux restores every byte for varied image shapes", () => {
  const cases = [
    [1, 1, "00000000000000000000000000000001"],
    [2, 7, "00112233445566778899aabbccddeeff"],
    [37, 23, "0123456789abcdeffedcba9876543210"],
    [128, 64, "ffffffff00000000a5a5a5a55a5a5a5a"],
  ];

  for (const [width, height, seed] of cases) {
    const original = makePixels(width, height, width + height);
    const scrambled = PixelFlux.scrambleRgba(original, width, height, seed);
    const restored = PixelFlux.restoreRgba(scrambled, width, height, seed);
    assert.deepEqual(restored, original, `${width}x${height} did not round-trip`);
  }
});

test("PixelFlux output is deterministic per seed and changes across seeds", () => {
  const width = 19;
  const height = 11;
  const original = makePixels(width, height, 9);
  const seedA = "11111111222222223333333344444444";
  const seedB = "11111111222222223333333344444445";

  const first = PixelFlux.scrambleRgba(original, width, height, seedA);
  const second = PixelFlux.scrambleRgba(original, width, height, seedA);
  const other = PixelFlux.scrambleRgba(original, width, height, seedB);

  assert.deepEqual(first, second);
  assert.notDeepEqual(first, other);
  assert.notDeepEqual(first, original);
});

test("stored DEFLATE fallback round-trips across multiple 64K blocks", () => {
  const source = Uint8Array.from({ length: 180_000 }, (_, index) => (index * 29 + 17) & 0xff);
  const compressed = PixelFlux._deflateStored(source);
  const restored = PixelFlux._inflateStored(compressed);
  assert.deepEqual(restored, source);
});

test("PixelFlux PNG carries recovery metadata and preserves exact RGBA", async () => {
  const width = 31;
  const height = 17;
  const seed = "89abcdef0123456776543210fedcba98";
  const original = makePixels(width, height, 3);
  const scrambled = PixelFlux.scrambleRgba(original, width, height, seed);
  const metadata = PixelFlux.makeMetadata({
    width,
    height,
    seed,
    checksum: PixelFlux.checksumHex(original),
    originalNameB64: "5rWL6K+VLnBuZw==",
    createdAt: "2026-08-08T00:00:00.000Z",
  });

  const png = await PixelFlux.encodePngRgba(scrambled, width, height, metadata, {
    compression: "store",
  });
  const prefixMetadata = PixelFlux.readMetadata(png.subarray(0, Math.min(65536, png.length)));
  const decoded = await PixelFlux.decodePngRgba(png);
  const restored = PixelFlux.restoreRgba(decoded.rgba, width, height, prefixMetadata.seed);

  assert.equal(prefixMetadata.magic, PixelFlux.MAGIC);
  assert.equal(prefixMetadata.checksum, PixelFlux.checksumHex(original));
  assert.equal(decoded.width, width);
  assert.equal(decoded.height, height);
  assert.deepEqual(decoded.rgba, scrambled);
  assert.deepEqual(restored, original);

  const restoredPng = await PixelFlux.encodePngRgba(restored, width, height, null, {
    compression: "deflate",
  });
  const decodedRestored = await PixelFlux.decodePngRgba(restoredPng);
  assert.deepEqual(decodedRestored.rgba, original);
});

test("scramble page is wired into the SPA registry and tool grid", () => {
  const root = path.join(__dirname, "..");
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const registry = fs.readFileSync(path.join(root, "js", "page-registry.js"), "utf8");
  const cards = fs.readFileSync(path.join(root, "js", "tool-cards.js"), "utf8");

  assert.match(index, /<template id="page-scramble">/);
  assert.match(registry, /scramble:\s*\{/);
  assert.match(registry, /js\/image-scramble-core\.js/);
  assert.match(registry, /js\/image-scramble\.js/);
  assert.match(cards, /href:\s*"#\/scramble"/);
});
