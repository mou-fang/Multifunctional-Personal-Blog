/*
 * QQ Music EKey fetch & metadata proxy (server-side).
 *
 * Decryption has been moved to the browser (js/qq-music-decrypt.js).
 * This module only handles QQ API communication that requires CORS proxying.
 */

const QQ_API_URL = "https://u.y.qq.com/cgi-bin/musicu.fcg";
const QQ_API_REFERER = "https://y.qq.com/";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

class QQMusicUnlockError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "QQMusicUnlockError";
    this.code = code;
    this.status = status;
  }
}

class QQMusicAuthError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "QQMusicAuthError";
    this.code = code;
    this.status = status;
  }
}

// ---- Cookie parsing --------------------------------------------------------

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
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

function joinCookieMap(cookies) {
  return Object.keys(cookies || {})
    .filter(key => String(key || "").trim() && String(cookies[key] || "").trim())
    .sort()
    .map(key => `${key}=${cookies[key]}`)
    .join("; ");
}

function authFromCookieString(rawCookie) {
  const cookies = parseCookieString(rawCookie);
  const normalized = normalizeQQMusicCookies(cookies);
  const cookie = joinCookieMap(normalized);
  const uin = normalizeUin(normalized.qqmusic_uin || normalized.uin || normalized.musicid || normalized.wxuin);
  if (!cookie) {
    throw new QQMusicAuthError("QQ_LOGIN_COOKIE_INVALID", "没有找到有效的 Cookie 内容", 400);
  }
  if (!uin) {
    throw new QQMusicAuthError("QQ_LOGIN_COOKIE_INVALID", "Cookie 中没有找到 uin，请确认复制的是 y.qq.com 的完整 Cookie", 400);
  }
  const musicKey = firstNonEmpty(normalized.qqmusic_key, normalized.musickey, normalized.qm_keyst);
  if (!musicKey) {
    throw new QQMusicAuthError(
      "QQ_LOGIN_MUSIC_KEY_MISSING",
      "Cookie 中没有 qqmusic_key/musickey，请确认已在 y.qq.com 登录后再复制 Cookie",
      400,
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

function publicAuthInfo(auth) {
  if (!auth) return null;
  return {
    display: auth.display || "",
    uin: auth.uin || "",
    hasMusicKey: !!auth.hasMusicKey,
  };
}

// ---- QQ API communication --------------------------------------------------

function createQQGuid() {
  return String(Math.floor(Math.random() * 9000000000) + 1000000000);
}

async function postQQApi(payload, cookie = "") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(QQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "QQMusic/21",
        Referer: QQ_API_REFERER,
        Origin: "https://y.qq.com",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    throw new QQMusicUnlockError("QQ_API_FAILED", `连接 QQ 音乐接口失败: ${error.message}`, 502);
  } finally {
    clearTimeout(timer);
  }
}

// ---- EKey fetch ------------------------------------------------------------

function uniqueNonEmpty(values) {
  return Array.from(new Set(values.map(value => String(value || "").trim()).filter(Boolean)));
}

function getMusicexFileInfo(meta) {
  const filename = String(meta.filename || "").trim();
  const fileMid = filename.replace(/\.(?:mflac|mgg)$/i, "");
  if (!fileMid || !meta.songMid) {
    throw new QQMusicUnlockError("INVALID_QQ_FILE", "musicex 文件缺少歌曲或文件标识");
  }
  const extMatch = filename.match(/\.(?:mflac|mgg)$/i);
  const extension = extMatch ? extMatch[0].toLowerCase() : (fileMid.startsWith("F0") ? ".mflac" : ".mgg");
  return {
    fileMid,
    filename: filename || `${fileMid}${extension}`,
    extension,
  };
}

function buildEkeyAttempts(meta, auth) {
  const fileInfo = getMusicexFileInfo(meta);
  const filenames = uniqueNonEmpty([
    fileInfo.filename,
    `${fileInfo.fileMid}${fileInfo.extension}`,
  ]);
  const authUin = String(auth?.uin || "").trim();
  const hasAuthUin = authUin && authUin !== "0";
  const attempts = [];

  function push(name, module, method, uin, opts = {}) {
    attempts.push({
      name,
      module,
      method,
      uin: String(uin || "0"),
      commUin: Number(uin) || 0,
      guid: opts.guid || createQQGuid(),
      filenames,
      // EVkey-specific fields. When `evkey: true`, buildEkeyPayload uses the
      // GetEVkey parameter shape (musicfile + checklimit + ctx + scene +
      // referer + nettype + songtype:1) instead of the GetVkey shape.
      evkey: !!opts.evkey,
      songtype: opts.songtype != null ? opts.songtype : 0,
    });
  }

  // GetEVkey is the dedicated endpoint for VIP-encrypted .mflac/.mgg media.
  // QQ Music's vkey.GetVkeyServer/CgiGetVkey path returns a non-empty ekey
  // only for some accounts; GetEVkey works more reliably and is what we put
  // first.  songtype must be 1 here (per the official RPC schema).
  if (hasAuthUin) push("CgiGetEVkey/auth", "music.vkey.GetEVkey", "CgiGetEVkey", authUin, { evkey: true, songtype: 1 });
  push("CgiGetEVkey/zero", "music.vkey.GetEVkey", "CgiGetEVkey", "0", { evkey: true, songtype: 1 });

  // Legacy GetVkey path (still works for some songs).
  if (hasAuthUin) push("CgiGetVkey/auth-random", "vkey.GetVkeyServer", "CgiGetVkey", authUin);
  push("CgiGetVkey/zero-random", "vkey.GetVkeyServer", "CgiGetVkey", "0");
  push("UrlGetVkey/zero-random", "music.vkey.GetVkey", "UrlGetVkey", "0");
  if (hasAuthUin) push("UrlGetVkey/auth-random", "music.vkey.GetVkey", "UrlGetVkey", authUin);
  if (hasAuthUin) push("CgiGetVkey/auth-fixed", "vkey.GetVkeyServer", "CgiGetVkey", authUin, { guid: "10000" });

  return attempts;
}

function buildEkeyPayload(attempt, songMid) {
  const songmids = attempt.filenames.map(() => songMid);
  const songtypes = songmids.map(() => attempt.songtype || 0);
  const param = attempt.evkey ? {
    // GetEVkey/CgiGetEVkey shape (per qmpc-rpc reference).
    checklimit: 0,
    ctx: 1,
    downloadfrom: 0,
    filename: attempt.filenames,
    guid: attempt.guid,
    musicfile: attempt.filenames,
    nettype: "",
    referer: "y.qq.com",
    scene: 0,
    songmid: songmids,
    songtype: songtypes,
    uin: attempt.uin,
  } : {
    // Legacy GetVkey/CgiGetVkey shape.
    filename: attempt.filenames,
    guid: attempt.guid,
    songmid: songmids,
    songtype: songtypes,
    uin: attempt.uin,
    loginflag: 1,
    platform: "20",
  };
  return {
    comm: {
      cv: 4747474, ct: 24, format: "json", inCharset: "utf-8", outCharset: "utf-8",
      notice: 0, platform: "yqq.json", needNewCode: 1, uin: attempt.commUin,
      g_tk_new_20200303: 5381, g_tk: 5381,
    },
    req_1: {
      module: attempt.module,
      method: attempt.method,
      param,
    },
  };
}

function getMidUrlInfo(result) {
  const items = result?.req_1?.data?.midurlinfo;
  return Array.isArray(items) ? items : [];
}

function getFirstEkey(result) {
  for (const item of getMidUrlInfo(result)) {
    const ekey = String(item?.ekey || "").trim();
    if (ekey) return ekey;
  }
  return "";
}

function compactQQDiagnostic(value, maxLength = 80) {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, maxLength);
}

function summarizeEkeyAttempt(attempt, result) {
  const req = result?.req_1 || {};
  const data = req.data || {};
  const items = getMidUrlInfo(result);
  const first = items[0] || {};
  const parts = [
    attempt.name,
    `code=${req.code ?? result?.code ?? "?"}`,
    `items=${items.length}`,
  ];
  const message = req.message || req.msg || data.msg || first.msg || first.errmsg || first.reason;
  const subCode = first.subcode ?? first.vkeyerr ?? first.errtype ?? first.errcode;
  if (message) parts.push(`msg=${compactQQDiagnostic(message, 60)}`);
  if (subCode !== undefined) parts.push(`sub=${compactQQDiagnostic(subCode, 24)}`);
  if (first.purl !== undefined) parts.push(`purl=${first.purl ? "yes" : "empty"}`);
  if (first.ekey !== undefined) parts.push(`ekey=${first.ekey ? "yes" : "empty"}`);
  if (first.filename) parts.push(`file=${compactQQDiagnostic(first.filename, 80)}`);
  return parts.join(" ");
}

async function fetchEkey(meta, auth) {
  const attempts = buildEkeyAttempts(meta, auth);
  const diagnostics = [];

  for (const attempt of attempts) {
    const result = await postQQApi(buildEkeyPayload(attempt, meta.songMid), auth.cookie);
    const ekey = getFirstEkey(result);
    if (ekey) return ekey;
    diagnostics.push(summarizeEkeyAttempt(attempt, result));
  }

  const detail = diagnostics.slice(0, 4).join("; ");
  if (detail) console.warn("[music] QQ Music returned empty EKey:", detail);
  throw new QQMusicUnlockError(
    "QQ_VIP_REQUIRED",
    "QQ 音乐没有返回解密密钥。通常是登录会话失效、账号没有这首歌的下载/会员权限。请重新导入 Cookie，并确认这首歌能在 QQ 音乐用当前账号播放。" +
      (detail ? ` 诊断: ${detail}` : ""),
    403,
  );
}

// ---- Song metadata ---------------------------------------------------------

function stripMarkup(value) {
  return String(value || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
}

// Extract a clean songmid (14-char base62) from a raw value. The musicex tail
// stores it as a UTF-16LE string, but callers may pass it with surrounding
// whitespace or mixed with the filename; trim to the leading alnum run.
function cleanSongMid(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^[A-Za-z0-9]+/);
  return match ? match[0] : raw;
}

// Build a song-info request payload for the batch detail endpoint.
function buildSongInfoPayload(songMid, uin) {
  return {
    comm: { cv: 4747474, ct: 24, format: "json", inCharset: "utf-8", outCharset: "utf-8", uin: Number(uin) || 0, g_tk: 5381 },
    req_1: {
      module: "music.musichallSong.songinfoserver",
      method: "GetSongDetail",
      param: {
        song_mid: [songMid],
        song_id: [0],
        song_type: [0],
      },
    },
  };
}

async function fetchSongMetadata(songMid, auth) {
  const mid = cleanSongMid(songMid);
  if (!mid) return null;

  // 1) Prefer the precise GetSongDetail endpoint (looks up by songmid directly,
  //    no fuzzy text matching that returns the wrong song).
  try {
    const result = await postQQApi(buildSongInfoPayload(mid, auth?.uin), auth?.cookie || "");
    const track = result?.req_1?.data?.tracks?.[0] || result?.req_1?.data?.track_info;
    if (track && (track.mid || track.songmid)) {
      const albumMid = track.album?.mid || "";
      return {
        title: stripMarkup(track.title || track.name),
        artist: (track.singer || []).map(item => stripMarkup(item.title || item.name)).filter(Boolean).join("/"),
        album: stripMarkup(track.album?.title || track.album?.name),
        albumMid,
        coverUrl: albumMid ? `/api/music/cover/${albumMid}` : "",
      };
    }
  } catch (_error) {
    // Fall through to the search-based lookup below.
  }

  // 2) Fallback: fuzzy search. Only trust a result whose songmid matches the
  //    one we asked for, to avoid showing the wrong song.
  try {
    const result = await postQQApi({
      comm: { cv: 4747474, ct: 24, format: "json", uin: Number(auth?.uin || 0) },
      req_1: {
        module: "music.search.SearchCgiService",
        method: "DoSearchForQQMusicDesktop",
        param: { query: mid, page_num: 1, num_per_page: 10, search_type: 0 },
      },
    }, auth?.cookie || "");
    const list = result?.req_1?.data?.body?.song?.list || [];
    // Pick the first entry whose mid equals the requested songmid.
    const song = list.find(item => cleanSongMid(item.mid || item.songmid) === mid) || null;
    if (!song) return null;
    const albumMid = song.album?.mid || "";
    return {
      title: stripMarkup(song.title || song.name),
      artist: (song.singer || []).map(item => stripMarkup(item.title || item.name)).filter(Boolean).join("/"),
      album: stripMarkup(song.album?.title || song.album?.name),
      albumMid,
      coverUrl: albumMid ? `/api/music/cover/${albumMid}` : "",
    };
  } catch (_error) {
    return null;
  }
}

module.exports = {
  QQMusicUnlockError,
  QQMusicAuthError,
  authFromCookieString,
  publicAuthInfo,
  fetchEkey,
  fetchSongMetadata,
};
