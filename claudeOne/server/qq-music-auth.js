/*
 * QQ Music QR login support.
 *
 * The QQ and WeChat QR login flows are ported from music-lib:
 * https://github.com/guohuiyuan/music-lib
 * This module deliberately returns cookies only to the server caller. The
 * browser receives an opaque local session id managed by server.js.
 */

const QQ_QR_SHOW_API = "https://ssl.ptlogin2.qq.com/ptqrshow";
const QQ_QR_CHECK_API = "https://ssl.ptlogin2.qq.com/ptqrlogin";
const QQ_CONNECT_CLIENT_ID = "100497308";
const QQ_CONNECT_APP_ID = "716027609";
const QQ_CONNECT_DAID = "383";
const QQ_CONNECT_LOGIN_JUMP = "https://graph.qq.com/oauth2.0/login_jump";
const QQ_CONNECT_AUTH_API = "https://graph.qq.com/oauth2.0/authorize";
const QQ_QQ_REDIRECT_URI = "https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https%3A%2F%2Fy.qq.com%2F";
const QQ_WX_QR_CONNECT_API = "https://open.weixin.qq.com/connect/qrconnect";
const QQ_WX_QR_CHECK_API = "https://lp.open.weixin.qq.com/connect/l/qrconnect";
const QQ_WX_REDIRECT_URI = "https://y.qq.com/portal/wx_redirect.html?login_type=2&surl=https://y.qq.com/";
const QQ_WX_APP_ID = "wx48db31d50e334801";
const QQ_MUSIC_API_ENDPOINTS = Object.freeze([
  "https://u.y.qq.com/cgi-bin/musicu.fcg",
  "https://szu.y.qq.com/cgi-bin/musicu.fcg",
  "https://shu.y.qq.com/cgi-bin/musicu.fcg",
]);

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

class QQMusicAuthError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "QQMusicAuthError";
    this.code = code;
    this.status = status;
  }
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function normalizeLoginType(loginType) {
  const value = String(loginType || "").trim().toLowerCase();
  return ["wx", "wechat", "weixin"].includes(value) ? "wx" : "qq";
}

function hash33(value) {
  let hash = 0;
  for (const char of String(value || "")) {
    hash += (hash << 5) + char.codePointAt(0);
  }
  return hash & 0x7fffffff;
}

function splitSetCookieHeader(header) {
  if (!header) return [];
  const parts = [];
  let start = 0;
  let inExpires = false;
  for (let i = 0; i < header.length; i += 1) {
    const ch = header[i];
    if (ch === "," && !inExpires) {
      parts.push(header.slice(start, i).trim());
      start = i + 1;
      continue;
    }
    const lookbehind = header.slice(Math.max(start, i - 8), i + 1).toLowerCase();
    if (lookbehind.endsWith("expires=")) inExpires = true;
    if (inExpires && ch === ";") inExpires = false;
  }
  parts.push(header.slice(start).trim());
  return parts.filter(Boolean);
}

function responseCookies(response) {
  const cookies = {};
  let rawCookies = [];
  if (typeof response.headers.getSetCookie === "function") {
    rawCookies = response.headers.getSetCookie();
  } else {
    rawCookies = splitSetCookieHeader(response.headers.get("set-cookie"));
  }
  for (const raw of rawCookies) {
    const firstPart = String(raw || "").split(";", 1)[0];
    const eq = firstPart.indexOf("=");
    if (eq > 0) {
      cookies[firstPart.slice(0, eq).trim()] = firstPart.slice(eq + 1);
    }
  }
  return cookies;
}

function joinCookieMap(cookies) {
  return Object.keys(cookies || {})
    .filter(key => String(key || "").trim())
    .sort()
    .map(key => `${key}=${cookies[key]}`)
    .join("; ");
}

