/* ===== claudeOne :: ascii.js =====
 * ASCII art generator — upload, auto-convert (debounce), history, mobile collapse.
 * SPA lifecycle: window.__page_ascii
 */

(function bootstrapAscii() {
  "use strict";

  var container = null;
  var ac = null;

  const CFG = window.CLAUDE_ONE_CONFIG;
  const CS = window.ClaudeOne;

  const API_BASE = "http://localhost:3001";
  const HISTORY_KEY = "claudeOne:ascii-history";
  const HISTORY_MAX = 12;
  const DEBOUNCE_MS = 600;

  // ---- State (module-level, persists across mount/unmount) ----
  let selectedFile = null;
  let lastResult = null; // { text, pngBase64, params }
  let abortController = null;
  let debounceTimer = null;
  let isManualTrigger = true; // distinguishes button click vs auto-convert

  // ---- DOM refs (rebuilt on mount) ----
  var uploadZone, fileInput, previewArea, previewImg, previewName, clearPreviewBtn;
  var convertBtn, convertText, convertSpinner, statusText;
  var outputSection, outputTextWrapper, outputText, outputPngWrapper, outputPng;
  var tabBtns, historySection, historyList, collapseBtn, controlsBody, autoToggle;
  var modeRadios, widthPresetRadios, widthCustom, heightModeRadios, heightCustom;
  var charSetRadios, customMapInput, toggleColored, toggleNegative, toggleGrayscale;

  function collectEls() {
    uploadZone = container.querySelector("[data-upload-zone]");
    fileInput = container.querySelector("[data-file-input]");
    previewArea = container.querySelector("[data-preview-area]");
    previewImg = container.querySelector("[data-preview-img]");
    previewName = container.querySelector("[data-preview-name]");
    clearPreviewBtn = container.querySelector("[data-clear-preview]");
    convertBtn = container.querySelector("[data-convert-btn]");
    convertText = container.querySelector("[data-convert-text]");
    convertSpinner = container.querySelector("[data-convert-spinner]");
    statusText = container.querySelector("[data-status-text]");
    outputSection = container.querySelector("[data-output-section]");
    outputTextWrapper = container.querySelector("[data-output-text-wrapper]");
    outputText = container.querySelector("[data-output-text]");
    outputPngWrapper = container.querySelector("[data-output-png-wrapper]");
    outputPng = container.querySelector("[data-output-png]");
    tabBtns = container.querySelectorAll("[data-tab]");
    historySection = container.querySelector("[data-history-section]");
    historyList = container.querySelector("[data-history-list]");
    collapseBtn = container.querySelector("[data-collapse-btn]");
    controlsBody = container.querySelector("[data-controls-body]");
    autoToggle = container.querySelector("[data-auto-toggle]");
    modeRadios = container.querySelectorAll("[data-mode]");
    widthPresetRadios = container.querySelectorAll("[data-width-preset]");
    widthCustom = container.querySelector("[data-width-custom]");
    heightModeRadios = container.querySelectorAll("[data-height-mode]");
    heightCustom = container.querySelector("[data-height-custom]");
    charSetRadios = container.querySelectorAll("[data-char-set]");
    customMapInput = container.querySelector("[data-custom-map]");
    var tColored = container.querySelector('[data-toggle="colored"]');
    toggleColored = tColored ? tColored.querySelector("input") : null;
    var tNeg = container.querySelector('[data-toggle="negative"]');
    toggleNegative = tNeg ? tNeg.querySelector("input") : null;
    var tGray = container.querySelector('[data-toggle="grayscale"]');
    toggleGrayscale = tGray ? tGray.querySelector("input") : null;
  }

  // ---- Helper: get param values ----
  function getMode() {
    for (var i = 0; modeRadios && i < modeRadios.length; i++) {
      if (modeRadios[i].checked) return modeRadios[i].value;
    }
    return "ascii";
  }

  function getWidth() {
    for (var i = 0; widthPresetRadios && i < widthPresetRadios.length; i++) {
      var r = widthPresetRadios[i];
      if (!r.checked) continue;
      if (r.value === "custom") return parseInt(widthCustom ? widthCustom.value : "80", 10) || 80;
      return parseInt(r.value, 10);
    }
    return 80;
  }

  function getHeight() {
    for (var i = 0; heightModeRadios && i < heightModeRadios.length; i++) {
      var r = heightModeRadios[i];
      if (!r.checked) continue;
      if (r.value === "auto") return 0;
      return parseInt(heightCustom ? heightCustom.value : "0", 10) || 0;
    }
    return 0;
  }

  function getCharSet() {
    for (var i = 0; charSetRadios && i < charSetRadios.length; i++) {
      if (charSetRadios[i].checked) return charSetRadios[i].value;
    }
    return "default";
  }

  function getCustomMap() {
    return (customMapInput ? customMapInput.value : "").trim();
  }

  function getParams() {
    return {
      mode: getMode(),
      width: getWidth(),
      height: getHeight(),
      colored: toggleColored ? toggleColored.checked : false,
      negative: toggleNegative ? toggleNegative.checked : false,
      grayscale: toggleGrayscale ? toggleGrayscale.checked : false,
      charSet: getCharSet(),
      customMap: getCharSet() === "custom" ? getCustomMap() : "",
    };
  }

  // ---- File handling ----
  function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      if (CS && CS.toast) CS.toast("请选择图片文件", "err");
      return;
    }
    selectedFile = file;
    previewName.textContent = file.name;
    previewImg.src = URL.createObjectURL(file);
    var dropVis = container.querySelector("[data-drop-visual]");
    if (dropVis) dropVis.hidden = true;
    previewArea.hidden = false;
    convertBtn.disabled = false;
    statusText.textContent = (autoToggle && autoToggle.checked) ? "自动转换中…" : "已就绪，点击转换";

    if (autoToggle && autoToggle.checked) {
      scheduleAutoConvert();
    }
  }

  function clearFile() {
    selectedFile = null;
    if (previewImg.src) URL.revokeObjectURL(previewImg.src);
    previewImg.src = "";
    var dropVis = container.querySelector("[data-drop-visual]");
    if (dropVis) dropVis.hidden = false;
    previewArea.hidden = true;
    convertBtn.disabled = true;
    statusText.textContent = "请先上传图片";
  }

  /* Helper to wire with signal */
  function on(el, evt, fn) {
    if (el) el.addEventListener(evt, fn, ac ? { signal: ac.signal } : undefined);
  }

  // ---- Debounced auto-convert ----
  function scheduleAutoConvert() {
    if (!selectedFile) return;
    cancelPending();
    isManualTrigger = false;
    statusText.textContent = "参数已变更，即将自动转换…";
    debounceTimer = setTimeout(function() { doConvert(); }, DEBOUNCE_MS);
  }

  function cancelPending() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  // ---- Convert ----
  async function doConvert() {
    if (!selectedFile) return;

    cancelPending();
    abortController = new AbortController();

    var isManual = isManualTrigger;
    isManualTrigger = true; // reset for next
    convertBtn.disabled = true;
    convertText.style.display = "none";
    convertSpinner.style.display = "";
    if (isManual) statusText.textContent = "转换中，请稍候…";

    var params = getParams();

    try {
      var formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("mode", params.mode);
      formData.append("width", String(params.width));
      formData.append("height", String(params.height));
      formData.append("colored", params.colored ? "true" : "false");
      formData.append("negative", params.negative ? "true" : "false");
      formData.append("grayscale", params.grayscale ? "true" : "false");
      formData.append("charSet", params.charSet);
      if (params.charSet === "custom") {
        formData.append("customMap", params.customMap);
      }

      var resp = await fetch(API_BASE + "/api/ascii", {
        method: "POST",
        body: formData,
        signal: abortController.signal,
      });

      var data = await resp.json();

      if (!resp.ok || !data.success) {
        throw new Error(data.error || "服务器返回错误");
      }

      lastResult = { text: data.text, pngBase64: data.pngBase64, params: params };

      // Display text
      outputText.textContent = data.text || "(无文本输出)";

      // Display PNG
      if (data.pngBase64) {
        outputPng.src = "data:image/png;base64," + data.pngBase64;
        var pngTab = container.querySelector('[data-tab="png"]');
        if (pngTab) pngTab.style.display = "";
      } else {
        var pngTab = container.querySelector('[data-tab="png"]');
        if (pngTab) pngTab.style.display = "none";
      }

      // Show output
      outputSection.hidden = false;
      switchTab("text");
      statusText.textContent = "转换成功 · " + params.width + " 字符宽 · " + params.mode + (params.colored ? " · 彩色" : "") + (params.negative ? " · 反色" : "");
      if (isManual || !(autoToggle && autoToggle.checked)) {
        outputSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      // Auto-collapse controls on mobile after first conversion
      if (window.innerWidth <= 768 && controlsBody) {
        controlsBody.setAttribute("data-collapsed", "true");
        collapseBtn.innerHTML = "&#9660;";
        collapseBtn.hidden = false;
      }

      // Save to history
      saveHistory(params);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("[ascii]", err);
      if (CS && CS.toast) CS.toast(err.message || "转换失败", "err");
      statusText.textContent = "转换失败: " + err.message;
    } finally {
      convertBtn.disabled = !selectedFile;
      convertText.style.display = "";
      convertSpinner.style.display = "none";
      abortController = null;
    }
  }

  // ---- Auto-convert triggers ----
  function wireAutoTrigger(el, events) {
    if (!el) return;
    events.split(" ").forEach(function(evt) {
      on(el, evt, function() {
        if (autoToggle && autoToggle.checked) scheduleAutoConvert();
      });
    });
  }

  // ---- Tab switching ----
  function switchTab(name) {
    if (tabBtns) {
      tabBtns.forEach(function(btn) {
        btn.classList.toggle("active", btn.getAttribute("data-tab") === name);
      });
    }
    if (outputTextWrapper) outputTextWrapper.hidden = name !== "text";
    if (outputPngWrapper) outputPngWrapper.hidden = name !== "png";
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  }

  // ---- History (localStorage) ----
  function loadHistory() {
    try {
      var raw = CS.storage.get(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function saveHistory(params) {
    if (!lastResult || !lastResult.text) return;
    var text = lastResult.text;
    var preview = text.length > 400 ? text.slice(0, 400) : text;
    var history = loadHistory();

    var dupIdx = history.findIndex(function(h) {
      return h.fileName === ((selectedFile && selectedFile.name) || "") &&
        h.params.mode === params.mode &&
        h.params.width === params.width &&
        h.params.height === params.height &&
        h.params.colored === params.colored;
    });
    if (dupIdx >= 0) history.splice(dupIdx, 1);

    history.unshift({
      id: Date.now(),
      textPreview: preview,
      fileName: (selectedFile && selectedFile.name) || "未知",
      params: params,
      timestamp: Date.now(),
    });

    if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;

    var totalText = 0;
    for (var i = 0; i < history.length; i++) {
      totalText += history[i].textPreview.length;
      if (totalText > 500000) {
        history.length = i;
        break;
      }
    }

    try {
      CS.storage.set(HISTORY_KEY, JSON.stringify(history));
    } catch(e) {
      history.pop();
      try { CS.storage.set(HISTORY_KEY, JSON.stringify(history)); } catch(e2) { /* give up */ }
    }

    renderHistory();
  }

  function renderHistory() {
    if (!historySection || !historyList) return;
    var history = loadHistory();
    historySection.hidden = history.length === 0;
    historyList.innerHTML = "";

    if (history.length === 0) return;

    history.forEach(function(item) {
      var div = document.createElement("div");
      div.className = "ascii-history-item";
      div.setAttribute("data-history-id", item.id);

      var thumb = document.createElement("div");
      thumb.className = "ascii-history-item__thumb";
      thumb.textContent = item.textPreview;

      var meta = document.createElement("div");
      meta.className = "ascii-history-item__meta";

      var name = document.createElement("div");
      name.className = "ascii-history-item__name";
      name.textContent = item.fileName;

      var paramsEl = document.createElement("div");
      paramsEl.className = "ascii-history-item__params";
      var p = item.params;
      paramsEl.textContent = p.mode + " · " + p.width + "w · " + (p.colored ? "彩色 " : "") + (p.negative ? "反色 " : "") + (p.grayscale ? "灰度 " : "") + (p.charSet !== "default" ? p.charSet : "");

      var timeEl = document.createElement("span");
      timeEl.className = "ascii-history-item__time";
      timeEl.textContent = formatTime(item.timestamp);

      var removeBtn = document.createElement("button");
      removeBtn.className = "ascii-history-item__remove";
      removeBtn.type = "button";
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        removeHistoryItem(item.id);
      });

      meta.appendChild(name);
      meta.appendChild(paramsEl);
      div.appendChild(thumb);
      div.appendChild(meta);
      div.appendChild(timeEl);
      div.appendChild(removeBtn);

      div.addEventListener("click", function() {
        if (outputText) {
          outputText.textContent = item.textPreview.length >= 400
            ? item.textPreview + "\n\n… (截取自历史记录)"
            : item.textPreview;
        }
        if (outputSection) outputSection.hidden = false;
        switchTab("text");
        if (statusText) statusText.textContent = "已加载历史记录 · " + item.fileName;
        if (outputSection) outputSection.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      historyList.appendChild(div);
    });
  }

  function removeHistoryItem(id) {
    var history = loadHistory().filter(function(h) { return h.id !== id; });
    CS.storage.set(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
  }

  function formatTime(ts) {
    var d = new Date(ts);
    var now = new Date();
    var diffMin = Math.floor((now - d) / 60000);
    if (diffMin < 1) return "刚刚";
    if (diffMin < 60) return diffMin + " 分钟前";
    var diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return diffHr + " 小时前";
    return (d.getMonth() + 1) + "/" + d.getDate();
  }

  // ---- Mobile collapse ----
  function checkMobileCollapse() {
    if (!collapseBtn || !controlsBody) return;
    var isMobile = window.innerWidth <= 768;
    collapseBtn.hidden = !isMobile;
    if (isMobile && lastResult) {
      controlsBody.setAttribute("data-collapsed", "true");
      collapseBtn.innerHTML = "&#9660;";
    }
  }

  // ---- Init / wire ----
  function wire() {
    // Drag & drop
    on(uploadZone, "dragover", function(e) { e.preventDefault(); uploadZone.setAttribute("data-dragover", "true"); });
    on(uploadZone, "dragleave", function() { uploadZone.setAttribute("data-dragover", "false"); });
    on(uploadZone, "drop", function(e) {
      e.preventDefault();
      uploadZone.setAttribute("data-dragover", "false");
      var file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
    on(uploadZone, "click", function() { if (fileInput) fileInput.click(); });
    on(fileInput, "change", function() {
      var file = fileInput.files[0];
      if (file) handleFile(file);
    });
    on(clearPreviewBtn, "click", function() { clearFile(); cancelPending(); });

    // Convert
    on(convertBtn, "click", function() { isManualTrigger = true; doConvert(); });

    // Wire all parameter changes to trigger auto-convert
    if (modeRadios) modeRadios.forEach(function(r) { wireAutoTrigger(r, "change"); });
    if (widthPresetRadios) widthPresetRadios.forEach(function(r) { wireAutoTrigger(r, "change"); });
    wireAutoTrigger(widthCustom, "input");
    if (heightModeRadios) heightModeRadios.forEach(function(r) { wireAutoTrigger(r, "change"); });
    wireAutoTrigger(heightCustom, "input");
    if (charSetRadios) charSetRadios.forEach(function(r) { wireAutoTrigger(r, "change"); });
    wireAutoTrigger(customMapInput, "input");
    wireAutoTrigger(toggleColored, "change");
    wireAutoTrigger(toggleNegative, "change");
    wireAutoTrigger(toggleGrayscale, "change");

    on(autoToggle, "change", function() {
      if (autoToggle.checked && selectedFile) {
        scheduleAutoConvert();
      } else {
        cancelPending();
        if (selectedFile) statusText.textContent = "已就绪，点击转换";
      }
    });

    // Parameter UI wiring (non-auto)
    if (widthPresetRadios) {
      widthPresetRadios.forEach(function(r) {
        on(r, "change", function() {
          if (widthCustom) widthCustom.style.display = (r.value === "custom") ? "" : "none";
        });
      });
    }
    if (heightModeRadios) {
      heightModeRadios.forEach(function(r) {
        on(r, "change", function() {
          if (heightCustom) heightCustom.style.display = (r.value === "custom") ? "" : "none";
        });
      });
    }
    if (charSetRadios) {
      charSetRadios.forEach(function(r) {
        on(r, "change", function() {
          if (customMapInput) customMapInput.style.display = (r.value === "custom") ? "" : "none";
        });
      });
    }

    // Tab switching
    if (tabBtns) {
      tabBtns.forEach(function(btn) {
        on(btn, "click", function() { switchTab(btn.getAttribute("data-tab")); });
      });
    }

    // Actions
    var actionCopy = container.querySelector("[data-action-copy]");
    if (actionCopy) {
      on(actionCopy, "click", async function() {
        if (!outputText || !outputText.textContent) return;
        try {
          await navigator.clipboard.writeText(outputText.textContent);
          if (CS && CS.toast) CS.toast("已复制到剪贴板", "ok");
        } catch(e) {
          if (CS && CS.toast) CS.toast("复制失败，请手动选择", "err");
        }
      });
    }

    var actionDownloadTxt = container.querySelector("[data-action-download-txt]");
    if (actionDownloadTxt) {
      on(actionDownloadTxt, "click", function() {
        if (!outputText || !outputText.textContent) return;
        var blob = new Blob([outputText.textContent], { type: "text/plain;charset=utf-8" });
        downloadBlob(blob, "ascii-art.txt");
      });
    }

    var actionDownloadPng = container.querySelector("[data-action-download-png]");
    if (actionDownloadPng) {
      on(actionDownloadPng, "click", function() {
        if (!lastResult || !lastResult.pngBase64) return;
        var byteString = atob(lastResult.pngBase64);
        var ab = new ArrayBuffer(byteString.length);
        var ia = new Uint8Array(ab);
        for (var i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        var blob = new Blob([ab], { type: "image/png" });
        downloadBlob(blob, "ascii-art.png");
      });
    }

    var actionClear = container.querySelector("[data-action-clear]");
    if (actionClear) {
      on(actionClear, "click", function() {
        if (outputText) outputText.textContent = "";
        if (outputPng) outputPng.src = "";
        lastResult = null;
        if (outputSection) outputSection.hidden = true;
        clearFile();
        statusText.textContent = "请先上传图片";
      });
    }

    var historyClearAll = container.querySelector("[data-history-clear-all]");
    if (historyClearAll) {
      on(historyClearAll, "click", function() {
        CS.storage.remove(HISTORY_KEY);
        renderHistory();
        if (CS && CS.toast) CS.toast("历史记录已清空", "ok");
      });
    }

    // Collapse
    on(collapseBtn, "click", function() {
      if (!controlsBody) return;
      var collapsed = controlsBody.getAttribute("data-collapsed") === "true";
      controlsBody.setAttribute("data-collapsed", String(!collapsed));
      collapseBtn.innerHTML = collapsed ? "&#9650;" : "&#9660;";
    });

    // Resize & keyboard
    if (ac) {
      window.addEventListener("resize", checkMobileCollapse, { signal: ac.signal });
      document.addEventListener("keydown", function(e) {
        if (e.ctrlKey && e.key === "Enter" && selectedFile && !convertBtn.disabled) {
          e.preventDefault();
          if (convertBtn) convertBtn.click();
        }
      }, { signal: ac.signal });
    }

    // Init
    renderHistory();
    checkMobileCollapse();
  }

  function mount(el) {
    container = el;
    ac = new AbortController();
    collectEls();
    wire();
  }

  function unmount() {
    if (ac) { ac.abort(); ac = null; }
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    if (abortController) { abortController.abort(); abortController = null; }
    container = null;
  }

  window.__page_ascii = { mount: mount, unmount: unmount };
})();
