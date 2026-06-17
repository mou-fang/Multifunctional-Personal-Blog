const assert = require("node:assert/strict");
const test = require("node:test");

const {
  QQMusicUnlockError,
  QQMusicAuthError,
  authFromCookieString,
  publicAuthInfo,
} = require("./qq-music-unlock");

test("authFromCookieString parses valid QQ Music cookie", () => {
  const cookie = "qqmusic_uin=12345678; qqmusic_key=abcdef1234567890; other=value";
  const auth = authFromCookieString(cookie);
  assert.equal(auth.uin, "12345678");
  assert.equal(auth.hasMusicKey, true);
  assert.ok(auth.cookie.includes("qqmusic_key=abcdef1234567890"));
  assert.ok(auth.display.includes("12345678"));
});

test("authFromCookieString rejects empty cookie", () => {
  assert.throws(() => authFromCookieString(""), QQMusicAuthError);
  assert.throws(() => authFromCookieString("   "), /没有找到有效的 Cookie/);
});

test("authFromCookieString rejects cookie without uin", () => {
  assert.throws(
    () => authFromCookieString("qqmusic_key=abcdef1234567890"),
    /没有找到 uin/
  );
});

test("authFromCookieString rejects cookie without musickey", () => {
  assert.throws(
    () => authFromCookieString("qqmusic_uin=12345678"),
    /没有 qqmusic_key/
  );
});

test("authFromCookieString normalizes o-prefixed uin", () => {
  const cookie = "uin=o0012345678; qqmusic_key=abcdef1234567890";
  const auth = authFromCookieString(cookie);
  assert.equal(auth.uin, "12345678");
});

test("publicAuthInfo returns null for null input", () => {
  assert.equal(publicAuthInfo(null), null);
});

test("publicAuthInfo strips sensitive fields", () => {
  const info = publicAuthInfo({
    cookie: "secret",
    uin: "12345",
    hasMusicKey: true,
    cookies: { secret: "data" },
    display: "QQ 音乐账号 12345",
  });
  assert.equal(info.display, "QQ 音乐账号 12345");
  assert.equal(info.uin, "12345");
  assert.equal(info.hasMusicKey, true);
  assert.equal(info.cookie, undefined);
  assert.equal(info.cookies, undefined);
});
