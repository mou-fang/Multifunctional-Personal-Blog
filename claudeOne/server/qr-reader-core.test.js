const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { classify } = require("../js/qr-reader-core.js");
const jsQR = require("../libs/jsqr/jsQR.js");
// Matrices generated independently with node-qrcode 1.5.4, default ECC M.
const fixtures = require("./fixtures/qr-reader.json");

function raster(fixture, inverted = false, rotated = false) {
  const width = (fixture.size + 8) * 5;
  const data = new Uint8ClampedArray(width * width * 4);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const mx = Math.floor(x / 5) - 4, my = Math.floor(y / 5) - 4;
    const dark = mx >= 0 && my >= 0 && mx < fixture.size && my < fixture.size && fixture.data[my * fixture.size + mx] === "1";
    const shade = (dark !== inverted) ? 0 : 255;
    const at = (rotated ? x * width + (width - 1 - y) : y * width + x) * 4;
    data.set([shade, shade, shade, 255], at);
  }
  return { data, width };
}
test("local decoder reads URL, Unicode, Wi-Fi, unsafe protocol and phone QR images", () => {
  for (const fixture of fixtures) {
    for (const [inverted, rotated] of [[false, false], [true, false], [false, true]]) {
      const { data, width } = raster(fixture, inverted, rotated);
      const result = jsQR(data, width, width, { inversionAttempts: "attemptBoth" });
      assert.equal(result?.data, fixture.text);
    }
  }
});
test("blank image has no fabricated result", () => {
  assert.equal(jsQR(new Uint8ClampedArray(160 * 160 * 4).fill(255), 160, 160), null);
});
test("only valid HTTP(S) URLs without embedded credentials get an open action", () => {
  const raw = "  https://example.com/a?x=1#你好  ";
  assert.equal(classify(raw).text, raw);
  assert.equal(classify(raw).detail, "example.com");
  assert.equal(classify("HTTP://EXAMPLE.COM").href, "http://example.com/");
  for (const raw of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "file:///C:/test", "https://", "https://user:password@example.com", "<img src=x onerror=alert(1)>"]) {
    assert.equal(classify(raw).href, null);
  }
});
test("Wi-Fi escaping and all content labels preserve original payload", () => {
  const wifi = classify("WIFI:T:WPA;S:Office\\;Guest;P:a\\:b\\;c\\\\d;H:true;;");
  assert.deepEqual(wifi.fields, [["网络名称", "Office;Guest"], ["密码", "a:b;c\\d"], ["加密方式", "WPA"], ["隐藏网络", "是"]]);
  for (const [raw, type] of [["你好", "text"], ["mailto:a@example.com", "email"], ["tel:123", "phone"], ["SMSTO:123:hi", "sms"], ["BEGIN:VCARD\nFN:张三", "contact"], ["geo:1,2", "location"], ["BEGIN:VEVENT", "event"], ["weixin://abc", "app"], ["", "text"]]) {
    assert.equal(classify(raw).type, type); assert.equal(classify(raw).text, raw);
  }
});
test("reader route, local assets, lifecycle and tools entry are wired", () => {
  const base = path.join(__dirname, "..");
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(base, "js/page-registry.js"), "utf8"), context);
  const page = context.window.__CLAUDEONE_PAGES["qr-reader"];
  assert.ok(fs.readFileSync(path.join(base, "index.html"), "utf8").includes(`id="${page.templateId}"`));
  for (const asset of [...page.css, ...page.js]) assert.ok(fs.existsSync(path.join(base, asset)));
  assert.ok(fs.readFileSync(path.join(base, "js/qr-reader.js"), "utf8").includes(`window.${page.lifecycle}`));
  assert.ok(fs.readFileSync(path.join(base, "js/tool-cards.js"), "utf8").includes('href: "#/qr-reader"'));
});
