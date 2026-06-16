const assert = require("node:assert/strict");
const test = require("node:test");

const {
  bufferToDataUrl,
  buildQQOAuthAuthorizeUrl,
  buildQQXLoginUrl,
  decodeQQQRSessionKey,
  encodeQQQRSessionKey,
  extractLikelyUrls,
  extractRedirectUrlsFromBody,
  hash33,
  joinCookieMap,
  mapQQQRStatus,
  mapQQWXQRStatus,
  normalizeQQMusicCookies,
  parseCookieString,
  parseQQQRCheck,
  parseQQWXQRCheck,
  qqLoginExchangeCandidatesFromTokens,
  qqMusicGtk,
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
    p_skey: "pt-key",
    musickey: "music-key",
  });
  assert.equal(cookies.uin, "12345");
  assert.equal(cookies.qqmusic_uin, "12345");
  assert.equal(cookies.qqmusic_key, "music-key");
  assert.equal(cookies.qm_keyst, "music-key");
  assert.equal(cookies.p_skey, "pt-key");
});

test("QQ browser session keys are not treated as QQ Music keys", () => {
  const cookies = normalizeQQMusicCookies({
    ptui_loginuin: "0012345",
    p_skey: "pt-key",
  });
  assert.equal(cookies.uin, "12345");
  assert.equal(cookies.qqmusic_uin, "12345");
  assert.equal(cookies.qqmusic_key, undefined);
  assert.equal(cookies.qm_keyst, undefined);
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

test("cookie text can be parsed for QQ Music login import", () => {
  assert.deepEqual(parseCookieString(" qqmusic_key=music-key ; qqmusic_uin=12345; empty= "), {
    qqmusic_key: "music-key",
    qqmusic_uin: "12345",
    empty: "",
  });
  const cookies = normalizeQQMusicCookies(parseCookieString("qqmusic_key=music-key; qqmusic_uin=0012345"));
  assert.equal(cookies.qqmusic_key, "music-key");
  assert.equal(cookies.uin, "12345");
});

test("QQ OAuth authorize URL carries the QQ Music redirect context", () => {
  const url = new URL(buildQQOAuthAuthorizeUrl("state-123"));
  assert.equal(url.hostname, "graph.qq.com");
  assert.equal(url.searchParams.get("client_id"), "100497308");
  assert.equal(url.searchParams.get("state"), "state-123");
  assert.equal(url.searchParams.get("redirect_uri"), "https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https%3A%2F%2Fy.qq.com%2F");
});

test("QQ xlogin URL keeps the QQ Connect app and login jump", () => {
  const url = new URL(buildQQXLoginUrl());
  assert.equal(url.hostname, "xui.ptlogin2.qq.com");
  assert.equal(url.searchParams.get("appid"), "716027609");
  assert.equal(url.searchParams.get("pt_3rd_aid"), "100497308");
  assert.equal(url.searchParams.get("s_url"), "https://graph.qq.com/oauth2.0/login_jump");
});

test("QQ QR session key preserves OAuth cookies server-side", () => {
  const key = encodeQQQRSessionKey({
    qrsig: "qr",
    loginSig: "login",
    cookies: { qrsig: "qr", pt_login_sig: "login" },
  });
  assert.deepEqual(decodeQQQRSessionKey(key), {
    qrsig: "qr",
    loginSig: "login",
    cookies: { qrsig: "qr", pt_login_sig: "login" },
  });
});

test("QQ redirect body parser follows JavaScript redirects", () => {
  assert.deepEqual(
    extractRedirectUrlsFromBody("<script>window.location.href='https://graph.qq.com/oauth2.0/login_jump?x=1&amp;y=2'</script>"),
    ["https://graph.qq.com/oauth2.0/login_jump?x=1&y=2"],
  );
  assert.deepEqual(
    extractRedirectUrlsFromBody("<script>location.replace('/portal/wx_redirect.html?code=CODE123')</script>", "https://y.qq.com/base"),
    ["https://y.qq.com/portal/wx_redirect.html?code=CODE123"],
  );
});

test("QQ diagnostic URL parser finds escaped callback URLs", () => {
  assert.deepEqual(
    extractLikelyUrls('var url="https:\\/\\/y.qq.com\\/portal\\/wx_redirect.html?login_type=1&code=CODE123";'),
    ["https://y.qq.com/portal/wx_redirect.html?login_type=1&code=CODE123"],
  );
});

test("QQ login token fallback candidates are built from ptlogin cookies", () => {
  const candidates = qqLoginExchangeCandidatesFromTokens({
    pt_oauth_token: "oauth",
    pt4_token: "pt4",
    supertoken: "super",
    superkey: "key",
    superuin: "o0012345",
  });
  assert.deepEqual(candidates.map(item => item.label), [
    "pt_oauth_token-as-code",
    "pt_oauth_token-as-authCode",
    "pt_oauth_token-direct",
    "qq-token-bundle",
    "pt4_token-as-code",
    "supertoken-as-code",
  ]);
  assert.equal(candidates[3].param.superuin, "12345");
});

test("QQ Music gtk uses p_skey when present", () => {
  assert.equal(qqMusicGtk({}), 5381);
  assert.equal(qqMusicGtk({ p_skey: "abc" }), hash33("abc"));
});

test("QR images can be embedded as data URLs", () => {
  assert.equal(bufferToDataUrl(Buffer.from("qr"), "image/png; charset=utf-8"), "data:image/png;base64,cXI=");
});
