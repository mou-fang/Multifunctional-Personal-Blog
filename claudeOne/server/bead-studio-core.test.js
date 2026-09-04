const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Core = require("../js/bead-studio-core.js");

function imageData(width, height, pixelAt) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const rgba = pixelAt(x, y);
      const offset = (y * width + x) * 4;
      data[offset] = rgba[0]; data[offset + 1] = rgba[1]; data[offset + 2] = rgba[2]; data[offset + 3] = rgba[3] ?? 255;
    }
  }
  return { width, height, data };
}

test("palette exposes the full 291 colors, basic 221 colors, and five brand mappings", () => {
  assert.equal(Core.COMPLETE_PALETTE.length, 291);
  assert.equal(Core.getPalette("221").length, 221);
  assert.equal(Core.getPalette("291").length, 291);
  assert.deepEqual(Core.BRANDS, ["MARD", "COCO", "漫漫", "盼盼", "咪小窝"]);
  const h07 = Core.getColor("H07");
  assert.ok(h07);
  for (const brand of Core.BRANDS) assert.ok(Core.codeFor(h07, brand));
});

test("CIEDE2000 implementation matches the published Sharma reference pair", () => {
  const delta = Core.ciede2000({ L: 50, a: 2.6772, b: -79.7751 }, { L: 50, a: 0, b: -82.7485 });
  assert.ok(Math.abs(delta - 2.0425) < 0.0001, `unexpected delta ${delta}`);
});

test("image conversion respects dimensions, transparency, palette limit, and exclusions", () => {
  const source = imageData(8, 8, (x, y) => {
    if (x < 4 && y < 4) return [255, 20, 25, 255];
    if (x >= 4 && y < 4) return [20, 210, 45, 255];
    if (x < 4) return [35, 70, 245, 255];
    return [0, 0, 0, 0];
  });
  const first = Core.convertImageData(source, { width: 8, height: 8, paletteMode: "291", maxColors: 3, style: "cartoon" });
  assert.equal(first.width, 8);
  assert.equal(first.height, 8);
  assert.equal(first.cells.length, 64);
  assert.ok(first.colorsUsed <= 3);
  assert.equal(first.totalBeads, 48);
  const excluded = first.cells.find(Boolean);
  const second = Core.convertImageData(source, { width: 8, height: 8, paletteMode: "291", maxColors: 3, excludedIds: [excluded] });
  assert.ok(!second.cells.includes(excluded));
});

test("background removal removes edge-connected background but preserves foreground", () => {
  const source = imageData(9, 9, (x, y) => (x >= 3 && x <= 5 && y >= 3 && y <= 5 ? [220, 30, 30, 255] : [250, 250, 250, 255]));
  const result = Core.convertImageData(source, { width: 9, height: 9, removeBackground: true, backgroundTolerance: 8, maxColors: 8 });
  assert.ok(result.totalBeads >= 5 && result.totalBeads <= 16, `foreground count ${result.totalBeads}`);
  assert.ok(result.cells[4 * 9 + 4]);
  assert.equal(result.cells[0], null);
});

test("layer composition, locking metadata, cloning, and serialization round-trip", () => {
  const project = Core.createProject(4, 3, "测试项目");
  project.layers[0].cells[0] = "A01";
  const top = Core.createLayer(4, 3, "高光");
  top.cells[0] = "B01";
  top.cells[5] = "C01";
  top.locked = true;
  project.layers.push(top);
  project.activeLayerId = top.id;
  assert.deepEqual(Core.composeProject(project).slice(0, 6), ["B01", null, null, null, null, "C01"]);
  top.visible = false;
  assert.equal(Core.composeProject(project)[0], "A01");
  const restored = Core.deserializeProject(Core.serializeProject(project));
  assert.equal(restored.name, "测试项目");
  assert.equal(restored.layers.length, 2);
  assert.equal(restored.layers[1].locked, true);
  assert.equal(restored.layers[1].visible, false);
  assert.notEqual(restored.layers[0].cells, project.layers[0].cells);
});

test("drawing, filling, mirroring, copying, pasting, and resizing operate on bead grids", () => {
  let cells = Core.emptyCells(5, 5);
  cells = Core.drawLine(cells, 5, 5, 0, 0, 4, 4, "A01");
  assert.equal(cells.filter(Boolean).length, 5);
  cells = Core.drawRect(cells, 5, 5, { x: 0, y: 0 }, { x: 4, y: 4 }, "B01", false);
  assert.equal(cells[0], "B01");
  assert.equal(cells[2 * 5 + 2], "A01");
  cells = Core.floodFill(cells, 5, 5, 1 * 5 + 2, "C01");
  assert.equal(cells[1 * 5 + 2], "C01");
  const region = Core.copyRegion(cells, 5, 5, { x0: 0, y0: 0, x1: 1, y1: 1 });
  assert.equal(region.width, 2);
  assert.equal(region.height, 2);
  const pasted = Core.pasteRegion(Core.emptyCells(5, 5), 5, 5, region, 3, 3);
  assert.equal(pasted[3 * 5 + 3], cells[0]);
  const mirrored = Core.mirrorCells(["A01", "B01", "C01", null], 4, 1, "horizontal");
  assert.deepEqual(mirrored, [null, "C01", "B01", "A01"]);
  const project = Core.createProject(3, 3, "resize"); project.layers[0].cells[4] = "A01";
  const resized = Core.resizeProject(project, 5, 5, "center");
  assert.equal(resized.layers[0].cells[2 * 5 + 2], "A01");
});

test("bead studio is fully wired into the SPA and tool card grid", () => {
  const root = path.join(__dirname, "..");
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const registry = fs.readFileSync(path.join(root, "js", "page-registry.js"), "utf8");
  const cards = fs.readFileSync(path.join(root, "js", "tool-cards.js"), "utf8");
  const controller = fs.readFileSync(path.join(root, "js", "bead-studio.js"), "utf8");
  const styles = fs.readFileSync(path.join(root, "css", "bead-studio.css"), "utf8");
  assert.match(index, /<template id="page-beads">/);
  for (const panel of ["optimize", "edit", "preview", "make"]) assert.match(index, new RegExp(`data-beads-panel="${panel}"`));
  for (const feature of ["data-beads-text", "data-beads-mirror-h", "data-beads-copy", "data-beads-layers"]) assert.match(index, new RegExp(feature));
  assert.match(registry, /beads:\s*\{/);
  assert.match(registry, /js\/bead-studio-core\.js/);
  assert.match(registry, /js\/bead-studio\.js/);
  assert.match(cards, /href:\s*"#\/beads"/);
  assert.match(controller, /window\.__page_beads/);
  assert.match(styles, /body\[data-theme="neumorphism"\] \.beads-canvas-panel/);
  assert.match(styles, /body\[data-theme="liquid-glass"\] \.beads-commandbar/);
  assert.match(styles, /backdrop-filter:\s*blur\(22px\) saturate\(145%\)/);
  assert.doesNotMatch(styles, /body\[data-theme="liquid-glass"\] \.beads-canvas-wrap\s*\{[^}]*#101522/s);
  assert.match(styles, /\.beads-studio input\[type="range"\]::\-webkit-slider-thumb\s*\{[^}]*border-radius:\s*50%/s);
  assert.match(styles, /clip-path:\s*circle\(50% at 50% 50%\)/);
  assert.doesNotMatch(controller, /if \(id && size >= 17\)/);
  assert.match(controller, /ctx\.strokeText\(code, centerX, centerY, size - 6\)/);
  assert.match(controller, /每颗豆子含色号/);
});