function parseCookieString(cookieText) {
  const result = {};
  for (const part of String(cookieText || "").split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

function normalizeUin(value) {
  const trimmed = String(value || "").trim();
  return trimmed.replace(/^o/i, "").replace(/^0+/, "") || trimmed;
}

function normalizeQQMusicCookies(cookies) {
  const result = { ...(cookies || {}) };
  if (!result.uin) {
    result.uin = firstNonEmpty(
      result.qqmusic_uin,
      result.ptui_loginuin,
      result.luin,
      result.pt2gguin,
      result.superuin,
      result.p_uin,
      result.musicid,
      result.userid,
      result.wxuin,
    );
  }
  result.uin = normalizeUin(result.uin);
  if (!result.qqmusic_uin && result.uin) result.qqmusic_uin = result.uin;

  const musicKey = firstNonEmpty(
    result.qqmusic_key,
    result.musickey,
    result.qm_keyst,
    result.music_key,
    result.strMusicKey,
  );
  if (musicKey) {
    result.qqmusic_key = musicKey;
    if (!result.qm_keyst) result.qm_keyst = musicKey;
    if (!result.musickey) result.musickey = musicKey;
  }
  return result;
}

function authFromCookies(cookies) {
  const normalized = normalizeQQMusicCookies(cookies);
  const cookie = joinCookieMap(normalized);
  const uin = normalizeUin(normalized.qqmusic_uin || normalized.uin || normalized.musicid || normalized.wxuin);
  if (!cookie || !uin) {
    throw new QQMusicAuthError("QQ_LOGIN_COOKIE_INVALID", "QQ 音乐登录成功，但没有拿到可用的账号凭据", 502);
  }
  const musicKey = firstNonEmpty(normalized.qqmusic_key, normalized.musickey, normalized.qm_keyst);
  if (!musicKey) {
    throw new QQMusicAuthError(
      "QQ_LOGIN_MUSIC_KEY_MISSING",
      "QQ 登录成功，但没有换到 QQ 音乐解锁所需的 musickey。请重新扫码；如果一直失败，优先使用微信扫码登录同一个 QQ 音乐账号。",
      502,
    );
  }
  return {
    cookie,
    uin,
    hasMusicKey: true,
    cookies: normalized,
    display: `QQ 音乐账号 ${uin}`,
  };
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  return { response, text };
}

function bufferToDataUrl(buffer, mime = "image/png") {
  const type = String(mime || "image/png").split(";", 1)[0].trim() || "image/png";
  return `data:${type};base64,${Buffer.from(buffer).toString("base64")}`;
}

async function fetchImageDataUrl(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new QQMusicAuthError("QQ_QR_IMAGE_FAILED", `二维码图片获取失败: HTTP ${response.status}`, 502);
  }
  const mime = response.headers.get("content-type") || "image/png";
  return bufferToDataUrl(await response.arrayBuffer(), mime);
}

function mapQQQRStatus(code) {
  switch (code) {
    case "0": return "success";
    case "65": return "expired";
    case "66": return "waiting";
    case "67": return "scanned";
    default: return "failed";
  }
}

function parseQQQRCheck(raw) {
  const matches = [...String(raw || "").matchAll(/'([^']*)'/g)].map(match => match[1]);
  if (matches.length >= 5) {
    return { code: matches[0], redirectUrl: matches[2], message: matches[4] };
  }
  return { code: "", redirectUrl: "", message: String(raw || "").trim() };
}

function mapQQWXQRStatus(code) {
  switch (code) {
    case "405": return "success";
    case "402": return "expired";
    case "404": return "scanned";
    case "408": return "waiting";
    default: return "failed";
  }
}

function qqWXQRMessage(code, raw) {
  switch (code) {
    case "405": return "登录成功";
    case "402": return "二维码已过期";
    case "404": return "已扫码，请在微信中确认";
    case "408": return "等待扫码中";
    default: return String(raw || "").trim();
  }
}

function parseQQWXQRUUID(raw) {
  const patterns = [
    /connect\/l\/qrconnect\?uuid=([A-Za-z0-9_-]+)/,
    /window\.QRLogin\.uuid\s*=\s*"([^"]+)"/,
    /\/connect\/qrcode\/([A-Za-z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = String(raw || "").match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function parseQQWXQRCheck(raw) {
  const source = String(raw || "");
  const code = source.match(/wx_errcode\s*=\s*'?([0-9]+)'?/)?.[1]?.trim() || "";
  const wxCode = source.match(/wx_code\s*=\s*["']([^"']*)["']/)?.[1]?.trim() || "";
  return { code, wxCode };
}

function buildQQOAuthAuthorizeUrl(state = "") {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: QQ_CONNECT_CLIENT_ID,
    redirect_uri: QQ_QQ_REDIRECT_URI,
    state: state || `claudeone-${Date.now()}`,
    display: "pc",
    scope: "get_user_info,get_app_friends",
  });
  return `${QQ_CONNECT_AUTH_API}?${params}`;
}

function buildQQXLoginUrl() {
  const params = new URLSearchParams({
    appid: QQ_CONNECT_APP_ID,
    daid: QQ_CONNECT_DAID,
    style: "33",
    login_text: "登录",
    hide_title_bar: "1",
    hide_border: "1",
    target: "self",
    s_url: QQ_CONNECT_LOGIN_JUMP,
    pt_3rd_aid: QQ_CONNECT_CLIENT_ID,
  });
  return `https://xui.ptlogin2.qq.com/cgi-bin/xlogin?${params}`;
}

function encodeQQQRSessionKey(data) {
  return Buffer.from(JSON.stringify(data || {}), "utf8").toString("base64url");
}

function decodeQQQRSessionKey(value) {
  try {
    const raw = Buffer.from(String(value || ""), "base64url").toString("utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
}

async function fetchQQOAuthContext(state) {
  const authorizeUrl = buildQQOAuthAuthorizeUrl(state);
  const contextCookies = {};
  let currentUrl = authorizeUrl;
  let referer = "https://y.qq.com/";
  for (let i = 0; i < 4 && currentUrl; i += 1) {
    const response = await fetch(currentUrl, {
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        Referer: referer,
        Cookie: joinCookieMap(contextCookies),
      },
    });
    Object.assign(contextCookies, responseCookies(response));
    await response.arrayBuffer();
    const location = String(response.headers.get("location") || "").trim();
    if (!location || response.status < 300 || response.status >= 400) break;
    const nextUrl = new URL(location, currentUrl);
    referer = currentUrl;
    currentUrl = nextUrl.toString();
  }

  const xloginUrl = buildQQXLoginUrl();
  const xloginResponse = await fetch(xloginUrl, {
    redirect: "manual",
    headers: {
      "User-Agent": USER_AGENT,
      Referer: currentUrl || authorizeUrl,
      Cookie: joinCookieMap(contextCookies),
    },
  });
  if (!xloginResponse.ok) {
    throw new QQMusicAuthError("QQ_QR_CREATE_FAILED", `QQ 授权登录页初始化失败: HTTP ${xloginResponse.status}`, 502);
  }
  Object.assign(contextCookies, responseCookies(xloginResponse));
  await xloginResponse.arrayBuffer();
  return {
    state,
    authorizeUrl,
    showUrl: currentUrl || authorizeUrl,
    xloginUrl,
    loginSig: String(contextCookies.pt_login_sig || "").trim(),
    cookies: contextCookies,
  };
}

async function createQQQRLogin() {
  const state = `claudeone-${Date.now()}`;
  const context = await fetchQQOAuthContext(state);
  const params = new URLSearchParams({
    appid: QQ_CONNECT_APP_ID,
    e: "2",
    l: "M",
    s: "3",
    d: "72",
    v: "4",
    t: (Date.now() / 1000).toFixed(17),
    daid: QQ_CONNECT_DAID,
    pt_3rd_aid: QQ_CONNECT_CLIENT_ID,
  });
  const response = await fetch(`${QQ_QR_SHOW_API}?${params}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: context.xloginUrl,
      Cookie: joinCookieMap(context.cookies),
    },
  });
  if (!response.ok) {
    throw new QQMusicAuthError("QQ_QR_CREATE_FAILED", `QQ 登录二维码生成失败: HTTP ${response.status}`, 502);
  }
  const image = Buffer.from(await response.arrayBuffer());
  const qrCookies = responseCookies(response);
  const qrsig = String(qrCookies.qrsig || "").trim();
  if (!qrsig) {
    throw new QQMusicAuthError("QQ_QR_CREATE_FAILED", "QQ 登录二维码缺少 qrsig", 502);
  }
  const cookies = { ...context.cookies, ...qrCookies };
  const key = encodeQQQRSessionKey({
    qrsig,
    state,
    authorizeUrl: context.authorizeUrl,
    showUrl: context.showUrl,
    xloginUrl: context.xloginUrl,
    loginSig: firstNonEmpty(context.loginSig, cookies.pt_login_sig),
    cookies,
  });
  return {
    type: "qq",
    key,
    imageUrl: bufferToDataUrl(image, "image/png"),
    expiresAt: Date.now() + 2 * 60 * 1000,
  };
}

async function checkQQQRLogin(key) {
  let session = decodeQQQRSessionKey(key);
  if (!session.qrsig) {
    const values = new URLSearchParams(key);
    session = { qrsig: values.get("qrsig") || "", cookies: { qrsig: values.get("qrsig") || "" } };
  }
  const qrsig = String(session.qrsig || "").trim();
  if (!qrsig) throw new QQMusicAuthError("QQ_QR_SESSION_INVALID", "QQ 登录会话缺少 qrsig");
  const baseCookies = { ...(session.cookies || {}), qrsig };
  const loginSig = firstNonEmpty(session.loginSig, baseCookies.pt_login_sig);

  const params = new URLSearchParams({
    u1: QQ_CONNECT_LOGIN_JUMP,
    ptqrtoken: String(hash33(qrsig)),
    ptredirect: "100",
    h: "1",
    t: "1",
    g: "1",
    from_ui: "1",
    ptlang: "2052",
    action: `0-0-${Date.now()}`,
    js_ver: "21072115",
    js_type: "1",
    login_sig: loginSig,
    pt_uistyle: "40",
    aid: QQ_CONNECT_APP_ID,
    daid: QQ_CONNECT_DAID,
    pt_3rd_aid: QQ_CONNECT_CLIENT_ID,
    has_onekey: "1",
    pttype: "1",
    service: "ptqrlogin",
    nodirect: "0",
  });
  const { response, text } = await fetchText(`${QQ_QR_CHECK_API}?${params}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: session.xloginUrl || "https://xui.ptlogin2.qq.com/",
      Cookie: joinCookieMap(baseCookies),
    },
  });
  const parsed = parseQQQRCheck(text);
  const result = {
    type: "qq",
    status: mapQQQRStatus(parsed.code),
    message: parsed.message,
    code: parsed.code,
  };
  if (result.status !== "success") return result;

  const cookies = { ...baseCookies, ...responseCookies(response) };
  const visitedUrls = [parsed.redirectUrl];
  if (parsed.redirectUrl) {
    const redirectResult = await fetchQQRedirectCookies(parsed.redirectUrl, cookies, { referer: session.showUrl || session.xloginUrl || "https://xui.ptlogin2.qq.com/" });
    Object.assign(cookies, redirectResult.cookies);
    visitedUrls.push(...redirectResult.visitedUrls, redirectResult.finalUrl);
  }
  if (session.authorizeUrl) {
    const authorizeResult = await fetchQQRedirectCookies(session.authorizeUrl, cookies, { referer: session.showUrl || "https://graph.qq.com/" });
    Object.assign(cookies, authorizeResult.cookies);
    visitedUrls.push(...authorizeResult.visitedUrls, authorizeResult.finalUrl);
  }
  const qqCode = extractUrlParam(visitedUrls, "code");
  const exchangeDiagnostics = [];
  if (!qqCode) {
    const fallbackCookies = await fetchQQLoginCookiesFromTokens(cookies, exchangeDiagnostics);
    if (fallbackCookies) {
      Object.assign(cookies, fallbackCookies);
      return { ...result, auth: authFromCookies(cookies), message: "登录成功" };
    }
    return failQQCodeMissing(parsed.redirectUrl, visitedUrls, cookies, exchangeDiagnostics);
  }
  const musicLoginCookies = await fetchQQLoginCookies([{ label: "oauth-code", param: { code: qqCode } }], cookies);
  Object.assign(cookies, musicLoginCookies);
  return { ...result, auth: authFromCookies(cookies), message: "登录成功" };
}

