/* ===== claudeOne :: qr.js ===== */
(function () {
  "use strict";

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];
  const toast = window.ClaudeOne?.toast || (() => {});

  /* ---- Default config ---- */
  const DEFAULTS = {
    width: 300,
    height: 300,
    data: "",
    image: "",
    shape: "square",
    margin: 20,
    qrOptions: { typeNumber: 0, mode: undefined, errorCorrectionLevel: "M" },
    imageOptions: { saveAsBlob: false, hideBackgroundDots: true, imageSize: 0.3, crossOrigin: undefined, margin: 5 },
    dotsOptions: { type: "classy-rounded", color: "#6f9bff", roundSize: true, gradient: undefined },
    cornersSquareOptions: { type: "extra-rounded", color: undefined, gradient: undefined },
    cornersDotOptions: { type: "dot", color: undefined, gradient: undefined },
    backgroundOptions: { round: 0, color: "#ffffff" },
  };

  /* ---- State ---- */
  let qrCode = null;
  let logoDataUrl = "";
  let config = JSON.parse(JSON.stringify(DEFAULTS));

  /* ---- Content type helpers ---- */
  function buildContentData() {
    const type = $('input[name="contentType"]:checked')?.value || "url";
    switch (type) {
      case "url":
      case "text":
        return $("[data-content-input]")?.value || "";
      case "wifi": {
        const ssid = $("[data-wifi-ssid]")?.value || "";
        const pass = $("[data-wifi-pass]")?.value || "";
        const enc = $('input[name="wifiEnc"]:checked')?.value || "WPA";
        const hidden = $('[data-toggle="wifiHidden"] input')?.checked || false;
        if (!ssid) return "";
        return `WIFI:T:${enc};S:${ssid};P:${pass};H:${hidden ? "true" : "false"};;`;
      }
      case "email": {
        const to = $("[data-email-to]")?.value || "";
        const subject = $("[data-email-subject]")?.value || "";
        const body = $("[data-email-body]")?.value || "";
        if (!to) return "";
        return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }
      case "phone": {
        const num = $("[data-phone-num]")?.value || "";
        return num ? `tel:${num}` : "";
      }
      case "sms": {
        const num = $("[data-sms-num]")?.value || "";
        const body = $("[data-sms-body]")?.value || "";
        if (!num) return "";
        return `sms:${num}?body=${encodeURIComponent(body)}`;
      }
      default:
        return $("[data-content-input]")?.value || "";
    }
  }

  /* ---- Render a QR instance and wait for async drawing ---- */
  function renderQR(instance, wrap) {
    wrap.innerHTML = "";
    instance.append(wrap);
    return new Promise((resolve) => {
      const canvas = wrap.querySelector("canvas");
      if (!canvas) { resolve(); return; }
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += 100;
        try {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const pixel = ctx.getImageData(0, 0, 1, 1).data;
            if (pixel[3] > 0 || elapsed > 3000) {
              clearInterval(interval);
              resolve();
            }
          }
        } catch (_) {
          // Canvas tainted by logo SVG — rendering is done, just can't read pixels
          clearInterval(interval);
          resolve();
          return;
        }
        if (elapsed > 4000) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }

  /* ---- Update QR code (always recreates to avoid stale state) ---- */
  function updateQR() {
    const data = buildContentData();
    config.data = data;

    if (!data) {
      const wrap = $("[data-qr-canvas]");
      if (wrap) wrap.innerHTML = '<p class="muted" style="text-align:center;padding:var(--space-8)">请先输入内容</p>';
      qrCode = null;
      return;
    }

    const wrap = $("[data-qr-canvas]");
    if (!wrap) return;

    try {
      const instance = new QRCodeStyling(config);
      qrCode = instance;
      renderQR(instance, wrap).catch((e) => {
        console.error("[qr] render failed:", e);
      });
    } catch (e) {
      console.error("[qr]", e);
      toast("生成二维码失败: " + e.message, "err");
      qrCode = null;
    }
  }

  /* ---- Debounced update ---- */
  let updateTimer = null;
  function scheduleUpdate() {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(updateQR, 150);
  }

  /* ---- Sync UI from config ---- */
  function syncUIFromConfig() {
    // Size
    const wSlider = $("[data-width]");
    const hSlider = $("[data-height]");
    if (wSlider) { wSlider.value = config.width; $("[data-width-val]").textContent = config.width; }
    if (hSlider) { hSlider.value = config.height; $("[data-height-val]").textContent = config.height; }

    // Margin
    const mSlider = $("[data-margin]");
    if (mSlider) { mSlider.value = config.margin; $("[data-margin-val]").textContent = config.margin; }

    // Background
    const bgColor = $("[data-bg-color]");
    if (bgColor) { bgColor.value = config.backgroundOptions?.color || "#ffffff"; $("[data-bg-color-hex]").textContent = bgColor.value; }
    const transBg = $('[data-toggle="transparentBg"] input');
    if (transBg) {
      transBg.checked = !config.backgroundOptions?.color;
      $("[data-bg-color-wrap]")?.toggleAttribute("hidden", transBg.checked);
    }

    // Dots
    const dotsType = $('input[name="dotsType"][value="' + (config.dotsOptions?.type || "classy-rounded") + '"]');
    if (dotsType) dotsType.checked = true;
    const dotsColor = $("[data-dots-color]");
    if (dotsColor) { dotsColor.value = config.dotsOptions?.color || "#000000"; $("[data-dots-color-hex]").textContent = dotsColor.value; }

    // Dots gradient
    const hasGrad = !!config.dotsOptions?.gradient;
    const gradToggle = $('[data-toggle="dotsGradient"] input');
    if (gradToggle) {
      gradToggle.checked = hasGrad;
      $("[data-dots-gradient]")?.toggleAttribute("hidden", !hasGrad);
    }
    if (hasGrad) {
      const grad = config.dotsOptions.gradient;
      const gradType = $('input[name="dotsGradType"][value="' + (grad.type || "linear") + '"]');
      if (gradType) gradType.checked = true;
      if (grad.colorStops?.[0]) { $("[data-dots-grad1]").value = grad.colorStops[0].color; $("[data-dots-grad1-hex]").textContent = grad.colorStops[0].color; }
      if (grad.colorStops?.[1]) { $("[data-dots-grad2]").value = grad.colorStops[1].color; $("[data-dots-grad2-hex]").textContent = grad.colorStops[1].color; }
      const rot = $("[data-dots-grad-rotation]");
      if (rot) { rot.value = grad.rotation || 0; $("[data-dots-grad-rotation-val]").innerHTML = (grad.rotation || 0) + "&deg;"; }
    }

    // Corner square
    const csType = $('input[name="cornersSquareType"][value="' + (config.cornersSquareOptions?.type || "extra-rounded") + '"]');
    if (csType) csType.checked = true;
    const csFollow = $('[data-toggle="cornersSquareFollowDots"] input');
    if (csFollow) {
      csFollow.checked = !config.cornersSquareOptions?.color;
      $("[data-corners-square-color-wrap]")?.toggleAttribute("hidden", csFollow.checked);
    }
    if (config.cornersSquareOptions?.color) {
      $("[data-corners-square-color]").value = config.cornersSquareOptions.color;
      $("[data-corners-square-color-hex]").textContent = config.cornersSquareOptions.color;
    }

    // Corner dot
    const cdType = $('input[name="cornersDotType"][value="' + (config.cornersDotOptions?.type || "dot") + '"]');
    if (cdType) cdType.checked = true;
    const cdFollow = $('[data-toggle="cornersDotFollowDots"] input');
    if (cdFollow) {
      cdFollow.checked = !config.cornersDotOptions?.color;
      $("[data-corners-dot-color-wrap]")?.toggleAttribute("hidden", cdFollow.checked);
    }
    if (config.cornersDotOptions?.color) {
      $("[data-corners-dot-color]").value = config.cornersDotOptions.color;
      $("[data-corners-dot-color-hex]").textContent = config.cornersDotOptions.color;
    }

    // Logo
    const logoSize = $("[data-logo-size]");
    if (logoSize) {
      const val = config.imageOptions?.imageSize || 0.3;
      logoSize.value = val;
      $("[data-logo-size-val]").textContent = Math.round(val * 100) + "%";
    }
    const logoMargin = $("[data-logo-margin]");
    if (logoMargin) { logoMargin.value = config.imageOptions?.margin || 5; $("[data-logo-margin-val]").textContent = config.imageOptions?.margin || 5; }
    const logoHideBg = $('[data-toggle="logoHideBg"] input');
    if (logoHideBg) logoHideBg.checked = config.imageOptions?.hideBackgroundDots !== false;

    // ECC
    const eccl = $('input[name="eccl"][value="' + (config.qrOptions?.errorCorrectionLevel || "M") + '"]');
    if (eccl) eccl.checked = true;

    // Content type
    const ct = $('input[name="contentType"][value="url"]');
    if (ct) ct.checked = true;
    const contentInput = $("[data-content-input]");
    if (contentInput && config.data && !config.data.startsWith("WIFI:") && !config.data.startsWith("mailto:") && !config.data.startsWith("tel:") && !config.data.startsWith("sms:")) {
      contentInput.value = config.data;
    }

    // Logo preview
    if (config.image) {
      $("[data-logo-preview]")?.removeAttribute("hidden");
      $("[data-logo-drop-visual]")?.setAttribute("hidden", "");
      $("[data-logo-img]").src = config.image;
      logoDataUrl = config.image;
    }
  }

  /* ---- Content type switching ---- */
  function switchContentType(type) {
    const simple = $("[data-content-simple]");
    const wifi = $("[data-wifi-fields]");
    const email = $("[data-email-fields]");
    const phone = $("[data-phone-fields]");
    const sms = $("[data-sms-fields]");
    const label = $("[data-content-label]");
    const input = $("[data-content-input]");

    // Hide all
    [simple, wifi, email, phone, sms].forEach(el => el && el.setAttribute("hidden", ""));
    $("[data-url-hint]")?.setAttribute("hidden", "");

    switch (type) {
      case "url":
        simple?.removeAttribute("hidden");
        if (label) label.textContent = "网址";
        if (input) input.placeholder = "https://example.com";
        $("[data-url-hint]")?.removeAttribute("hidden");
        break;
      case "text":
        simple?.removeAttribute("hidden");
        if (label) label.textContent = "文本内容";
        if (input) input.placeholder = "输入任意文本...";
        break;
      case "wifi":
        wifi?.removeAttribute("hidden");
        break;
      case "email":
        email?.removeAttribute("hidden");
        break;
      case "phone":
        phone?.removeAttribute("hidden");
        break;
      case "sms":
        sms?.removeAttribute("hidden");
        break;
    }
  }

  /* ---- Presets ---- */
  const PRESETS = {
    default: {
      dotsOptions: { type: "square", color: "#000000", gradient: undefined },
      cornersSquareOptions: { type: "square", color: undefined },
      cornersDotOptions: { type: "square", color: undefined },
      backgroundOptions: { color: "#ffffff", round: 0 },
      imageOptions: { ...DEFAULTS.imageOptions },
    },
    "blue-dots": {
      dotsOptions: { type: "dots", color: "#2563eb", gradient: undefined },
      cornersSquareOptions: { type: "dot", color: "#1d4ed8" },
      cornersDotOptions: { type: "dot", color: "#1d4ed8" },
      backgroundOptions: { color: "#f0f6ff", round: 0 },
    },
    neon: {
      dotsOptions: {
        type: "classy-rounded",
        color: "#00ff88",
        gradient: { type: "linear", rotation: Math.PI / 4, colorStops: [{ offset: 0, color: "#00ff88" }, { offset: 1, color: "#ff00ff" }] },
      },
      cornersSquareOptions: { type: "extra-rounded", color: "#00ff88" },
      cornersDotOptions: { type: "dot", color: "#ff00ff" },
      backgroundOptions: { color: "#0a0a2e", round: 0 },
    },
    "liquid-glass": {
      dotsOptions: {
        type: "classy-rounded",
        color: "#3e3e3e",
        gradient: undefined,
      },
      cornersSquareOptions: { type: "extra-rounded", color: undefined },
      cornersDotOptions: { type: "dot", color: undefined },
      backgroundOptions: { color: "#f3f3f3", round: 0 },
    },
    "soft-ui": {
      dotsOptions: {
        type: "rounded",
        color: "#6f9bff",
        gradient: undefined,
      },
      cornersSquareOptions: { type: "extra-rounded", color: undefined },
      cornersDotOptions: { type: "dot", color: undefined },
      backgroundOptions: { color: "#e6efff", round: 0 },
    },
    warm: {
      dotsOptions: {
        type: "classy-rounded",
        color: "#e07c3e",
        gradient: { type: "linear", rotation: Math.PI / 3, colorStops: [{ offset: 0, color: "#e07c3e" }, { offset: 1, color: "#e03e6c" }] },
      },
      cornersSquareOptions: { type: "extra-rounded", color: "#e07c3e" },
      cornersDotOptions: { type: "dot", color: "#e03e6c" },
      backgroundOptions: { color: "#fff8f2", round: 0 },
    },
    minimal: {
      dotsOptions: { type: "square", color: "#1a1a1a", gradient: undefined },
      cornersSquareOptions: { type: "square", color: "#1a1a1a" },
      cornersDotOptions: { type: "square", color: "#1a1a1a" },
      backgroundOptions: { color: "#ffffff", round: 0 },
    },
    pink: {
      dotsOptions: {
        type: "classy-rounded",
        color: "#ff6b9d",
        gradient: { type: "linear", rotation: 0, colorStops: [{ offset: 0, color: "#ff6b9d" }, { offset: 1, color: "#c44dff" }] },
      },
      cornersSquareOptions: { type: "extra-rounded", color: "#ff6b9d" },
      cornersDotOptions: { type: "dot", color: "#c44dff" },
      backgroundOptions: { color: "#fff5f8", round: 0 },
    },
    tech: {
      dotsOptions: {
        type: "extra-rounded",
        color: "#00d4aa",
        gradient: { type: "linear", rotation: Math.PI / 2, colorStops: [{ offset: 0, color: "#00d4aa" }, { offset: 1, color: "#0066ff" }] },
      },
      cornersSquareOptions: { type: "extra-rounded", color: "#00d4aa" },
      cornersDotOptions: { type: "dot", color: "#0066ff" },
      backgroundOptions: { color: "#0d1117", round: 0 },
    },
  };

  function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;

    // Deep merge preset into config (keeping data, width, height, margin, image)
    const keep = { data: config.data, width: config.width, height: config.height, margin: config.margin, image: config.image, imageOptions: { ...config.imageOptions } };
    config = JSON.parse(JSON.stringify(DEFAULTS));
    Object.assign(config, keep);
    Object.assign(config.dotsOptions, preset.dotsOptions || {});
    if (preset.cornersSquareOptions) config.cornersSquareOptions = { ...config.cornersSquareOptions, ...preset.cornersSquareOptions };
    if (preset.cornersDotOptions) config.cornersDotOptions = { ...config.cornersDotOptions, ...preset.cornersDotOptions };
    if (preset.backgroundOptions) config.backgroundOptions = { ...config.backgroundOptions, ...preset.backgroundOptions };

    syncUIFromConfig();
    recreateQR();
    toast("已应用预设", "ok");
  }

  /* ---- Recreate QR (same as updateQR now, kept for clarity) ---- */
  function recreateQR() {
    updateQR();
  }

  /* ---- Export helpers ---- */
  function getExportScale() {
    const checked = $('input[name="exportScale"]:checked');
    return checked ? parseInt(checked.value, 10) : 2;
  }

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

  async function exportPNG() {
    if (!qrCode || !config.data) { toast("请先生成二维码", "err"); return; }
    const name = ($("[data-export-name]")?.value || "qrcode").replace(/[^a-zA-Z0-9_-]/g, "_");
    const scale = getExportScale();
    try {
      const scaled = { ...config, width: config.width * scale, height: config.height * scale };
      const tmp = new QRCodeStyling(scaled);
      const detached = document.createElement("div");
      detached.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none";
      document.body.appendChild(detached);
      await renderQR(tmp, detached);
      const blob = await tmp.getRawData("png");
      document.body.removeChild(detached);
      if (blob) {
        downloadBlob(blob instanceof Blob ? blob : new Blob([blob], { type: "image/png" }), name + ".png");
        toast("PNG 已导出", "ok");
      } else {
        toast("导出失败：无法生成图片", "err");
      }
    } catch (e) {
      console.error("[qr] export PNG failed:", e);
      toast("导出 PNG 失败: " + e.message, "err");
    }
  }

  async function exportSVG() {
    if (!qrCode || !config.data) { toast("请先生成二维码", "err"); return; }
    const name = ($("[data-export-name]")?.value || "qrcode").replace(/[^a-zA-Z0-9_-]/g, "_");
    try {
      const tmp = new QRCodeStyling(config);
      const detached = document.createElement("div");
      detached.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none";
      document.body.appendChild(detached);
      await renderQR(tmp, detached);
      const raw = await tmp.getRawData("svg");
      document.body.removeChild(detached);
      if (raw) {
        const blob = raw instanceof Blob ? raw : new Blob([raw], { type: "image/svg+xml" });
        downloadBlob(blob, name + ".svg");
        toast("SVG 已导出", "ok");
      } else {
        toast("导出失败：无法生成 SVG", "err");
      }
    } catch (e) {
      console.error("[qr] export SVG failed:", e);
      toast("导出 SVG 失败: " + e.message, "err");
    }
  }

  /* ---- Config JSON ---- */
  function copyConfig() {
    const json = JSON.stringify(config, null, 2);
    navigator.clipboard?.writeText(json).then(() => {
      toast("配置已复制", "ok");
    }).catch(() => {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = json;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast("配置已复制", "ok");
    });
  }

  function showImportConfig() {
    const ta = $("[data-config-json]");
    const actions = $("[data-config-actions]");
    if (ta) { ta.hidden = false; ta.value = ""; ta.focus(); }
    if (actions) actions.hidden = false;
  }

  function hideImportConfig() {
    $("[data-config-json]")?.setAttribute("hidden", "");
    $("[data-config-actions]")?.setAttribute("hidden", "");
  }

  function applyImportConfig() {
    const ta = $("[data-config-json]");
    if (!ta) return;
    try {
      const parsed = JSON.parse(ta.value);
      config = JSON.parse(JSON.stringify(DEFAULTS));
      // Merge imported values
      Object.keys(parsed).forEach(k => {
        if (typeof parsed[k] === "object" && parsed[k] !== null && !Array.isArray(parsed[k])) {
          config[k] = { ...config[k], ...parsed[k] };
        } else {
          config[k] = parsed[k];
        }
      });
      syncUIFromConfig();
      recreateQR();
      hideImportConfig();
      toast("配置已导入", "ok");
    } catch (e) {
      toast("JSON 格式错误: " + e.message, "err");
    }
  }

  function resetDefaults() {
    config = JSON.parse(JSON.stringify(DEFAULTS));
    logoDataUrl = "";
    config.image = "";
    // Reset logo preview
    $("[data-logo-preview]")?.setAttribute("hidden", "");
    $("[data-logo-drop-visual]")?.removeAttribute("hidden");
    $("[data-logo-img]").src = "";
    syncUIFromConfig();
    recreateQR();
    toast("已恢复默认", "ok");
  }

  function clearContent() {
    const input = $("[data-content-input]");
    if (input) input.value = "";
    ["[data-wifi-ssid]", "[data-wifi-pass]", "[data-email-to]", "[data-email-subject]", "[data-email-body]", "[data-phone-num]", "[data-sms-num]", "[data-sms-body]"].forEach(sel => {
      const el = $(sel);
      if (el) el.value = "";
    });
    config.data = "";
    scheduleUpdate();
    toast("内容已清空", "ok");
  }

  /* ---- Logo handling ---- */
  function handleLogoFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      logoDataUrl = e.target.result;
      config.image = logoDataUrl;
      $("[data-logo-preview]")?.removeAttribute("hidden");
      $("[data-logo-drop-visual]")?.setAttribute("hidden", "");
      $("[data-logo-img]").src = logoDataUrl;
      recreateQR();
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    logoDataUrl = "";
    config.image = "";
    $("[data-logo-preview]")?.setAttribute("hidden", "");
    $("[data-logo-drop-visual]")?.removeAttribute("hidden", "");
    $("[data-logo-img]").src = "";
    recreateQR();
  }

  /* ---- Init ---- */
  function init() {
    // Content type switching
    $$('input[name="contentType"]').forEach(radio => {
      radio.addEventListener("change", () => {
        switchContentType(radio.value);
        scheduleUpdate();
      });
    });

    // Content input
    $("[data-content-input]")?.addEventListener("input", scheduleUpdate);

    // WiFi fields
    ["[data-wifi-ssid]", "[data-wifi-pass]"].forEach(sel => {
      $(sel)?.addEventListener("input", scheduleUpdate);
    });
    $$('input[name="wifiEnc"]').forEach(r => r.addEventListener("change", scheduleUpdate));
    $('[data-toggle="wifiHidden"] input')?.addEventListener("change", scheduleUpdate);

    // Email fields
    ["[data-email-to]", "[data-email-subject]", "[data-email-body]"].forEach(sel => {
      $(sel)?.addEventListener("input", scheduleUpdate);
    });

    // Phone
    $("[data-phone-num]")?.addEventListener("input", scheduleUpdate);

    // SMS
    ["[data-sms-num]", "[data-sms-body]"].forEach(sel => {
      $(sel)?.addEventListener("input", scheduleUpdate);
    });

    // URL hint
    $("[data-content-input]")?.addEventListener("input", () => {
      const val = $("[data-content-input]")?.value || "";
      const hint = $("[data-url-hint]");
      if (hint) {
        const isUrl = $('input[name="contentType"]:checked')?.value === "url";
        hint.style.display = (isUrl && val && !val.startsWith("http://") && !val.startsWith("https://") && val.includes(".")) ? "" : "none";
      }
    });

    // Width slider
    $("[data-width]")?.addEventListener("input", (e) => {
      config.width = parseInt(e.target.value, 10);
      $("[data-width-val]").textContent = config.width;
      scheduleUpdate();
    });

    // Height slider
    $("[data-height]")?.addEventListener("input", (e) => {
      config.height = parseInt(e.target.value, 10);
      $("[data-height-val]").textContent = config.height;
      scheduleUpdate();
    });

    // Size presets
    $$("[data-size-preset]").forEach(btn => {
      btn.addEventListener("click", () => {
        const size = parseInt(btn.dataset.sizePreset, 10);
        config.width = size;
        config.height = size;
        $("[data-width]").value = size;
        $("[data-height]").value = size;
        $("[data-width-val]").textContent = size;
        $("[data-height-val]").textContent = size;
        scheduleUpdate();
      });
    });

    // Margin slider
    $("[data-margin]")?.addEventListener("input", (e) => {
      config.margin = parseInt(e.target.value, 10);
      $("[data-margin-val]").textContent = config.margin;
      scheduleUpdate();
    });

    // Transparent bg
    $('[data-toggle="transparentBg"] input')?.addEventListener("change", (e) => {
      if (e.target.checked) {
        config.backgroundOptions.color = "";
        $("[data-bg-color-wrap]")?.setAttribute("hidden", "");
      } else {
        config.backgroundOptions.color = $("[data-bg-color]")?.value || "#ffffff";
        $("[data-bg-color-wrap]")?.removeAttribute("hidden");
      }
      recreateQR();
    });

    // Bg color
    $("[data-bg-color]")?.addEventListener("input", (e) => {
      config.backgroundOptions.color = e.target.value;
      $("[data-bg-color-hex]").textContent = e.target.value;
      scheduleUpdate();
    });

    // Dots type
    $$('input[name="dotsType"]').forEach(radio => {
      radio.addEventListener("change", () => {
        config.dotsOptions.type = radio.value;
        recreateQR();
      });
    });

    // Dots color
    $("[data-dots-color]")?.addEventListener("input", (e) => {
      config.dotsOptions.color = e.target.value;
      $("[data-dots-color-hex]").textContent = e.target.value;
      scheduleUpdate();
    });

    // Dots gradient toggle
    $('[data-toggle="dotsGradient"] input')?.addEventListener("change", (e) => {
      $("[data-dots-gradient]")?.toggleAttribute("hidden", !e.target.checked);
      if (e.target.checked) {
        const c1 = $("[data-dots-grad1]")?.value || "#6f9bff";
        const c2 = $("[data-dots-grad2]")?.value || "#ff6b7a";
        const rot = parseInt($("[data-dots-grad-rotation]")?.value || "0", 10);
        const type = $('input[name="dotsGradType"]:checked')?.value || "linear";
        config.dotsOptions.gradient = {
          type,
          rotation: type === "radial" ? 0 : (rot * Math.PI / 180),
          colorStops: [{ offset: 0, color: c1 }, { offset: 1, color: c2 }],
        };
      } else {
        config.dotsOptions.gradient = undefined;
      }
      recreateQR();
    });

    // Dots gradient type
    $$('input[name="dotsGradType"]').forEach(radio => {
      radio.addEventListener("change", () => {
        if (config.dotsOptions.gradient) {
          config.dotsOptions.gradient.type = radio.value;
          if (radio.value === "radial") config.dotsOptions.gradient.rotation = 0;
        }
        recreateQR();
      });
    });

    // Dots gradient colors
    $("[data-dots-grad1]")?.addEventListener("input", (e) => {
      if (config.dotsOptions.gradient?.colorStops?.[0]) {
        config.dotsOptions.gradient.colorStops[0].color = e.target.value;
        $("[data-dots-grad1-hex]").textContent = e.target.value;
        scheduleUpdate();
      }
    });

    $("[data-dots-grad2]")?.addEventListener("input", (e) => {
      if (config.dotsOptions.gradient?.colorStops?.[1]) {
        config.dotsOptions.gradient.colorStops[1].color = e.target.value;
        $("[data-dots-grad2-hex]").textContent = e.target.value;
        scheduleUpdate();
      }
    });

    // Dots gradient rotation
    $("[data-dots-grad-rotation]")?.addEventListener("input", (e) => {
      const deg = parseInt(e.target.value, 10);
      $("[data-dots-grad-rotation-val]").innerHTML = deg + "&deg;";
      if (config.dotsOptions.gradient) {
        config.dotsOptions.gradient.rotation = deg * Math.PI / 180;
      }
      scheduleUpdate();
    });

    // Corner square type
    $$('input[name="cornersSquareType"]').forEach(radio => {
      radio.addEventListener("change", () => {
        config.cornersSquareOptions.type = radio.value;
        recreateQR();
      });
    });

    // Corner square follow dots
    $('[data-toggle="cornersSquareFollowDots"] input')?.addEventListener("change", (e) => {
      $("[data-corners-square-color-wrap]")?.toggleAttribute("hidden", e.target.checked);
      if (e.target.checked) {
        config.cornersSquareOptions.color = undefined;
      } else {
        config.cornersSquareOptions.color = $("[data-corners-square-color]")?.value || "#6f9bff";
      }
      recreateQR();
    });

    // Corner square color
    $("[data-corners-square-color]")?.addEventListener("input", (e) => {
      config.cornersSquareOptions.color = e.target.value;
      $("[data-corners-square-color-hex]").textContent = e.target.value;
      scheduleUpdate();
    });

    // Corner dot type
    $$('input[name="cornersDotType"]').forEach(radio => {
      radio.addEventListener("change", () => {
        config.cornersDotOptions.type = radio.value;
        recreateQR();
      });
    });

    // Corner dot follow dots
    $('[data-toggle="cornersDotFollowDots"] input')?.addEventListener("change", (e) => {
      $("[data-corners-dot-color-wrap]")?.toggleAttribute("hidden", e.target.checked);
      if (e.target.checked) {
        config.cornersDotOptions.color = undefined;
      } else {
        config.cornersDotOptions.color = $("[data-corners-dot-color]")?.value || "#6f9bff";
      }
      recreateQR();
    });

    // Corner dot color
    $("[data-corners-dot-color]")?.addEventListener("input", (e) => {
      config.cornersDotOptions.color = e.target.value;
      $("[data-corners-dot-color-hex]").textContent = e.target.value;
      scheduleUpdate();
    });

    // Logo upload
    const logoUpload = $("[data-logo-upload]");
    const logoInput = $("[data-logo-input]");

    logoUpload?.addEventListener("dragover", (e) => {
      e.preventDefault();
      logoUpload.dataset.dragover = "true";
    });
    logoUpload?.addEventListener("dragleave", () => {
      logoUpload.dataset.dragover = "false";
    });
    logoUpload?.addEventListener("drop", (e) => {
      e.preventDefault();
      logoUpload.dataset.dragover = "false";
      const file = e.dataTransfer?.files?.[0];
      if (file) handleLogoFile(file);
    });

    logoInput?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) handleLogoFile(file);
      e.target.value = "";
    });

    $("[data-remove-logo]")?.addEventListener("click", removeLogo);

    // Logo size
    $("[data-logo-size]")?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      config.imageOptions.imageSize = val;
      $("[data-logo-size-val]").textContent = Math.round(val * 100) + "%";
      scheduleUpdate();
    });

    // Logo margin
    $("[data-logo-margin]")?.addEventListener("input", (e) => {
      config.imageOptions.margin = parseInt(e.target.value, 10);
      $("[data-logo-margin-val]").textContent = config.imageOptions.margin;
      scheduleUpdate();
    });

    // Logo hide bg dots
    $('[data-toggle="logoHideBg"] input')?.addEventListener("change", (e) => {
      config.imageOptions.hideBackgroundDots = e.target.checked;
      recreateQR();
    });

    // Error correction level
    $$('input[name="eccl"]').forEach(radio => {
      radio.addEventListener("change", () => {
        config.qrOptions.errorCorrectionLevel = radio.value;
        recreateQR();
      });
    });

    // Presets
    $$("[data-preset]").forEach(btn => {
      btn.addEventListener("click", () => {
        $$("[data-preset]").forEach(b => b.removeAttribute("data-active"));
        btn.setAttribute("data-active", "true");
        applyPreset(btn.dataset.preset);
      });
    });

    // Export
    $("[data-export-png]")?.addEventListener("click", exportPNG);
    $("[data-export-svg]")?.addEventListener("click", exportSVG);

    // Config
    $("[data-copy-config]")?.addEventListener("click", copyConfig);
    $("[data-import-config]")?.addEventListener("click", showImportConfig);
    $("[data-apply-config]")?.addEventListener("click", applyImportConfig);
    $("[data-cancel-config]")?.addEventListener("click", hideImportConfig);
    $("[data-reset-defaults]")?.addEventListener("click", resetDefaults);
    $("[data-clear-content]")?.addEventListener("click", clearContent);

    // Export scale pills
    $$("[data-export-scale]").forEach(radio => {
      radio.addEventListener("change", () => {
        // Scale change is read at export time, no action needed
      });
    });

    // Segmented control pill styling (compress-style)
    setupSegPills();

    // Initial sync
    syncUIFromConfig();
    updateQR();
  }

  /* ---- Segmented pill styling ---- */
  function setupSegPills() {
    // All segmented groups: style active label
    $$(".qr-seg").forEach(group => {
      const radios = $$('input[type="radio"]', group);
      radios.forEach(r => {
        r.addEventListener("change", () => {
          radios.forEach(rr => {
            rr.parentElement.removeAttribute("data-active");
          });
          if (r.checked) r.parentElement.setAttribute("data-active", "true");
        });
        // Init
        if (r.checked) r.parentElement.setAttribute("data-active", "true");
      });
    });
  }

  /* ---- Boot ---- */
  document.addEventListener("DOMContentLoaded", init);
})();
