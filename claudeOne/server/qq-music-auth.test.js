const assert = require("node:assert/strict");
const test = require("node:test");

const {
  bufferToDataUrl,
  hash33,
  joinCookieMap,
  mapQQQRStatus,
  mapQQWXQRStatus,
  normalizeQQMusicCookies,
  parseQQQRCheck,
  parseQQWXQRCheck,
  splitSetCookieHeader,
} = require("./qq-music-auth");

test("hash33 matches QQ ptqrtoken behavior", () => {
  assert.equal(hash33("abc"), 108966);
});

test("QQ QR poll callback is parsed", () => {
  const parsed = parseQQQRCheck("ptuiCB('0','0','https://example.test/login','0','登录成功！','nickname');");
  assert.deepEqual(parsed, {
    code: "0",
    redirectUrl: "https://example.test/login",
    message: "登录成功！",
  });
  assert.equal(mapQQQRStatus("66"), "waiting");
  assert.equal(mapQQQRStatus("67"), "scanned");
  assert.equal(mapQQQRStatus("65"), "expired");
});

test("WeChat QR poll variables are parsed", () => {
  assert.deepEqual(parseQQWXQRCheck("window.wx_errcode='405';window.wx_code='CODE123';"), {
    code: "405",
    wxCode: "CODE123",
  });
  assert.equal(mapQQWXQRStatus("408"), "waiting");
  assert.equal(mapQQWXQRStatus("404"), "scanned");
  assert.equal(mapQQWXQRStatus("402"), "expired");
});

test("QQ Music cookies are normalized for official API calls", () => {
  const cookies = normalizeQQMusicCookies({
    ptui_loginuin: "0012345",
    p_skey: "secret-key",
  });
  assert.equal(cookies.uin, "12345");
  assert.equal(cookies.qqmusic_uin, "12345");
  assert.equal(cookies.qqmusic_key, "secret-key");
  assert.equal(cookies.qm_keyst, "secret-key");
});

test("set-cookie splitting keeps Expires commas intact", () => {
  const header = "a=1; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Path=/, b=two; Path=/";
  assert.deepEqual(splitSetCookieHeader(header), [
    "a=1; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Path=/",
    "b=two; Path=/",
  ]);
});

test("joinCookieMap sorts keys for stable headers", () => {
  assert.equal(joinCookieMap({ b: "2", a: "1" }), "a=1; b=2");
});

test("QR images can be embedded as data URLs", () => {
  assert.equal(bufferToDataUrl(Buffer.from("qr"), "image/png; charset=utf-8"), "data:image/png;base64,cXI=");
});