async function createQQWXQRLogin() {
  const state = `claudeone-${Date.now()}`;
  const params = new URLSearchParams({
    appid: QQ_WX_APP_ID,
    redirect_uri: QQ_WX_REDIRECT_URI,
    response_type: "code",
    scope: "snsapi_login",
    state,
    href: "https://y.qq.com/mediastyle/music_v17/src/css/popup_wechat.css#wechat_redirect",
  });
  const loginUrl = `${QQ_WX_QR_CONNECT_API}?${params}`;
  const { response, text } = await fetchText(loginUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://y.qq.com/",
    },
  });
  if (!response.ok) {
    throw new QQMusicAuthError("QQ_WX_QR_CREATE_FAILED", `微信登录二维码生成失败: HTTP ${response.status}`, 502);
  }
  const uuid = parseQQWXQRUUID(text);
  if (!uuid) {
    throw new QQMusicAuthError("QQ_WX_QR_CREATE_FAILED", "微信登录二维码缺少 uuid", 502);
  }
  const qrImageUrl = `https://open.weixin.qq.com/connect/qrcode/${encodeURIComponent(uuid)}`;
  const imageUrl = await fetchImageDataUrl(qrImageUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: loginUrl,
    },
  });
  return {
    type: "wx",
    key: new URLSearchParams({ type: "wx", uuid, state }).toString(),
    url: loginUrl,
    imageUrl,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
}

