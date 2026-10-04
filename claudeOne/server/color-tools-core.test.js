const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const C = require("../js/color-tools-core.js");

test("opaque color inputs handle shorthand, percentages and hue wrapping, rejecting injection", () => {
  for (const [value, expected] of [["abc", "#AABBCC"], [" #f00 ", "#FF0000"], ["rgb(100%, 0%, 0%)", "#FF0000"], ["rgb(0 128 255)", "#0080FF"], ["hsl(-120deg 100% 50%)", "#0000FF"], ["hsl(720, 100%, 50%)", "#FF0000"]]) assert.equal(C.parse(value), expected);
  for (const value of ["", "#ffff", "#ff000080", "rgba(0,0,0,.5)", "transparent", "rgb(256,0,0)", "rgb(0%,255,0)", "hsl(0, 101%, 50%)", "rgb(1 2 3 / 0)", "red; background:url(x)", "<script>", null, {}]) assert.equal(C.parse(value), null);
  assert.equal(C.parse(`hsl(-${"9".repeat(400)}, 100%, 50%)`), null);
});
test("RGB-HSL roundtrips an independently spaced RGB cube", () => {
  for (let r = 0; r <= 255; r += 51) for (let g = 0; g <= 255; g += 51) for (let b = 0; b <= 255; b += 51) {
    const hex = C.toHex([r, g, b]); assert.equal(C.fromHsl(...C.hsl(hex)), hex);
  }
  assert.equal(C.formats("#FF0000").hsl, "hsl(0, 100%, 50%)");
});
test("WCAG contrast agrees with known ratios and is symmetric", () => {
  assert.equal(C.contrast("#000000", "#FFFFFF"), 21);
  assert.equal(C.contrast("#FF0000", "#FF0000"), 1);
  assert.ok(Math.abs(C.contrast("#777777", "#FFFFFF") - 4.478089) < .00001);
  assert.equal(C.contrast("#123456", "#ABCDEF"), C.contrast("#ABCDEF", "#123456"));
  assert.equal(C.ink("#000000"), "#FFFFFF"); assert.equal(C.ink("#FFFFFF"), "#000000");
});
test("harmonies retain the base, have distinct valid colors and correct complementary relationships", () => {
  assert.ok(C.harmony("#FF0000", "complement").includes("#00FFFF"));
  assert.ok(C.harmony("#FF0000", "triad").includes("#00FF00"));
  assert.ok(C.harmony("#FF0000", "triad").includes("#0000FF"));
  for (const type of ["analogous", "complement", "triad", "mono"]) for (const hex of ["#000000", "#FFFFFF", "#888888", "#547AC0"]) {
    const colors = C.harmony(hex, type); assert.ok(colors.includes(hex)); assert.equal(new Set(colors).size, colors.length); assert.ok(colors.every(c => C.parse(c) === c));
  }
});
test("linear-light color-vision previews preserve neutrals and known red reference values", () => {
  for (const type of ["protan", "deutan", "tritan", "gray"]) for (const hex of ["#000000", "#FFFFFF", "#808080"]) assert.equal(C.simulate(hex, type), hex);
  // Published Machado matrices applied to linear sRGB [1,0,0], then encoded.
  assert.equal(C.simulate("#FF0000", "protan"), "#6D5F00");
  assert.equal(C.simulate("#FF0000", "deutan"), "#A39000");
  assert.equal(C.simulate("#FF0000", "gray"), "#7F7F7F");
});
test("palette interchange validates all records and roundtrips Unicode annotations", () => {
  const palette = C.normalizePalette({ name: "机甲配色", colors: [{ hex: "#f00", label: "主体 / 漆号" }, "#00f"] });
  assert.deepEqual(C.normalizePalette(JSON.parse(JSON.stringify(palette))), palette);
  assert.equal(palette.colors[1].hex, "#0000FF");
  for (const value of [{ colors: Array(41).fill("#fff") }, { colors: ["#fff", { hex: "url(x)" }] }, { colors: [], version: 2 }, { colors: [], format: "another-format" }, { colors: {} }]) assert.throws(() => C.normalizePalette(value));
});
test("gradients sort stops, preserve hard transitions and reject invalid positions", () => {
  const stops = [{ hex: "#00f", pos: 100 }, { hex: "#f00", pos: 0 }];
  assert.equal(C.gradient(stops), "linear-gradient(90deg, #FF0000 0%, #0000FF 100%)");
  assert.equal(C.gradient(stops, "radial"), "radial-gradient(circle, #FF0000 0%, #0000FF 100%)");
  assert.equal(stops[0].pos, 100);
  assert.match(C.gradient([{ hex: "#000", pos: 50 }, { hex: "#fff", pos: 50 }]), /50%, #FFFFFF 50%/);
  for (const pos of [-1, 101, NaN]) assert.throws(() => C.gradient([{ hex: "#fff", pos }, { hex: "#000", pos: 100 }]));
  assert.throws(() => C.gradient([{ hex: "#fff", pos: 0 }]));
});
test("exports preserve colors and safely escape untrusted SVG names", () => {
  const palette = { name: '<script>bad & "title"</script>', colors: [{ hex: "#f00", label: '<img onload="bad">' }] };
  const svg = C.svgPalette(palette);
  assert.ok(!svg.includes("<script>")); assert.ok(!svg.includes("<img"));
  assert.ok(svg.includes("&lt;script&gt;")); assert.ok(svg.includes('fill="#FF0000"'));
  assert.equal(C.cssPalette(palette), ":root {\n  --color-01: #FF0000;\n}\n");
  assert.ok(C.exportLayout(40).height > C.exportLayout(5).height);
});
test("crop geometry handles reverse drags and clips out-of-bounds points", () => {
  const r = C.region({ x: .8, y: .9 }, { x: .2, y: .3 });
  assert.equal(r.x, .2); assert.equal(r.y, .3); assert.ok(Math.abs(r.width - .6) < 1e-12); assert.ok(Math.abs(r.height - .6) < 1e-12);
  assert.deepEqual(C.region({ x: -1, y: -2 }, { x: 2, y: 3 }), { x: 0, y: 0, width: 1, height: 1 });
});
test("vendored extraction finds distinct opaque colors and excludes transparent pixels", () => {
  class ImageData { constructor(data, width, height) { this.data = data; this.width = width; this.height = height; } }
  const context = vm.createContext({ ImageData, Uint8ClampedArray, console, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../libs/color-thief-3.5.0/color-thief.global.js"), "utf8"), context);
  const pixels = new Uint8ClampedArray(30 * 10 * 4);
  for (let i = 0; i < 300; i++) pixels.set(i < 100 ? [255, 0, 0, 255] : i < 200 ? [0, 0, 255, 255] : [0, 255, 0, 0], i * 4);
  const colors = context.ColorThief.getPaletteSync(new ImageData(pixels, 30, 10), { colorCount: 5, quality: 1 }).map(c => c.rgb());
  assert.ok(colors.some(c => c.r > 220 && c.b < 30));
  assert.ok(colors.some(c => c.b > 220 && c.r < 30));
  assert.ok(colors.every(c => c.g < 30));
});
test("image worker retains white model colors, ignores transparency and reports its task ID", () => {
  class ImageData { constructor(data, width, height) { this.data = data; this.width = width; this.height = height; } }
  let reply;
  const context = vm.createContext({ ImageData, Uint8ClampedArray, console, setTimeout, clearTimeout, self: { postMessage: data => { reply = data; } } });
  context.importScripts = () => vm.runInContext(fs.readFileSync(path.join(__dirname, "../libs/color-thief-3.5.0/color-thief.global.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/color-tools-worker.js"), "utf8"), context);
  const pixels = new Uint8ClampedArray(40 * 10 * 4);
  for (let i = 0; i < 400; i++) pixels.set(i < 100 ? [255, 0, 0, 255] : i < 200 ? [0, 0, 255, 255] : i < 300 ? [255, 255, 255, 255] : [0, 255, 0, 0], i * 4);
  context.self.onmessage({ data: { buffer: pixels.buffer, width: 40, height: 10, count: 5, id: 42 } });
  assert.equal(reply.id, 42); assert.equal(reply.error, undefined);
  assert.ok(reply.colors.some(c => c.hex === "#FFFFFF"));
  assert.ok(reply.colors.some(c => c.hex === "#FF0000"));
  assert.ok(reply.colors.some(c => c.hex === "#0000FF"));
  assert.ok(reply.colors.every(c => c.hex !== "#00FF00"));
  assert.ok(Math.abs(reply.colors.reduce((sum, c) => sum + c.proportion, 0) - 1) < .00001);
  pixels.fill(0);
  context.self.onmessage({ data: { buffer: pixels.buffer, width: 40, height: 10, count: 5, id: 43 } });
  assert.equal(reply.id, 43); assert.equal(reply.error, undefined); assert.equal(reply.colors.length, 0);
  pixels.set([0, 255, 0, 1], 0);
  context.self.onmessage({ data: { buffer: pixels.buffer, width: 40, height: 10, count: 5, id: 44 } });
  assert.equal(reply.colors.length, 1); assert.equal(reply.colors[0].hex, "#00FF00");
});
test("color page route, template, lifecycle, tools card and local worker assets are wired", () => {
  const base = path.join(__dirname, ".."), context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(base, "js/page-registry.js"), "utf8"), context);
  const page = context.window.__CLAUDEONE_PAGES.colors;
  assert.equal(page.navSection, "tools"); assert.equal(page.lifecycle, "__page_colors");
  assert.ok(fs.readFileSync(path.join(base, "index.html"), "utf8").includes('id="page-colors"'));
  assert.match(fs.readFileSync(path.join(base, "js/tool-cards.js"), "utf8"), /title: "颜色工具"[\s\S]*?href: "#\/colors"/);
  for (const asset of [...page.css, ...page.js, "js/color-tools-worker.js", "libs/color-thief-3.5.0/LICENSE"]) assert.ok(fs.existsSync(path.join(base, asset)), asset);
});
