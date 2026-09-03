(function () {
  "use strict";

  var Core = window.BeadStudioCore;
  var DRAFT_KEY = "claudeOne:beadStudio:draft:v1";
  var SETTINGS_KEY = "claudeOne:beadStudio:settings:v1";
  var TOOL_NAMES = {
    pan: "拖动", pencil: "画笔", eraser: "橡皮", fill: "填充", eyedropper: "吸管",
    select: "选择", line: "直线", rect: "矩形", ellipse: "椭圆", text: "文字"
  };
  var GROUP_NAMES = { all: "全部", A: "黄/肤", B: "橙", C: "红", D: "粉", E: "紫", F: "蓝", G: "绿", H: "棕", M: "莫兰迪", P: "灰", Q: "黑白", R: "夜光", T: "透明", Y: "特殊", ZG: "混合" };

  var root = null;
  var aborter = null;
  var el = {};
  var project = null;
  var stage = "optimize";
  var sourceImage = null;
  var sourceUrl = "";
  var referenceImage = null;
  var referenceUrl = "";
  var sourceFileName = "";
  var sourceRatio = 1;
  var selectedColorId = "H07";
  var paletteGroup = "all";
  var activeTool = "pencil";
  var zoom = 1;
  var selection = null;
  var clipboard = null;
  var drag = null;
  var excludedIds = new Set();
  var history = [];
  var future = [];
  var autosaveTimer = 0;
  var preview = { material: "matte", roundness: 0.3, background: "warm", shadow: true, codes: false };
  var make = { placed: new Set(), currentColorId: null, startedAt: 0, elapsed: 0, timerId: 0 };
  var mountGeneration = 0;
  var sourceLoadSequence = 0;
  var referenceLoadSequence = 0;

  function q(selector) { return root ? root.querySelector(selector) : null; }
  function qa(selector) { return root ? Array.from(root.querySelectorAll(selector)) : []; }
  function on(target, type, handler, options) {
    if (!target) return;
    var opts = Object.assign({}, options || {}, { signal: aborter.signal });
    target.addEventListener(type, handler, opts);
  }
  function numberValue(node, fallback) {
    var value = Number(node && node.value);
    return Number.isFinite(value) ? value : fallback;
  }
  function safeColor(id) { return Core.getColor(id) || Core.getPalette("291")[0]; }
  function currentBrand() { return project ? project.brand : (el.brand ? el.brand.value : "MARD"); }
  function currentPaletteMode() { return project ? project.paletteMode : (el.paletteMode ? el.paletteMode.value : "291"); }
  function currentCode(id) { return Core.codeFor(safeColor(id), currentBrand()); }
  function activeLayer() { return project ? Core.getActiveLayer(project) : null; }
  function clampDimension(value) { return Core.clamp(Math.round(Number(value) || 29), 4, Core.MAX_SIDE); }

  function collectElements() {
    el = {
      projectName: q("[data-beads-project-name]"), saveState: q("[data-beads-save-state]"),
      canvas: q("[data-beads-canvas]"), canvasWrap: q("[data-beads-canvas-wrap]"), empty: q("[data-beads-empty]"),
      canvasTitle: q("[data-beads-canvas-title]"), canvasMeta: q("[data-beads-canvas-meta]"), zoomValue: q("[data-beads-zoom-value]"),
      pointerStatus: q("[data-beads-pointer-status]"), selectionStatus: q("[data-beads-selection-status]"), undo: q("[data-beads-undo]"), redo: q("[data-beads-redo]"),
      imageFile: q("[data-beads-image-file]"), projectFile: q("[data-beads-project-file]"), referenceFile: q("[data-beads-reference-file]"),
      sourceImage: q("[data-beads-source-image]"), sourcePlaceholder: q("[data-beads-source-placeholder]"), sourceName: q("[data-beads-source-name]"), sourceDims: q("[data-beads-source-dims]"),
      width: q("[data-beads-width]"), height: q("[data-beads-height]"), lockRatio: q("[data-beads-lock-ratio]"),
      brand: q("[data-beads-brand]"), paletteMode: q("[data-beads-palette-mode]"), maxColors: q("[data-beads-max-colors]"), maxColorsValue: q("[data-beads-max-colors-value]"),
      style: q("[data-beads-style]"), fitMode: q("[data-beads-fit-mode]"), sourceScale: q("[data-beads-source-scale]"), sourceScaleValue: q("[data-beads-source-scale-value]"),
      sourceX: q("[data-beads-source-x]"), sourceY: q("[data-beads-source-y]"), merge: q("[data-beads-merge]"), mergeValue: q("[data-beads-merge-value]"),
      brightness: q("[data-beads-brightness]"), contrast: q("[data-beads-contrast]"), saturation: q("[data-beads-saturation]"), removeBg: q("[data-beads-remove-bg]"),
      dither: q("[data-beads-dither]"), bgTolerance: q("[data-beads-bg-tolerance]"), bgToleranceValue: q("[data-beads-bg-tolerance-value]"), bgToleranceWrap: q("[data-beads-bg-tolerance-wrap]"),
      generate: q("[data-beads-generate]"), usedWrap: q("[data-beads-used-wrap]"), usedList: q("[data-beads-used-list]"),
      activeTool: q("[data-beads-active-tool]"), textTools: q("[data-beads-text-tools]"), text: q("[data-beads-text]"), textSize: q("[data-beads-text-size]"), textDirection: q("[data-beads-text-direction]"),
      selectedSwatch: q("[data-beads-selected-swatch]"), selectedCode: q("[data-beads-selected-code]"), paletteSearch: q("[data-beads-palette-search]"), paletteGroups: q("[data-beads-palette-groups]"), palette: q("[data-beads-palette]"),
      layers: q("[data-beads-layers]"), referenceShow: q("[data-beads-reference-show]"), referenceOpacity: q("[data-beads-reference-opacity]"),
      resizeWidth: q("[data-beads-resize-width]"), resizeHeight: q("[data-beads-resize-height]"), previewCanvas: q("[data-beads-preview-canvas]"),
      roundness: q("[data-beads-roundness]"), roundnessValue: q("[data-beads-roundness-value]"), previewBg: q("[data-beads-preview-bg]"), previewShadow: q("[data-beads-preview-shadow]"), previewCodes: q("[data-beads-preview-codes]"),
      makePercent: q("[data-beads-make-percent]"), progressBar: q("[data-beads-progress-bar]"), placed: q("[data-beads-placed]"), remaining: q("[data-beads-remaining]"), timer: q("[data-beads-timer]"),
      strategy: q("[data-beads-strategy]"), gridInterval: q("[data-beads-grid-interval]"), hidePlaced: q("[data-beads-hide-placed]"), dimOthers: q("[data-beads-dim-others]"), guideCurrent: q("[data-beads-guide-current]"), makeColors: q("[data-beads-make-colors]")
    };
  }

  function notify(message, error) {
    if (el.pointerStatus) {
      el.pointerStatus.textContent = message;
      el.pointerStatus.dataset.error = error ? "true" : "false";
    }
  }

  function revokeObjectUrl(kind) {
    var value = kind === "source" ? sourceUrl : referenceUrl;
    if (value) URL.revokeObjectURL(value);
    if (kind === "source") sourceUrl = ""; else referenceUrl = "";
  }

  function readSettings() {
    try {
      var settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      if (settings.preview) preview = Object.assign(preview, settings.preview);
      if (settings.activeTool && TOOL_NAMES[settings.activeTool]) activeTool = settings.activeTool;
      if (settings.selectedColorId && Core.getColor(settings.selectedColorId)) selectedColorId = settings.selectedColorId;
    } catch (_) { /* Ignore malformed local settings. */ }
  }

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ preview: preview, activeTool: activeTool, selectedColorId: selectedColorId })); } catch (_) { /* Storage can be unavailable. */ }
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (raw) project = Core.deserializeProject(raw);
    } catch (_) {
      localStorage.removeItem(DRAFT_KEY);
      project = null;
    }
  }

  function queueAutosave() {
    clearTimeout(autosaveTimer);
    if (el.saveState) el.saveState.textContent = "正在保存…";
    autosaveTimer = window.setTimeout(function () {
      if (!project) return;
      try {
        localStorage.setItem(DRAFT_KEY, Core.serializeProject(project));
        if (el.saveState) el.saveState.textContent = "已自动保存到本机";
      } catch (_) {
        if (el.saveState) el.saveState.textContent = "本地空间不足，请保存项目文件";
      }
    }, 350);
  }

  function progressKey() {
    return project ? "claudeOne:beadStudio:progress:" + project.createdAt : "";
  }

  function saveMakeProgress() {
    if (!project) return;
    try {
      localStorage.setItem(progressKey(), JSON.stringify({ placed: Array.from(make.placed), elapsed: elapsedSeconds(), currentColorId: make.currentColorId }));
    } catch (_) { /* Non-critical state. */ }
  }

  function loadMakeProgress() {
    make.placed = new Set();
    make.elapsed = 0;
    make.startedAt = 0;
    make.currentColorId = null;
    if (!project) return;
    try {
      var data = JSON.parse(localStorage.getItem(progressKey()) || "{}");
      var cells = Core.composeProject(project);
      if (Array.isArray(data.placed)) data.placed.forEach(function (index) { if (cells[index]) make.placed.add(Number(index)); });
      make.elapsed = Math.max(0, Number(data.elapsed) || 0);
      if (data.currentColorId && cells.indexOf(data.currentColorId) >= 0) make.currentColorId = data.currentColorId;
    } catch (_) { /* Ignore stale progress. */ }
  }

  function elapsedSeconds() {
    return make.elapsed + (make.startedAt ? Math.floor((Date.now() - make.startedAt) / 1000) : 0);
  }

  function formatTimer(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    var hours = Math.floor(seconds / 3600);
    var minutes = Math.floor((seconds % 3600) / 60);
    var secs = seconds % 60;
    return (hours ? String(hours).padStart(2, "0") + ":" : "") + String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  }

  function beginHistory() {
    if (!project) return false;
    history.push(Core.cloneProject(project));
    if (history.length > 60) history.shift();
    future.length = 0;
    return true;
  }

  function finishMutation(message) {
    if (!project) return;
    project.updatedAt = new Date().toISOString();
    sanitizeMakeProgress();
    queueAutosave();
    renderProject();
    if (message) notify(message);
  }

  function mutate(message, callback) {
    var layer = activeLayer();
    if (!project || !layer) { notify("请先创建或导入图纸", true); return; }
    if (layer.locked) { notify("当前图层已锁定", true); return; }
    beginHistory();
    callback(layer);
    finishMutation(message);
  }

  function undo() {
    if (!history.length || !project) return;
    future.push(Core.cloneProject(project));
    project = history.pop();
    selection = null;
    finishMutation("已撤销");
  }

  function redo() {
    if (!future.length || !project) return;
    history.push(Core.cloneProject(project));
    project = future.pop();
    selection = null;
    finishMutation("已重做");
  }

  function sanitizeMakeProgress() {
    if (!project) return;
    var cells = Core.composeProject(project);
    make.placed.forEach(function (index) { if (!cells[index]) make.placed.delete(index); });
    if (make.currentColorId && cells.indexOf(make.currentColorId) < 0) make.currentColorId = null;
    saveMakeProgress();
  }

  function createBlank() {
    var width = clampDimension(el.width.value);
    var height = clampDimension(el.height.value);
    project = Core.createProject(width, height, el.projectName.value.trim() || "未命名拼豆");
    project.brand = el.brand.value;
    project.paletteMode = el.paletteMode.value;
    history = [];
    future = [];
    selection = null;
    excludedIds.clear();
    loadMakeProgress();
    queueAutosave();
    setStage("edit");
    renderProject();
    fitCanvas();
    notify("已创建 " + width + " × " + height + " 空白画布");
  }

  function loadImageFile(file, kind) {
    if (!file || !file.type.match(/^image\//)) { notify("请选择 JPG、PNG、WebP、BMP 或 GIF 图片", true); return; }
    var image = new Image();
    var url = URL.createObjectURL(file);
    var generation = mountGeneration;
    var sequence = kind === "source" ? ++sourceLoadSequence : ++referenceLoadSequence;
    image.onload = function () {
      if (!root || generation !== mountGeneration || (kind === "source" ? sequence !== sourceLoadSequence : sequence !== referenceLoadSequence)) { URL.revokeObjectURL(url); return; }
      if (kind === "source") {
        revokeObjectUrl("source");
        sourceImage = image;
        sourceUrl = url;
        sourceFileName = file.name;
        sourceRatio = image.naturalWidth / image.naturalHeight;
        el.sourceImage.src = url;
        el.sourceImage.hidden = false;
        el.sourcePlaceholder.hidden = true;
        el.sourceName.textContent = file.name;
        el.sourceDims.textContent = image.naturalWidth + " × " + image.naturalHeight + " px · 本地读取";
        el.generate.disabled = false;
        if (el.lockRatio.checked) el.height.value = clampDimension(numberValue(el.width, 29) / sourceRatio);
        notify("图片已载入，可以调整参数后生成");
      } else {
        revokeObjectUrl("reference");
        referenceImage = image;
        referenceUrl = url;
        el.referenceShow.checked = true;
        renderCanvas();
        notify("参考图已载入");
      }
    };
    image.onerror = function () {
      URL.revokeObjectURL(url);
      if (root && generation === mountGeneration) notify("图片读取失败，请换一张图片", true);
    };
    image.src = url;
  }

  function sourceFrame(width, height) {
    var targetMax = 1200;
    var frameWidth = Math.max(64, Math.min(targetMax, width * 10));
    var frameHeight = Math.max(64, Math.round(frameWidth * height / width));
    if (frameHeight > targetMax) { frameWidth = Math.round(frameWidth * targetMax / frameHeight); frameHeight = targetMax; }
    var canvas = document.createElement("canvas");
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, frameWidth, frameHeight);
    var iw = sourceImage.naturalWidth, ih = sourceImage.naturalHeight;
    var baseScale = el.fitMode.value === "cover" ? Math.max(frameWidth / iw, frameHeight / ih) : Math.min(frameWidth / iw, frameHeight / ih);
    var scale = baseScale * numberValue(el.sourceScale, 100) / 100;
    var dw = iw * scale, dh = ih * scale;
    var x = (frameWidth - dw) / 2 + numberValue(el.sourceX, 0) / 100 * frameWidth * 0.45;
    var y = (frameHeight - dh) / 2 + numberValue(el.sourceY, 0) / 100 * frameHeight * 0.45;
    ctx.imageSmoothingEnabled = el.style.value === "realistic";
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sourceImage, x, y, dw, dh);
    return ctx.getImageData(0, 0, frameWidth, frameHeight);
  }

  function generatePattern() {
    if (!sourceImage) { notify("请先选择一张图片", true); return; }
    var width = clampDimension(el.width.value);
    var height = clampDimension(el.height.value);
    el.generate.disabled = true;
    el.generate.textContent = "正在生成…";
    var generation = mountGeneration;
    window.setTimeout(function () {
      if (!root || generation !== mountGeneration) return;
      try {
        var result = Core.convertImageData(sourceFrame(width, height), {
          width: width, height: height, paletteMode: el.paletteMode.value, excludedIds: Array.from(excludedIds),
          maxColors: numberValue(el.maxColors, 32), style: el.style.value,
          brightness: numberValue(el.brightness, 0), contrast: numberValue(el.contrast, 0), saturation: numberValue(el.saturation, 0),
          removeBackground: el.removeBg.checked, backgroundTolerance: numberValue(el.bgTolerance, 16), dither: el.dither.checked,
          mergeStrength: numberValue(el.merge, 25) / 100
        });
        project = Core.createProject(width, height, el.projectName.value.trim() || sourceFileName.replace(/\.[^.]+$/, "") || "未命名拼豆");
        project.brand = el.brand.value;
        project.paletteMode = el.paletteMode.value;
        project.layers[0].cells = result.cells;
        history = [];
        future = [];
        selection = null;
        loadMakeProgress();
        queueAutosave();
        renderProject();
        fitCanvas();
        notify("生成完成：" + result.totalBeads + " 颗，" + result.colorsUsed + " 种颜色");
      } catch (error) {
        notify("生成失败：" + error.message, true);
      } finally {
        el.generate.disabled = false;
        el.generate.textContent = "生成拼豆图纸";
      }
    }, 20);
  }

  function setStage(next) {
    if (!["optimize", "edit", "preview", "make"].includes(next)) return;
    stage = next;
    qa("[data-beads-stage]").forEach(function (button) {
      var active = button.dataset.beadsStage === stage;
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    qa("[data-beads-panel]").forEach(function (panel) { panel.hidden = panel.dataset.beadsPanel !== stage; });
    el.canvasTitle.textContent = stage === "make" ? "摆豆图纸" : stage === "preview" ? "结构图纸" : "图纸画布";
    if (stage === "make" && project && !make.startedAt) make.startedAt = Date.now();
    if (stage !== "make" && make.startedAt) { make.elapsed = elapsedSeconds(); make.startedAt = 0; saveMakeProgress(); }
    renderProject();
  }

  function setTool(tool) {
    if (!TOOL_NAMES[tool]) return;
    activeTool = tool;
    qa("[data-tool]").forEach(function (button) { button.dataset.active = button.dataset.tool === tool ? "true" : "false"; });
    el.activeTool.textContent = TOOL_NAMES[tool];
    el.textTools.hidden = tool !== "text";
    el.canvasWrap.dataset.tool = tool;
    saveSettings();
  }

  function cellSize() {
    if (!project) return 16;
    return Math.max(3, Math.min(34, Math.round(16 * zoom), Math.floor(4096 / Math.max(project.width, project.height))));
  }

  function cellFromPointer(event) {
    if (!project) return null;
    var rect = el.canvas.getBoundingClientRect();
    var x = Math.floor((event.clientX - rect.left) * el.canvas.width / rect.width / cellSize());
    var y = Math.floor((event.clientY - rect.top) * el.canvas.height / rect.height / cellSize());
    if (x < 0 || y < 0 || x >= project.width || y >= project.height) return null;
    return { x: x, y: y, index: y * project.width + x };
  }

  function drawReference(ctx, width, height) {
    if (!referenceImage || !el.referenceShow.checked || stage === "make") return;
    ctx.save();
    ctx.globalAlpha = numberValue(el.referenceOpacity, 35) / 100;
    var iw = referenceImage.naturalWidth, ih = referenceImage.naturalHeight;
    var scale = Math.min(width / iw, height / ih);
    var dw = iw * scale, dh = ih * scale;
    ctx.drawImage(referenceImage, (width - dw) / 2, (height - dh) / 2, dw, dh);
    ctx.restore();
  }

  function renderBead(ctx, x, y, size, color, alpha) {
    var inset = Math.max(0.5, size * 0.08);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color.hex;
    if (size < 7) {
      ctx.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2);
    } else {
      ctx.beginPath();
      ctx.roundRect(x + inset, y + inset, size - inset * 2, size - inset * 2, Math.max(1, size * 0.2));
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.24)";
      ctx.fillRect(x + size * 0.22, y + size * 0.18, size * 0.3, Math.max(1, size * 0.08));
    }
    ctx.globalAlpha = 1;
  }

  function renderCanvas() {
    if (!el.canvas) return;
    if (!project) {
      el.canvas.width = 1; el.canvas.height = 1;
      el.canvas.style.width = "1px"; el.canvas.style.height = "1px";
      el.empty.hidden = false;
      el.canvasMeta.textContent = "29 × 29 · 0 颗";
      el.selectionStatus.textContent = "未选择区域";
      return;
    }
    el.empty.hidden = true;
    var size = cellSize();
    var width = project.width * size, height = project.height * size;
    el.canvas.width = width; el.canvas.height = height;
    el.canvas.style.width = width + "px"; el.canvas.style.height = height + "px";
    var ctx = el.canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--surface-sunken").trim() || "#f2efe8";
    ctx.fillRect(0, 0, width, height);
    drawReference(ctx, width, height);
    var cells = Core.composeProject(project);
    var makeMode = stage === "make";
    cells.forEach(function (id, index) {
      if (!id) return;
      var placed = make.placed.has(index);
      if (makeMode && placed && el.hidePlaced.checked) return;
      var alpha = 1;
      if (makeMode && make.currentColorId && id !== make.currentColorId && el.dimOthers.checked) alpha = 0.16;
      if (makeMode && placed) alpha *= 0.3;
      var x = index % project.width, y = Math.floor(index / project.width);
      renderBead(ctx, x * size, y * size, size, safeColor(id), alpha);
      if (makeMode && placed && size >= 11) {
        ctx.globalAlpha = 0.8; ctx.strokeStyle = "#237a57"; ctx.lineWidth = Math.max(1, size * 0.1);
        ctx.beginPath(); ctx.moveTo(x * size + size * 0.22, y * size + size * 0.52); ctx.lineTo(x * size + size * 0.43, y * size + size * 0.72); ctx.lineTo(x * size + size * 0.8, y * size + size * 0.28); ctx.stroke(); ctx.globalAlpha = 1;
      }
    });
    var interval = makeMode ? Math.max(1, numberValue(el.gridInterval, 10)) : 1;
    ctx.beginPath();
    for (var gx = 0; gx <= project.width; gx += 1) {
      if (gx % interval !== 0 && makeMode) continue;
      ctx.moveTo(gx * size + 0.5, 0); ctx.lineTo(gx * size + 0.5, height);
    }
    for (var gy = 0; gy <= project.height; gy += 1) {
      if (gy % interval !== 0 && makeMode) continue;
      ctx.moveTo(0, gy * size + 0.5); ctx.lineTo(width, gy * size + 0.5);
    }
    ctx.strokeStyle = makeMode ? "rgba(40,45,60,.4)" : "rgba(50,55,70,.13)";
    ctx.lineWidth = makeMode ? 1.5 : 1;
    ctx.stroke();
    if (selection && stage === "edit") {
      var bounds = normalizedSelection();
      ctx.save(); ctx.strokeStyle = "#6f58d9"; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.strokeRect(bounds.x0 * size + 1, bounds.y0 * size + 1, (bounds.x1 - bounds.x0 + 1) * size - 2, (bounds.y1 - bounds.y0 + 1) * size - 2); ctx.restore();
    }
    var summary = Core.summarizeCells(cells);
    el.canvasMeta.textContent = project.width + " × " + project.height + " · " + summary.total + " 颗 · " + summary.colors + " 色";
    if (selection) {
      var selected = normalizedSelection();
      el.selectionStatus.textContent = "选区 " + (selected.x1 - selected.x0 + 1) + " × " + (selected.y1 - selected.y0 + 1);
    } else el.selectionStatus.textContent = "未选择区域";
  }

  function normalizedSelection() {
    if (!selection || !project) return null;
    return {
      x0: Core.clamp(Math.min(selection.x0, selection.x1), 0, project.width - 1),
      y0: Core.clamp(Math.min(selection.y0, selection.y1), 0, project.height - 1),
      x1: Core.clamp(Math.max(selection.x0, selection.x1), 0, project.width - 1),
      y1: Core.clamp(Math.max(selection.y0, selection.y1), 0, project.height - 1)
    };
  }

  function renderPaletteGroups() {
    var groups = ["all"].concat(Array.from(new Set(Core.getPalette(currentPaletteMode()).map(function (color) { return color.group; }))));
    el.paletteGroups.replaceChildren();
    groups.forEach(function (group) {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = GROUP_NAMES[group] || group;
      button.dataset.active = paletteGroup === group ? "true" : "false";
      button.addEventListener("click", function () { paletteGroup = group; renderPaletteGroups(); renderPalette(); }, { signal: aborter.signal });
      el.paletteGroups.appendChild(button);
    });
  }

  function renderPalette() {
    var search = (el.paletteSearch.value || "").trim().toUpperCase();
    var brand = currentBrand();
    var colors = Core.getPalette(currentPaletteMode()).filter(function (color) {
      var code = Core.codeFor(color, brand);
      return (paletteGroup === "all" || color.group === paletteGroup) && (!search || color.id.includes(search) || String(code).toUpperCase().includes(search) || color.hex.includes(search));
    });
    el.palette.replaceChildren();
    colors.forEach(function (color) {
      var button = document.createElement("button");
      button.type = "button";
      button.title = brand + " " + Core.codeFor(color, brand) + " · " + color.hex;
      button.dataset.code = Core.codeFor(color, brand);
      button.dataset.active = color.id === selectedColorId ? "true" : "false";
      button.style.background = color.hex;
      button.style.setProperty("--code-ink", color.rgb[0] * .299 + color.rgb[1] * .587 + color.rgb[2] * .114 > 150 ? "#111" : "#fff");
      button.addEventListener("click", function () { selectedColorId = color.id; renderSelectedColor(); renderPalette(); saveSettings(); }, { signal: aborter.signal });
      el.palette.appendChild(button);
    });
  }

  function renderSelectedColor() {
    var color = safeColor(selectedColorId);
    el.selectedSwatch.style.background = color.hex;
    el.selectedCode.textContent = currentBrand() + " " + Core.codeFor(color, currentBrand()) + " · " + color.hex;
  }

  function renderUsedColors() {
    el.usedList.replaceChildren();
    if (!project) { el.usedWrap.hidden = true; return; }
    var summary = Core.summarizeCells(Core.composeProject(project));
    el.usedWrap.hidden = summary.rows.length === 0;
    summary.rows.forEach(function (row) {
      var button = document.createElement("button"); button.type = "button";
      var swatch = document.createElement("span"); swatch.style.background = row.color.hex;
      var label = document.createElement("b"); label.textContent = currentCode(row.id);
      var count = document.createElement("small"); count.textContent = row.count + " 颗";
      button.append(swatch, label, count);
      button.title = "排除 " + currentCode(row.id) + " 并重新生成";
      button.addEventListener("click", function () {
        if (!sourceImage) { selectedColorId = row.id; setStage("edit"); renderProject(); return; }
        excludedIds.add(row.id); generatePattern();
      }, { signal: aborter.signal });
      el.usedList.appendChild(button);
    });
  }

  function renderLayers() {
    el.layers.replaceChildren();
    if (!project) return;
    project.layers.forEach(function (layer) {
      var item = document.createElement("div"); item.className = "beads-layer"; item.dataset.active = layer.id === project.activeLayerId ? "true" : "false";
      var visible = document.createElement("button"); visible.type = "button"; visible.textContent = layer.visible ? "◉" : "○"; visible.title = layer.visible ? "隐藏图层" : "显示图层"; visible.dataset.on = String(layer.visible);
      var locked = document.createElement("button"); locked.type = "button"; locked.textContent = layer.locked ? "锁" : "开"; locked.title = layer.locked ? "解锁图层" : "锁定图层"; locked.dataset.on = String(layer.locked);
      var name = document.createElement("strong"); name.textContent = layer.name; name.title = "点击选择图层";
      var count = document.createElement("small"); count.textContent = Core.summarizeCells(layer.cells).total + " 颗";
      item.append(visible, locked, name, count);
      on(item, "click", function (event) { if (event.target === visible || event.target === locked) return; project.activeLayerId = layer.id; renderLayers(); });
      on(visible, "click", function () { beginHistory(); layer.visible = !layer.visible; finishMutation(layer.visible ? "图层已显示" : "图层已隐藏"); });
      on(locked, "click", function () { beginHistory(); layer.locked = !layer.locked; finishMutation(layer.locked ? "图层已锁定" : "图层已解锁"); });
      el.layers.appendChild(item);
    });
  }

  function renderProject() {
    renderCanvas();
    if (project) {
      el.projectName.value = project.name;
      el.brand.value = project.brand;
      el.paletteMode.value = project.paletteMode;
      el.width.value = project.width; el.height.value = project.height;
      el.resizeWidth.value = project.width; el.resizeHeight.value = project.height;
    }
    el.undo.disabled = history.length === 0;
    el.redo.disabled = future.length === 0;
    renderSelectedColor();
    renderPaletteGroups();
    renderPalette();
    renderUsedColors();
    renderLayers();
    renderPreview();
    renderMakeGuide();
  }

  function fitCanvas() {
    if (!project || !el.canvasWrap) return;
    var availableWidth = Math.max(120, el.canvasWrap.clientWidth - 48);
    var availableHeight = Math.max(120, el.canvasWrap.clientHeight - 48);
    zoom = Core.clamp(Math.min(availableWidth / (project.width * 16), availableHeight / (project.height * 16)), 0.2, 2.1);
    el.zoomValue.textContent = Math.round(zoom * 100) + "%";
    renderCanvas();
    window.setTimeout(function () {
      if (!root || !el.canvasWrap || !el.canvas) return;
      el.canvasWrap.scrollLeft = Math.max(0, (el.canvas.scrollWidth - el.canvasWrap.clientWidth) / 2);
      el.canvasWrap.scrollTop = Math.max(0, (el.canvas.scrollHeight - el.canvasWrap.clientHeight) / 2);
    }, 0);
  }

  function backgroundFill(ctx, width, height, style) {
    if (style === "transparent") { ctx.clearRect(0, 0, width, height); return; }
    var colors = { warm: "#f6f2e8", white: "#ffffff", beige: "#dfd1b8", dark: "#252837", black: "#090a0d", wood: "#bd8c5b" };
    ctx.fillStyle = colors[style] || colors.warm;
    ctx.fillRect(0, 0, width, height);
    if (style === "wood") {
      ctx.save(); ctx.globalAlpha = 0.16; ctx.strokeStyle = "#55361f"; ctx.lineWidth = 2;
      for (var y = 10; y < height; y += 24) {
        ctx.beginPath(); ctx.moveTo(0, y);
        for (var x = 0; x <= width; x += 28) ctx.quadraticCurveTo(x + 8, y + Math.sin(x * 0.04 + y) * 4, x + 28, y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function paintMaterialBead(ctx, cx, cy, size, color, id) {
    var rgb = color.rgb;
    var radius = size * (preview.material === "fused" ? (0.5 - preview.roundness * 0.12) : 0.43);
    ctx.save();
    if (preview.shadow) { ctx.shadowColor = "rgba(20,22,28,.28)"; ctx.shadowBlur = Math.max(1, size * 0.16); ctx.shadowOffsetY = size * 0.08; }
    ctx.fillStyle = color.hex;
    ctx.beginPath();
    if (preview.material === "fused") {
      var corner = Math.max(1, size * (0.08 + preview.roundness * 0.22));
      ctx.roundRect(cx - size * 0.47, cy - size * 0.47, size * 0.94, size * 0.94, corner);
    } else ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = "transparent";
    if (preview.material !== "fused" && size >= 8) {
      ctx.fillStyle = "rgba(20,20,24,.34)";
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, size * 0.14), 0, Math.PI * 2); ctx.fill();
    }
    if (preview.material === "gloss") {
      var gloss = ctx.createRadialGradient(cx - size * 0.17, cy - size * 0.19, 0, cx, cy, size * 0.45);
      gloss.addColorStop(0, "rgba(255,255,255,.82)"); gloss.addColorStop(0.38, "rgba(255,255,255,.08)"); gloss.addColorStop(1, "rgba(0,0,0,.16)");
      ctx.fillStyle = gloss; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
    } else if (preview.material === "glitter" && size >= 7) {
      ctx.fillStyle = "rgba(255,255,255,.82)";
      [[-.2, -.18], [.18, -.05], [-.05, .22]].forEach(function (point, index) { ctx.fillRect(cx + point[0] * size, cy + point[1] * size, index === 1 ? 1 : 1.5, index === 1 ? 1 : 1.5); });
    } else if (preview.material === "frosted") {
      ctx.fillStyle = "rgba(255,255,255,.24)"; ctx.beginPath(); ctx.arc(cx - size * 0.06, cy - size * 0.08, radius * 0.78, 0, Math.PI * 2); ctx.fill();
    } else if (preview.material === "matte") {
      ctx.strokeStyle = "rgba(" + rgb.join(",") + ",.7)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, radius - 0.5, 0, Math.PI * 2); ctx.stroke();
    }
    if (preview.codes && size >= 17) {
      ctx.fillStyle = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) > 150 ? "rgba(0,0,0,.78)" : "rgba(255,255,255,.88)";
      ctx.font = "600 " + Math.max(5, size * 0.24) + "px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(currentCode(id), cx, cy + size * 0.02, size * 0.82);
    }
    ctx.restore();
  }

  function drawPreviewCanvas(canvas, maxPixels) {
    if (!canvas) return;
    if (!project) { canvas.width = 1; canvas.height = 1; return; }
    var padding = 42;
    var size = Math.max(3, Math.min(24, Math.floor((maxPixels - padding * 2) / Math.max(project.width, project.height))));
    var width = project.width * size + padding * 2;
    var height = project.height * size + padding * 2;
    canvas.width = width; canvas.height = height;
    var ctx = canvas.getContext("2d");
    backgroundFill(ctx, width, height, preview.background);
    var cells = Core.composeProject(project);
    cells.forEach(function (id, index) {
      if (!id) return;
      var x = index % project.width, y = Math.floor(index / project.width);
      paintMaterialBead(ctx, padding + x * size + size / 2, padding + y * size + size / 2, size, safeColor(id), id);
    });
  }

  function renderPreview() {
    preview.roundness = numberValue(el.roundness, preview.roundness * 100) / 100;
    preview.background = el.previewBg ? el.previewBg.value : preview.background;
    preview.shadow = el.previewShadow ? el.previewShadow.checked : preview.shadow;
    preview.codes = el.previewCodes ? el.previewCodes.checked : preview.codes;
    if (el.roundnessValue) el.roundnessValue.textContent = Math.round(preview.roundness * 100) + "%";
    qa("[data-material]").forEach(function (button) { button.dataset.active = button.dataset.material === preview.material ? "true" : "false"; });
    drawPreviewCanvas(el.previewCanvas, 760);
  }

  function orderedMakeRows(cells) {
    var rows = Core.summarizeCells(cells).rows.map(function (row) {
      var remaining = 0, edge = 0;
      cells.forEach(function (id, index) {
        if (id !== row.id || make.placed.has(index)) return;
        remaining += 1;
        var x = index % project.width, y = Math.floor(index / project.width);
        if (x === 0 || y === 0 || x === project.width - 1 || y === project.height - 1) edge += 1;
      });
      return { id: row.id, color: row.color, count: row.count, remaining: remaining, edge: edge };
    });
    var strategy = el.strategy ? el.strategy.value : "largest";
    if (strategy === "code") rows.sort(function (a, b) { return currentCode(a.id).localeCompare(currentCode(b.id), "zh-CN", { numeric: true }); });
    else if (strategy === "edge") rows.sort(function (a, b) { return b.edge - a.edge || b.remaining - a.remaining; });
    else if (strategy === "recent") rows.sort(function (a, b) { return a.id === make.currentColorId ? -1 : b.id === make.currentColorId ? 1 : b.remaining - a.remaining; });
    else rows.sort(function (a, b) { return b.remaining - a.remaining || b.count - a.count; });
    return rows;
  }

  function renderMakeGuide() {
    if (!el.makeColors) return;
    el.makeColors.replaceChildren();
    if (!project) {
      el.makePercent.textContent = "0%"; el.progressBar.style.width = "0%"; el.placed.textContent = "0"; el.remaining.textContent = "0"; el.timer.textContent = "00:00";
      return;
    }
    var cells = Core.composeProject(project);
    var total = Core.summarizeCells(cells).total;
    var done = make.placed.size;
    var percent = total ? Math.round(done / total * 100) : 0;
    el.makePercent.textContent = percent + "%"; el.progressBar.style.width = percent + "%";
    el.placed.textContent = done; el.remaining.textContent = Math.max(0, total - done); el.timer.textContent = formatTimer(elapsedSeconds());
    var rows = orderedMakeRows(cells);
    if (!make.currentColorId) {
      var firstRemaining = rows.find(function (row) { return row.remaining > 0; });
      make.currentColorId = firstRemaining ? firstRemaining.id : (rows[0] ? rows[0].id : null);
    }
    rows.forEach(function (row) {
      var button = document.createElement("button"); button.type = "button"; button.dataset.active = row.id === make.currentColorId ? "true" : "false"; button.dataset.complete = row.remaining === 0 ? "true" : "false";
      var swatch = document.createElement("span"); swatch.style.background = row.color.hex;
      var label = document.createElement("b"); label.textContent = currentCode(row.id);
      var count = document.createElement("small"); count.textContent = row.remaining + " / " + row.count;
      button.append(swatch, label, count);
      on(button, "click", function () { make.currentColorId = row.id; saveMakeProgress(); renderMakeGuide(); renderCanvas(); });
      el.makeColors.appendChild(button);
    });
    var current = rows.find(function (row) { return row.id === make.currentColorId; });
    var guideSwatch = el.guideCurrent.querySelector("span"); var guideLabel = el.guideCurrent.querySelector("strong");
    if (current) { guideSwatch.style.background = current.color.hex; guideLabel.textContent = currentCode(current.id) + " · 剩余 " + current.remaining + " 颗"; }
    else { guideSwatch.style.background = "transparent"; guideLabel.textContent = total ? "全部完成" : "图纸中没有豆子"; }
  }

  function updateTimer() {
    if (stage === "make" && make.startedAt && el.timer) el.timer.textContent = formatTimer(elapsedSeconds());
  }

  function layerCanEdit() {
    var layer = activeLayer();
    if (!layer) { notify("请先创建图纸", true); return false; }
    if (layer.locked) { notify("当前图层已锁定", true); return false; }
    return true;
  }

  function paintCell(point, erase) {
    var layer = activeLayer();
    if (!layer || !point) return false;
    var next = erase ? null : selectedColorId;
    if ((layer.cells[point.index] || null) === next) return false;
    layer.cells[point.index] = next;
    return true;
  }

  function stampText(point) {
    var text = (el.text.value || "").trim();
    if (!text) { notify("请先输入文字", true); return; }
    var size = Core.clamp(Math.round(numberValue(el.textSize, 10)), 5, 32);
    mutate("文字已写入当前图层", function (layer) {
      var bitmap = document.createElement("canvas"); bitmap.width = project.width; bitmap.height = project.height;
      var ctx = bitmap.getContext("2d"); ctx.clearRect(0, 0, bitmap.width, bitmap.height); ctx.fillStyle = "#fff"; ctx.textBaseline = "top"; ctx.font = "900 " + size + "px 'Microsoft YaHei','PingFang SC',sans-serif";
      if (el.textDirection.value === "vertical") Array.from(text).forEach(function (char, index) { ctx.fillText(char, point.x, point.y + index * (size + 1)); });
      else ctx.fillText(text, point.x, point.y);
      var alpha = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
      for (var index = 0; index < project.width * project.height; index += 1) if (alpha[index * 4 + 3] > 72) layer.cells[index] = selectedColorId;
    });
  }

  function handlePointerDown(event) {
    if (!project) return;
    var point = cellFromPointer(event);
    if (!point) return;
    event.preventDefault();
    el.canvas.focus({ preventScroll: true });
    el.canvas.setPointerCapture(event.pointerId);
    if (stage === "make") {
      if (!Core.composeProject(project)[point.index]) return;
      if (make.placed.has(point.index)) make.placed.delete(point.index); else make.placed.add(point.index);
      saveMakeProgress(); renderMakeGuide(); renderCanvas();
      return;
    }
    if (stage !== "edit") return;
    if (activeTool === "pan") {
      drag = { type: "pan", clientX: event.clientX, clientY: event.clientY, scrollLeft: el.canvasWrap.scrollLeft, scrollTop: el.canvasWrap.scrollTop };
      el.canvasWrap.dataset.dragging = "true"; return;
    }
    if (activeTool === "eyedropper") {
      var picked = Core.composeProject(project)[point.index];
      if (picked) { selectedColorId = picked; renderSelectedColor(); renderPalette(); notify("已吸取 " + currentCode(picked)); }
      return;
    }
    if (activeTool === "fill") {
      if (!layerCanEdit()) return;
      mutate("区域已填充", function (layer) { layer.cells = Core.floodFill(layer.cells, project.width, project.height, point.index, selectedColorId); });
      return;
    }
    if (activeTool === "text") { if (layerCanEdit()) stampText(point); return; }
    if (activeTool === "select") {
      selection = { x0: point.x, y0: point.y, x1: point.x, y1: point.y };
      drag = { type: "select", start: point }; renderCanvas(); return;
    }
    if (["line", "rect", "ellipse"].includes(activeTool)) {
      if (!layerCanEdit()) return;
      drag = { type: activeTool, start: point, end: point }; renderCanvas(); return;
    }
    if (activeTool === "pencil" || activeTool === "eraser") {
      if (!layerCanEdit()) return;
      beginHistory();
      drag = { type: activeTool, last: point, changed: paintCell(point, activeTool === "eraser") };
      renderCanvas();
    }
  }

  function handlePointerMove(event) {
    var point = cellFromPointer(event);
    if (point) el.pointerStatus.textContent = "坐标 " + (point.x + 1) + ", " + (point.y + 1) + (Core.composeProject(project)[point.index] ? " · " + currentCode(Core.composeProject(project)[point.index]) : " · 空");
    if (!drag) return;
    event.preventDefault();
    if (drag.type === "pan") {
      el.canvasWrap.scrollLeft = drag.scrollLeft - (event.clientX - drag.clientX);
      el.canvasWrap.scrollTop = drag.scrollTop - (event.clientY - drag.clientY); return;
    }
    if (!point) return;
    if (drag.type === "select") { selection.x1 = point.x; selection.y1 = point.y; renderCanvas(); return; }
    if (["line", "rect", "ellipse"].includes(drag.type)) { drag.end = point; selection = { x0: drag.start.x, y0: drag.start.y, x1: point.x, y1: point.y }; renderCanvas(); return; }
    if (drag.type === "pencil" || drag.type === "eraser") {
      if (point.index === drag.last.index) return;
      var layer = activeLayer();
      var result = Core.drawLine(layer.cells, project.width, project.height, drag.last.x, drag.last.y, point.x, point.y, drag.type === "eraser" ? null : selectedColorId);
      if (result.some(function (value, index) { return value !== layer.cells[index]; })) drag.changed = true;
      layer.cells = result; drag.last = point; renderCanvas();
    }
  }

  function handlePointerUp(event) {
    if (!drag) return;
    var current = drag;
    drag = null;
    el.canvasWrap.dataset.dragging = "false";
    if (current.type === "pan" || current.type === "select") return;
    if (current.type === "pencil" || current.type === "eraser") {
      if (current.changed) finishMutation(current.type === "eraser" ? "已擦除豆子" : "已绘制豆子");
      else history.pop();
      return;
    }
    if (["line", "rect", "ellipse"].includes(current.type)) {
      var end = current.end || cellFromPointer(event) || current.start;
      beginHistory();
      var layer = activeLayer();
      if (current.type === "line") layer.cells = Core.drawLine(layer.cells, project.width, project.height, current.start.x, current.start.y, end.x, end.y, selectedColorId);
      if (current.type === "rect") layer.cells = Core.drawRect(layer.cells, project.width, project.height, current.start, end, selectedColorId, q("[data-beads-shape-filled]").checked);
      if (current.type === "ellipse") layer.cells = Core.drawEllipse(layer.cells, project.width, project.height, current.start, end, selectedColorId, q("[data-beads-shape-filled]").checked);
      selection = null; finishMutation(TOOL_NAMES[current.type] + "已绘制");
    }
  }

  function copySelection() {
    if (!project) return;
    clipboard = Core.copyRegion(Core.composeProject(project), project.width, project.height, normalizedSelection());
    notify("已复制 " + clipboard.width + " × " + clipboard.height + " 区域");
  }

  function pasteSelection() {
    if (!project || !clipboard) { notify("剪贴板中没有拼豆区域", true); return; }
    var bounds = normalizedSelection();
    var x = bounds ? bounds.x0 : 0, y = bounds ? bounds.y0 : 0;
    mutate("已粘贴到当前图层", function (layer) { layer.cells = Core.pasteRegion(layer.cells, project.width, project.height, clipboard, x, y); });
    selection = { x0: x, y0: y, x1: x + clipboard.width - 1, y1: y + clipboard.height - 1 };
  }

  function mirror(axis) {
    if (!project) return;
    mutate(axis === "horizontal" ? "已水平镜像" : "已垂直镜像", function (layer) { layer.cells = Core.mirrorCells(layer.cells, project.width, project.height, axis, normalizedSelection()); });
  }

  function clearSelectionCells() {
    if (!project) return;
    var bounds = normalizedSelection();
    mutate(bounds ? "已清空选区" : "已清空当前图层", function (layer) {
      if (!bounds) { layer.cells.fill(null); return; }
      for (var y = bounds.y0; y <= bounds.y1; y += 1) for (var x = bounds.x0; x <= bounds.x1; x += 1) layer.cells[y * project.width + x] = null;
    });
  }

  function safeFileName(name) {
    return (name || "拼豆图纸").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "拼豆图纸";
  }

  function downloadBlob(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a"); link.href = url; link.download = fileName; document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function downloadCanvas(canvas, fileName) {
    canvas.toBlob(function (blob) {
      if (blob) downloadBlob(blob, fileName);
      else notify("浏览器无法导出这张图片", true);
    }, "image/png");
  }

  function buildPatternCanvas() {
    if (!project) return null;
    var cells = Core.composeProject(project);
    var summary = Core.summarizeCells(cells);
    var margin = 48, header = 92;
    var size = Math.max(5, Math.min(28, Math.floor((1700 - margin * 2) / project.width)));
    var gridWidth = project.width * size, gridHeight = project.height * size;
    var columns = gridWidth > 900 ? 4 : gridWidth > 560 ? 3 : 2;
    var legendWidth = Math.max(720, gridWidth);
    var itemWidth = legendWidth / columns;
    var legendRows = Math.ceil(summary.rows.length / columns);
    var legendHeight = summary.rows.length ? 58 + legendRows * 30 : 34;
    var canvas = document.createElement("canvas");
    canvas.width = margin * 2 + legendWidth;
    canvas.height = header + gridHeight + legendHeight + 42;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fbfaf7"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#171820"; ctx.font = "700 26px 'Microsoft YaHei',sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(project.name, margin, 38);
    ctx.fillStyle = "#666a74"; ctx.font = "14px 'Microsoft YaHei',sans-serif";
    ctx.fillText(project.width + " × " + project.height + " · " + summary.total + " 颗 · " + summary.colors + " 色 · " + project.brand + " 色号", margin, 65);
    var offsetX = margin + (legendWidth - gridWidth) / 2, offsetY = header;
    cells.forEach(function (id, index) {
      var x = index % project.width, y = Math.floor(index / project.width);
      ctx.fillStyle = id ? safeColor(id).hex : "#ffffff"; ctx.fillRect(offsetX + x * size, offsetY + y * size, size, size);
      if (id && size >= 17) {
        var color = safeColor(id), light = color.rgb[0] * .299 + color.rgb[1] * .587 + color.rgb[2] * .114;
        ctx.fillStyle = light > 155 ? "rgba(0,0,0,.78)" : "rgba(255,255,255,.9)";
        ctx.font = "600 " + Math.max(6, Math.floor(size * .28)) + "px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(currentCode(id), offsetX + x * size + size / 2, offsetY + y * size + size / 2, size - 2);
      }
    });
    ctx.beginPath();
    for (var gx = 0; gx <= project.width; gx += 1) { ctx.moveTo(offsetX + gx * size + .5, offsetY); ctx.lineTo(offsetX + gx * size + .5, offsetY + gridHeight); }
    for (var gy = 0; gy <= project.height; gy += 1) { ctx.moveTo(offsetX, offsetY + gy * size + .5); ctx.lineTo(offsetX + gridWidth, offsetY + gy * size + .5); }
    ctx.strokeStyle = "rgba(40,42,48,.24)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = "rgba(25,28,34,.7)"; ctx.lineWidth = 2;
    for (var bx = 0; bx <= project.width; bx += 29) { ctx.beginPath(); ctx.moveTo(offsetX + bx * size, offsetY); ctx.lineTo(offsetX + bx * size, offsetY + gridHeight); ctx.stroke(); }
    for (var by = 0; by <= project.height; by += 29) { ctx.beginPath(); ctx.moveTo(offsetX, offsetY + by * size); ctx.lineTo(offsetX + gridWidth, offsetY + by * size); ctx.stroke(); }
    var legendY = offsetY + gridHeight + 40;
    ctx.fillStyle = "#171820"; ctx.font = "700 18px 'Microsoft YaHei',sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("材料清单", margin, legendY);
    summary.rows.forEach(function (row, index) {
      var column = index % columns, line = Math.floor(index / columns);
      var x = margin + column * itemWidth, y = legendY + 30 + line * 30;
      ctx.fillStyle = row.color.hex; ctx.beginPath(); ctx.arc(x + 9, y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "#252731"; ctx.font = "600 13px ui-monospace,monospace"; ctx.fillText(currentCode(row.id), x + 24, y);
      ctx.fillStyle = "#737681"; ctx.font = "12px 'Microsoft YaHei',sans-serif"; ctx.fillText(row.count + " 颗", x + Math.min(itemWidth * .55, 115), y);
    });
    ctx.fillStyle = "#8a8d96"; ctx.font = "11px 'Microsoft YaHei',sans-serif"; ctx.fillText("由 claudeOne 拼豆工坊生成 · 图纸色号以所选品牌为准", margin, canvas.height - 16);
    return canvas;
  }

  function exportProject() {
    if (!project) { notify("没有可保存的项目", true); return; }
    downloadBlob(new Blob([Core.serializeProject(project)], { type: "application/json;charset=utf-8" }), safeFileName(project.name) + ".beads.json");
    notify("项目文件已保存");
  }

  function exportCsv() {
    if (!project) { notify("没有可导出的用量", true); return; }
    var rows = Core.summarizeCells(Core.composeProject(project)).rows;
    var csv = ["内部色号," + project.brand + "色号,HEX,数量"];
    rows.forEach(function (row) { csv.push([row.id, currentCode(row.id), row.color.hex, row.count].join(",")); });
    csv.push(["合计", "", "", rows.reduce(function (sum, row) { return sum + row.count; }, 0)].join(","));
    downloadBlob(new Blob(["\ufeff" + csv.join("\r\n")], { type: "text/csv;charset=utf-8" }), safeFileName(project.name) + "-用量.csv");
    notify("用量 CSV 已导出");
  }

  function exportPattern() {
    var canvas = buildPatternCanvas();
    if (!canvas) { notify("没有可导出的图纸", true); return; }
    downloadCanvas(canvas, safeFileName(project.name) + "-图纸.png");
    notify("正在生成高清图纸");
  }

  function exportPreview() {
    if (!project) { notify("没有可导出的效果图", true); return; }
    var canvas = document.createElement("canvas"); drawPreviewCanvas(canvas, 1500);
    downloadCanvas(canvas, safeFileName(project.name) + "-效果图.png");
    notify("正在导出效果图");
  }

  function printPattern() {
    var canvas = buildPatternCanvas();
    if (!canvas) { notify("没有可打印的图纸", true); return; }
    var popup = window.open("", "_blank");
    if (!popup) { notify("浏览器阻止了打印窗口，请允许弹窗后重试", true); return; }
    popup.opener = null;
    popup.document.title = safeFileName(project.name);
    var style = popup.document.createElement("style"); style.textContent = "@page{size:auto;margin:8mm}body{margin:0;text-align:center}img{max-width:100%;height:auto}";
    var image = popup.document.createElement("img"); image.alt = "拼豆图纸"; image.onload = function () { popup.print(); }; image.src = canvas.toDataURL("image/png");
    popup.document.head.appendChild(style); popup.document.body.appendChild(image);
  }

  function importProjectFile(file) {
    if (!file) return;
    var generation = mountGeneration;
    file.text().then(function (text) {
      if (!root || generation !== mountGeneration) return;
      var imported = Core.deserializeProject(text);
      project = imported; history = []; future = []; selection = null; excludedIds.clear();
      loadMakeProgress(); queueAutosave(); renderProject(); fitCanvas(); setStage("edit"); notify("项目导入成功");
    }).catch(function (error) { if (root && generation === mountGeneration) notify("项目导入失败：" + error.message, true); });
  }

  function addLayer(duplicate) {
    if (!project) { notify("请先创建图纸", true); return; }
    if (project.layers.length >= 30) { notify("最多支持 30 个图层", true); return; }
    beginHistory();
    var source = activeLayer();
    var layer = Core.createLayer(project.width, project.height, duplicate && source ? source.name + " 副本" : "图层 " + (project.layers.length + 1), duplicate && source ? source.cells : null);
    var index = Math.max(0, project.layers.findIndex(function (item) { return item.id === project.activeLayerId; }) + 1);
    project.layers.splice(index, 0, layer); project.activeLayerId = layer.id;
    finishMutation(duplicate ? "图层已复制" : "已添加图层");
  }

  function moveLayer(direction) {
    if (!project) return;
    var index = project.layers.findIndex(function (layer) { return layer.id === project.activeLayerId; });
    var next = index + direction;
    if (index < 0 || next < 0 || next >= project.layers.length) return;
    beginHistory();
    var moved = project.layers.splice(index, 1)[0]; project.layers.splice(next, 0, moved);
    finishMutation(direction > 0 ? "图层已上移" : "图层已下移");
  }

  function renameLayer() {
    var layer = activeLayer(); if (!layer) return;
    var name = window.prompt("图层名称", layer.name);
    if (name == null || !name.trim()) return;
    beginHistory(); layer.name = name.trim().slice(0, 40); finishMutation("图层已重命名");
  }

  function deleteLayer() {
    if (!project) return;
    if (project.layers.length === 1) { notify("项目至少需要保留一个图层", true); return; }
    var index = project.layers.findIndex(function (layer) { return layer.id === project.activeLayerId; });
    if (index < 0) return;
    beginHistory(); project.layers.splice(index, 1); project.activeLayerId = project.layers[Math.max(0, index - 1)].id; finishMutation("图层已删除");
  }

  function resizeCanvas() {
    if (!project) return;
    var width = clampDimension(el.resizeWidth.value), height = clampDimension(el.resizeHeight.value);
    if (width === project.width && height === project.height) return;
    beginHistory(); project = Core.resizeProject(project, width, height, "center"); selection = null; finishMutation("画布已调整为 " + width + " × " + height); fitCanvas();
  }

  function completeCurrentColor() {
    if (!project || !make.currentColorId) return;
    Core.composeProject(project).forEach(function (id, index) { if (id === make.currentColorId) make.placed.add(index); });
    var rows = orderedMakeRows(Core.composeProject(project));
    var next = rows.find(function (row) { return row.remaining > 0 && row.id !== make.currentColorId; });
    if (next) make.currentColorId = next.id;
    saveMakeProgress(); renderMakeGuide(); renderCanvas(); notify("当前颜色已全部标记完成");
  }

  function resetMakeProgress() {
    if (!project) return;
    if (make.placed.size && !window.confirm("确定清空这个项目的全部摆豆进度和计时吗？")) return;
    make.placed.clear(); make.currentColorId = null; make.elapsed = 0; make.startedAt = stage === "make" ? Date.now() : 0;
    saveMakeProgress(); renderMakeGuide(); renderCanvas(); notify("摆豆进度已重置");
  }

  function startNewProject() {
    if (project && !window.confirm("开始新项目？当前项目仍保存在本机草稿中，建议先下载项目文件。")) return;
    project = null; history = []; future = []; selection = null; clipboard = null; excludedIds.clear();
    make.placed.clear(); make.currentColorId = null; make.elapsed = 0; make.startedAt = 0;
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) { /* Ignore storage failure. */ }
    setStage("optimize"); renderProject(); notify("可以上传图片或创建空白画布");
  }

  function handleKeyboard(event) {
    var target = event.target;
    if (target && (target.matches("input,textarea,select") || target.isContentEditable)) return;
    var key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
    if ((event.ctrlKey || event.metaKey) && key === "y") { event.preventDefault(); redo(); return; }
    if ((event.ctrlKey || event.metaKey) && key === "c") { event.preventDefault(); copySelection(); return; }
    if ((event.ctrlKey || event.metaKey) && key === "v") { event.preventDefault(); pasteSelection(); return; }
    var shortcuts = { v: "pan", b: "pencil", e: "eraser", g: "fill", i: "eyedropper", s: "select", l: "line", r: "rect", o: "ellipse", t: "text" };
    if (shortcuts[key] && stage === "edit") { event.preventDefault(); setTool(shortcuts[key]); }
    if ((event.key === "Delete" || event.key === "Backspace") && stage === "edit") { event.preventDefault(); clearSelectionCells(); }
    if (event.key === "Escape") { selection = null; renderCanvas(); }
  }

  function bindEvents() {
    qa("[data-beads-stage]").forEach(function (button) { on(button, "click", function () { setStage(button.dataset.beadsStage); }); });
    qa("[data-beads-pick-image]").forEach(function (button) { on(button, "click", function () { el.imageFile.click(); }); });
    on(el.imageFile, "change", function () { loadImageFile(el.imageFile.files[0], "source"); el.imageFile.value = ""; });
    on(q("[data-beads-blank]"), "click", createBlank);
    on(q("[data-beads-create-blank]"), "click", createBlank);
    on(el.generate, "click", generatePattern);
    on(q("[data-beads-new]"), "click", startNewProject);
    on(q("[data-beads-import-project]"), "click", function () { el.projectFile.click(); });
    on(el.projectFile, "change", function () { importProjectFile(el.projectFile.files[0]); el.projectFile.value = ""; });
    on(q("[data-beads-export-project]"), "click", exportProject);
    on(q("[data-beads-export-csv]"), "click", exportCsv);
    on(q("[data-beads-export-pattern]"), "click", exportPattern);
    on(q("[data-beads-export-preview]"), "click", exportPreview);
    on(q("[data-beads-print]"), "click", printPattern);

    on(el.projectName, "input", function () {
      if (!project) return;
      project.name = el.projectName.value.trim().slice(0, 80) || "未命名拼豆";
      queueAutosave();
    });
    on(el.width, "input", function () { if (sourceImage && el.lockRatio.checked) el.height.value = clampDimension(numberValue(el.width, 29) / sourceRatio); });
    on(el.height, "input", function () { if (sourceImage && el.lockRatio.checked) el.width.value = clampDimension(numberValue(el.height, 29) * sourceRatio); });
    qa("[data-size]").forEach(function (button) { on(button, "click", function () { el.width.value = button.dataset.size; el.height.value = sourceImage && el.lockRatio.checked ? clampDimension(Number(button.dataset.size) / sourceRatio) : button.dataset.size; }); });
    on(el.brand, "change", function () {
      if (project) { beginHistory(); project.brand = el.brand.value; finishMutation("已切换为 " + project.brand + " 色号"); }
      else { renderSelectedColor(); renderPalette(); }
    });
    on(el.paletteMode, "change", function () {
      if (project) { beginHistory(); project.paletteMode = el.paletteMode.value; finishMutation("已切换色卡范围"); }
      else { renderPaletteGroups(); renderPalette(); }
    });
    on(el.maxColors, "input", function () { el.maxColorsValue.textContent = el.maxColors.value; });
    on(el.sourceScale, "input", function () { el.sourceScaleValue.textContent = el.sourceScale.value + "%"; });
    on(el.merge, "input", function () { el.mergeValue.textContent = el.merge.value + "%"; });
    on(el.bgTolerance, "input", function () { el.bgToleranceValue.textContent = el.bgTolerance.value; });
    on(el.removeBg, "change", function () { el.bgToleranceWrap.hidden = !el.removeBg.checked; });

    qa("[data-tool]").forEach(function (button) { on(button, "click", function () { setTool(button.dataset.tool); }); });
    on(el.paletteSearch, "input", renderPalette);
    on(q("[data-beads-copy]"), "click", copySelection);
    on(q("[data-beads-paste]"), "click", pasteSelection);
    on(q("[data-beads-mirror-h]"), "click", function () { mirror("horizontal"); });
    on(q("[data-beads-mirror-v]"), "click", function () { mirror("vertical"); });
    on(q("[data-beads-clear-selection]"), "click", clearSelectionCells);
    on(q("[data-beads-layer-add]"), "click", function () { addLayer(false); });
    on(q("[data-beads-layer-duplicate]"), "click", function () { addLayer(true); });
    on(q("[data-beads-layer-up]"), "click", function () { moveLayer(1); });
    on(q("[data-beads-layer-down]"), "click", function () { moveLayer(-1); });
    on(q("[data-beads-layer-rename]"), "click", renameLayer);
    on(q("[data-beads-layer-delete]"), "click", deleteLayer);
    on(q("[data-beads-reference-pick]"), "click", function () { el.referenceFile.click(); });
    on(el.referenceFile, "change", function () { loadImageFile(el.referenceFile.files[0], "reference"); el.referenceFile.value = ""; });
    on(el.referenceShow, "change", renderCanvas);
    on(el.referenceOpacity, "input", renderCanvas);
    on(q("[data-beads-resize]"), "click", resizeCanvas);

    qa("[data-material]").forEach(function (button) { on(button, "click", function () { preview.material = button.dataset.material; renderPreview(); saveSettings(); }); });
    on(el.roundness, "input", function () { renderPreview(); saveSettings(); });
    on(el.previewBg, "change", function () { renderPreview(); saveSettings(); });
    on(el.previewShadow, "change", function () { renderPreview(); saveSettings(); });
    on(el.previewCodes, "change", function () { renderPreview(); saveSettings(); });
    on(el.strategy, "change", renderMakeGuide);
    on(el.gridInterval, "change", renderCanvas);
    on(el.hidePlaced, "change", renderCanvas);
    on(el.dimOthers, "change", renderCanvas);
    on(q("[data-beads-complete-color]"), "click", completeCurrentColor);
    on(q("[data-beads-make-reset]"), "click", resetMakeProgress);

    on(el.undo, "click", undo); on(el.redo, "click", redo);
    on(q("[data-beads-zoom-out]"), "click", function () { zoom = Core.clamp(zoom / 1.2, .2, 3); el.zoomValue.textContent = Math.round(zoom * 100) + "%"; renderCanvas(); });
    on(q("[data-beads-zoom-in]"), "click", function () { zoom = Core.clamp(zoom * 1.2, .2, 3); el.zoomValue.textContent = Math.round(zoom * 100) + "%"; renderCanvas(); });
    on(q("[data-beads-fit]"), "click", fitCanvas);
    on(el.canvas, "pointerdown", handlePointerDown);
    on(el.canvas, "pointermove", handlePointerMove);
    on(el.canvas, "pointerup", handlePointerUp);
    on(el.canvas, "pointercancel", handlePointerUp);
    on(el.canvas, "pointerleave", function () { if (!drag) el.pointerStatus.textContent = "坐标 —"; });
    on(el.canvasWrap, "wheel", function (event) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault(); zoom = Core.clamp(zoom * (event.deltaY < 0 ? 1.12 : .89), .2, 3); el.zoomValue.textContent = Math.round(zoom * 100) + "%"; renderCanvas();
    }, { passive: false });
    on(document, "keydown", handleKeyboard);
    on(window, "beforeunload", function () { if (project) { try { localStorage.setItem(DRAFT_KEY, Core.serializeProject(project)); saveMakeProgress(); } catch (_) { /* Ignore. */ } } });
  }

  function mount(container) {
    if (!Core) throw new Error("BeadStudioCore 未加载");
    mountGeneration += 1;
    root = container && container.querySelector ? container : document;
    if (!root.querySelector("[data-beads-studio]")) return;
    aborter = new AbortController();
    collectElements();
    readSettings();
    loadDraft();
    loadMakeProgress();
    el.roundness.value = Math.round(preview.roundness * 100);
    el.previewBg.value = preview.background;
    el.previewShadow.checked = preview.shadow;
    el.previewCodes.checked = preview.codes;
    el.maxColorsValue.textContent = el.maxColors.value;
    el.sourceScaleValue.textContent = el.sourceScale.value + "%";
    el.mergeValue.textContent = el.merge.value + "%";
    el.bgToleranceValue.textContent = el.bgTolerance.value;
    bindEvents();
    setTool(activeTool);
    setStage(project ? "edit" : "optimize");
    renderProject();
    if (project) window.setTimeout(fitCanvas, 60);
    make.timerId = window.setInterval(updateTimer, 1000);
  }

  function unmount() {
    mountGeneration += 1;
    sourceLoadSequence += 1;
    referenceLoadSequence += 1;
    if (make.startedAt) { make.elapsed = elapsedSeconds(); make.startedAt = 0; saveMakeProgress(); }
    clearInterval(make.timerId); make.timerId = 0;
    clearTimeout(autosaveTimer);
    if (aborter) aborter.abort();
    revokeObjectUrl("source"); revokeObjectUrl("reference");
    root = null; aborter = null; el = {}; sourceImage = null; referenceImage = null; drag = null;
  }

  window.__page_beads = { mount: mount, unmount: unmount };
})();
