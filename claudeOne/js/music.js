/* ===== claudeOne :: music.js =====
 * Music unlock page — file upload, worker communication, download/preview.
 * Decryption runs in a Web Worker (decrypt-worker.js) to keep the UI responsive.
 */

(function bootstrapMusic() {
  const CFG = window.CLAUDE_ONE_CONFIG;
  const CS = window.ClaudeOne;

  if (!CFG || !CS) {
    console.error("[music] Config or shell missing");
    return;
  }

  // --- State ---------------------------------------------------------------
  const fileResults = new Map(); // id -> { name, status, title, artist, album, ext, mime, blob }
  const SUPPORTED = CFG.music.supportedExts;
  let worker = null;
  let idCounter = 0;
  let audioUrl = null;

  // --- DOM refs ------------------------------------------------------------
  const uploadZone = document.querySelector("[data-upload-zone]");
  const fileInput = document.querySelector("[data-file-input]");
  const fileList = document.querySelector("[data-file-list]");
  const batchActions = document.querySelector("[data-batch-actions]");
  const downloadAllBtn = document.querySelector("[data-download-all]");
  const clearAllBtn = document.querySelector("[data-clear-all]");
  const namingRadios = document.querySelectorAll("[data-naming-format]");
  const audioPlayer = document.querySelector("[data-audio-player]");
  const audioEl = document.querySelector("[data-audio-el]");
  const audioPlay = document.querySelector("[data-audio-play]");
  const audioClose = document.querySelector("[data-audio-close]");
  const audioProgressWrap = document.querySelector("[data-audio-progress-wrap]");
  const audioProgressFill = document.querySelector("[data-audio-progress]");
  const audioTime = document.querySelector("[data-audio-time]");
  const audioVolumeFill = document.querySelector("[data-audio-volume]");
  const audioVolumeSlider = document.querySelector("[data-audio-volume-slider]");
  const nowPlaying = document.querySelector("[data-now-playing]");
  const emptyState = document.querySelector("[data-empty-state]");

  // --- Init worker ---------------------------------------------------------
  function initWorker() {
    try {
      const workerUrl = "./js/decrypt-worker.js";
      worker = new Worker(workerUrl);
      worker.onmessage = handleWorkerMessage;
      worker.onerror = function (e) {
        console.error("[music] Worker error:", e);
        CS.toast("解密引擎启动失败，请刷新页面重试", "err");
      };
    } catch (err) {
      console.error("[music] Cannot create worker:", err);
      CS.toast("当前环境不支持后台解密，请使用现代浏览器", "err");
    }
  }

  // --- Worker message handler ----------------------------------------------
  function handleWorkerMessage(e) {
    const { id, status, data, error } = e.data;
    const entry = fileResults.get(id);
    if (!entry) return;

    if (status === "error") {
      entry.status = "error";
      entry.error = error;
      updateFileCard(id);
      return;
    }

    entry.status = "done";
    entry.title = data.title || entry.name;
    entry.artist = data.artist || "未知艺术家";
    entry.album = data.album || "";
    entry.ext = data.ext || "mp3";
    entry.mime = data.mime || "audio/mpeg";
    entry.title = entry.title || entry.name;

    // Create blob for audio
    if (data.audio) {
      entry.blob = new Blob([data.audio], { type: entry.mime });
    }

    // Create blob URL for cover picture
    if (data.picture && data.picture.byteLength > 0) {
      entry.coverUrl = URL.createObjectURL(
        new Blob([data.picture], { type: "image/jpeg" })
      );
    }

    updateFileCard(id);
    updateEmptyState();
  }

  // --- File processing -----------------------------------------------------
  function handleFiles(files) {
    if (!worker) {
      CS.toast("解密引擎未就绪，请刷新页面", "err");
      return;
    }

    let added = 0;
    for (const file of files) {
      const ext = "." + file.name.split(".").pop().toLowerCase();
      if (!SUPPORTED.includes(ext)) {
        CS.toast("不支持格式: " + file.name, "err", 2500);
        continue;
      }
      if (file.size > CFG.music.maxFileSize) {
        CS.toast("文件过大: " + file.name, "err", 2500);
        continue;
      }
      if (file.size === 0) {
        CS.toast("文件为空: " + file.name, "err", 2500);
        continue;
      }

      const id = String(++idCounter);
      fileResults.set(id, {
        name: file.name.replace(/\.[^.]+$/, ""),
        rawName: file.name,
        status: "decrypting",
        title: null,
        artist: null,
        album: null,
        ext: null,
        mime: null,
        blob: null,
        coverUrl: null,
        error: null,
      });

      renderFileCard(id);
      readAndDecrypt(id, file);
      added++;
    }

    if (added > 0) {
      updateEmptyState();
    }
  }

  function readAndDecrypt(id, file) {
    const reader = new FileReader();
    reader.onload = function () {
      if (!worker) return;
      worker.postMessage(
        {
          id: id,
          name: file.name,
          buffer: reader.result,
        },
        [reader.result]
      );
    };
    reader.onerror = function () {
      const entry = fileResults.get(id);
      if (entry) {
        entry.status = "error";
        entry.error = "无法读取文件";
        updateFileCard(id);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // --- Render --------------------------------------------------------------
  function renderFileCard(id) {
    const entry = fileResults.get(id);
    if (!entry) return;

    const card = document.createElement("div");
    card.className = "file-card page-chunk";
    card.setAttribute("data-file-id", id);
    card.setAttribute("data-revealed", "true");
    card.innerHTML = buildCardHTML(entry);
    fileList.appendChild(card);
    bindCardActions(card, id);
  }

  function buildCardHTML(entry) {
    const coverHTML = entry.coverUrl
      ? `<img src="${CS.escapeHtml(entry.coverUrl)}" alt="cover" />`
      : `<span>&#9835;</span>`;

    const title = entry.title || entry.name || "...";
    const artist = entry.status === "decrypting" ? "解密中..." : (entry.artist || "");
    const album = entry.album || "";
    const statusText =
      entry.status === "decrypting"
        ? "解密中"
        : entry.status === "done"
        ? "已解锁"
        : "失败";
    const statusClass =
      entry.status === "decrypting"
        ? "decrypting"
        : entry.status === "done"
        ? "done"
        : "error";

    let actionsHTML = "";
    if (entry.status === "done") {
      actionsHTML = `
        <button class="file-card__action file-card__action--play" data-action="play" title="试听">&#9654;</button>
        <button class="file-card__action file-card__action--download" data-action="download" title="下载">&#8595;</button>
        <button class="file-card__action file-card__action--delete" data-action="delete" title="删除">&#10005;</button>
      `;
    } else if (entry.status === "decrypting") {
      actionsHTML = `
        <button class="file-card__action file-card__action--delete" data-action="delete" title="取消">&#10005;</button>
      `;
    } else {
      actionsHTML = `
        <button class="file-card__action file-card__action--delete" data-action="delete" title="移除">&#10005;</button>
      `;
    }

    return `
      <div class="file-card__cover">${coverHTML}</div>
      <div class="file-card__meta">
        <div class="file-card__title">${CS.escapeHtml(title)}</div>
        <div class="file-card__artist">${CS.escapeHtml(artist)}</div>
        <div class="file-card__album">${CS.escapeHtml(album)}</div>
      </div>
      <span class="file-card__status" data-status="${statusClass}">${statusText}</span>
      <div class="file-card__actions">${actionsHTML}</div>
    `;
  }

  function updateFileCard(id) {
    const entry = fileResults.get(id);
    if (!entry) return;
    const card = document.querySelector(`[data-file-id="${id}"]`);
    if (!card) return;
    card.innerHTML = buildCardHTML(entry);
    bindCardActions(card, id);
  }

  function bindCardActions(card, id) {
    card.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = btn.getAttribute("data-action");
        if (action === "play") previewAudio(id);
        else if (action === "download") downloadFile(id);
        else if (action === "delete") removeFile(id);
      });
    });
  }

  function updateEmptyState() {
    const hasFiles = fileResults.size > 0;
    emptyState.hidden = hasFiles;
    batchActions.hidden = !hasFiles;
  }

  // --- Preview (custom player) --------------------------------------------
  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function updateProgress() {
    if (!audioEl || !audioEl.duration) return;
    const pct = (audioEl.currentTime / audioEl.duration) * 100;
    audioProgressFill.style.width = pct + "%";
    audioTime.textContent = formatTime(audioEl.currentTime);
  }

  function previewAudio(id) {
    const entry = fileResults.get(id);
    if (!entry || !entry.blob) return;

    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(entry.blob);
    audioEl.src = audioUrl;
    nowPlaying.textContent = entry.title || entry.name;
    audioPlayer.hidden = false;
    audioPlay.innerHTML = "&#9646;&#9646;";
    audioTime.textContent = "00:00";
    audioProgressFill.style.width = "0%";

    // Wire events
    audioEl.ontimeupdate = updateProgress;
    audioEl.onloadedmetadata = function () {
      audioTime.textContent = formatTime(audioEl.duration);
    };
    audioEl.onended = function () {
      audioPlay.innerHTML = "&#9654;";
    };
    audioEl.onplay = function () {
      audioPlay.innerHTML = "&#9646;&#9646;";
    };
    audioEl.onpause = function () {
      audioPlay.innerHTML = "&#9654;";
    };

    audioEl.volume = audioVolumeSlider ? audioVolumeSlider.value / 100 : 1;
    audioEl.play().catch(function () {});
  }

  function togglePlay() {
    if (!audioEl.src) return;
    if (audioEl.paused) {
      audioEl.play().catch(function () {});
    } else {
      audioEl.pause();
    }
  }

  function stopPreview() {
    audioEl.pause();
    audioEl.removeAttribute("src");
    audioEl.ontimeupdate = null;
    audioEl.onloadedmetadata = null;
    audioEl.onended = null;
    audioEl.onplay = null;
    audioEl.onpause = null;
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      audioUrl = null;
    }
    audioPlayer.hidden = true;
    audioPlay.innerHTML = "&#9654;";
    audioProgressFill.style.width = "0%";
    audioTime.textContent = "00:00";
  }

  // --- Download ------------------------------------------------------------
  function getDownloadFilename(entry) {
    const fmt = getNamingFormat();
    const ext = entry.ext || "mp3";
    const title = entry.title || entry.name || "unknown";
    const artist = entry.artist || "";

    switch (fmt) {
      case "1":
        return `${title}.${ext}`;
      case "3":
        return artist ? `${title} - ${artist}.${ext}` : `${title}.${ext}`;
      case "2":
      default:
        return artist ? `${artist} - ${title}.${ext}` : `${title}.${ext}`;
    }
  }

  function getNamingFormat() {
    for (const radio of namingRadios) {
      if (radio.checked) return radio.value;
    }
    return "2";
  }

  function downloadFile(id) {
    const entry = fileResults.get(id);
    if (!entry || !entry.blob) return;

    const url = URL.createObjectURL(entry.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = getDownloadFilename(entry);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadAll() {
    const doneEntries = [...fileResults.values()].filter(
      (e) => e.status === "done" && e.blob
    );
    if (doneEntries.length === 0) {
      CS.toast("没有可下载的文件", "err");
      return;
    }

    doneEntries.forEach((entry, i) => {
      setTimeout(() => {
        const url = URL.createObjectURL(entry.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = getDownloadFilename(entry);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, i * 300);
    });

    CS.toast(`正在下载 ${doneEntries.length} 个文件`, "ok");
  }

  // --- Remove --------------------------------------------------------------
  function removeFile(id) {
    const entry = fileResults.get(id);
    if (!entry) return;

    if (entry.coverUrl) URL.revokeObjectURL(entry.coverUrl);
    fileResults.delete(id);

    const card = document.querySelector(`[data-file-id="${id}"]`);
    if (card) card.remove();

    updateEmptyState();
  }

  function clearAll() {
    for (const [id, entry] of fileResults) {
      if (entry.coverUrl) URL.revokeObjectURL(entry.coverUrl);
    }
    fileResults.clear();
    fileList.querySelectorAll(".file-card").forEach((c) => c.remove());
    updateEmptyState();
    CS.toast("已清空所有文件");
  }

  // --- Upload zone events --------------------------------------------------
  function setupUploadZone() {
    if (!uploadZone || !fileInput) return;

    // Click to open file picker
    uploadZone.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", () => {
      if (fileInput.files.length > 0) {
        handleFiles(fileInput.files);
        fileInput.value = "";
      }
    });

    // Drag and drop
    uploadZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadZone.setAttribute("data-dragover", "true");
    });

    uploadZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadZone.setAttribute("data-dragover", "false");
    });

    uploadZone.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadZone.setAttribute("data-dragover", "false");
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    });

    // Also handle drag on the inner zone
    const innerZone = uploadZone.querySelector(".upload-zone__inner");
    if (innerZone) {
      innerZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.setAttribute("data-dragover", "true");
      });
    }
  }

  // --- Naming format persistence --------------------------------------------
  function setupNamingFormat() {
    const saved = CS.storage.get(CFG.music.storageKey) || "2";
    namingRadios.forEach((r) => {
      if (r.value === saved) r.checked = true;
      r.addEventListener("change", () => {
        if (r.checked) CS.storage.set(CFG.music.storageKey, r.value);
      });
    });
  }

  // --- Events --------------------------------------------------------------
  if (downloadAllBtn) downloadAllBtn.addEventListener("click", downloadAll);
  if (clearAllBtn) clearAllBtn.addEventListener("click", clearAll);
  if (audioClose) audioClose.addEventListener("click", stopPreview);
  if (audioPlay) audioPlay.addEventListener("click", togglePlay);

  // Progress bar click to seek
  if (audioProgressWrap) {
    audioProgressWrap.addEventListener("click", function (e) {
      if (!audioEl.duration) return;
      var rect = audioProgressWrap.getBoundingClientRect();
      var pct = (e.clientX - rect.left) / rect.width;
      audioEl.currentTime = pct * audioEl.duration;
    });
  }

  // Volume slider
  if (audioVolumeSlider) {
    audioVolumeSlider.addEventListener("input", function () {
      var v = this.value / 100;
      audioEl.volume = v;
      if (audioVolumeFill) audioVolumeFill.style.width = this.value + "%";
    });
  }

  // --- Boot ----------------------------------------------------------------
  function init() {
    initWorker();
    setupUploadZone();
    setupNamingFormat();
    updateEmptyState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
