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
  const SUPPORTED = CFG ? CFG.music.supportedExts : [];
  const SERVER_UNLOCK_EXTS = new Set([".mflac", ".mgg"]);
  const API_BASE = CFG && CFG.api ? String(CFG.api.baseUrl || "").replace(/\/$/, "") : "";
  const AUTH_STORAGE_KEY = "claudeOne:music-qq-auth-session";
  const DEFAULT_API_UNLOCK_CONCURRENCY = 2;
  let worker = null;
  let idCounter = 0;
  let workerReady = false;
  let apiUnlockConcurrency = DEFAULT_API_UNLOCK_CONCURRENCY;
  let apiUnlockActive = 0;
  let apiUnlockQueue = [];
  let qqAuthSession = null;
  let qqAuthPollTimer = null;
  let qqAuthGeneration = 0;

  // --- Per-mount state -------------------------------------------------------
  let container = null;
  let ac = null;
  let uploadZone, fileInput, fileList, batchActions;
  let downloadAllBtn, clearAllBtn;
  let namingRadios, emptyState;
  let musicLimitText;
  let qqLoginStatus, qqLoginWxBtn, qqLoginQqBtn, qqLogoutBtn;
  let qqQrWrap, qqQrImg, qqQrHint, qqLoginDetail;

  const AUDIO_MIME_BY_EXT = {
    mp3: "audio/mpeg",
    flac: "audio/flac",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    wav: "audio/wav",
    aac: "audio/aac"
  };

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
          type: qqAuthSession.type,
          status: qqAuthSession.status,
          expiresAt: qqAuthSession.expiresAt,
          auth: qqAuthSession.auth || null
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
    if (qqLoginWxBtn) qqLoginWxBtn.disabled = !!isBusy;
    if (qqLoginQqBtn) qqLoginQqBtn.disabled = !!isBusy;
  }

  function renderAuthSession(session) {
    qqAuthSession = session || null;
    saveAuthSession();
    var status = qqAuthSession ? qqAuthSession.status : "none";
    var isLoggedIn = status === "success" && qqAuthSession.auth;
    var isPolling = status === "waiting" || status === "scanned";

    if (qqLogoutBtn) qqLogoutBtn.hidden = !qqAuthSession;
    if (qqQrWrap) qqQrWrap.hidden = !qqAuthSession || isLoggedIn || !qqAuthSession.imageUrl;
    if (qqQrImg && qqAuthSession && qqAuthSession.imageUrl) qqQrImg.src = qqAuthSession.imageUrl;
    if (qqQrHint && qqAuthSession) {
      qqQrHint.textContent = qqAuthSession.type === "qq"
        ? "请使用 QQ 扫码并在手机上确认，本页会自动检测登录状态。"
        : "请使用微信扫码并在手机上确认，本页会自动检测登录状态。";
    }

    if (isLoggedIn) {
      var display = qqAuthSession.auth.display || "已登录 QQ 音乐";
      setAuthStatus(display + "。新版 .mflac/.mgg 会使用这个账号请求 EKey。", "ok");
      if (qqLoginDetail) qqLoginDetail.textContent = "登录态只保存在服务器内存中，默认 2 小时过期。退出登录会立即清除 Cookie 和本次临时 EKey 缓存。";
    } else if (status === "scanned") {
      setAuthStatus("已扫码，请在手机上确认授权登录。", "warn");
    } else if (status === "waiting") {
      setAuthStatus(qqAuthSession.message || "等待扫码确认。", "warn");
    } else if (status === "expired") {
      setAuthStatus("二维码已过期，请重新生成。旧格式仍可直接解锁。", "err");
    } else if (status === "failed") {
      setAuthStatus(qqAuthSession.message || "登录失败，请重新扫码。", "err");
    } else {
      setAuthStatus("未登录。旧格式可直接上传；新版 QQ 文件请先扫码登录。", "idle");
      if (qqLoginDetail) qqLoginDetail.textContent = "说明：本站不会把你的 QQ 音乐 Cookie 返回给浏览器，也不会写入仓库；服务器只用它请求这次解锁所需的 EKey。";
    }

    setAuthButtonsBusy(isPolling);
  }

  function stopAuthPolling() {
    if (qqAuthPollTimer) {
      clearInterval(qqAuthPollTimer);
      qqAuthPollTimer = null;
    }
  }

  async function pollAuthSession(id, generation) {
    if (!id) return;
    if (generation !== qqAuthGeneration || !qqAuthSession || qqAuthSession.id !== id) return;
    try {
      var response = await fetch(API_BASE + "/api/music/auth/status/" + encodeURIComponent(id));
      var payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "登录状态查询失败");
      if (generation !== qqAuthGeneration || !qqAuthSession || qqAuthSession.id !== id) return;
      renderAuthSession(payload.session);
      var status = payload.session && payload.session.status;
      if (status === "success" || status === "expired" || status === "failed") {
        stopAuthPolling();
        setAuthButtonsBusy(false);
      }
    } catch (error) {
      if (generation !== qqAuthGeneration || !qqAuthSession || qqAuthSession.id !== id) return;
      stopAuthPolling();
      setAuthButtonsBusy(false);
      qqAuthSession = null;
      saveAuthSession();
      renderAuthSession(null);
      setAuthStatus(error.message || "登录状态查询失败，请重新扫码。", "err");
    }
  }

  function startAuthPolling(id) {
    stopAuthPolling();
    var generation = qqAuthGeneration;
    qqAuthPollTimer = setInterval(function () { pollAuthSession(id, generation); }, 2000);
    pollAuthSession(id, generation);
  }

  async function startQQLogin(type) {
    var generation = ++qqAuthGeneration;
    try {
      stopAuthPolling();
      setAuthButtonsBusy(true);
      setAuthStatus(type === "qq" ? "正在生成 QQ 扫码二维码..." : "正在生成微信扫码二维码...", "warn");
      var response = await fetch(API_BASE + "/api/music/auth/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: type })
      });
      var payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "二维码生成失败");
      if (generation !== qqAuthGeneration) return;
      renderAuthSession(payload.session);
      startAuthPolling(payload.session.id);
    } catch (error) {
      if (generation !== qqAuthGeneration) return;
      setAuthButtonsBusy(false);
      renderAuthSession(null);
      setAuthStatus(error.message || "二维码生成失败，请稍后重试。", "err");
    }
  }

  async function logoutQQAuth() {
    var id = qqAuthSession && qqAuthSession.id;
    qqAuthGeneration += 1;
    stopAuthPolling();
    if (id) {
      try { await fetch(API_BASE + "/api/music/auth/" + encodeURIComponent(id), { method: "DELETE" }); }
      catch (_error) { /* Ignore logout network errors; local state is cleared. */ }
    }
    qqAuthSession = null;
    saveAuthSession();
    renderAuthSession(null);
  }

  function getAuthSessionId() {
    return qqAuthSession && qqAuthSession.status === "success" && qqAuthSession.auth
      ? qqAuthSession.id
      : "";
  }

  async function updateMusicLimitNotice() {
    if (!musicLimitText) return;
    try {
      var response = await fetch(API_BASE + "/api/health", { cache: "no-store" });
      if (!response.ok) return;
      var payload = await response.json();
      var limits = payload.musicLimits || {};
      if (!limits.unlockPerHour) return;
      apiUnlockConcurrency = Math.max(1, Number(limits.maxConcurrentPerIp) || DEFAULT_API_UNLOCK_CONCURRENCY);
      musicLimitText.textContent =
        "当前服务器允许：每个 IP 每小时最多解锁 " + limits.unlockPerHour +
        " 个文件；全站同时最多 " + limits.maxConcurrent +
        " 个解锁任务；同一 IP 同时最多 " + limits.maxConcurrentPerIp +
        " 个任务；单文件最大 " + limits.maxFileSizeMb +
        "MB。遇到“服务器繁忙”或“请求太频繁”时，稍等片刻再试即可。";
      pumpApiUnlockQueue();
    } catch (_error) {
      // The default static text is good enough if health check is unavailable.
    }
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
      var ext = "." + file.name.split(".").pop().toLowerCase();
      if (!SUPPORTED.includes(ext)) {
        if (CS && CS.toast) CS.toast("不支持格式: " + file.name, "err", 2500);
        continue;
      }
      if (!SERVER_UNLOCK_EXTS.has(ext) && !worker) {
        if (CS && CS.toast) CS.toast("浏览器解密引擎未就绪: " + file.name, "err", 2500);
        continue;
      }
      if (file.size > CFG.music.maxFileSize) {
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
    var ext = "." + file.name.split(".").pop().toLowerCase();
    if (SERVER_UNLOCK_EXTS.has(ext)) {
      enqueueApiUnlock(id, file);
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

  function updateApiQueuePositions() {
    for (var i = 0; i < apiUnlockQueue.length; i++) {
      var entry = fileResults.get(apiUnlockQueue[i].id);
      if (!entry) continue;
      entry.status = "queued";
      entry.queuePosition = i + 1;
      refreshEntry(apiUnlockQueue[i].id);
    }
  }

  function enqueueApiUnlock(id, file) {
    var entry = fileResults.get(id);
    if (!entry) return;
    entry.status = "queued";
    entry.queuePosition = apiUnlockQueue.length + 1;
    apiUnlockQueue.push({ id: id, file: file });
    refreshEntry(id);
    updateApiQueuePositions();
    pumpApiUnlockQueue();
  }

  function removeQueuedApiUnlock(id) {
    var before = apiUnlockQueue.length;
    apiUnlockQueue = apiUnlockQueue.filter(function (job) { return job.id !== id; });
    if (apiUnlockQueue.length !== before) updateApiQueuePositions();
  }

  function pumpApiUnlockQueue() {
    while (apiUnlockActive < apiUnlockConcurrency && apiUnlockQueue.length > 0) {
      var job = apiUnlockQueue.shift();
      var entry = fileResults.get(job.id);
      if (!entry) continue;
      entry.status = "decrypting";
      entry.queuePosition = 0;
      refreshEntry(job.id);
      updateApiQueuePositions();
      apiUnlockActive++;
      unlockWithLocalApi(job.id, job.file).finally(function () {
        apiUnlockActive = Math.max(0, apiUnlockActive - 1);
        updateApiQueuePositions();
        pumpApiUnlockQueue();
      });
    }
  }

  function decodeMetaHeader(value) {
    if (!value) return {};
    var normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    while (normalized.length % 4) normalized += "=";
    var binary = atob(normalized);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  async function readApiError(response) {
    try {
      var payload = await response.json();
      var retryAfter = Number(payload.retryAfter || response.headers.get("Retry-After") || 0);
      var message = payload.error || "解锁失败";
      if (retryAfter > 0) {
        message += "，请约 " + retryAfter + " 秒后再试";
      }
      return {
        message: message,
        code: payload.code || ""
      };
    } catch (_error) {
      return {
        message: "解锁服务返回异常 (HTTP " + response.status + ")",
        code: ""
      };
    }
  }

  async function unlockWithLocalApi(id, file) {
    var entry = fileResults.get(id);
    if (!entry) return;
    try {
      var form = new FormData();
      form.append("file", file, file.name);
      var authSessionId = getAuthSessionId();
      if (authSessionId) form.append("authSessionId", authSessionId);
      var response = await fetch(API_BASE + "/api/music/unlock", { method: "POST", body: form });
      if (!response.ok) {
        var apiError = await readApiError(response);
        var unlockError = new Error(apiError.message);
        unlockError.code = apiError.code;
        throw unlockError;
      }

      var metadata = decodeMetaHeader(response.headers.get("X-Music-Meta"));
      var audio = await response.arrayBuffer();
      var picture = null;
      var pictureMime = "";
      if (metadata.coverUrl) {
        try {
          var coverResponse = await fetch(API_BASE + metadata.coverUrl);
          if (coverResponse.ok) {
            pictureMime = coverResponse.headers.get("content-type") || "";
            picture = await coverResponse.arrayBuffer();
          }
        } catch (_coverError) {
          // Audio is still usable when a remote cover cannot be loaded.
        }
      }

      entry = fileResults.get(id);
      if (!entry) return;
      completeEntry(entry, {
        audio: audio,
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        ext: metadata.ext,
        mime: metadata.mime || response.headers.get("content-type"),
        picture: picture,
        pictureMime: pictureMime
      });
    } catch (error) {
      entry = fileResults.get(id);
      if (!entry) return;
      entry.status = "error";
      entry.error = error.message || "QQ 音乐解锁失败";
      if (error.code === "QQ_LOGIN_REQUIRED" || error.code === "QQ_AUTH_REQUIRED") {
        setAuthStatus("这个文件是新版 QQ musicex，需要先扫码登录自己的 QQ 音乐账号，再重新上传或重试解锁。", "err");
      } else if (error.code === "QQ_VIP_REQUIRED") {
        setAuthStatus("QQ 官方没有给这个账号返回 EKey：通常是账号没有该歌曲的会员、购买或下载权限。", "err");
      } else if (error.code === "RATE_LIMITED" || error.code === "MUSIC_SERVER_BUSY" || error.code === "MUSIC_IP_BUSY") {
        setAuthStatus(error.message || "服务器正在保护资源，请稍后再试。", "warn");
      }
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
    removeQueuedApiUnlock(id);
    if (entry.coverUrl) URL.revokeObjectURL(entry.coverUrl);
    fileResults.delete(id);
    var card = fileList.querySelector('[data-file-id="' + id + '"]');
    if (card) card.remove();
    updateEmptyDOM();
  }

  function clearAll() {
    apiUnlockQueue = [];
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
    musicLimitText = el.querySelector("[data-music-limit-text]");
    qqLoginStatus = el.querySelector("[data-qq-login-status]");
    qqLoginWxBtn = el.querySelector("[data-qq-login-wx]");
    qqLoginQqBtn = el.querySelector("[data-qq-login-qq]");
    qqLogoutBtn = el.querySelector("[data-qq-logout]");
    qqQrWrap = el.querySelector("[data-qq-qr-wrap]");
    qqQrImg = el.querySelector("[data-qq-qr-img]");
    qqQrHint = el.querySelector("[data-qq-qr-hint]");
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
    if (qqLoginWxBtn) qqLoginWxBtn.addEventListener("click", function () { startQQLogin("wx"); }, { signal: signal });
    if (qqLoginQqBtn) qqLoginQqBtn.addEventListener("click", function () { startQQLogin("qq"); }, { signal: signal });
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
      qqAuthGeneration += 1;
      renderAuthSession(restoredAuth);
      startAuthPolling(restoredAuth.id);
    } else {
      renderAuthSession(null);
    }

    // Refresh reveal for new elements
    if (CS && CS.refreshReveal) CS.refreshReveal();
  }

  function unmount() {
    if (ac) { ac.abort(); ac = null; }
    stopAuthPolling();
    apiUnlockQueue = [];
    if (worker) {
      worker.terminate();
      worker = null;
      workerReady = false;
    }
    fileResults.forEach(function (entry) {
      if (entry && (entry.status === "processing" || entry.status === "decrypting" || entry.status === "queued")) {
        entry.status = "error";
        entry.error = "页面已切换，解密任务已取消";
      }
    });
    // Keep fileResults (user may come back)
    container = null;
    uploadZone = null; fileInput = null; fileList = null;
    batchActions = null; downloadAllBtn = null; clearAllBtn = null;
    namingRadios = null; emptyState = null; musicLimitText = null;
    qqLoginStatus = null; qqLoginWxBtn = null; qqLoginQqBtn = null; qqLogoutBtn = null;
    qqQrWrap = null; qqQrImg = null; qqQrHint = null; qqLoginDetail = null;
  }

  window.__page_music = { mount: mount, unmount: unmount };
})();
