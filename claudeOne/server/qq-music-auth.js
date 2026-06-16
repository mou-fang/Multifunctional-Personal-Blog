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
const QQ_WX_QR_CONNECT_API = "https://open.weixin.qq.com/connect/qrconnect";
const QQ_WX_QR_CHECK_API = "https://lp.open.weixin.qq.com/connect/l/qrconnect";
const QQ_WX_REDIRECT_URI = "https://y.qq.com/portal/wx_redirect.html?login_type=2&surl=https://y.qq.com/";
const QQ_WX_APP_ID = "wx48db31d50e334801";

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

  if (!result.qqmusic_key) {
    result.qqmusic_key = firstNonEmpty(result.p_skey, result.skey, result.musickey, result.qm_keyst);
  }
  if (!result.qm_keyst && result.qqmusic_key) result.qm_keyst = result.qqmusic_key;
  if (!result.musickey && result.qqmusic_key) result.musickey = result.qqmusic_key;
  return result;
}

function authFromCookies(cookies) {
  const normalized = normalizeQQMusicCookies(cookies);
  const cookie = joinCookieMap(normalized);
  const uin = normalizeUin(normalized.qqmusic_uin || normalized.uin || normalized.musicid || normalized.wxuin);
  if (!cookie || !uin) {
    throw new QQMusicAuthError("QQ_LOGIN_COOKIE_INVALID", "QQ 音乐登录成功，但没有拿到可用的账号凭据", 502);
  }
  return {
    cookie,
    uin,
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

async function createQQQRLogin() {
  const params = new URLSearchParams({
    appid: "716027609",
    e: "2",
    l: "M",
    s: "3",
    d: "72",
    v: "4",
    t: (Date.now() / 1000).toFixed(17),
    daid: "383",
    pt_3rd_aid: "100497308",
  });
  const response = await fetch(`${QQ_QR_SHOW_API}?${params}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://y.qq.com/",
    },
  });
  if (!response.ok) {
    throw new QQMusicAuthError("QQ_QR_CREATE_FAILED", `QQ 登录二维码生成失败: HTTP ${response.status}`, 502);
  }
  const image = Buffer.from(await response.arrayBuffer());
  const cookies = responseCookies(response);
  const qrsig = String(cookies.qrsig || "").trim();
  if (!qrsig) {
    throw new QQMusicAuthError("QQ_QR_CREATE_FAILED", "QQ 登录二维码缺少 qrsig", 502);
  }
  return {
    type: "qq",
    key: new URLSearchParams({ qrsig }).toString(),
    imageUrl: bufferToDataUrl(image, "image/png"),
    expiresAt: Date.now() + 2 * 60 * 1000,
  };
}

async function checkQQQRLogin(key) {
  const values = new URLSearchParams(key);
  const qrsig = String(values.get("qrsig") || "").trim();
  if (!qrsig) throw new QQMusicAuthError("QQ_QR_SESSION_INVALID", "QQ 登录会话缺少 qrsig");

  const params = new URLSearchParams({
    u1: "https://graph.qq.com/oauth2.0/login_jump",
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
    login_sig: "",
    pt_uistyle: "40",
    aid: "716027609",
    daid: "383",
    pt_3rd_aid: "100497308",
    has_onekey: "1",
    pttype: "1",
    service: "ptqrlogin",
    nodirect: "0",
  });
  const { response, text } = await fetchText(`${QQ_QR_CHECK_API}?${params}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://xui.ptlogin2.qq.com/",
      Cookie: `qrsig=${qrsig}`,
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

  const cookies = responseCookies(response);
  if (parsed.redirectUrl) {
    const redirectCookies = await fetchQQRedirectCookies(parsed.redirectUrl, cookies);
    Object.assign(cookies, redirectCookies);
  }
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
  const endpoints = [
    "https://u.y.qq.com/cgi-bin/musicu.fcg",
    "https://szu.y.qq.com/cgi-bin/musicu.fcg",
    "https://shu.y.qq.com/cgi-bin/musicu.fcg",
  ];
  let lastError = null;
  for (const endpoint of endpoints) {
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
      Object.assign(cookies, qqWXLoginDataCookies(parsed.req?.data || {}));
      return { cookies, endpoint };
    } catch (error) {
      lastError = error;
    }
  }
  throw new QQMusicAuthError("QQ_WX_LOGIN_FAILED", `微信登录换取 QQ 音乐凭据失败: ${lastError?.message || "unknown"}`, 502);
}

function qqWXLoginDataCookies(data) {
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

async function fetchQQRedirectCookies(redirectUrl, cookies) {
  let currentUrl = String(redirectUrl || "").trim();
  let referer = "https://y.qq.com/";
  const collected = { ...(cookies || {}) };
  for (let i = 0; i < 8 && currentUrl; i += 1) {
    const response = await fetch(currentUrl, {
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        Referer: referer,
        Cookie: joinCookieMap(collected),
      },
    });
    Object.assign(collected, responseCookies(response));
    const location = String(response.headers.get("location") || "").trim();
    if (!location || response.status < 300 || response.status >= 400) break;
    const nextUrl = new URL(location, currentUrl);
    referer = currentUrl;
    currentUrl = nextUrl.toString();
  }
  return collected;
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
    display: auth.display || (auth.uin ? `QQ 音乐账号 ${auth.uin}` : "已登录 QQ 音乐"),
  };
}

module.exports = {
  QQMusicAuthError,
  checkQQMusicQRLogin,
  createQQMusicQRLogin,
  bufferToDataUrl,
  hash33,
  joinCookieMap,
  mapQQQRStatus,
  mapQQWXQRStatus,
  normalizeQQMusicCookies,
  parseQQQRCheck,
  parseQQWXQRCheck,
  publicAuthInfo,
  splitSetCookieHeader,
};
