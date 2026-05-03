/* ===== claudeOne :: ascii.js =====
 * ASCII art generator — upload, auto-convert (debounce), history, mobile collapse.
 */

(function bootstrapAscii() {
  const CFG = window.CLAUDE_ONE_CONFIG;
  const CS = window.ClaudeOne;

  if (!CFG || !CS) {
    console.error("[ascii] Config or shell missing");
    return;
  }

  const API_BASE = "http://localhost:3001";
  const HISTORY_KEY = "claudeOne:ascii-history";
  const HISTORY_MAX = 12;
  const DEBOUNCE_MS = 600;

  // ---- State ----
  let selectedFile = null;
  let lastResult = null; // { text, pngBase64, params }
  let abortController = null;
  let debounceTimer = null;
  let isManualTrigger = true; // distinguishes button click vs auto-convert

  // ---- DOM refs ----
  const uploadZone = document.querySelector("[data-upload-zone]");
  const fileInput = document.querySelector("[data-file-input]");
  const previewArea = document.querySelector("[data-preview-area]");
  const previewImg = document.querySelector("[data-preview-img]");
  const previewName = document.querySelector("[data-preview-name]");
  const clearPreviewBtn = document.querySelector("[data-clear-preview]");
  const convertBtn = document.querySelector("[data-convert-btn]");
  const convertText = document.querySelector("[data-convert-text]");
  const convertSpinner = document.querySelector("[data-convert-spinner]");
  const statusText = document.querySelector("[data-status-text]");
  const outputSection = document.querySelector("[data-output-section]");
  const outputTextWrapper = document.querySelector("[data-output-text-wrapper]");
  const outputText = document.querySelector("[data-output-text]");
  const outputPngWrapper = document.querySelector("[data-output-png-wrapper]");
  const outputPng = document.querySelector("[data-output-png]");
  const tabBtns = document.querySelectorAll("[data-tab]");
  const historySection = document.querySelector("[data-history-section]");
  const historyList = document.querySelector("[data-history-list]");
  const collapseBtn = document.querySelector("[data-collapse-btn]");
  const controlsBody = document.querySelector("[data-controls-body]");
  const autoToggle = document.querySelector("[data-auto-toggle]");

  // Parameter inputs
  const modeRadios = document.querySelectorAll("[data-mode]");
  const widthPresetRadios = document.querySelectorAll("[data-width-preset]");
  const widthCustom = document.querySelector("[data-width-custom]");
  const heightModeRadios = document.querySelectorAll("[data-height-mode]");
  const heightCustom = document.querySelector("[data-height-custom]");
  const charSetRadios = document.querySelectorAll("[data-char-set]");
  const customMapInput = document.querySelector("[data-custom-map]");
  const toggleColored = document.querySelector("[data-toggle=\"colored\"] input");
  const toggleNegative = document.querySelector("[data-toggle=\"negative\"] input");
  const toggleGrayscale = document.querySelector("[data-toggle=\"grayscale\"] input");

  // ---- Helper: get param values ----
  function getMode() {
    for (const r of modeRadios) if (r.checked) return r.value;
    return "ascii";
  }

  function getWidth() {
    for (const r of widthPresetRadios) {
      if (!r.checked) continue;
      if (r.value === "custom") return parseInt(widthCustom.value, 10) || 80;
      return parseInt(r.value, 10);
    }
    return 80;
  }

  function getHeight() {
    for (const r of heightModeRadios) {
      if (!r.checked) continue;
      if (r.value === "auto") return 0;
      return parseInt(heightCustom.value, 10) || 0;
    }
    return 0;
  }

  function getCharSet() {
    for (const r of charSetRadios) if (r.checked) return r.value;
    return "default";
  }

  function getCustomMap() {
    return (customMapInput.value || "").trim();
  }

  function getParams() {
    return {
      mode: getMode(),
      width: getWidth(),
      height: getHeight(),
      colored: toggleColored.checked,
      negative: toggleNegative.checked,
      grayscale: toggleGrayscale.checked,
      charSet: getCharSet(),
      customMap: getCharSet() === "custom" ? getCustomMap() : "",
    };
  }

  // ---- File handling ----
  function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      CS.toast("请选择图片文件", "err");
      return;
    }
    selectedFile = file;
    previewName.textContent = file.name;
    previewImg.src = URL.createObjectURL(file);
    document.querySelector("[data-drop-visual]").hidden = true;
    previewArea.hidden = false;
    convertBtn.disabled = false;
    statusText.textContent = autoToggle.checked ? "自动转换中…" : "已就绪，点击转换";

    if (autoToggle.checked) {
      scheduleAutoConvert();
    }
  }

  function clearFile() {
    selectedFile = null;
    if (previewImg.src) URL.revokeObjectURL(previewImg.src);
    previewImg.src = "";
    document.querySelector("[data-drop-visual]").hidden = false;
    previewArea.hidden = true;
    convertBtn.disabled = true;
    statusText.textContent = "请先上传图片";
  }

  // ---- Drag & drop ----
  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.setAttribute("data-dragover", "true");
  });

  uploadZone.addEventListener("dragleave", () => {
    uploadZone.setAttribute("data-dragover", "false");
  });

  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.setAttribute("data-dragover", "false");
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  uploadZone.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) handleFile(file);
  });

  clearPreviewBtn.addEventListener("click", () => {
    clearFile();
    cancelPending();
  });

  // ---- Debounced auto-convert ----
  function scheduleAutoConvert() {
    if (!selectedFile) return;
    cancelPending();
    isManualTrigger = false;
    statusText.textContent = "参数已变更，即将自动转换…";
    debounceTimer = setTimeout(() => doConvert(), DEBOUNCE_MS);
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

    const isManual = isManualTrigger;
    isManualTrigger = true; // reset for next
    convertBtn.disabled = true;
    convertText.style.display = "none";
    convertSpinner.style.display = "";
    if (isManual) statusText.textContent = "转换中，请稍候…";

    const params = getParams();

    try {
      const formData = new FormData();
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

      const resp = await fetch(`${API_BASE}/api/ascii`, {
        method: "POST",
        body: formData,
        signal: abortController.signal,
      });

      const data = await resp.json();

      if (!resp.ok || !data.success) {
        throw new Error(data.error || "服务器返回错误");
      }

      lastResult = { text: data.text, pngBase64: data.pngBase64, params };

      // Display text
      outputText.textContent = data.text || "(无文本输出)";

      // Display PNG
      if (data.pngBase64) {
        outputPng.src = `data:image/png;base64,${data.pngBase64}`;
        document.querySelector("[data-tab=\"png\"]").style.display = "";
      } else {
        document.querySelector("[data-tab=\"png\"]").style.display = "none";
      }

      // Show output
      outputSection.hidden = false;
      switchTab("text");
      statusText.textContent = `转换成功 · ${params.width} 字符宽 · ${params.mode}${params.colored ? " · 彩色" : ""}${params.negative ? " · 反色" : ""}`;
      if (isManual || !autoToggle.checked) {
        outputSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      // Auto-collapse controls on mobile after first conversion
      if (window.innerWidth <= 768) {
        controlsBody.setAttribute("data-collapsed", "true");
        collapseBtn.innerHTML = "&#9660;";
        collapseBtn.hidden = false;
      }

      // Save to history
      saveHistory(params);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("[ascii]", err);
      CS.toast(err.message || "转换失败", "err");
      statusText.textContent = `转换失败: ${err.message}`;
    } finally {
      convertBtn.disabled = !selectedFile;
      convertText.style.display = "";
      convertSpinner.style.display = "none";
      abortController = null;
    }
  }

  convertBtn.addEventListener("click", () => {
    isManualTrigger = true;
    doConvert();
  });

  // ---- Auto-convert triggers ----
  function wireAutoTrigger(el, events) {
    events.split(" ").forEach((evt) => {
      el.addEventListener(evt, () => {
        if (autoToggle.checked) scheduleAutoConvert();
      });
    });
  }

  // Wire all parameter changes to trigger auto-convert
  modeRadios.forEach((r) => wireAutoTrigger(r, "change"));
  widthPresetRadios.forEach((r) => wireAutoTrigger(r, "change"));
  wireAutoTrigger(widthCustom, "input");
  heightModeRadios.forEach((r) => wireAutoTrigger(r, "change"));
  wireAutoTrigger(heightCustom, "input");
  charSetRadios.forEach((r) => wireAutoTrigger(r, "change"));
  wireAutoTrigger(customMapInput, "input");
  wireAutoTrigger(toggleColored, "change");
  wireAutoTrigger(toggleNegative, "change");
  wireAutoTrigger(toggleGrayscale, "change");

  autoToggle.addEventListener("change", () => {
    if (autoToggle.checked && selectedFile) {
      scheduleAutoConvert();
    } else {
      cancelPending();
      if (selectedFile) statusText.textContent = "已就绪，点击转换";
    }
  });

  // ---- Parameter UI wiring (non-auto) ----
  widthPresetRadios.forEach((r) => {
    r.addEventListener("change", () => {
      widthCustom.style.display = (r.value === "custom") ? "" : "none";
    });
  });

  heightModeRadios.forEach((r) => {
    r.addEventListener("change", () => {
      heightCustom.style.display = (r.value === "custom") ? "" : "none";
    });
  });

  charSetRadios.forEach((r) => {
    r.addEventListener("change", () => {
      customMapInput.style.display = (r.value === "custom") ? "" : "none";
    });
  });

  // ---- Tab switching ----
  function switchTab(name) {
    for (const btn of tabBtns) {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === name);
    }
    outputTextWrapper.hidden = name !== "text";
    outputPngWrapper.hidden = name !== "png";
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.getAttribute("data-tab"));
    });
  });

  // ---- Actions ----
  document.querySelector("[data-action-copy]").addEventListener("click", async () => {
    if (!outputText.textContent) return;
    try {
      await navigator.clipboard.writeText(outputText.textContent);
      CS.toast("已复制到剪贴板", "ok");
    } catch {
      CS.toast("复制失败，请手动选择", "err");
    }
  });

  document.querySelector("[data-action-download-txt]").addEventListener("click", () => {
    if (!outputText.textContent) return;
    const blob = new Blob([outputText.textContent], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, "ascii-art.txt");
  });

  document.querySelector("[data-action-download-png]").addEventListener("click", () => {
    if (!lastResult?.pngBase64) return;
    const byteString = atob(lastResult.pngBase64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: "image/png" });
    downloadBlob(blob, "ascii-art.png");
  });

  document.querySelector("[data-action-clear]").addEventListener("click", () => {
    outputText.textContent = "";
    outputPng.src = "";
    lastResult = null;
    outputSection.hidden = true;
    clearFile();
    statusText.textContent = "请先上传图片";
  });

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---- History (localStorage) ----
  function loadHistory() {
    try {
      const raw = CS.storage.get(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function saveHistory(params) {
    if (!lastResult?.text) return;
    const text = lastResult.text;
    const preview = text.length > 400 ? text.slice(0, 400) : text;
    const history = loadHistory();

    // Remove duplicate (same file + same params)
    const dupIdx = history.findIndex((h) =>
      h.fileName === (selectedFile?.name || "") &&
      h.params.mode === params.mode &&
      h.params.width === params.width &&
      h.params.height === params.height &&
      h.params.colored === params.colored
    );
    if (dupIdx >= 0) history.splice(dupIdx, 1);

    history.unshift({
      id: Date.now(),
      textPreview: preview,
      fileName: selectedFile?.name || "未知",
      params,
      timestamp: Date.now(),
    });

    // Trim to max
    if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;

    // Trim text previews to stay under ~2MB total
    let totalText = 0;
    for (let i = 0; i < history.length; i++) {
      totalText += history[i].textPreview.length;
      if (totalText > 500000) {
        history.length = i;
        break;
      }
    }

    try {
      CS.storage.set(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Storage full — trim oldest
      history.pop();
      try { CS.storage.set(HISTORY_KEY, JSON.stringify(history)); } catch { /* give up */ }
    }

    renderHistory();
  }

  function renderHistory() {
    const history = loadHistory();
    historySection.hidden = history.length === 0;
    historyList.innerHTML = "";

    if (history.length === 0) return;

    for (const item of history) {
      const div = document.createElement("div");
      div.className = "ascii-history-item";
      div.setAttribute("data-history-id", item.id);

      const thumb = document.createElement("div");
      thumb.className = "ascii-history-item__thumb";
      thumb.textContent = item.textPreview;

      const meta = document.createElement("div");
      meta.className = "ascii-history-item__meta";

      const name = document.createElement("div");
      name.className = "ascii-history-item__name";
      name.textContent = item.fileName;

      const params = document.createElement("div");
      params.className = "ascii-history-item__params";
      const p = item.params;
      params.textContent = `${p.mode} · ${p.width}w · ${p.colored ? "彩色 " : ""}${p.negative ? "反色 " : ""}${p.grayscale ? "灰度 " : ""}${p.charSet !== "default" ? p.charSet : ""}`;

      const time = document.createElement("span");
      time.className = "ascii-history-item__time";
      time.textContent = formatTime(item.timestamp);

      const removeBtn = document.createElement("button");
      removeBtn.className = "ascii-history-item__remove";
      removeBtn.type = "button";
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeHistoryItem(item.id);
      });

      meta.appendChild(name);
      meta.appendChild(params);
      div.appendChild(thumb);
      div.appendChild(meta);
      div.appendChild(time);
      div.appendChild(removeBtn);

      div.addEventListener("click", () => {
        outputText.textContent = item.textPreview.length >= 400
          ? item.textPreview + "\n\n… (截取自历史记录)"
          : item.textPreview;
        outputSection.hidden = false;
        switchTab("text");
        statusText.textContent = `已加载历史记录 · ${item.fileName}`;
        outputSection.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      historyList.appendChild(div);
    }
  }

  function removeHistoryItem(id) {
    const history = loadHistory().filter((h) => h.id !== id);
    CS.storage.set(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
  }

  document.querySelector("[data-history-clear-all]").addEventListener("click", () => {
    CS.storage.remove(HISTORY_KEY);
    renderHistory();
    CS.toast("历史记录已清空", "ok");
  });

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diffMin = Math.floor((now - d) / 60000);
    if (diffMin < 1) return "刚刚";
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} 小时前`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  // ---- Mobile collapse ----
  function checkMobileCollapse() {
    const isMobile = window.innerWidth <= 768;
    collapseBtn.hidden = !isMobile;
    if (isMobile && lastResult) {
      controlsBody.setAttribute("data-collapsed", "true");
      collapseBtn.innerHTML = "&#9660;";
    }
  }

  collapseBtn.addEventListener("click", () => {
    const collapsed = controlsBody.getAttribute("data-collapsed") === "true";
    controlsBody.setAttribute("data-collapsed", String(!collapsed));
    collapseBtn.innerHTML = collapsed ? "&#9650;" : "&#9660;";
  });

  window.addEventListener("resize", checkMobileCollapse);

  // ---- Keyboard shortcut: Ctrl+Enter to convert ----
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter" && selectedFile && !convertBtn.disabled) {
      e.preventDefault();
      convertBtn.click();
    }
  });

  // ---- Init ----
  renderHistory();
  checkMobileCollapse();
})();
