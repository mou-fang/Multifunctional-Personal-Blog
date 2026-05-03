/* ===== claudeOne :: pixel.js =====
 * Pixel art tool — upload, pixelit integration, post-processing, effects, export.
 * Uses giventofly/pixelit (MIT) as core pixelation engine.
 */

(function bootstrapPixel() {
  const CFG = window.CLAUDE_ONE_CONFIG;
  const CS = window.ClaudeOne;
  if (!CFG || !CS) {
    console.error("[pixel] Config or shell missing");
    return;
  }

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

  // ===== State =====
  let selectedFile = null;
  let originalImage = null;
  let debounceTimer = null;
  let config = loadConfig();

  // ===== DOM refs =====
  const uploadZone = document.querySelector("[data-upload-zone]");
  const fileInput = document.querySelector("[data-file-input]");
  const previewArea = document.querySelector("[data-preview-area]");
  const previewImg = document.querySelector("[data-preview-img]");
  const previewName = document.querySelector("[data-preview-name]");
  const previewDims = document.querySelector("[data-preview-dims]");
  const clearPreviewBtn = document.querySelector("[data-clear-preview]");
  const controlsBody = document.querySelector("[data-controls-body]");
  const collapseBtn = document.querySelector("[data-collapse-btn]");
  const blockSizeSlider = document.querySelector("[data-block-size]");
  const blockSizeVal = document.querySelector("[data-block-size-val]");
  const blockPresets = document.querySelector("[data-block-presets]");
  const maxWRadios = document.querySelectorAll("[data-max-w]");
  const widthCustom = document.querySelector("[data-width-custom]");
  const maxHRadios = document.querySelectorAll("[data-max-h]");
  const heightCustom = document.querySelector("[data-height-custom]");
  const colorModeRadios = document.querySelectorAll("[data-color-mode]");
  const saturationSlider = document.querySelector("[data-saturation]");
  const saturationVal = document.querySelector("[data-saturation-val]");
  const brightnessSlider = document.querySelector("[data-brightness]");
  const brightnessVal = document.querySelector("[data-brightness-val]");
  const contrastSlider = document.querySelector("[data-contrast]");
  const contrastVal = document.querySelector("[data-contrast-val]");
  const paletteRadios = document.querySelectorAll("[data-palette]");
  const customPalettePanel = document.querySelector("[data-custom-palette]");
  const paletteColorsEl = document.querySelector("[data-palette-colors]");
  const colorPicker = document.querySelector("[data-color-picker]");
  const addColorBtn = document.querySelector("[data-add-color]");
  const copyPaletteBtn = document.querySelector("[data-copy-palette]");
  const pastePaletteBtn = document.querySelector("[data-paste-palette]");
  const ditherRadios = document.querySelectorAll("[data-dither]");
  const gridOptions = document.querySelector("[data-grid-options]");
  const gridColorInput = document.querySelector("[data-grid-color]");
  const gridOpacitySlider = document.querySelector("[data-grid-opacity]");
  const gridOpacityVal = document.querySelector("[data-grid-opacity-val]");
  const bgColorInput = document.querySelector("[data-bg-color]");
  const bgColorWrap = document.querySelector("[data-bg-color-wrap]");
  const workspaceSection = document.querySelector(".pixel-workspace");
  const resultCanvas = document.querySelector("[data-result-canvas]");
  const resultDims = document.querySelector("[data-result-dims]");
  const resultWrap = document.querySelector("[data-result-wrap]");
  const exportBtn = document.querySelector("[data-export-png]");
  const copyConfigBtn = document.querySelector("[data-copy-config]");
  const resetBtn = document.querySelector("[data-reset-defaults]");
  const clearBtn = document.querySelector("[data-clear-all]");
  const pixelitSrcImg = document.querySelector("[data-pixelit-src]");
  const pixelitWorkCanvas = document.querySelector("[data-pixelit-work]");

  // Effect toggles
  const togglePixelStroke = document.querySelector("[data-toggle=\"pixelStroke\"] input");
  const toggleGridLines = document.querySelector("[data-toggle=\"gridLines\"] input");
  const toggleRounded = document.querySelector("[data-toggle=\"rounded\"] input");
  const toggleCrt = document.querySelector("[data-toggle=\"crt\"] input");
  const toggleNoise = document.querySelector("[data-toggle=\"noise\"] input");
  const toggleTransparentBg = document.querySelector("[data-toggle=\"transparentBg\"] input");

  // ===== Config persistence =====
  function loadConfig() {
    try {
      const saved = CS.storage.get(CONFIG_KEY);
      if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
    } catch (_) {}
    return { ...DEFAULTS };
  }

  function saveConfig() {
    try {
      CS.storage.set(CONFIG_KEY, JSON.stringify(config));
    } catch (_) {}
  }

  function getMaxW() {
    for (const r of maxWRadios) {
      if (!r.checked) continue;
      if (r.value === "custom") return parseInt(widthCustom.value, 10) || 1024;
      return parseInt(r.value, 10) || 0;
    }
    return 0;
  }

  function getMaxH() {
    for (const r of maxHRadios) {
      if (!r.checked) continue;
      if (r.value === "custom") return parseInt(heightCustom.value, 10) || 1024;
      return parseInt(r.value, 10) || 0;
    }
    return 0;
  }

  function getColorMode() {
    for (const r of colorModeRadios) if (r.checked) return r.value;
    return "original";
  }

  function getPaletteKey() {
    for (const r of paletteRadios) if (r.checked) return r.value;
    return "none";
  }

  function getDither() {
    for (const r of ditherRadios) if (r.checked) return r.value;
    return "none";
  }

  function readConfig() {
    config.blockSize = parseInt(blockSizeSlider.value, 10) || 8;
    config.maxW = getMaxW();
    config.maxWCustom = parseInt(widthCustom.value, 10) || 1024;
    config.maxH = getMaxH();
    config.maxHCustom = parseInt(heightCustom.value, 10) || 1024;
    config.colorMode = getColorMode();
    config.saturation = parseInt(saturationSlider.value, 10) || 0;
    config.brightness = parseInt(brightnessSlider.value, 10) || 0;
    config.contrast = parseInt(contrastSlider.value, 10) || 0;
    config.palette = getPaletteKey();
    config.dither = getDither();
    config.pixelStroke = togglePixelStroke.checked;
    config.gridLines = toggleGridLines.checked;
    config.gridColor = gridColorInput.value;
    config.gridOpacity = parseInt(gridOpacitySlider.value, 10) || 0;
    config.rounded = toggleRounded.checked;
    config.crt = toggleCrt.checked;
    config.noise = toggleNoise.checked;
    config.transparentBg = toggleTransparentBg.checked;
    config.bgColor = bgColorInput.value;
  }

  function applyConfigToUI() {
    blockSizeSlider.value = config.blockSize;
    blockSizeVal.textContent = config.blockSize;

    for (const r of maxWRadios) {
      r.checked = r.value === String(config.maxW) || (config.maxW === 0 && r.value === "0");
    }
    if (config.maxW === 0) {
      maxWRadios.forEach(r => { if (r.value === "0") r.checked = true; });
    }
    widthCustom.value = config.maxWCustom;
    widthCustom.style.display = "none";
    for (const r of maxWRadios) {
      if (r.value === "custom" && r.checked) widthCustom.style.display = "";
    }

    for (const r of maxHRadios) {
      r.checked = r.value === String(config.maxH) || (config.maxH === 0 && r.value === "0");
    }
    heightCustom.value = config.maxHCustom;

    for (const r of colorModeRadios) r.checked = r.value === config.colorMode;
    saturationSlider.value = config.saturation;
    saturationVal.textContent = config.saturation;
    brightnessSlider.value = config.brightness;
    brightnessVal.textContent = config.brightness;
    contrastSlider.value = config.contrast;
    contrastVal.textContent = config.contrast;

    for (const r of paletteRadios) r.checked = r.value === config.palette;
    customPalettePanel.hidden = config.palette !== "custom";
    if (config.palette === "custom") renderCustomPalette();

    for (const r of ditherRadios) r.checked = r.value === config.dither;

    togglePixelStroke.checked = config.pixelStroke;
    toggleGridLines.checked = config.gridLines;
    gridColorInput.value = config.gridColor;
    gridOpacitySlider.value = config.gridOpacity;
    gridOpacityVal.textContent = config.gridOpacity + "%";
    gridOptions.hidden = !config.gridLines;
    toggleRounded.checked = config.rounded;
    toggleCrt.checked = config.crt;
    toggleNoise.checked = config.noise;
    toggleTransparentBg.checked = config.transparentBg;
    bgColorInput.value = config.bgColor;
    bgColorWrap.hidden = config.transparentBg;

    // Update preset pills active state
    updatePresetPills();
  }

  function updatePresetPills() {
    blockPresets.querySelectorAll("[data-preset]").forEach(p => {
      p.dataset.active = p.dataset.preset === String(config.blockSize) ? "true" : "false";
    });
  }

  // ===== Custom palette management =====
  function renderCustomPalette() {
    paletteColorsEl.innerHTML = "";
    config.customPalette.forEach((c, i) => {
      const swatch = document.createElement("div");
      swatch.className = "pixel-palette-swatch";
      swatch.style.background = `rgb(${c[0]},${c[1]},${c[2]})`;
      swatch.title = `#${toHex(c[0])}${toHex(c[1])}${toHex(c[2])} (点击删除)`;
      swatch.addEventListener("click", () => {
        config.customPalette.splice(i, 1);
        renderCustomPalette();
        scheduleProcess();
      });
      paletteColorsEl.appendChild(swatch);
    });
  }

  function toHex(n) {
    return n.toString(16).padStart(2, "0");
  }

  function hexToRgb(hex) {
    const m = hex.replace("#", "").match(/.{2}/g);
    return m ? [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)] : [0, 0, 0];
  }

  // ===== Image upload =====
  function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      CS.toast("请选择图片文件", "info");
      return;
    }
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewName.textContent = file.name;
      pixelitSrcImg.onload = () => {
        originalImage = pixelitSrcImg;
        previewDims.textContent = `${pixelitSrcImg.naturalWidth} x ${pixelitSrcImg.naturalHeight}`;
        uploadZone.querySelector(".pixel-upload__inner").hidden = true;
        previewArea.hidden = false;
        workspaceSection.hidden = false;
        processImage();
      };
      pixelitSrcImg.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function clearFile() {
    selectedFile = null;
    originalImage = null;
    pixelitSrcImg.src = "";
    previewImg.src = "";
    fileInput.value = "";
    uploadZone.querySelector(".pixel-upload__inner").hidden = false;
    previewArea.hidden = true;
    workspaceSection.hidden = true;
    const ctx = resultCanvas.getContext("2d");
    ctx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
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

    const blockSize = config.blockSize || 8;
    const maxW = config.maxW || 0;
    const maxH = config.maxH || 0;

    // Map blockSize to pixelit scale: scale = 100 / blockSize
    // Clamp to pixelit's valid range 1..50
    let pxScale = 100 / blockSize;
    if (pxScale < 1) pxScale = 1;
    if (pxScale > 50) pxScale = 50;

    // Get palette
    let palette = null;
    if (config.palette !== "none") {
      if (config.palette === "custom") {
        palette = config.customPalette.length >= 2 ? config.customPalette : null;
      } else {
        palette = PALETTES[config.palette] || null;
      }
    }

    // Create pixelit instance
    const px = new pixelit({
      from: pixelitSrcImg,
      to: pixelitWorkCanvas,
      scale: pxScale,
      palette: palette || undefined,
      maxWidth: maxW || undefined,
      maxHeight: maxH || undefined
    });

    // Run pixelit pipeline
    px.draw().pixelate();
    if (palette && palette.length >= 2 && config.palette !== "none") {
      px.convertPalette();
    }
    if (config.colorMode === "grayscale") {
      px.convertGrayscale();
    }

    // Copy pixelit result to display canvas
    const w = pixelitWorkCanvas.width;
    const h = pixelitWorkCanvas.height;
    resultCanvas.width = w;
    resultCanvas.height = h;
    const ctx = resultCanvas.getContext("2d");

    // Handle background
    if (!config.transparentBg) {
      ctx.fillStyle = config.bgColor;
      ctx.fillRect(0, 0, w, h);
    }

    // Draw pixelit result
    ctx.drawImage(pixelitWorkCanvas, 0, 0);

    // Post-processing
    const imageData = ctx.getImageData(0, 0, w, h);

    // Color mode (skip grayscale, already handled by pixelit)
    if (config.colorMode !== "grayscale") {
      applyColorMode(imageData, config.colorMode);
    }

    // Adjustments
    if (config.saturation !== 0 || config.brightness !== 0 || config.contrast !== 0) {
      applyAdjustments(imageData, config.saturation, config.brightness, config.contrast);
    }

    // Dithering
    if (config.dither === "threshold") {
      applyThresholdDither(imageData);
    }

    ctx.putImageData(imageData, 0, 0);

    // Effects overlays
    if (config.pixelStroke) drawPixelStroke(ctx, w, h, blockSize);
    if (config.gridLines) drawGridLines(ctx, w, h, blockSize, config.gridColor, config.gridOpacity);
    if (config.rounded) drawRoundedPixels(ctx, w, h, blockSize);
    if (config.crt) drawCRT(ctx, w, h);
    if (config.noise) drawNoise(ctx, w, h);

    // Update result info
    resultDims.textContent = `${w} x ${h}`;
    resultWrap.dataset.checker = config.transparentBg ? "true" : "false";
  }

  // ===== Post-processing: color modes =====
  function applyColorMode(imageData, mode) {
    const d = imageData.data;
    const len = d.length;
    if (mode === "bw") {
      for (let i = 0; i < len; i += 4) {
        const avg = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const v = avg > 128 ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    } else if (mode === "highContrast") {
      for (let i = 0; i < len; i += 4) {
        d[i] = d[i] > 128 ? Math.min(255, d[i] * 1.5) : d[i] * 0.5;
        d[i + 1] = d[i + 1] > 128 ? Math.min(255, d[i + 1] * 1.5) : d[i + 1] * 0.5;
        d[i + 2] = d[i + 2] > 128 ? Math.min(255, d[i + 2] * 1.5) : d[i + 2] * 0.5;
      }
    } else if (mode === "invert") {
      for (let i = 0; i < len; i += 4) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
    }
    // "original" — no-op
  }

  // ===== Post-processing: saturation / brightness / contrast =====
  function applyAdjustments(imageData, sat, bri, con) {
    const d = imageData.data;
    const len = d.length;
    const satMul = 1 + sat / 100;
    const briAdd = bri / 100 * 128;
    const conFactor = (259 * (con + 255)) / (255 * (259 - con));

    for (let i = 0; i < len; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];

      // Brightness
      if (bri !== 0) {
        r += briAdd; g += briAdd; b += briAdd;
      }

      // Contrast
      if (con !== 0) {
        r = conFactor * (r - 128) + 128;
        g = conFactor * (g - 128) + 128;
        b = conFactor * (b - 128) + 128;
      }

      // Saturation via HSL
      if (sat !== 0) {
        const hsl = rgbToHsl(r, g, b);
        hsl[1] = Math.max(0, Math.min(1, hsl[1] * satMul));
        const rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);
        r = rgb[0]; g = rgb[1]; b = rgb[2];
      }

      d[i] = clamp8(r);
      d[i + 1] = clamp8(g);
      d[i + 2] = clamp8(b);
    }
  }

  function clamp8(v) {
    return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return [h, s, l];
  }

  function hslToRgb(h, s, l) {
    if (s === 0) {
      const v = Math.round(l * 255);
      return [v, v, v];
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
      Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
      Math.round(hue2rgb(p, q, h) * 255),
      Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
    ];
  }

  function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  // ===== Post-processing: dithering =====
  function applyThresholdDither(imageData) {
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const noise = (Math.random() - 0.5) * 50;
      d[i] = clamp8(d[i] + noise);
      d[i + 1] = clamp8(d[i + 1] + noise);
      d[i + 2] = clamp8(d[i + 2] + noise);
    }
  }

  // ===== Effects overlays =====
  function drawPixelStroke(ctx, w, h, blockSize) {
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += blockSize) {
      for (let x = 0; x < w; x += blockSize) {
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
    for (let x = 0; x <= w; x += blockSize) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = 0; y <= h; y += blockSize) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawRoundedPixels(ctx, w, h, blockSize) {
    // Re-draw each pixel block with rounded corners
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(resultCanvas, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, w, h);

    ctx.clearRect(0, 0, w, h);
    if (!config.transparentBg) {
      ctx.fillStyle = config.bgColor;
      ctx.fillRect(0, 0, w, h);
    }

    const radius = Math.max(1, blockSize * 0.15);
    const gap = 1;
    const hasRoundRect = typeof ctx.roundRect === "function";
    for (let y = 0; y < h; y += blockSize) {
      for (let x = 0; x < w; x += blockSize) {
        const i = (y * w + x) * 4;
        const r = imageData.data[i], g = imageData.data[i + 1], b = imageData.data[i + 2], a = imageData.data[i + 3];
        if (a < 10) continue;
        ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
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
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }
    ctx.restore();
  }

  function drawNoise(ctx, w, h) {
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 30;
      d[i] = clamp8(d[i] + n);
      d[i + 1] = clamp8(d[i + 1] + n);
      d[i + 2] = clamp8(d[i + 2] + n);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  // ===== Export PNG =====
  function exportPNG() {
    resultCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pixel-art.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      CS.toast("PNG 已导出", "ok");
    }, "image/png");
  }

  // ===== Copy config JSON =====
  function copyConfigJSON() {
    readConfig();
    const json = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      CS.toast("配置已复制到剪贴板", "ok");
    }).catch(() => {
      CS.toast("复制失败", "err");
    });
  }

  // ===== Restore defaults =====
  function restoreDefaults() {
    config = { ...DEFAULTS };
    applyConfigToUI();
    saveConfig();
    if (originalImage) processImage();
    CS.toast("已恢复默认设置", "ok");
  }

  // ===== Event wiring =====
  function init() {
    applyConfigToUI();

    // File upload
    fileInput.addEventListener("change", (e) => {
      if (e.target.files[0]) handleFile(e.target.files[0]);
    });

    // Drag & drop
    uploadZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadZone.dataset.dragover = "true";
    });
    uploadZone.addEventListener("dragleave", () => {
      uploadZone.dataset.dragover = "false";
    });
    uploadZone.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadZone.dataset.dragover = "false";
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });

    // Clear preview
    clearPreviewBtn.addEventListener("click", clearFile);

    // Collapse controls (mobile)
    collapseBtn.addEventListener("click", () => {
      const collapsed = controlsBody.dataset.collapsed === "true";
      controlsBody.dataset.collapsed = collapsed ? "false" : "true";
      collapseBtn.innerHTML = collapsed ? "&#9650;" : "&#9660;";
    });

    // Block size slider
    blockSizeSlider.addEventListener("input", () => {
      blockSizeVal.textContent = blockSizeSlider.value;
      updatePresetPills();
      scheduleProcess();
    });

    // Block size presets
    blockPresets.querySelectorAll("[data-preset]").forEach(btn => {
      btn.addEventListener("click", () => {
        blockSizeSlider.value = btn.dataset.preset;
        blockSizeVal.textContent = btn.dataset.preset;
        updatePresetPills();
        scheduleProcess();
      });
    });

    // Max width radios
    maxWRadios.forEach(r => {
      r.addEventListener("change", () => {
        widthCustom.style.display = r.value === "custom" && r.checked ? "" : "none";
        scheduleProcess();
      });
    });
    widthCustom.addEventListener("input", scheduleProcess);

    // Max height radios
    maxHRadios.forEach(r => {
      r.addEventListener("change", () => {
        heightCustom.style.display = r.value === "custom" && r.checked ? "" : "none";
        scheduleProcess();
      });
    });
    heightCustom.addEventListener("input", scheduleProcess);

    // Color mode
    colorModeRadios.forEach(r => r.addEventListener("change", scheduleProcess));

    // Adjustment sliders
    saturationSlider.addEventListener("input", () => {
      saturationVal.textContent = saturationSlider.value;
      scheduleProcess();
    });
    brightnessSlider.addEventListener("input", () => {
      brightnessVal.textContent = brightnessSlider.value;
      scheduleProcess();
    });
    contrastSlider.addEventListener("input", () => {
      contrastVal.textContent = contrastSlider.value;
      scheduleProcess();
    });

    // Palette
    paletteRadios.forEach(r => {
      r.addEventListener("change", () => {
        customPalettePanel.hidden = r.value !== "custom";
        if (r.value === "custom") renderCustomPalette();
        scheduleProcess();
      });
    });

    // Custom palette actions
    addColorBtn.addEventListener("click", () => {
      const rgb = hexToRgb(colorPicker.value);
      config.customPalette.push(rgb);
      renderCustomPalette();
      scheduleProcess();
    });
    copyPaletteBtn.addEventListener("click", () => {
      const json = JSON.stringify(config.customPalette);
      navigator.clipboard.writeText(json).then(() => {
        CS.toast("调色板 JSON 已复制", "ok");
      }).catch(() => CS.toast("复制失败", "err"));
    });
    pastePaletteBtn.addEventListener("click", () => {
      const input = prompt("粘贴调色板 JSON（格式: [[r,g,b], ...]）");
      if (!input) return;
      try {
        const arr = JSON.parse(input);
        if (Array.isArray(arr) && arr.length >= 2 && arr.every(c => Array.isArray(c) && c.length === 3)) {
          config.customPalette = arr;
          renderCustomPalette();
          scheduleProcess();
          CS.toast("调色板已导入", "ok");
        } else {
          CS.toast("格式不正确", "err");
        }
      } catch (_) {
        CS.toast("JSON 解析失败", "err");
      }
    });

    // Dithering
    ditherRadios.forEach(r => r.addEventListener("change", scheduleProcess));

    // Effect toggles
    togglePixelStroke.addEventListener("change", scheduleProcess);
    toggleGridLines.addEventListener("change", () => {
      gridOptions.hidden = !toggleGridLines.checked;
      scheduleProcess();
    });
    toggleRounded.addEventListener("change", scheduleProcess);
    toggleCrt.addEventListener("change", scheduleProcess);
    toggleNoise.addEventListener("change", scheduleProcess);
    gridColorInput.addEventListener("input", scheduleProcess);
    gridOpacitySlider.addEventListener("input", () => {
      gridOpacityVal.textContent = gridOpacitySlider.value + "%";
      scheduleProcess();
    });

    // Background
    toggleTransparentBg.addEventListener("change", () => {
      bgColorWrap.hidden = toggleTransparentBg.checked;
      scheduleProcess();
    });
    bgColorInput.addEventListener("input", scheduleProcess);

    // Actions
    exportBtn.addEventListener("click", exportPNG);
    copyConfigBtn.addEventListener("click", copyConfigJSON);
    resetBtn.addEventListener("click", restoreDefaults);
    clearBtn.addEventListener("click", clearFile);
  }

  init();
})();