async function checkQQWXQRLogin(key) {
  const values = new URLSearchParams(key);
  const uuid = String(values.get("uuid") || "").trim();
  const state = String(values.get("state") || "STATE").trim();
  if (!uuid) throw new QQMusicAuthError("QQ_WX_QR_SESSION_INVALID", "微信登录会话缺少 uuid");

  const params = new URLSearchParams({ uuid, _: String(Date.now()) });
  const { text } = await fetchText(`${QQ_WX_QR_CHECK_API}?${params}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: QQ_WX_QR_CONNECT_API,
    },
  });
  const parsed = parseQQWXQRCheck(text);
  const result = {
    type: "wx",
    status: mapQQWXQRStatus(parsed.code),
    message: qqWXQRMessage(parsed.code, text),
    code: parsed.code,
  };
  if (result.status !== "success") return result;
  if (!parsed.wxCode) {
    return { ...result, status: "failed", message: "微信授权码为空" };
  }

  const { cookies, endpoint } = await fetchQQWXLoginCookies(parsed.wxCode);
  return {
    ...result,
    message: "登录成功",
    auth: authFromCookies(cookies),
    extra: { endpoint, state },
  };
}

async function fetchQQWXLoginCookies(wxCode) {
  const payload = JSON.stringify({
    comm: {
      tmeAppID: "qqmusic",
      tmeLoginType: "1",
      g_tk: 5381,
      platform: "yqq",
      ct: 24,
      cv: 0,
    },
    req: {
      module: "music.login.LoginServer",
      method: "Login",
      param: {
        strAppid: QQ_WX_APP_ID,
        code: wxCode,
      },
    },
  });
  let lastError = null;
  for (const endpoint of QQ_MUSIC_API_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          Referer: QQ_WX_REDIRECT_URI,
          Origin: "https://y.qq.com",
          Accept: "*/*",
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: "login_type=2",
        },
        body: payload,
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const parsed = JSON.parse(body);
      const topCode = Number(parsed.code || 0);
      const reqCode = Number(parsed.req?.code || 0);
      if (topCode !== 0 || reqCode !== 0) {
        throw new Error(firstNonEmpty(parsed.req?.message, parsed.req?.msg, parsed.message, parsed.msg, `code=${topCode}, req=${reqCode}`));
      }
      const cookies = responseCookies(response);
      Object.assign(cookies, qqMusicLoginDataCookies(parsed.req?.data || {}));
      return { cookies, endpoint };
    } catch (error) {
      lastError = error;
    }
  }
  throw new QQMusicAuthError("QQ_WX_LOGIN_FAILED", `微信登录换取 QQ 音乐凭据失败: ${lastError?.message || "unknown"}`, 502);
}

function qqLoginExchangeCandidatesFromTokens(cookies = {}) {
  const ptOauthToken = firstNonEmpty(cookies.pt_oauth_token);
  const pt4Token = firstNonEmpty(cookies.pt4_token);
  const supertoken = firstNonEmpty(cookies.supertoken);
  const superkey = firstNonEmpty(cookies.superkey);
  const superuin = normalizeUin(firstNonEmpty(cookies.superuin, cookies.p_uin, cookies.pt2gguin));
  const candidates = [];
  if (ptOauthToken) {
    candidates.push({ label: "pt_oauth_token-as-code", param: { code: ptOauthToken } });
    candidates.push({ label: "pt_oauth_token-as-authCode", param: { authCode: ptOauthToken } });
    candidates.push({ label: "pt_oauth_token-direct", param: { pt_oauth_token: ptOauthToken } });
  }
  if (ptOauthToken || pt4Token || supertoken || superkey) {
    candidates.push({
      label: "qq-token-bundle",
      param: compactObject({
        pt_oauth_token: ptOauthToken,
        pt4_token: pt4Token,
        supertoken,
        superkey,
        superuin,
        uin: superuin,
      }),
    });
  }
  if (pt4Token) {
    candidates.push({ label: "pt4_token-as-code", param: { code: pt4Token } });
  }
  if (supertoken) {
    candidates.push({ label: "supertoken-as-code", param: { code: supertoken } });
  }
  return candidates;
}

function compactObject(value) {
  const result = {};
  for (const [key, raw] of Object.entries(value || {})) {
    const normalized = String(raw || "").trim();
    if (normalized) result[key] = normalized;
  }
  return result;
}

function qqMusicGtk(cookies = {}) {
  const key = firstNonEmpty(cookies.p_skey, cookies.skey, cookies.qqmusic_key, cookies.musickey);
  return key ? hash33(key) : 5381;
}

async function fetchQQLoginCookiesFromTokens(cookies = {}, diagnostics = []) {
  const candidates = qqLoginExchangeCandidatesFromTokens(cookies);
  if (!candidates.length) return null;
  try {
    return await fetchQQLoginCookies(candidates, cookies, diagnostics);
  } catch (_error) {
    return null;
  }
}

async function authFromQQCallbackUrl(callbackUrl) {
  const raw = String(callbackUrl || "").trim();
  const code = extractUrlParam([raw], "code") || (/^[A-Za-z0-9_-]{8,}$/.test(raw) ? raw : "");
  const pastedCookies = parseCookieString(raw);
  if (firstNonEmpty(pastedCookies.qqmusic_key, pastedCookies.musickey, pastedCookies.qm_keyst)) {
    return authFromCookies(pastedCookies);
  }
  if (!code) {
    throw new QQMusicAuthError(
      "QQ_LOGIN_CODE_MISSING",
      "没有找到可用的 QQ 音乐登录态。请粘贴 y.qq.com 的 document.cookie，或包含 code= 的 QQ 官方回调地址。",
      400,
    );
  }
  const cookies = await fetchQQLoginCookies([{ label: "manual-callback-code", param: { code } }], { login_type: "1" });
  return authFromCookies(cookies);
}

async function fetchQQLoginCookies(candidates, baseCookies = {}, diagnostics = []) {
  const list = Array.isArray(candidates) ? candidates : [{ label: "oauth-code", param: { code: candidates } }];
  const requestCookies = { ...(baseCookies || {}), login_type: "1" };
  let lastError = null;
  let sawAttempt = false;
  for (const endpoint of QQ_MUSIC_API_ENDPOINTS) {
    for (const candidate of list) {
      sawAttempt = true;
      const payload = JSON.stringify({
        comm: {
          g_tk: qqMusicGtk(requestCookies),
          platform: "yqq",
          ct: 24,
          cv: 0,
        },
        req: {
          module: "QQConnectLogin.LoginServer",
          method: "QQLogin",
          param: candidate.param || {},
        },
      });
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "User-Agent": USER_AGENT,
            Referer: QQ_QQ_REDIRECT_URI,
            Origin: "https://y.qq.com",
            Accept: "*/*",
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: joinCookieMap(requestCookies),
          },
          body: payload,
        });
        const body = await response.text();
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const parsed = JSON.parse(body);
        const topCode = Number(parsed.code || 0);
        const reqCode = Number(parsed.req?.code || 0);
        if (topCode !== 0 || reqCode !== 0) {
          throw new Error(firstNonEmpty(parsed.req?.message, parsed.req?.msg, parsed.message, parsed.msg, `code=${topCode}, req=${reqCode}`));
        }
        const cookies = responseCookies(response);
        const loginCookies = qqMusicLoginDataCookies(parsed.req?.data || {});
        Object.assign(cookies, loginCookies);
        if (!firstNonEmpty(cookies.qqmusic_key, cookies.musickey, cookies.qm_keyst)) {
          throw new Error("QQ 音乐接口没有返回 musickey");
        }
        diagnostics.push(`${candidate.label}@${new URL(endpoint).hostname}: ok`);
        return cookies;
      } catch (error) {
        lastError = error;
        diagnostics.push(`${candidate.label}@${new URL(endpoint).hostname}: ${sanitizeDiagnosticText(error.message || "unknown")}`);
      }
    }
  }
  const message = sawAttempt
    ? `QQ 登录换取 QQ 音乐 musickey 失败: ${lastError?.message || "unknown"}`
    : "QQ 登录换取 QQ 音乐 musickey 失败: 没有可用的 code/token";
  throw new QQMusicAuthError("QQ_LOGIN_MUSIC_KEY_FAILED", message, 502);
}

function qqMusicLoginDataCookies(data) {
  const result = {};
  const value = (...keys) => {
    for (const key of keys) {
      const raw = data?.[key];
      if (typeof raw === "string" && raw.trim()) return raw.trim();
      if (typeof raw === "number" && raw > 0) return String(Math.trunc(raw));
    }
    return "";
  };
  const musicId = value("musicid", "musicId", "userid", "user_id", "uin");
  if (musicId) result.musicid = musicId;
  const musicKey = value("musickey", "music_key", "qqmusic_key", "qm_keyst", "strMusicKey");
  if (musicKey) {
    result.musickey = musicKey;
    result.qqmusic_key = musicKey;
    result.qm_keyst = musicKey;
  }
  const refreshKey = value("refresh_key", "refreshKey");
  if (refreshKey) result.refresh_key = refreshKey;
  const refreshToken = value("refresh_token", "refreshToken");
  if (refreshToken) result.refresh_token = refreshToken;
  const openId = value("openid", "openId", "wxopenid", "strOpenid");
  if (openId) {
    result.openid = openId;
    result.wxopenid = openId;
  }
  const unionId = value("unionid", "unionId", "wxunionid", "strUnionid");
  if (unionId) {
    result.unionid = unionId;
    result.wxunionid = unionId;
  }
  const accessToken = value("access_token", "accessToken", "wxaccess_token");
  if (accessToken) result.wxaccess_token = accessToken;
  return result;
}

async function fetchQQRedirectCookies(redirectUrl, cookies, options = {}) {
  let currentUrl = String(redirectUrl || "").trim();
  let finalUrl = currentUrl;
  let referer = options.referer || "https://y.qq.com/";
  const collected = { ...(cookies || {}) };
  const visitedUrls = [];
  for (let i = 0; i < 12 && currentUrl; i += 1) {
    finalUrl = currentUrl;
    visitedUrls.push(currentUrl);
    const response = await fetch(currentUrl, {
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        Referer: referer,
        Cookie: joinCookieMap(collected),
      },
    });
    Object.assign(collected, responseCookies(response));
    const body = await response.text();
    const location = String(response.headers.get("location") || "").trim();
    const bodyRedirect = firstNonEmpty(...extractRedirectUrlsFromBody(body, currentUrl));
    const nextLocation = response.status >= 300 && response.status < 400 ? location : bodyRedirect;
    if (!nextLocation) {
      visitedUrls.push(...extractLikelyUrls(body, currentUrl));
      break;
    }
    const nextUrl = new URL(nextLocation, currentUrl);
    referer = currentUrl;
    currentUrl = nextUrl.toString();
  }
  return { cookies: collected, finalUrl, visitedUrls };
}

function extractRedirectUrlsFromBody(body, baseUrl = "https://y.qq.com/") {
  const source = String(body || "");
  const urls = [];
  const patterns = [
    /(?:window\.)?location(?:\.href|\.replace)?\s*=\s*["']([^"']+)["']/gi,
    /(?:window\.)?location\.replace\(\s*["']([^"']+)["']\s*\)/gi,
    /<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url=([^"']+)["']/gi,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const value = htmlDecode(match[1] || "").trim();
      if (!value || /^javascript:/i.test(value)) continue;
      try {
        urls.push(new URL(value, baseUrl).toString());
      } catch (_error) {
        // Ignore malformed redirect candidates.
      }
    }
  }
  return urls;
}

function extractLikelyUrls(body, baseUrl = "https://y.qq.com/") {
  const source = htmlDecode(String(body || "")).replace(/\\\//g, "/");
  const urls = [];
  const pattern = /https?:\/\/[^\s"'<>\\]+/gi;
  for (const match of source.matchAll(pattern)) {
    const raw = match[0];
    try {
      const url = new URL(raw, baseUrl);
      if (url.searchParams.has("code") || url.hostname.endsWith("qq.com")) urls.push(url.toString());
    } catch (_error) {
      // Ignore malformed URL candidates.
    }
  }
  return urls;
}

function htmlDecode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function sanitizeDiagnosticUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, "https://y.qq.com/");
    for (const key of ["code", "access_token", "openid", "openkey", "key", "skey", "p_skey"]) {
      if (url.searchParams.has(key)) url.searchParams.set(key, "[redacted]");
    }
    return url.toString();
  } catch (_error) {
    return raw.slice(0, 180);
  }
}

function sanitizeDiagnosticText(value) {
  return String(value || "")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .slice(0, 160);
}

function failQQCodeMissing(redirectUrl, visitedUrls, cookies, exchangeDiagnostics = []) {
  const lastUrl = (visitedUrls || []).filter(Boolean).slice(-1)[0] || redirectUrl || "";
  const exchange = exchangeDiagnostics.length ? ` exchange=${exchangeDiagnostics.join("; ")}` : "";
  throw new QQMusicAuthError(
    "QQ_LOGIN_CODE_MISSING",
    `QQ 登录成功，但 QQ 音乐 OAuth 没有返回 code，无法继续换取 musickey。请重新扫码；如果反复出现，说明 QQ 当前拒绝了服务端完成 QQ 授权跳转。诊断: redirect=${sanitizeDiagnosticUrl(redirectUrl)} last=${sanitizeDiagnosticUrl(lastUrl)} cookieKeys=${Object.keys(cookies || {}).sort().join(",")}${exchange}`,
    502,
  );
}

function extractUrlParam(urls, ...keys) {
  for (const raw of urls || []) {
    if (!raw) continue;
    try {
      const url = new URL(String(raw), "https://y.qq.com/");
      for (const key of keys) {
        const value = String(url.searchParams.get(key) || "").trim();
        if (value) return value;
      }
    } catch (_error) {
      // Ignore malformed redirect URLs.
    }
  }
  return "";
}

async function createQQMusicQRLogin(loginType) {
  return normalizeLoginType(loginType) === "wx" ? createQQWXQRLogin() : createQQQRLogin();
}

async function checkQQMusicQRLogin(loginType, key) {
  return normalizeLoginType(loginType) === "wx" ? checkQQWXQRLogin(key) : checkQQQRLogin(key);
}

function publicAuthInfo(auth) {
  if (!auth) return null;
  return {
    uin: auth.uin,
    hasMusicKey: !!auth.hasMusicKey,
    display: auth.display || (auth.uin ? `QQ 音乐账号 ${auth.uin}` : "已登录 QQ 音乐"),
  };
}

module.exports = {
  QQMusicAuthError,
  authFromQQCallbackUrl,
  buildQQOAuthAuthorizeUrl,
  buildQQXLoginUrl,
  checkQQMusicQRLogin,
  createQQMusicQRLogin,
  decodeQQQRSessionKey,
  encodeQQQRSessionKey,
  extractLikelyUrls,
  extractRedirectUrlsFromBody,
  qqLoginExchangeCandidatesFromTokens,
  qqMusicGtk,
  bufferToDataUrl,
  hash33,
  joinCookieMap,
  mapQQQRStatus,
  mapQQWXQRStatus,
  normalizeQQMusicCookies,
  parseCookieString,
  parseQQQRCheck,
  parseQQWXQRCheck,
  publicAuthInfo,
  splitSetCookieHeader,
};
