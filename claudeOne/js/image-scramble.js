/* ===== claudeOne :: image-scramble.js =====
 * PixelFlux page: upload, preview, worker orchestration, download and the
 * interactive idle pixel field.
 * SPA lifecycle: window.__page_scramble
 */

(function bootstrapImageScramble() {
  "use strict";

  var MAX_PIXELS = 16 * 1024 * 1024;
  var MAX_FILE_BYTES = 140 * 1024 * 1024;
  var ALLOWED_TYPES = {
    "image/jpeg": true,
    "image/png": true,
    "image/webp": true,
    "image/bmp": true,
  };

  var container = null;
  var ac = null;
  var worker = null;
  var workerRequest = null;
  var requestCounter = 0;
  var loadToken = 0;
  var pixelField = null;

  var uploadZone;
  var fileInput;
  var uploadTitle;
  var uploadSubtitle;
  var uploadBadge;
  var clearButton;
  var scrambleButton;
  var restoreButton;
  var viewer;
  var viewerStage;
  var viewerStatus;
  var viewerMeta;
  var viewerCaption;
  var downloadLink;
  var previewImage;
  var emptyCopy;
  var placeholderCanvas;
  var processingOverlay;
  var processingLabel;
  var progressBar;
  var progressText;

  var state = createEmptyState();

  function createEmptyState() {
    return {
      file: null,
      metadata: null,
      width: 0,
      height: 0,
      objectUrl: null,
      processing: false,
      derived: false,
      status: "",
    };
  }

  function collectElements() {
    uploadZone = container.querySelector("[data-upload-zone]");
    fileInput = container.querySelector("[data-file-input]");
    uploadTitle = container.querySelector("[data-upload-title]");
    uploadSubtitle = container.querySelector("[data-upload-subtitle]");
    uploadBadge = container.querySelector("[data-upload-badge]");
    clearButton = container.querySelector("[data-clear-file]");
    scrambleButton = container.querySelector("[data-scramble-action]");
    restoreButton = container.querySelector("[data-restore-action]");
    viewer = container.querySelector("[data-viewer]");
    viewerStage = container.querySelector("[data-viewer-stage]");
    viewerStatus = container.querySelector("[data-viewer-status]");
    viewerMeta = container.querySelector("[data-viewer-meta]");
    viewerCaption = container.querySelector("[data-viewer-caption]");
    downloadLink = container.querySelector("[data-download]");
    previewImage = container.querySelector("[data-preview-image]");
    emptyCopy = container.querySelector("[data-empty-copy]");
    placeholderCanvas = container.querySelector("[data-placeholder-canvas]");
    processingOverlay = container.querySelector("[data-processing]");
    processingLabel = container.querySelector("[data-processing-label]");
    progressBar = container.querySelector("[data-progress-bar]");
    progressText = container.querySelector("[data-progress-text]");
  }

  function toast(message, kind) {
    if (window.ClaudeOne && typeof window.ClaudeOne.toast === "function") {
      window.ClaudeOne.toast(message, kind || "info", 3600);
    }
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 1) return "0 B";
    var units = ["B", "KB", "MB", "GB"];
    var index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    var value = bytes / Math.pow(1024, index);
    return (value >= 100 || index === 0 ? value.toFixed(0) : value.toFixed(1)) + " " + units[index];
  }

  function sanitizeFilename(name) {
    var clean = String(name || "image")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
      .replace(/[. ]+$/g, "")
      .trim();
    return (clean || "image").slice(0, 120);
  }

  function filenameStem(name) {
    var clean = sanitizeFilename(name);
    var dot = clean.lastIndexOf(".");
    return dot > 0 ? clean.slice(0, dot) : clean;
  }

  function utf8ToBase64(value) {
    var bytes = new TextEncoder().encode(String(value || ""));
    var binary = "";
    for (var i = 0; i < bytes.length; i += 0x4000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x4000));
    }
    return btoa(binary);
  }

  function base64ToUtf8(value) {
    try {
      var binary = atob(String(value || ""));
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    } catch (error) {
      return "image";
    }
  }

  function isAcceptedImage(file) {
    if (!file) return false;
    if (ALLOWED_TYPES[file.type]) return true;
    return /\.(jpe?g|png|webp|bmp)$/i.test(file.name || "");
  }

  function isPng(file) {
    return file && (file.type === "image/png" || /\.png$/i.test(file.name || ""));
  }

  function updateButtons() {
    var hasFile = !!state.file;
    var isScrambled = !!state.metadata;
    scrambleButton.disabled = !hasFile || state.processing || isScrambled;
    restoreButton.disabled = !hasFile || state.processing || !isScrambled;
    clearButton.disabled = state.processing;
    fileInput.disabled = state.processing;
  }

  function revokeCurrentUrl() {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }

  function showEmptyViewer() {
    viewer.dataset.mode = "empty";
    previewImage.hidden = true;
    previewImage.removeAttribute("src");
    emptyCopy.hidden = false;
    placeholderCanvas.hidden = false;
    processingOverlay.hidden = true;
    viewerStatus.textContent = "等待图片";
    viewerMeta.textContent = "PIXEL FIELD / IDLE";
    viewerCaption.textContent = "未导入图片时，这里会持续演算一片可交互的像素场。";
    downloadLink.hidden = true;
    downloadLink.removeAttribute("href");
    downloadLink.removeAttribute("download");
    if (pixelField) pixelField.show();
  }

  function showImageViewer(url) {
    viewer.dataset.mode = state.processing ? "processing" : "image";
    previewImage.src = url;
    previewImage.hidden = false;
    emptyCopy.hidden = true;
    placeholderCanvas.hidden = true;
    if (pixelField) pixelField.hide();
  }

  function resetPage() {
    loadToken++;
    revokeCurrentUrl();
    state = createEmptyState();
    if (fileInput) fileInput.value = "";
    if (uploadTitle) uploadTitle.textContent = "导入一张图片";
    if (uploadSubtitle) uploadSubtitle.textContent = "拖拽到这里，或点击选择 JPG / PNG / WebP / BMP";
    if (uploadBadge) uploadBadge.textContent = "选择文件";
    if (clearButton) clearButton.hidden = true;
    showEmptyViewer();
    updateButtons();
  }

  function probeImage(url) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = function () {
        reject(new Error("浏览器无法读取这张图片"));
      };
      image.src = url;
    });
  }

  async function detectMetadata(file) {
    if (!isPng(file)) return null;
    var prefix = await file.slice(0, 65536).arrayBuffer();
    return window.PixelFlux.readMetadata(prefix);
  }

  function applyFileState(file, url, dimensions, metadata, options) {
    options = options || {};
    revokeCurrentUrl();
    state.file = file;
    state.objectUrl = url;
    state.width = dimensions.width;
    state.height = dimensions.height;
    state.metadata = metadata || null;
    state.derived = !!options.derived;
    state.status = metadata ? "已识别 PixelFlux 混淆图" : (options.status || "图片已就绪");

    uploadTitle.textContent = file.name;
    uploadSubtitle.textContent = dimensions.width + " × " + dimensions.height + " px · " + formatBytes(file.size);
    uploadBadge.textContent = metadata ? "可解混淆" : "已就绪";
    clearButton.hidden = false;

    showImageViewer(url);
    if (options.status) state.status = options.status;
    viewerStatus.textContent = state.status;
    viewerMeta.textContent = dimensions.width + " × " + dimensions.height + " / " + formatBytes(file.size);
    viewerCaption.textContent = options.caption || (
      metadata
        ? "恢复标记完整，可以直接点击“解密（解混淆）”。"
        : "普通图片已载入，可以开始生成可逆混淆 PNG。"
    );
    previewImage.alt = metadata ? "PixelFlux 混淆图片预览" : "导入图片预览";

    if (options.downloadName) {
      downloadLink.href = url;
      downloadLink.download = options.downloadName;
      downloadLink.hidden = false;
    } else {
      downloadLink.hidden = true;
      downloadLink.removeAttribute("href");
      downloadLink.removeAttribute("download");
    }
    updateButtons();
  }

  async function loadFile(file) {
    if (state.processing) return;
    if (!isAcceptedImage(file)) {
      toast("请选择 JPG、PNG、WebP 或 BMP 图片", "err");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast("图片文件过大，请选择 140 MB 以内的文件", "err");
      return;
    }

    var token = ++loadToken;
    var url = URL.createObjectURL(file);
    try {
      var dimensions = await probeImage(url);
      if (token !== loadToken || !container) {
        URL.revokeObjectURL(url);
        return;
      }
      if (!dimensions.width || !dimensions.height || dimensions.width * dimensions.height > MAX_PIXELS) {
        throw new Error("图片像素过大，请使用不超过 1600 万像素的图片");
      }
      var metadata = await detectMetadata(file);
      if (token !== loadToken || !container) {
        URL.revokeObjectURL(url);
        return;
      }
      if (metadata && (metadata.width !== dimensions.width || metadata.height !== dimensions.height)) {
        throw new Error("PixelFlux 恢复标记与图片尺寸不一致");
      }
      applyFileState(file, url, dimensions, metadata);
      if (metadata) toast("已识别可解混淆的 PixelFlux PNG", "ok");
    } catch (error) {
      URL.revokeObjectURL(url);
      toast(error && error.message ? error.message : "图片导入失败", "err");
    } finally {
      if (fileInput) fileInput.value = "";
    }
  }

  async function decodeImageToRgba(file, expectedWidth, expectedHeight) {
    var canvas = document.createElement("canvas");
    canvas.width = expectedWidth;
    canvas.height = expectedHeight;
    var context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("当前浏览器无法创建图片画布");

    if (typeof createImageBitmap === "function") {
      var bitmap = await createImageBitmap(file);
      try {
        if (bitmap.width !== expectedWidth || bitmap.height !== expectedHeight) {
          throw new Error("图片尺寸在读取过程中发生变化");
        }
        context.drawImage(bitmap, 0, 0);
      } finally {
        if (typeof bitmap.close === "function") bitmap.close();
      }
    } else {
      var tempUrl = URL.createObjectURL(file);
      try {
        var image = await new Promise(function (resolve, reject) {
          var candidate = new Image();
          candidate.onload = function () { resolve(candidate); };
          candidate.onerror = function () { reject(new Error("图片解码失败")); };
          candidate.src = tempUrl;
        });
        context.drawImage(image, 0, 0);
      } finally {
        URL.revokeObjectURL(tempUrl);
      }
    }

    var imageData = context.getImageData(0, 0, expectedWidth, expectedHeight);
    return new Uint8Array(
      imageData.data.buffer.slice(imageData.data.byteOffset, imageData.data.byteOffset + imageData.data.byteLength)
    );
  }

  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker("./js/image-scramble-worker.js");
    worker.addEventListener("message", function (event) {
      var message = event.data || {};
      if (!workerRequest || message.requestId !== workerRequest.id) return;
      if (message.type === "progress") {
        setProgress(message.value, message.label);
      } else if (message.type === "result") {
        var resolve = workerRequest.resolve;
        workerRequest = null;
        resolve(message);
      } else if (message.type === "error") {
        var reject = workerRequest.reject;
        workerRequest = null;
        reject(new Error(message.error && message.error.message ? message.error.message : "图片处理失败"));
      }
    });
    worker.addEventListener("error", function () {
      if (workerRequest) {
        var reject = workerRequest.reject;
        workerRequest = null;
        reject(new Error("图片处理线程意外停止"));
      }
      if (worker) worker.terminate();
      worker = null;
    });
    return worker;
  }

  function runWorker(payload, transfer) {
    if (workerRequest) return Promise.reject(new Error("已有图片正在处理中"));
    var activeWorker = ensureWorker();
    var id = ++requestCounter;
    payload.requestId = id;
    return new Promise(function (resolve, reject) {
      workerRequest = { id: id, resolve: resolve, reject: reject };
      activeWorker.postMessage(payload, transfer || []);
    });
  }

  function setProgress(value, label) {
    var progress = Math.max(0, Math.min(1, Number(value) || 0));
    progressBar.style.width = Math.round(progress * 100) + "%";
    progressText.textContent = Math.round(progress * 100) + "%";
    if (label) processingLabel.textContent = label;
  }

  function setProcessing(active, label) {
    state.processing = !!active;
    processingOverlay.hidden = !active;
    if (active) {
      viewer.dataset.mode = "processing";
      viewerStatus.textContent = "处理中";
      setProgress(0, label || "正在处理");
      downloadLink.hidden = true;
    } else if (state.file) {
      viewer.dataset.mode = "image";
      viewerStatus.textContent = state.status || (state.metadata ? "已识别 PixelFlux 混淆图" : "图片已就绪");
      if (state.derived && state.objectUrl) downloadLink.hidden = false;
    }
    updateButtons();
  }

  async function processCurrent(mode) {
    if (!state.file || state.processing) return;
    if (mode === "scramble" && state.metadata) {
      toast("当前已经是 PixelFlux 混淆图，请直接解混淆", "err");
      return;
    }
    if (mode === "restore" && !state.metadata) {
      toast("这不是由 PixelFlux 生成的混淆 PNG", "err");
      return;
    }

    var sourceFile = state.file;
    var sourceWidth = state.width;
    var sourceHeight = state.height;
    setProcessing(true, mode === "scramble" ? "正在读取图片像素" : "正在读取混淆 PNG");

    try {
      var result;
      var outputName;
      if (mode === "scramble") {
        var rgba = await decodeImageToRgba(sourceFile, sourceWidth, sourceHeight);
        if (!container || sourceFile !== state.file) throw new Error("图片已更换，处理已取消");
        var seed = window.PixelFlux.randomSeedHex();
        result = await runWorker({
          mode: "scramble",
          rgbaBuffer: rgba.buffer,
          width: sourceWidth,
          height: sourceHeight,
          seed: seed,
          originalNameB64: utf8ToBase64(sourceFile.name),
        }, [rgba.buffer]);
        outputName = filenameStem(sourceFile.name) + ".pixelflux.png";
      } else {
        var pngBuffer = await sourceFile.arrayBuffer();
        if (!container || sourceFile !== state.file) throw new Error("图片已更换，处理已取消");
        result = await runWorker({ mode: "restore", pngBuffer: pngBuffer }, [pngBuffer]);
        var originalName = base64ToUtf8(result.sourceMetadata && result.sourceMetadata.originalNameB64);
        outputName = filenameStem(originalName) + ".restored.png";
      }

      if (!container || sourceFile !== state.file) return;
      var outputBlob = new Blob([result.pngBuffer], { type: "image/png" });
      var outputFile = new File([outputBlob], sanitizeFilename(outputName), {
        type: "image/png",
        lastModified: Date.now(),
      });
      var outputUrl = URL.createObjectURL(outputFile);
      var dimensions = await probeImage(outputUrl);
      if (!container || sourceFile !== state.file) {
        URL.revokeObjectURL(outputUrl);
        return;
      }

      applyFileState(outputFile, outputUrl, dimensions, result.metadata || null, {
        derived: true,
        downloadName: outputFile.name,
        status: mode === "scramble" ? "混淆完成" : "完整还原",
        caption: mode === "scramble"
          ? "混淆完成。恢复种子与校验信息已封装进当前 PNG，可直接下载或继续点“解混淆”验证。"
          : "解混淆完成，像素完整性校验通过；当前下载文件为无损 PNG。",
      });
      toast(mode === "scramble" ? "PixelFlux 混淆完成，可以下载 PNG" : "图片已完整还原", "ok");
    } catch (error) {
      if (container) toast(error && error.message ? error.message : "图片处理失败", "err");
    } finally {
      if (container) setProcessing(false);
    }
  }

  function setupFileEvents() {
    fileInput.addEventListener("change", function () {
      if (fileInput.files && fileInput.files[0]) loadFile(fileInput.files[0]);
    }, { signal: ac.signal });

    var dragDepth = 0;
    uploadZone.addEventListener("dragenter", function (event) {
      event.preventDefault();
      dragDepth++;
      uploadZone.dataset.dragover = "true";
    }, { signal: ac.signal });
    uploadZone.addEventListener("dragover", function (event) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    }, { signal: ac.signal });
    uploadZone.addEventListener("dragleave", function (event) {
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) uploadZone.dataset.dragover = "false";
    }, { signal: ac.signal });
    uploadZone.addEventListener("drop", function (event) {
      event.preventDefault();
      dragDepth = 0;
      uploadZone.dataset.dragover = "false";
      var files = event.dataTransfer && event.dataTransfer.files;
      if (files && files[0]) loadFile(files[0]);
    }, { signal: ac.signal });

    clearButton.addEventListener("click", function () {
      if (!state.processing) resetPage();
    }, { signal: ac.signal });
    scrambleButton.addEventListener("click", function () {
      processCurrent("scramble");
    }, { signal: ac.signal });
    restoreButton.addEventListener("click", function () {
      processCurrent("restore");
    }, { signal: ac.signal });
  }

  function createPixelField(canvas, stage, signal) {
    var context = canvas.getContext("2d");
    var width = 0;
    var height = 0;
    var dpr = 1;
    var tiles = [];
    var trail = [];
    var raf = 0;
    var running = false;
    var lastSwap = 0;
    var lastDraw = 0;
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var pointer = { x: -1000, y: -1000, px: -1000, py: -1000, speed: 0, heat: 0 };

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function rebuild() {
      var rect = stage.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      var columns = clamp(Math.round(width / 34), 12, 34);
      var rows = clamp(Math.round(height / 34), 9, 19);
      var cellWidth = width / columns;
      var cellHeight = height / rows;
      var size = Math.max(7, Math.min(cellWidth, cellHeight) - 5);
      tiles = [];
      for (var row = 0; row < rows; row++) {
        for (var column = 0; column < columns; column++) {
          var x = column * cellWidth + cellWidth / 2;
          var y = row * cellHeight + cellHeight / 2;
          tiles.push({
            x: x,
            y: y,
            targetX: x,
            targetY: y,
            size: size * (0.74 + Math.random() * 0.24),
            hue: 190 + Math.random() * 105,
            targetHue: 190 + Math.random() * 105,
            phase: Math.random() * Math.PI * 2,
            alpha: 0.18 + Math.random() * 0.34,
          });
        }
      }
    }

    function swapTargets(now) {
      if (now - lastSwap < (reduceMotion ? 1300 : 430)) return;
      lastSwap = now;
      var swaps = Math.max(2, Math.round(tiles.length / 75));
      for (var i = 0; i < swaps; i++) {
        var first = tiles[Math.floor(Math.random() * tiles.length)];
        var second = tiles[Math.floor(Math.random() * tiles.length)];
        if (!first || !second || first === second) continue;
        var x = first.targetX;
        var y = first.targetY;
        first.targetX = second.targetX;
        first.targetY = second.targetY;
        second.targetX = x;
        second.targetY = y;
        first.targetHue = 170 + Math.random() * 170;
        second.targetHue = 170 + Math.random() * 170;
      }
    }

    function draw(now) {
      if (!running) return;
      raf = requestAnimationFrame(draw);
      if (reduceMotion && now - lastDraw < 80) return;
      lastDraw = now;
      swapTargets(now);
      context.clearRect(0, 0, width, height);

      pointer.heat *= 0.955;
      pointer.speed *= 0.9;
      for (var trailIndex = trail.length - 1; trailIndex >= 0; trailIndex--) {
        trail[trailIndex].life *= 0.91;
        if (trail[trailIndex].life < 0.035) trail.splice(trailIndex, 1);
      }

      for (var i = 0; i < tiles.length; i++) {
        var tile = tiles[i];
        tile.x += (tile.targetX - tile.x) * (reduceMotion ? 0.035 : 0.075);
        tile.y += (tile.targetY - tile.y) * (reduceMotion ? 0.035 : 0.075);
        var hueDelta = ((tile.targetHue - tile.hue + 540) % 360) - 180;
        tile.hue = (tile.hue + hueDelta * 0.025 + 360) % 360;

        var influence = 0;
        var pushX = 0;
        var pushY = 0;
        for (var t = 0; t < trail.length; t++) {
          var point = trail[t];
          var dx = tile.x - point.x;
          var dy = tile.y - point.y;
          var distance = Math.sqrt(dx * dx + dy * dy) || 1;
          var local = Math.max(0, 1 - distance / 96) * point.life;
          if (local > influence) {
            influence = local;
            pushX = dx / distance;
            pushY = dy / distance;
          }
        }
        var wobble = Math.sin(now * 0.012 + tile.phase) * influence * (3 + pointer.speed * 0.16);
        var drawX = tile.x + pushX * influence * 10 + wobble;
        var drawY = tile.y + pushY * influence * 10 - wobble * 0.45;
        var drawSize = tile.size * (1 + influence * 0.3);

        if (Math.abs(tile.targetX - tile.x) + Math.abs(tile.targetY - tile.y) > 8) {
          context.beginPath();
          context.moveTo(tile.x, tile.y);
          context.lineTo(tile.targetX, tile.targetY);
          context.strokeStyle = "hsla(" + tile.hue + ", 72%, 62%, " + (0.025 + influence * 0.08) + ")";
          context.lineWidth = 1;
          context.stroke();
        }

        context.fillStyle = "hsla(" + ((tile.hue + influence * 34) % 360) + ", 76%, " + (58 + influence * 9) + "%, " + (tile.alpha + influence * 0.46) + ")";
        context.fillRect(drawX - drawSize / 2, drawY - drawSize / 2, drawSize, drawSize);
      }

      if (trail.length > 1) {
        context.beginPath();
        context.moveTo(trail[0].x, trail[0].y);
        for (var p = 1; p < trail.length; p++) context.lineTo(trail[p].x, trail[p].y);
        context.strokeStyle = "rgba(111, 155, 255, " + (0.06 + pointer.heat * 0.12) + ")";
        context.lineWidth = 1.5;
        context.stroke();
      }
    }

    function onPointerMove(event) {
      if (!running) return;
      var rect = stage.getBoundingClientRect();
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      var dx = pointer.x - pointer.px;
      var dy = pointer.y - pointer.py;
      pointer.speed = Math.min(28, Math.sqrt(dx * dx + dy * dy));
      pointer.heat = 1;
      trail.unshift({ x: pointer.x, y: pointer.y, life: 1 });
      if (trail.length > 20) trail.length = 20;
    }

    function onPointerLeave() {
      pointer.heat = 0;
      pointer.x = -1000;
      pointer.y = -1000;
    }

    stage.addEventListener("pointermove", onPointerMove, { signal: signal });
    stage.addEventListener("pointerleave", onPointerLeave, { signal: signal });
    var resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(rebuild) : null;
    if (resizeObserver) resizeObserver.observe(stage);
    else window.addEventListener("resize", rebuild, { signal: signal });
    rebuild();

    return {
      show: function () {
        if (running) return;
        running = true;
        canvas.hidden = false;
        lastSwap = 0;
        raf = requestAnimationFrame(draw);
      },
      hide: function () {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        canvas.hidden = true;
      },
      destroy: function () {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        if (resizeObserver) resizeObserver.disconnect();
        tiles = [];
        trail = [];
      },
    };
  }

  function mount(root) {
    unmount();
    container = root;
    ac = new AbortController();
    collectElements();
    pixelField = createPixelField(placeholderCanvas, viewerStage, ac.signal);
    setupFileEvents();
    resetPage();
  }

  function unmount() {
    loadToken++;
    if (ac) ac.abort();
    ac = null;
    if (pixelField) pixelField.destroy();
    pixelField = null;
    if (workerRequest) {
      workerRequest.reject(new Error("页面已关闭，处理已取消"));
      workerRequest = null;
    }
    if (worker) worker.terminate();
    worker = null;
    revokeCurrentUrl();
    state = createEmptyState();
    container = null;
  }

  window.__page_scramble = { mount: mount, unmount: unmount };
})();
