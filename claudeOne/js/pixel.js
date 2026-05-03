/* ===== claudeOne :: pixel.js =====
 * Pixel art tool — upload, pixelit integration, post-processing, effects, export.
 * Uses giventofly/pixelit (MIT) as core pixelation engine.
 * SPA lifecycle: window.__page_pixel
 */

(function bootstrapPixel() {
  "use strict";

  var container = null;
  var ac = null;

  const CFG = window.CLAUDE_ONE_CONFIG;
  const CS = window.ClaudeOne;

  // ===== Palette definitions =====
  const PALETTES = {
    gb: [[15,56,15],[48,98,48],[139,172,15],[155,188,15]],
    nes: [
      [0,0,0],[252,252,252],[124,124,124],[252,0,0],[188,0,0],
      [0,120,0],[0,168,0],[0,0,252],[0,0,188],[116,0,168],
      [252,120,0],[252,184,0],[0,88,0],[0,128,0],[68,40,188],
      [248,56,0],[228,92,16],[0,68,0],[0,88,0],[168,0,100],
      [252,160,68],[248,184,0],[80,48,0],[120,72,0],[252,224,168],
      [248,216,120],[0,0,168],[68,68,68],[104,104,104],[168,168,168],
      [248,120,88],[248,184,184],[128,208,16],[216,248,120],[120,120,248],
      [168,168,248],[248,164,192],[248,200,200],[104,136,252],[148,188,248],
      [120,200,248],[168,224,248],[248,216,248],[248,208,168],[168,248,168],
      [184,248,216],[248,248,248],[252,252,252],[164,228,252],[216,248,248]
    ],
    pico8: [
      [0,0,0],[29,43,83],[126,37,83],[0,135,81],
      [171,82,54],[95,87,79],[194,195,199],[255,241,232],
      [255,0,77],[255,163,0],[255,240,36],[0,228,54],
      [41,173,255],[131,118,156],[255,119,168],[255,204,170]
    ],
    cyberpunk: [
      [0,255,255],[255,0,255],[255,255,0],[255,50,100],
      [0,200,200],[200,0,200],[50,255,150],[255,100,0],
      [100,0,255],[0,0,0],[20,20,40],[255,255,255]
    ],
    bw: [[0,0,0],[255,255,255]],
    warm: [
      [101,67,33],[183,117,56],[218,165,105],[245,222,179],
      [205,133,63],[210,105,30],[139,69,19],[160,82,45],
      [255,228,196],[255,218,185],[255,160,122],[255,99,71]
    ],
    cool: [
      [0,40,80],[0,80,160],[0,160,220],[100,200,255],
      [30,60,120],[60,120,180],[120,180,240],[180,220,255],
      [0,20,60],[20,80,140],[80,160,200],[200,230,250]
    ]
  };

  // ===== Default config =====
  const DEFAULTS = {
    blockSize: 8,
    maxW: 0,
    maxWCustom: 1024,
    maxH: 0,
    maxHCustom: 1024,
    colorMode: "original",
    saturation: 0,
    brightness: 0,
    contrast: 0,
    palette: "none",
    customPalette: [[0,0,0],[255,255,255]],
    dither: "none",
    pixelStroke: false,
    gridLines: false,
    gridColor: "#000000",
    gridOpacity: 30,
    rounded: false,
    crt: false,
    noise: false,
    transparentBg: false,
    bgColor: "#ffffff"
  };

  const CONFIG_KEY = "claudeOne:pixel-config";
  const DEBOUNCE_MS = 300;

  // ===== State (module-level) =====
  let selectedFile = null;
  let originalImage = null;
  let debounceTimer = null;
  let config = loadConfig();

  // ===== DOM refs (rebuilt on mount) =====
  var uploadZone, fileInput, previewArea, previewImg, previewName, previewDims, clearPreviewBtn;
  var controlsBody, collapseBtn, blockSizeSlider, blockSizeVal, blockPresets;
  var maxWRadios, widthCustom, maxHRadios, heightCustom;
  var colorModeRadios, saturationSlider, saturationVal, brightnessSlider, brightnessVal;
  var contrastSlider, contrastVal, paletteRadios, customPalettePanel, paletteColorsEl;
  var colorPicker, addColorBtn, copyPaletteBtn, pastePaletteBtn;
  var ditherRadios, gridOptions, gridColorInput, gridOpacitySlider, gridOpacityVal;
  var bgColorInput, bgColorWrap, workspaceSection, resultCanvas, resultDims, resultWrap;
  var exportBtn, copyConfigBtn, resetBtn, clearBtn;
  var pixelitSrcImg, pixelitWorkCanvas;
  var togglePixelStroke, toggleGridLines, toggleRounded, toggleCrt, toggleNoise, toggleTransparentBg;

  function collectEls() {
    uploadZone = container.querySelector("[data-upload-zone]");
    fileInput = container.querySelector("[data-file-input]");
    previewArea = container.querySelector("[data-preview-area]");
    previewImg = container.querySelector("[data-preview-img]");
    previewName = container.querySelector("[data-preview-name]");
    previewDims = container.querySelector("[data-preview-dims]");
    clearPreviewBtn = container.querySelector("[data-clear-preview]");
    controlsBody = container.querySelector("[data-controls-body]");
    collapseBtn = container.querySelector("[data-collapse-btn]");
    blockSizeSlider = container.querySelector("[data-block-size]");
    blockSizeVal = container.querySelector("[data-block-size-val]");
    blockPresets = container.querySelector("[data-block-presets]");
    maxWRadios = container.querySelectorAll("[data-max-w]");
    widthCustom = container.querySelector("[data-width-custom]");
    maxHRadios = container.querySelectorAll("[data-max-h]");
    heightCustom = container.querySelector("[data-height-custom]");
    colorModeRadios = container.querySelectorAll("[data-color-mode]");
    saturationSlider = container.querySelector("[data-saturation]");
    saturationVal = container.querySelector("[data-saturation-val]");
    brightnessSlider = container.querySelector("[data-brightness]");
    brightnessVal = container.querySelector("[data-brightness-val]");
    contrastSlider = container.querySelector("[data-contrast]");
    contrastVal = container.querySelector("[data-contrast-val]");
    paletteRadios = container.querySelectorAll("[data-palette]");
    customPalettePanel = container.querySelector("[data-custom-palette]");
    paletteColorsEl = container.querySelector("[data-palette-colors]");
    colorPicker = container.querySelector("[data-color-picker]");
    addColorBtn = container.querySelector("[data-add-color]");
    copyPaletteBtn = container.querySelector("[data-copy-palette]");
    pastePaletteBtn = container.querySelector("[data-paste-palette]");
    ditherRadios = container.querySelectorAll("[data-dither]");
    gridOptions = container.querySelector("[data-grid-options]");
    gridColorInput = container.querySelector("[data-grid-color]");
    gridOpacitySlider = container.querySelector("[data-grid-opacity]");
    gridOpacityVal = container.querySelector("[data-grid-opacity-val]");
    bgColorInput = container.querySelector("[data-bg-color]");
    bgColorWrap = container.querySelector("[data-bg-color-wrap]");
    workspaceSection = container.querySelector(".pixel-workspace");
    resultCanvas = container.querySelector("[data-result-canvas]");
    resultDims = container.querySelector("[data-result-dims]");
    resultWrap = container.querySelector("[data-result-wrap]");
    exportBtn = container.querySelector("[data-export-png]");
    copyConfigBtn = container.querySelector("[data-copy-config]");
    resetBtn = container.querySelector("[data-reset-defaults]");
    clearBtn = container.querySelector("[data-clear-all]");
    pixelitSrcImg = container.querySelector("[data-pixelit-src]");
    pixelitWorkCanvas = container.querySelector("[data-pixelit-work]");

    // Effect toggles
    var t1 = container.querySelector('[data-toggle="pixelStroke"]');
    togglePixelStroke = t1 ? t1.querySelector("input") : null;
    var t2 = container.querySelector('[data-toggle="gridLines"]');
    toggleGridLines = t2 ? t2.querySelector("input") : null;
    var t3 = container.querySelector('[data-toggle="rounded"]');
    toggleRounded = t3 ? t3.querySelector("input") : null;
    var t4 = container.querySelector('[data-toggle="crt"]');
    toggleCrt = t4 ? t4.querySelector("input") : null;
    var t5 = container.querySelector('[data-toggle="noise"]');
    toggleNoise = t5 ? t5.querySelector("input") : null;
    var t6 = container.querySelector('[data-toggle="transparentBg"]');
    toggleTransparentBg = t6 ? t6.querySelector("input") : null;
  }

  // ===== Config persistence =====
  function loadConfig() {
    try {
      var saved = CS.storage.get(CONFIG_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        var out = {};
        for (var k in DEFAULTS) { out[k] = parsed[k] !== undefined ? parsed[k] : DEFAULTS[k]; }
        return out;
      }
    } catch(e) {}
    var out2 = {};
    for (var k2 in DEFAULTS) { out2[k2] = DEFAULTS[k2]; }
    return out2;
  }

  function saveConfig() {
    try { CS.storage.set(CONFIG_KEY, JSON.stringify(config)); } catch(e) {}
  }

  function getMaxW() {
    for (var i = 0; maxWRadios && i < maxWRadios.length; i++) {
      var r = maxWRadios[i];
      if (!r.checked) continue;
      if (r.value === "custom") return parseInt(widthCustom ? widthCustom.value : "1024", 10) || 1024;
      return parseInt(r.value, 10) || 0;
    }
    return 0;
  }

  function getMaxH() {
    for (var i = 0; maxHRadios && i < maxHRadios.length; i++) {
      var r = maxHRadios[i];
      if (!r.checked) continue;
      if (r.value === "custom") return parseInt(heightCustom ? heightCustom.value : "1024", 10) || 1024;
      return parseInt(r.value, 10) || 0;
    }
    return 0;
  }

  function getColorMode() {
    for (var i = 0; colorModeRadios && i < colorModeRadios.length; i++) {
      if (colorModeRadios[i].checked) return colorModeRadios[i].value;
    }
    return "original";
  }

  function getPaletteKey() {
    for (var i = 0; paletteRadios && i < paletteRadios.length; i++) {
      if (paletteRadios[i].checked) return paletteRadios[i].value;
    }
    return "none";
  }

  function getDither() {
    for (var i = 0; ditherRadios && i < ditherRadios.length; i++) {
      if (ditherRadios[i].checked) return ditherRadios[i].value;
    }
    return "none";
  }

  function readConfig() {
    config.blockSize = parseInt(blockSizeSlider ? blockSizeSlider.value : "8", 10) || 8;
    config.maxW = getMaxW();
    if (widthCustom) config.maxWCustom = parseInt(widthCustom.value, 10) || 1024;
    config.maxH = getMaxH();
    if (heightCustom) config.maxHCustom = parseInt(heightCustom.value, 10) || 1024;
    config.colorMode = getColorMode();
    config.saturation = parseInt(saturationSlider ? saturationSlider.value : "0", 10) || 0;
    config.brightness = parseInt(brightnessSlider ? brightnessSlider.value : "0", 10) || 0;
    config.contrast = parseInt(contrastSlider ? contrastSlider.value : "0", 10) || 0;
    config.palette = getPaletteKey();
    config.dither = getDither();
    if (togglePixelStroke) config.pixelStroke = togglePixelStroke.checked;
    if (toggleGridLines) config.gridLines = toggleGridLines.checked;
    if (gridColorInput) config.gridColor = gridColorInput.value;
    config.gridOpacity = parseInt(gridOpacitySlider ? gridOpacitySlider.value : "0", 10) || 0;
    if (toggleRounded) config.rounded = toggleRounded.checked;
    if (toggleCrt) config.crt = toggleCrt.checked;
    if (toggleNoise) config.noise = toggleNoise.checked;
    if (toggleTransparentBg) config.transparentBg = toggleTransparentBg.checked;
    if (bgColorInput) config.bgColor = bgColorInput.value;
  }

  function applyConfigToUI() {
    if (blockSizeSlider) blockSizeSlider.value = config.blockSize;
    if (blockSizeVal) blockSizeVal.textContent = config.blockSize;

    if (maxWRadios) {
      maxWRadios.forEach(function(r) {
        r.checked = r.value === String(config.maxW) || (config.maxW === 0 && r.value === "0");
      });
    }
    if (widthCustom) {
      widthCustom.value = config.maxWCustom;
      widthCustom.style.display = "none";
      if (maxWRadios) {
        maxWRadios.forEach(function(r) {
          if (r.value === "custom" && r.checked) widthCustom.style.display = "";
        });
      }
    }

    if (maxHRadios) {
      maxHRadios.forEach(function(r) {
        r.checked = r.value === String(config.maxH) || (config.maxH === 0 && r.value === "0");
      });
    }
    if (heightCustom) heightCustom.value = config.maxHCustom;

    if (colorModeRadios) colorModeRadios.forEach(function(r) { r.checked = r.value === config.colorMode; });
    if (saturationSlider) saturationSlider.value = config.saturation;
    if (saturationVal) saturationVal.textContent = config.saturation;
    if (brightnessSlider) brightnessSlider.value = config.brightness;
    if (brightnessVal) brightnessVal.textContent = config.brightness;
    if (contrastSlider) contrastSlider.value = config.contrast;
    if (contrastVal) contrastVal.textContent = config.contrast;

    if (paletteRadios) paletteRadios.forEach(function(r) { r.checked = r.value === config.palette; });
    if (customPalettePanel) customPalettePanel.hidden = config.palette !== "custom";
    if (config.palette === "custom") renderCustomPalette();

    if (ditherRadios) ditherRadios.forEach(function(r) { r.checked = r.value === config.dither; });

    if (togglePixelStroke) togglePixelStroke.checked = config.pixelStroke;
    if (toggleGridLines) toggleGridLines.checked = config.gridLines;
    if (gridColorInput) gridColorInput.value = config.gridColor;
    if (gridOpacitySlider) gridOpacitySlider.value = config.gridOpacity;
    if (gridOpacityVal) gridOpacityVal.textContent = config.gridOpacity + "%";
    if (gridOptions) gridOptions.hidden = !config.gridLines;
    if (toggleRounded) toggleRounded.checked = config.rounded;
    if (toggleCrt) toggleCrt.checked = config.crt;
    if (toggleNoise) toggleNoise.checked = config.noise;
    if (toggleTransparentBg) toggleTransparentBg.checked = config.transparentBg;
    if (bgColorInput) bgColorInput.value = config.bgColor;
    if (bgColorWrap) bgColorWrap.hidden = config.transparentBg;

    updatePresetPills();
  }

  function updatePresetPills() {
    if (!blockPresets) return;
    blockPresets.querySelectorAll("[data-preset]").forEach(function(p) {
      p.dataset.active = p.dataset.preset === String(config.blockSize) ? "true" : "false";
    });
  }

  // ===== Custom palette management =====
  function renderCustomPalette() {
    if (!paletteColorsEl) return;
    paletteColorsEl.innerHTML = "";
    config.customPalette.forEach(function(c, i) {
      var swatch = document.createElement("div");
      swatch.className = "pixel-palette-swatch";
      swatch.style.background = "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
      swatch.title = "#" + toHex(c[0]) + toHex(c[1]) + toHex(c[2]) + " (点击删除)";
      swatch.addEventListener("click", function() {
        config.customPalette.splice(i, 1);
        renderCustomPalette();
        scheduleProcess();
      });
      paletteColorsEl.appendChild(swatch);
    });
  }

  function toHex(n) { return n.toString(16).padStart(2, "0"); }

  function hexToRgb(hex) {
    var m = hex.replace("#", "").match(/.{2}/g);
    return m ? [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)] : [0, 0, 0];
  }

  // ===== Image upload =====
  function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      if (CS && CS.toast) CS.toast("请选择图片文件", "info");
      return;
    }
    selectedFile = file;
    var reader = new FileReader();
    reader.onload = function(e) {
      if (!previewImg || !pixelitSrcImg) return;
      previewImg.src = e.target.result;
      previewName.textContent = file.name;
      pixelitSrcImg.onload = function() {
        originalImage = pixelitSrcImg;
        if (previewDims) previewDims.textContent = pixelitSrcImg.naturalWidth + " x " + pixelitSrcImg.naturalHeight;
        var inner = uploadZone ? uploadZone.querySelector(".pixel-upload__inner") : null;
        if (inner) inner.hidden = true;
        if (previewArea) previewArea.hidden = false;
        if (workspaceSection) workspaceSection.hidden = false;
        processImage();
      };
      pixelitSrcImg.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function clearFile() {
    selectedFile = null;
    originalImage = null;
    if (pixelitSrcImg) pixelitSrcImg.src = "";
    if (previewImg) previewImg.src = "";
    if (fileInput) fileInput.value = "";
    var inner = uploadZone ? uploadZone.querySelector(".pixel-upload__inner") : null;
    if (inner) inner.hidden = false;
    if (previewArea) previewArea.hidden = true;
    if (workspaceSection) workspaceSection.hidden = true;
    if (resultCanvas) {
      var ctx = resultCanvas.getContext("2d");
      ctx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
    }
  }

  // ===== Core processing pipeline =====
  function scheduleProcess() {
    readConfig();
    saveConfig();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processImage, DEBOUNCE_MS);
  }

  function processImage() {
    if (!originalImage || !originalImage.naturalWidth) return;

    readConfig();

    var blockSize = config.blockSize || 8;
    var maxW = config.maxW || 0;
    var maxH = config.maxH || 0;

    var pxScale = 100 / blockSize;
    if (pxScale < 1) pxScale = 1;
    if (pxScale > 50) pxScale = 50;

    var palette = null;
    if (config.palette !== "none") {
      if (config.palette === "custom") {
        palette = config.customPalette.length >= 2 ? config.customPalette : null;
      } else {
        palette = PALETTES[config.palette] || null;
      }
    }

    if (!pixelitSrcImg || !pixelitWorkCanvas) return;
    var px = new pixelit({
      from: pixelitSrcImg,
      to: pixelitWorkCanvas,
      scale: pxScale,
      palette: palette || undefined,
      maxWidth: maxW || undefined,
      maxHeight: maxH || undefined
    });

    px.draw().pixelate();
    if (palette && palette.length >= 2 && config.palette !== "none") {
      px.convertPalette();
    }
    if (config.colorMode === "grayscale") {
      px.convertGrayscale();
    }

    var w = pixelitWorkCanvas.width;
    var h = pixelitWorkCanvas.height;
    if (!resultCanvas) return;
    resultCanvas.width = w;
    resultCanvas.height = h;
    var ctx = resultCanvas.getContext("2d");

    if (!config.transparentBg) {
      ctx.fillStyle = config.bgColor;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.drawImage(pixelitWorkCanvas, 0, 0);

    var imageData = ctx.getImageData(0, 0, w, h);

    if (config.colorMode !== "grayscale") {
      applyColorMode(imageData, config.colorMode);
    }

    if (config.saturation !== 0 || config.brightness !== 0 || config.contrast !== 0) {
      applyAdjustments(imageData, config.saturation, config.brightness, config.contrast);
    }

    if (config.dither === "threshold") {
      applyThresholdDither(imageData);
    }

    ctx.putImageData(imageData, 0, 0);

    if (config.pixelStroke) drawPixelStroke(ctx, w, h, blockSize);
    if (config.gridLines) drawGridLines(ctx, w, h, blockSize, config.gridColor, config.gridOpacity);
    if (config.rounded) drawRoundedPixels(ctx, w, h, blockSize);
    if (config.crt) drawCRT(ctx, w, h);
    if (config.noise) drawNoise(ctx, w, h);

    if (resultDims) resultDims.textContent = w + " x " + h;
    if (resultWrap) resultWrap.dataset.checker = config.transparentBg ? "true" : "false";
  }

  function applyColorMode(imageData, mode) {
    var d = imageData.data;
    var len = d.length;
    if (mode === "bw") {
      for (var i = 0; i < len; i += 4) {
        var avg = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        var v = avg > 128 ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    } else if (mode === "highContrast") {
      for (var i = 0; i < len; i += 4) {
        d[i] = d[i] > 128 ? Math.min(255, d[i] * 1.5) : d[i] * 0.5;
        d[i + 1] = d[i + 1] > 128 ? Math.min(255, d[i + 1] * 1.5) : d[i + 1] * 0.5;
        d[i + 2] = d[i + 2] > 128 ? Math.min(255, d[i + 2] * 1.5) : d[i + 2] * 0.5;
      }
    } else if (mode === "invert") {
      for (var i = 0; i < len; i += 4) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
    }
  }

  function applyAdjustments(imageData, sat, bri, con) {
    var d = imageData.data;
    var len = d.length;
    var satMul = 1 + sat / 100;
    var briAdd = bri / 100 * 128;
    var conFactor = (259 * (con + 255)) / (255 * (259 - con));

    for (var i = 0; i < len; i += 4) {
      var r = d[i], g = d[i + 1], b = d[i + 2];
      if (bri !== 0) { r += briAdd; g += briAdd; b += briAdd; }
      if (con !== 0) {
        r = conFactor * (r - 128) + 128;
        g = conFactor * (g - 128) + 128;
        b = conFactor * (b - 128) + 128;
      }
      if (sat !== 0) {
        var hsl = rgbToHsl(r, g, b);
        hsl[1] = Math.max(0, Math.min(1, hsl[1] * satMul));
        var rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);
        r = rgb[0]; g = rgb[1]; b = rgb[2];
      }
      d[i] = clamp8(r);
      d[i + 1] = clamp8(g);
      d[i + 2] = clamp8(b);
    }
  }

  function clamp8(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    var d = max - min;
    var s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    var h;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return [h, s, l];
  }

  function hslToRgb(h, s, l) {
    if (s === 0) { var v = Math.round(l * 255); return [v, v, v]; }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    return [Math.round(hue2rgb(p, q, h + 1/3) * 255), Math.round(hue2rgb(p, q, h) * 255), Math.round(hue2rgb(p, q, h - 1/3) * 255)];
  }

  function hue2rgb(p, q, t) {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }

  function applyThresholdDither(imageData) {
    var d = imageData.data;
    for (var i = 0; i < d.length; i += 4) {
      var noise = (Math.random() - 0.5) * 50;
      d[i] = clamp8(d[i] + noise);
      d[i + 1] = clamp8(d[i + 1] + noise);
      d[i + 2] = clamp8(d[i + 2] + noise);
    }
  }

  function drawPixelStroke(ctx, w, h, blockSize) {
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    for (var y = 0; y < h; y += blockSize) {
      for (var x = 0; x < w; x += blockSize) {
        ctx.strokeRect(x + 0.5, y + 0.5, blockSize - 1, blockSize - 1);
      }
    }
    ctx.restore();
  }

  function drawGridLines(ctx, w, h, blockSize, color, opacity) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = opacity / 100;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = 0; x <= w; x += blockSize) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
    for (var y = 0; y <= h; y += blockSize) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
    ctx.stroke();
    ctx.restore();
  }

  function drawRoundedPixels(ctx, w, h, blockSize) {
    var tempCanvas = document.createElement("canvas");
    tempCanvas.width = w; tempCanvas.height = h;
    var tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(resultCanvas, 0, 0);
    var imageData = tempCtx.getImageData(0, 0, w, h);

    ctx.clearRect(0, 0, w, h);
    if (!config.transparentBg) {
      ctx.fillStyle = config.bgColor;
      ctx.fillRect(0, 0, w, h);
    }

    var radius = Math.max(1, blockSize * 0.15);
    var gap = 1;
    var hasRoundRect = typeof ctx.roundRect === "function";
    for (var y = 0; y < h; y += blockSize) {
      for (var x = 0; x < w; x += blockSize) {
        var i = (y * w + x) * 4;
        var r = imageData.data[i], g = imageData.data[i + 1], b = imageData.data[i + 2], a = imageData.data[i + 3];
        if (a < 10) continue;
        ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + (a / 255) + ")";
        ctx.beginPath();
        if (hasRoundRect) {
          ctx.roundRect(x + gap, y + gap, blockSize - gap * 2, blockSize - gap * 2, radius);
        } else {
          ctx.rect(x + gap, y + gap, blockSize - gap * 2, blockSize - gap * 2);
        }
        ctx.fill();
      }
    }
  }

  function drawCRT(ctx, w, h) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.04)";
    for (var y = 0; y < h; y += 3) { ctx.fillRect(0, y, w, 1); }
    ctx.restore();
  }

  function drawNoise(ctx, w, h) {
    var imageData = ctx.getImageData(0, 0, w, h);
    var d = imageData.data;
    for (var i = 0; i < d.length; i += 4) {
      var n = (Math.random() - 0.5) * 30;
      d[i] = clamp8(d[i] + n);
      d[i + 1] = clamp8(d[i + 1] + n);
      d[i + 2] = clamp8(d[i + 2] + n);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function exportPNG() {
    if (!resultCanvas) return;
    resultCanvas.toBlob(function(blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "pixel-art.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
      if (CS && CS.toast) CS.toast("PNG 已导出", "ok");
    }, "image/png");
  }

  function copyConfigJSON() {
    readConfig();
    var json = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(json).then(function() {
      if (CS && CS.toast) CS.toast("配置已复制到剪贴板", "ok");
    }).catch(function() {
      if (CS && CS.toast) CS.toast("复制失败", "err");
    });
  }

  function restoreDefaults() {
    config = {};
    for (var k in DEFAULTS) { config[k] = DEFAULTS[k]; }
    applyConfigToUI();
    saveConfig();
    if (originalImage) processImage();
    if (CS && CS.toast) CS.toast("已恢复默认设置", "ok");
  }

  /* Helper: on with signal */
  function on(el, evt, fn) {
    if (el) el.addEventListener(evt, fn, ac ? { signal: ac.signal } : undefined);
  }

  function init() {
    applyConfigToUI();

    // File upload
    on(fileInput, "change", function(e) { if (e.target.files[0]) handleFile(e.target.files[0]); });

    // Drag & drop
    on(uploadZone, "dragover", function(e) { e.preventDefault(); if (uploadZone) uploadZone.dataset.dragover = "true"; });
    on(uploadZone, "dragleave", function() { if (uploadZone) uploadZone.dataset.dragover = "false"; });
    on(uploadZone, "drop", function(e) {
      e.preventDefault();
      if (uploadZone) uploadZone.dataset.dragover = "false";
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });

    on(clearPreviewBtn, "click", clearFile);

    on(collapseBtn, "click", function() {
      if (!controlsBody) return;
      var collapsed = controlsBody.dataset.collapsed === "true";
      controlsBody.dataset.collapsed = collapsed ? "false" : "true";
      collapseBtn.innerHTML = collapsed ? "&#9650;" : "&#9660;";
    });

    on(blockSizeSlider, "input", function() {
      if (blockSizeVal) blockSizeVal.textContent = blockSizeSlider.value;
      updatePresetPills();
      scheduleProcess();
    });

    if (blockPresets) {
      blockPresets.querySelectorAll("[data-preset]").forEach(function(btn) {
        on(btn, "click", function() {
          if (blockSizeSlider) blockSizeSlider.value = btn.dataset.preset;
          if (blockSizeVal) blockSizeVal.textContent = btn.dataset.preset;
          updatePresetPills();
          scheduleProcess();
        });
      });
    }

    if (maxWRadios) {
      maxWRadios.forEach(function(r) {
        on(r, "change", function() {
          if (widthCustom) widthCustom.style.display = r.value === "custom" && r.checked ? "" : "none";
          scheduleProcess();
        });
      });
    }
    on(widthCustom, "input", scheduleProcess);

    if (maxHRadios) {
      maxHRadios.forEach(function(r) {
        on(r, "change", function() {
          if (heightCustom) heightCustom.style.display = r.value === "custom" && r.checked ? "" : "none";
          scheduleProcess();
        });
      });
    }
    on(heightCustom, "input", scheduleProcess);

    if (colorModeRadios) colorModeRadios.forEach(function(r) { on(r, "change", scheduleProcess); });

    on(saturationSlider, "input", function() { if (saturationVal) saturationVal.textContent = saturationSlider.value; scheduleProcess(); });
    on(brightnessSlider, "input", function() { if (brightnessVal) brightnessVal.textContent = brightnessSlider.value; scheduleProcess(); });
    on(contrastSlider, "input", function() { if (contrastVal) contrastVal.textContent = contrastSlider.value; scheduleProcess(); });

    if (paletteRadios) {
      paletteRadios.forEach(function(r) {
        on(r, "change", function() {
          if (customPalettePanel) customPalettePanel.hidden = r.value !== "custom";
          if (r.value === "custom") renderCustomPalette();
          scheduleProcess();
        });
      });
    }

    on(addColorBtn, "click", function() {
      if (!colorPicker) return;
      var rgb = hexToRgb(colorPicker.value);
      config.customPalette.push(rgb);
      renderCustomPalette();
      scheduleProcess();
    });
    on(copyPaletteBtn, "click", function() {
      var json = JSON.stringify(config.customPalette);
      navigator.clipboard.writeText(json).then(function() {
        if (CS && CS.toast) CS.toast("调色板 JSON 已复制", "ok");
      }).catch(function() { if (CS && CS.toast) CS.toast("复制失败", "err"); });
    });
    on(pastePaletteBtn, "click", function() {
      var input = prompt("粘贴调色板 JSON（格式: [[r,g,b], ...]）");
      if (!input) return;
      try {
        var arr = JSON.parse(input);
        if (Array.isArray(arr) && arr.length >= 2 && arr.every(function(c) { return Array.isArray(c) && c.length === 3; })) {
          config.customPalette = arr;
          renderCustomPalette();
          scheduleProcess();
          if (CS && CS.toast) CS.toast("调色板已导入", "ok");
        } else {
          if (CS && CS.toast) CS.toast("格式不正确", "err");
        }
      } catch(e) { if (CS && CS.toast) CS.toast("JSON 解析失败", "err"); }
    });

    if (ditherRadios) ditherRadios.forEach(function(r) { on(r, "change", scheduleProcess); });

    on(togglePixelStroke, "change", scheduleProcess);
    on(toggleGridLines, "change", function() {
      if (gridOptions) gridOptions.hidden = !(toggleGridLines && toggleGridLines.checked);
      scheduleProcess();
    });
    on(toggleRounded, "change", scheduleProcess);
    on(toggleCrt, "change", scheduleProcess);
    on(toggleNoise, "change", scheduleProcess);
    on(gridColorInput, "input", scheduleProcess);
    on(gridOpacitySlider, "input", function() {
      if (gridOpacityVal) gridOpacityVal.textContent = gridOpacitySlider.value + "%";
      scheduleProcess();
    });

    on(toggleTransparentBg, "change", function() {
      if (bgColorWrap) bgColorWrap.hidden = toggleTransparentBg ? toggleTransparentBg.checked : true;
      scheduleProcess();
    });
    on(bgColorInput, "input", scheduleProcess);

    on(exportBtn, "click", exportPNG);
    on(copyConfigBtn, "click", copyConfigJSON);
    on(resetBtn, "click", restoreDefaults);
    on(clearBtn, "click", clearFile);
  }

  function mount(el) {
    container = el;
    ac = new AbortController();
    collectEls();
    init();
  }

  function unmount() {
    if (ac) { ac.abort(); ac = null; }
    clearTimeout(debounceTimer);
    debounceTimer = null;
    container = null;
  }

  window.__page_pixel = { mount: mount, unmount: unmount };
})();
