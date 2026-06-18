/* ===== claudeOne :: music.js =====
 * Music unlock page — file upload, worker communication, download.
 * Legacy formats run in a Web Worker. New QQ musicex files use the local API.
 * Audio playback delegated to global ClaudeOnePlayer.
 */

(function bootstrapMusic() {
  const CFG = window.CLAUDE_ONE_CONFIG;
  const CS = window.ClaudeOne;

  if (!CFG || !CS) {
    console.error("[music] Config or shell missing — deferring init");
    // Register lifecycle anyway, shell will be available at mount time
  }

  // --- Persistent module state (survives mount/unmount) ----------------------
  const fileResults = new Map();
  const FALLBACK_SUPPORTED_EXTS = Object.freeze([
    ".ncm", ".qmc0", ".qmc2", ".qmc3", ".qmcflac", ".qmcogg",
    ".mflac", ".mgg", ".tkm", ".bkcmp3", ".bkcflac",
    ".tm0", ".tm2", ".tm3", ".tm6",
  ]);
  // All QQ Music encrypted formats route through decryptQQMusicFrontend, which
  // delegates to qq-music-decrypt.js. That module's parseFileTail handles all
  // three tail formats (musicex / QTag / STag) so a single code path covers
  // both new (.mflac/.mgg) and legacy (.qmc*/.tkm/.bkc*/.tm*) extensions.
  const QQ_MUSIC_EXTS = new Set([
    ".mflac", ".mgg",
    ".qmc0", ".qmc2", ".qmc3", ".qmcflac", ".qmcogg",
    ".tkm", ".bkcmp3", ".bkcflac",
    ".tm0", ".tm2", ".tm3", ".tm6",
  ]);
  const FRONTEND_UNLOCK_EXTS = new Set([".ncm"]);
  const API_BASE = CFG && CFG.api ? String(CFG.api.baseUrl || "").replace(/\/$/, "") : "";
  const AUTH_STORAGE_KEY = "claudeOne:music-qq-auth-session";
  const QQ_OFFICIAL_AUTH_URL = "https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=100497308&redirect_uri=https%3A%2F%2Fy.qq.com%2Fportal%2Fwx_redirect.html%3Flogin_type%3D1%26surl%3Dhttps%253A%252F%252Fy.qq.com%252F&state=claudeone-manual&display=pc&scope=get_user_info%2Cget_app_friends";
  let worker = null;
  let idCounter = 0;
  let workerReady = false;
  let qqAuthSession = null;

  // --- Per-mount state -------------------------------------------------------
  let container = null;
  let ac = null;
  let uploadZone, fileInput, fileList, batchActions;
  let downloadAllBtn, clearAllBtn;
  let namingRadios, emptyState;
  let qqLoginStatus, qqLogoutBtn;
  let qqOpenOfficialBtn, qqCallbackInput, qqSubmitCallbackBtn;
  let qqLoginDetail;

  const AUDIO_MIME_BY_EXT = {
    mp3: "audio/mpeg",
    flac: "audio/flac",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    wav: "audio/wav",
    aac: "audio/aac"
  };

  function getMusicConfig() {
    return (window.CLAUDE_ONE_CONFIG && window.CLAUDE_ONE_CONFIG.music) ||
      (CFG && CFG.music) ||
      {};
  }

  function getSupportedExts() {
    var configured = getMusicConfig().supportedExts;
    return configured && configured.length
      ? Array.prototype.slice.call(configured)
      : FALLBACK_SUPPORTED_EXTS;
  }

  function getMaxMusicFileSize() {
    return Number(getMusicConfig().maxFileSize) || 200 * 1024 * 1024;
  }

  function getFileExt(name) {
    var cleanName = String(name || "").trim().toLowerCase();
    var supported = getSupportedExts().slice().sort(function (a, b) {
      return b.length - a.length;
    });
    for (var i = 0; i < supported.length; i++) {
      if (cleanName.endsWith(supported[i])) return supported[i];
    }
    var match = cleanName.match(/(\.[^./\\\s]+)$/);
    return match ? match[1] : "";
  }

  function detectImageMime(buffer) {
    var bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 16));
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
    if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
    return "image/jpeg";
  }

  function completeEntry(entry, data) {
    if (!data || !data.audio || data.audio.byteLength === 0) {
      throw new Error("解锁器没有返回有效音频");
    }
    entry.status = "done";
    entry.title = data.title || entry.name;
    entry.artist = data.artist || "未知艺术家";
    entry.album = data.album || "";
    entry.ext = String(data.ext || "mp3").replace(/^\./, "").toLowerCase();
    entry.mime = data.mime || AUDIO_MIME_BY_EXT[entry.ext] || "application/octet-stream";
    entry.blob = new Blob([data.audio], { type: entry.mime });
    if (data.picture && data.picture.byteLength > 0) {
      if (entry.coverUrl) URL.revokeObjectURL(entry.coverUrl);
      entry.coverUrl = URL.createObjectURL(new Blob(
        [data.picture],
        { type: data.pictureMime || detectImageMime(data.picture) }
      ));
    }
  }

  function refreshEntry(id) {
    if (container) {
      updateFileCardDOM(id);
      updateEmptyDOM();
    }
  }

  function saveAuthSession() {
    try {
      if (qqAuthSession && qqAuthSession.id) {
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
          id: qqAuthSession.id,
          expiresAt: qqAuthSession.expiresAt,
          uin: qqAuthSession.uin || "",
          display: qqAuthSession.display || "",
        }));
      } else {
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (_error) {
      // Session storage is only a convenience; server memory is authoritative.
    }
  }

  function loadAuthSession() {
    try {
      var raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.id || (parsed.expiresAt && parsed.expiresAt <= Date.now())) {
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch (_error) {
      return null;
    }
  }

  function setAuthStatus(message, tone) {
    if (qqLoginStatus) {
      qqLoginStatus.textContent = message;
      qqLoginStatus.setAttribute("data-tone", tone || "idle");
    }
  }

  function setAuthButtonsBusy(isBusy) {
    if (qqOpenOfficialBtn) qqOpenOfficialBtn.disabled = !!isBusy;
    if (qqSubmitCallbackBtn) qqSubmitCallbackBtn.disabled = !!isBusy;
  }

  function renderAuthSession(session) {
    qqAuthSession = session || null;
    saveAuthSession();
    var isLoggedIn = !!(qqAuthSession && qqAuthSession.id);

    if (qqLogoutBtn) qqLogoutBtn.hidden = !isLoggedIn;

    if (isLoggedIn) {
      var display = qqAuthSession.display || "已登录 QQ 音乐";
      setAuthStatus(display + "。新版 .mflac/.mgg 会使用这个账号请求 EKey。", "ok");
      if (qqLoginDetail) qqLoginDetail.textContent = "Cookie 保存在服务器内存中，默认 2 小时过期。退出登录会立即清除。";
    } else {
      setAuthStatus("未登录。旧格式可直接解锁；新版 QQ 文件需要导入 Cookie。", "idle");
      if (qqLoginDetail) qqLoginDetail.textContent = "在 y.qq.com 登录后，按 F12 打开控制台，输入 document.cookie 复制整串内容，粘贴到下方输入框导入。服务器只在内存中保存，退出登录会立即清除。";
    }
  }

  function openQQOfficialLogin() {
    window.open(QQ_OFFICIAL_AUTH_URL, "_blank", "noopener,noreferrer");
    setAuthStatus("已打开 QQ 官方登录页。登录后会跳到 y.qq.com，然后复制 document.cookie 粘贴到下方。", "warn");
  }

  async function submitCookieLogin() {
    var cookieValue = qqCallbackInput ? qqCallbackInput.value.trim() : "";
    if (!cookieValue) {
      setAuthStatus("请先粘贴 y.qq.com 的 document.cookie。", "err");
      return;
    }
    try {
      setAuthButtonsBusy(true);
      setAuthStatus("正在导入 QQ 音乐登录态...", "warn");
      var response = await fetch(API_BASE + "/api/music/auth/cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: cookieValue })
      });
      var payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Cookie 导入失败");
      if (qqCallbackInput) qqCallbackInput.value = "";
      renderAuthSession(payload.session);
    } catch (error) {
      renderAuthSession(null);
      setAuthStatus(error.message || "Cookie 导入失败，请确认粘贴的是 y.qq.com 的 document.cookie。", "err");
    } finally {
      setAuthButtonsBusy(false);
    }
  }

  async function logoutQQAuth() {
    var id = qqAuthSession && qqAuthSession.id;
    if (id) {
      try { await fetch(API_BASE + "/api/music/auth/" + encodeURIComponent(id), { method: "DELETE" }); }
      catch (_error) { /* Ignore logout network errors; local state is cleared. */ }
    }
    qqAuthSession = null;
    saveAuthSession();
    renderAuthSession(null);
  }

  function getAuthSessionId() {
    return qqAuthSession && qqAuthSession.id ? qqAuthSession.id : "";
  }

  async function updateMusicLimitNotice() {
    // No-op: limit notice removed since decryption is now client-side.
  }

  // --- Worker management (persistent) ----------------------------------------
  function ensureWorker() {
    if (worker) return;
    try {
      worker = new Worker("./js/decrypt-worker.js");
      worker.onmessage = function (e) {
        var data = e.data;
        var entry = fileResults.get(data.id);
        if (!entry) return;

        if (data.status === "error") {
          entry.status = "error";
          entry.error = data.error || "解锁失败";
        } else {
          try {
            completeEntry(entry, data.data);
          } catch (error) {
            entry.status = "error";
            entry.error = error.message;
          }
        }
        refreshEntry(data.id);
      };
      worker.onerror = function (e) {
        console.error("[music] Worker error:", e);
        if (CS && CS.toast) CS.toast("解密引擎启动失败，请刷新页面重试", "err");
      };
      workerReady = true;
    } catch (err) {
      console.error("[music] Cannot create worker:", err);
      if (CS && CS.toast) CS.toast("当前环境不支持后台解密", "err");
    }
  }

  // --- File processing -------------------------------------------------------
  function handleFiles(files) {
    var added = 0;
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var ext = getFileExt(file.name);
      if (!getSupportedExts().includes(ext)) {
        if (CS && CS.toast) CS.toast("不支持格式: " + file.name + "。支持 .ncm/.qmc/.mflac/.mgg 等音乐加密格式", "err", 3500);
        continue;
      }
      if (!QQ_MUSIC_EXTS.has(ext) && !FRONTEND_UNLOCK_EXTS.has(ext) && !worker) {
        if (CS && CS.toast) CS.toast("浏览器解密引擎未就绪: " + file.name, "err", 2500);
        continue;
      }
      if (file.size > getMaxMusicFileSize()) {
        if (CS && CS.toast) CS.toast("文件过大: " + file.name, "err", 2500);
        continue;
      }
      if (file.size === 0) {
        if (CS && CS.toast) CS.toast("文件为空: " + file.name, "err", 2500);
        continue;
      }

      var id = String(++idCounter);
      fileResults.set(id, {
        name: file.name.replace(/\.[^.]+$/, ""),
        rawName: file.name,
        status: "decrypting",
        title: null, artist: null, album: null, ext: null, mime: null,
        blob: null, coverUrl: null, error: null
      });

      renderFileCardDOM(id);
      readAndDecrypt(id, file);
      added++;
    }
    if (added > 0) updateEmptyDOM();
  }

  function readAndDecrypt(id, file) {
    var ext = getFileExt(file.name);
    if (QQ_MUSIC_EXTS.has(ext)) {
      decryptQQMusicFrontend(id, file);
      return;
    }
    if (ext === ".ncm") {
      decryptNcmInBrowser(id, file);
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      if (!worker) return;
      worker.postMessage({ id: id, name: file.name, buffer: reader.result }, [reader.result]);
    };
    reader.onerror = function () {
      var entry = fileResults.get(id);
      if (entry) { entry.status = "error"; entry.error = "无法读取文件"; updateFileCardDOM(id); }
    };
    reader.readAsArrayBuffer(file);
  }

  function decryptNcmInBrowser(id, file) {
    var reader = new FileReader();
    reader.onload = function () {
      var entry = fileResults.get(id);
      if (!entry) return;
      try {
        if (!window.ClaudeOneNcmDecrypt || typeof window.ClaudeOneNcmDecrypt.decrypt !== "function") {
          throw new Error("NCM 前端解密器未加载，请刷新页面后重试");
        }
        completeEntry(entry, window.ClaudeOneNcmDecrypt.decrypt(reader.result, file.name));
      } catch (error) {
        entry.status = "error";
        entry.error = error.message || "NCM 解锁失败";
      }
      refreshEntry(id);
    };
    reader.onerror = function () {
      var entry = fileResults.get(id);
      if (entry) {
        entry.status = "error";
        entry.error = "无法读取文件";
        refreshEntry(id);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function decryptQQMusicFrontend(id, file) {
    var entry = fileResults.get(id);
    if (!entry) return;
    try {
      entry.status = "decrypting";
      refreshEntry(id);

      // 1. Read file
      var arrayBuffer = await file.arrayBuffer();

      // 2. Parse file tail
      if (!window.ClaudeOneQQDecrypt || typeof window.ClaudeOneQQDecrypt.decrypt !== "function") {
        throw new Error("QQ 音乐前端解密器未加载，请刷新页面后重试");
      }

      // 3. Parse file tail first to decide whether an EKey is needed.
      //    New-format .mflac/.mgg (musicex) files do NOT embed an EKey, so we
      //    must fetch it from the server using the logged-in account.
      //    Legacy QTag/STag files embed the EKey in the tail and decrypt directly.
      var tail = window.ClaudeOneQQDecrypt.parseFileTail(arrayBuffer);
      if (!tail) {
        throw new Error("没有识别到 musicex、QTag 或 STag 文件尾部，请使用原始 QQ 音乐加密文件");
      }

      var result;
      try {
        // tail.ekey is non-empty only for legacy QTag/STag files.
        result = window.ClaudeOneQQDecrypt.decrypt(arrayBuffer, tail.ekey || "");
      } catch (decryptError) {
        // musicex files (tail.ekey == null) need a server-provided EKey.
        // Re-throw only if the file already had an embedded EKey but still failed
        // (e.g. invalid key / no playback permission) — we cannot help further.
        if (tail.ekey) throw decryptError;
        if (!tail.songMid) throw decryptError;

        var authSessionId = getAuthSessionId();
        if (!authSessionId) {
          setAuthStatus("新版 QQ musicex 文件需要导入 Cookie 才能获取 EKey。", "err");
          throw new Error("需要先导入 QQ 音乐 Cookie 才能解锁此文件");
        }

        // Fetch ekey from server
        var ekeyResponse = await fetch(API_BASE + "/api/music/ekey", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authSessionId: authSessionId,
            songMid: tail.songMid,
            filename: tail.filename || "",
          }),
        });
        var ekeyPayload = await ekeyResponse.json();
        if (!ekeyResponse.ok || !ekeyPayload.success) {
          var errMsg = ekeyPayload.error || "获取 EKey 失败";
          if (ekeyPayload.code === "QQ_LOGIN_REQUIRED") {
            setAuthStatus("Cookie 已过期，请重新导入。", "err");
          } else if (ekeyPayload.code === "QQ_VIP_REQUIRED") {
            setAuthStatus(errMsg, "err");
          }
          throw new Error(errMsg);
        }

        // Decrypt with ekey
        result = window.ClaudeOneQQDecrypt.decrypt(arrayBuffer, ekeyPayload.ekey);
      }

      // 4. Fetch metadata from server
      var title = "", artist = "", album = "", coverUrl = "";
      if (result.songMid) {
        try {
          var authSessionId2 = getAuthSessionId();
          var metaResponse = await fetch(API_BASE + "/api/music/metadata", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              songMid: result.songMid,
              authSessionId: authSessionId2 || "",
            }),
          });
          var metaPayload = await metaResponse.json();
          if (metaResponse.ok && metaPayload.success && metaPayload.metadata) {
            title = metaPayload.metadata.title || "";
            artist = metaPayload.metadata.artist || "";
            album = metaPayload.metadata.album || "";
            coverUrl = metaPayload.metadata.coverUrl || "";
          }
        } catch (_metaError) {
          // Metadata is optional, audio is still usable
        }
      }

      // 5. Fetch cover image. Prefer the server-provided cover (matches the
      //    looked-up album). If that's missing or the fetch fails, fall back to
      //    the picture embedded in the decrypted audio itself (QQ Music files
      //    carry their own cover), which is always correct for THIS song.
      var picture = null;
      var pictureMime = "";
      if (coverUrl) {
        try {
          var coverResponse = await fetch(API_BASE + coverUrl);
          if (coverResponse.ok) {
            pictureMime = coverResponse.headers.get("content-type") || "image/jpeg";
            picture = await coverResponse.arrayBuffer();
          }
        } catch (_coverError) {
          // Cover is optional, fall through to embedded cover.
        }
      }
      if (!picture && result.picture) {
        picture = result.picture;
        pictureMime = result.pictureMime || "image/jpeg";
      }

      // 6. Complete
      entry = fileResults.get(id);
      if (!entry) return;
      var extMap = { ".flac": "flac", ".ogg": "ogg", ".mp3": "mp3", ".m4a": "m4a" };
      completeEntry(entry, {
        audio: result.audio,
        title: title || file.name.replace(/\.[^.]+$/, ""),
        artist: artist || "未知艺术家",
        album: album || "",
        ext: extMap[result.ext] || "mp3",
        mime: AUDIO_MIME_BY_EXT[extMap[result.ext]] || "application/octet-stream",
        picture: picture,
        pictureMime: pictureMime,
      });
    } catch (error) {
      entry = fileResults.get(id);
      if (!entry) return;
      entry.status = "error";
      entry.error = error.message || "QQ 音乐解锁失败";
    }
    refreshEntry(id);
  }

  // --- DOM rendering (only when mounted) -------------------------------------
  function buildCardHTML(entry) {
    var coverHTML = entry.coverUrl
      ? '<img src="' + CS.escapeHtml(entry.coverUrl) + '" alt="cover" />'
      : '<span>&#9835;</span>';

    var title = entry.title || entry.name || "...";
    var artist = entry.status === "queued" ? ("排队中，第 " + (entry.queuePosition || 1) + " 位") :
      entry.status === "decrypting" ? "解密中..." :
      entry.status === "error" ? (entry.error || "解锁失败") : (entry.artist || "");
    var album = entry.album || "";
    var statusText = entry.status === "queued" ? "排队中" :
      entry.status === "decrypting" ? "解密中" : entry.status === "done" ? "已解锁" : "失败";
    var statusClass = entry.status === "queued" ? "queued" :
      entry.status === "decrypting" ? "decrypting" : entry.status === "done" ? "done" : "error";

    var actionsHTML = "";
    if (entry.status === "done") {
      actionsHTML = '<button class="file-card__action file-card__action--play" data-action="play" title="试听">&#9654;</button>' +
        '<button class="file-card__action file-card__action--download" data-action="download" title="下载">&#8595;</button>' +
        '<button class="file-card__action file-card__action--delete" data-action="delete" title="删除">&#10005;</button>';
    } else if (entry.status === "queued" || entry.status === "decrypting") {
      actionsHTML = '<button class="file-card__action file-card__action--delete" data-action="delete" title="取消">&#10005;</button>';
    } else {
      actionsHTML = '<button class="file-card__action file-card__action--delete" data-action="delete" title="移除">&#10005;</button>';
    }

    return '<div class="file-card__cover">' + coverHTML + '</div>' +
      '<div class="file-card__meta">' +
        '<div class="file-card__title">' + CS.escapeHtml(title) + '</div>' +
        '<div class="file-card__artist">' + CS.escapeHtml(artist) + '</div>' +
        '<div class="file-card__album">' + CS.escapeHtml(album) + '</div>' +
      '</div>' +
      '<span class="file-card__status" data-status="' + statusClass + '">' + statusText + '</span>' +
      '<div class="file-card__actions">' + actionsHTML + '</div>';
  }

  function renderFileCardDOM(id) {
    var entry = fileResults.get(id);
    if (!entry || !fileList) return;
    var card = document.createElement("div");
    card.className = "file-card page-chunk";
    card.setAttribute("data-file-id", id);
    card.setAttribute("data-revealed", "true");
    card.innerHTML = buildCardHTML(entry);
    fileList.appendChild(card);
    bindCardActionsDOM(card, id);
  }

  function updateFileCardDOM(id) {
    var entry = fileResults.get(id);
    if (!entry) return;
    var card = fileList.querySelector('[data-file-id="' + id + '"]');
    if (!card) return;
    card.innerHTML = buildCardHTML(entry);
    bindCardActionsDOM(card, id);
  }

  function bindCardActionsDOM(card, id) {
    var buttons = card.querySelectorAll("[data-action]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function (e) {
        e.stopPropagation();
        var action = this.getAttribute("data-action");
        if (action === "play") previewWithGlobalPlayer(id);
        else if (action === "download") downloadFile(id);
        else if (action === "delete") removeFile(id);
      }, { signal: ac.signal });
    }
  }

  function updateEmptyDOM() {
    if (!emptyState || !batchActions) return;
    var hasFiles = fileResults.size > 0;
    emptyState.hidden = hasFiles;
    batchActions.hidden = !hasFiles;
  }

  // --- Global player integration ---------------------------------------------
  function previewWithGlobalPlayer(id) {
    var entry = fileResults.get(id);
    if (!entry || !entry.blob) return;

    var player = window.ClaudeOnePlayer;
    if (!player) {
      if (CS && CS.toast) CS.toast("播放器未就绪", "err");
      return;
    }

    player.load({
      src: URL.createObjectURL(entry.blob),
      title: entry.title || entry.name,
      artist: entry.artist || "",
      album: entry.album || "",
      cover: entry.coverUrl || ""
    });
    player.play();
  }

  // --- Download --------------------------------------------------------------
  function getNamingFormat() {
    if (!namingRadios) return "2";
    for (var i = 0; i < namingRadios.length; i++) {
      if (namingRadios[i].checked) return namingRadios[i].value;
    }
    return "2";
  }

  function getDownloadFilename(entry) {
    var fmt = getNamingFormat();
    var ext = entry.ext || "mp3";
    var title = entry.title || entry.name || "unknown";
    var artist = entry.artist || "";
    switch (fmt) {
      case "1": return title + "." + ext;
      case "3": return artist ? (title + " - " + artist + "." + ext) : (title + "." + ext);
      default: return artist ? (artist + " - " + title + "." + ext) : (title + "." + ext);
    }
  }

  function downloadFile(id) {
    var entry = fileResults.get(id);
    if (!entry || !entry.blob) return;
    var url = URL.createObjectURL(entry.blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = getDownloadFilename(entry);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function downloadAll() {
    var doneEntries = [];
    fileResults.forEach(function (e) {
      if (e.status === "done" && e.blob) doneEntries.push(e);
    });
    if (doneEntries.length === 0) {
      if (CS && CS.toast) CS.toast("没有可下载的文件", "err");
      return;
    }
    doneEntries.forEach(function (entry, i) {
      setTimeout(function () {
        var url = URL.createObjectURL(entry.blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = getDownloadFilename(entry);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      }, i * 300);
    });
    if (CS && CS.toast) CS.toast("正在下载 " + doneEntries.length + " 个文件", "ok");
  }

  // --- Remove ----------------------------------------------------------------
  function removeFile(id) {
    var entry = fileResults.get(id);
    if (!entry) return;
    if (entry.coverUrl) URL.revokeObjectURL(entry.coverUrl);
    fileResults.delete(id);
    var card = fileList.querySelector('[data-file-id="' + id + '"]');
    if (card) card.remove();
    updateEmptyDOM();
  }

  function clearAll() {
    fileResults.forEach(function (entry) {
      if (entry.coverUrl) URL.revokeObjectURL(entry.coverUrl);
    });
    fileResults.clear();
    var cards = fileList.querySelectorAll(".file-card");
    for (var i = 0; i < cards.length; i++) cards[i].remove();
    updateEmptyDOM();
    if (CS && CS.toast) CS.toast("已清空所有文件");
  }

  // --- Lifecycle -------------------------------------------------------------
  function mount(el) {
    container = el;
    ac = new AbortController();
    var signal = ac.signal;

    // Query DOM within container
    uploadZone = el.querySelector("[data-upload-zone]");
    fileInput = el.querySelector("[data-file-input]");
    fileList = el.querySelector("[data-file-list]");
    batchActions = el.querySelector("[data-batch-actions]");
    downloadAllBtn = el.querySelector("[data-download-all]");
    clearAllBtn = el.querySelector("[data-clear-all]");
    namingRadios = el.querySelectorAll("[data-naming-format]");
    emptyState = el.querySelector("[data-empty-state]");
    qqLoginStatus = el.querySelector("[data-qq-login-status]");
    qqLogoutBtn = el.querySelector("[data-qq-logout]");
    qqOpenOfficialBtn = el.querySelector("[data-qq-open-official]");
    qqCallbackInput = el.querySelector("[data-qq-callback-url]");
    qqSubmitCallbackBtn = el.querySelector("[data-qq-submit-callback]");
    qqLoginDetail = el.querySelector("[data-qq-login-detail]");

    // Worker
    ensureWorker();

    // Upload zone
    if (uploadZone && fileInput) {
      uploadZone.addEventListener("click", function () {
        fileInput.value = "";
        fileInput.click();
      }, { signal: signal });

      fileInput.addEventListener("change", function () {
        if (fileInput.files.length > 0) {
          handleFiles(fileInput.files);
          fileInput.value = "";
        }
      }, { signal: signal });

      uploadZone.addEventListener("dragover", function (e) {
        e.preventDefault(); e.stopPropagation();
        uploadZone.setAttribute("data-dragover", "true");
      }, { signal: signal });

      uploadZone.addEventListener("dragleave", function (e) {
        e.preventDefault(); e.stopPropagation();
        uploadZone.setAttribute("data-dragover", "false");
      }, { signal: signal });

      uploadZone.addEventListener("drop", function (e) {
        e.preventDefault(); e.stopPropagation();
        uploadZone.setAttribute("data-dragover", "false");
        if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
      }, { signal: signal });
    }

    // Batch actions
    if (downloadAllBtn) downloadAllBtn.addEventListener("click", downloadAll, { signal: signal });
    if (clearAllBtn) clearAllBtn.addEventListener("click", clearAll, { signal: signal });
    if (qqOpenOfficialBtn) qqOpenOfficialBtn.addEventListener("click", openQQOfficialLogin, { signal: signal });
    if (qqSubmitCallbackBtn) qqSubmitCallbackBtn.addEventListener("click", submitCookieLogin, { signal: signal });
    if (qqCallbackInput) qqCallbackInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") submitCookieLogin();
    }, { signal: signal });
    if (qqLogoutBtn) qqLogoutBtn.addEventListener("click", logoutQQAuth, { signal: signal });

    // Naming format
    if (namingRadios && CS && CS.storage) {
      var saved = CS.storage.get(CFG.music.storageKey) || "2";
      for (var i = 0; i < namingRadios.length; i++) {
        if (namingRadios[i].value === saved) namingRadios[i].checked = true;
        namingRadios[i].addEventListener("change", function () {
          if (this.checked && CS && CS.storage) CS.storage.set(CFG.music.storageKey, this.value);
        }, { signal: signal });
      }
    }

    // Re-render existing file cards (from previous mount)
    if (fileList && fileResults.size > 0) {
      var existingCards = fileList.querySelectorAll(".file-card");
      for (var j = 0; j < existingCards.length; j++) existingCards[j].remove();
      fileResults.forEach(function (entry, id) {
        renderFileCardDOM(id);
      });
    }

    updateEmptyDOM();
    updateMusicLimitNotice();
    var restoredAuth = qqAuthSession || loadAuthSession();
    if (restoredAuth && restoredAuth.id) {
      renderAuthSession(restoredAuth);
    } else {
      renderAuthSession(null);
    }

    // Refresh reveal for new elements
    if (CS && CS.refreshReveal) CS.refreshReveal();
  }

  function unmount() {
    if (ac) { ac.abort(); ac = null; }
    if (worker) {
      worker.terminate();
      worker = null;
      workerReady = false;
    }
    fileResults.forEach(function (entry) {
      if (entry && (entry.status === "processing" || entry.status === "decrypting")) {
        entry.status = "error";
        entry.error = "页面已切换，解密任务已取消";
      }
    });
    // Keep fileResults (user may come back)
    container = null;
    uploadZone = null; fileInput = null; fileList = null;
    batchActions = null; downloadAllBtn = null; clearAllBtn = null;
    namingRadios = null; emptyState = null;
    qqLoginStatus = null; qqLogoutBtn = null; qqLoginDetail = null;
    qqOpenOfficialBtn = null; qqCallbackInput = null; qqSubmitCallbackBtn = null;
  }

  window.__page_music = { mount: mount, unmount: unmount };
})();
