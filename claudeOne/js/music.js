/* ===== claudeOne :: music.js =====
 * Music unlock page — file upload, worker communication, download.
 * Decryption runs in a Web Worker (decrypt-worker.js).
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
  let worker = null;
  let idCounter = 0;
  let workerReady = false;

  // --- Per-mount state -------------------------------------------------------
  let container = null;
  let ac = null;
  let uploadZone, fileInput, fileList, batchActions;
  let downloadAllBtn, clearAllBtn;
  let namingRadios, emptyState;

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
          entry.error = data.error;
        } else {
          entry.status = "done";
          entry.title = data.data.title || entry.name;
          entry.artist = data.data.artist || "未知艺术家";
          entry.album = data.data.album || "";
          entry.ext = data.data.ext || "mp3";
          entry.mime = data.data.mime || "audio/mpeg";
          if (data.data.audio) {
            entry.blob = new Blob([data.data.audio], { type: entry.mime });
          }
          if (data.data.picture && data.data.picture.byteLength > 0) {
            var head = new Uint8Array(data.data.picture.slice(0, 4));
            var mime = "image/jpeg";
            if (head[0]===0x89 && head[1]===0x50) mime = "image/png";
            else if (head[0]===0x47 && head[1]===0x49) mime = "image/gif";
            else if (head[0]===0x52 && head[1]===0x49) mime = "image/webp";
            else if (head[0]===0x42 && head[1]===0x4D) mime = "image/bmp";
            entry.coverUrl = URL.createObjectURL(new Blob([data.data.picture], { type: mime }));
          }
        }
        // Update UI only if page is mounted
        if (container) {
          updateFileCardDOM(data.id);
          updateEmptyDOM();
        }
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
    if (!worker) {
      if (CS && CS.toast) CS.toast("解密引擎未就绪，请刷新页面", "err");
      return;
    }

    var added = 0;
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var ext = "." + file.name.split(".").pop().toLowerCase();
      if (!SUPPORTED.includes(ext)) {
        if (CS && CS.toast) CS.toast("不支持格式: " + file.name, "err", 2500);
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

  // --- DOM rendering (only when mounted) -------------------------------------
  function buildCardHTML(entry) {
    var coverHTML = entry.coverUrl
      ? '<img src="' + CS.escapeHtml(entry.coverUrl) + '" alt="cover" />'
      : '<span>&#9835;</span>';

    var title = entry.title || entry.name || "...";
    var artist = entry.status === "decrypting" ? "解密中..." : (entry.artist || "");
    var album = entry.album || "";
    var statusText = entry.status === "decrypting" ? "解密中" : entry.status === "done" ? "已解锁" : "失败";
    var statusClass = entry.status === "decrypting" ? "decrypting" : entry.status === "done" ? "done" : "error";

    var actionsHTML = "";
    if (entry.status === "done") {
      actionsHTML = '<button class="file-card__action file-card__action--play" data-action="play" title="试听">&#9654;</button>' +
        '<button class="file-card__action file-card__action--download" data-action="download" title="下载">&#8595;</button>' +
        '<button class="file-card__action file-card__action--delete" data-action="delete" title="删除">&#10005;</button>';
    } else if (entry.status === "decrypting") {
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

    // Refresh reveal for new elements
    if (CS && CS.refreshReveal) CS.refreshReveal();
  }

  function unmount() {
    if (ac) { ac.abort(); ac = null; }
    // Keep worker alive (expensive to recreate)
    // Keep fileResults (user may come back)
    container = null;
    uploadZone = null; fileInput = null; fileList = null;
    batchActions = null; downloadAllBtn = null; clearAllBtn = null;
    namingRadios = null; emptyState = null;
  }

  window.__page_music = { mount: mount, unmount: unmount };
})();
