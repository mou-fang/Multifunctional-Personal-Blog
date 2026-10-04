(function () {
  "use strict";
  const C = window.ColorToolsCore;
  const DRAFT_KEY = "claudeOne:colors:draft:v1", SAVED_KEY = "claudeOne:colors:saved:v1";
  let root, ac, state, saved, deleted, screenController, bitmap, worker, extractTimer;
  let imageJob = 0, extractJob = 0, undo = [], redo = [], imageMode = "pick", crop = null, drag = null, point = { x: .5, y: .5 };
  let extracted = [], gradientStops = [], gradientValid = true, draggedIndex = -1;
  const urls = new Set();
  const $ = selector => root.querySelector(selector), $$ = selector => [...root.querySelectorAll(selector)];
  const listen = (target, event, fn) => target.addEventListener(event, fn, { signal: ac.signal });
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(text, action) { const b = element("button", "btn btn-sm", text); b.type = "button"; if (action) b.dataset.ctAction = action; return b; }
  function message(text, error = false) { if (!root) return; $("[data-ct-status]").textContent = text; $("[data-ct-status]").dataset.error = String(error); }
  function positionHelp() {
    const panel = $("[data-ct-help-panel]"); if (panel.hidden) return;
    panel.style.width = Math.min(360, document.documentElement.clientWidth - 32) + "px";
    const rect = $("[data-ct-help-toggle]").getBoundingClientRect(), width = panel.getBoundingClientRect().width;
    if (rect.bottom < 0 || rect.top >= window.innerHeight) { closeHelp(); return; }
    panel.style.left = Math.max(16, Math.min(rect.right - width, document.documentElement.clientWidth - width - 16)) + "px";
    panel.style.top = rect.bottom + 10 + "px";
    panel.style.maxHeight = Math.min(440, Math.max(100, window.innerHeight - rect.bottom - 26)) + "px";
  }
  function closeHelp(restoreFocus = false) {
    const panel = $("[data-ct-help-panel]"), toggle = $("[data-ct-help-toggle]");
    if (typeof panel.hidePopover === "function" && panel.matches(":popover-open")) panel.hidePopover();
    panel.hidden = true; toggle.setAttribute("aria-expanded", "false");
    if (restoreFocus) toggle.focus({ preventScroll: true });
  }
  function toggleHelp() {
    const panel = $("[data-ct-help-panel]");
    if (!panel.hidden) { closeHelp(); return; }
    panel.hidden = false; positionHelp();
    if (typeof panel.showPopover === "function") { panel.showPopover(); positionHelp(); }
    $("[data-ct-help-toggle]").setAttribute("aria-expanded", "true"); panel.focus({ preventScroll: true });
  }
  function readStorage(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; } }
  function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { $("[data-ct-draft-state]").textContent = "当前浏览器暂不能保存，请导出备份"; return false; }
  }
  function persist() {
    const ok = writeStorage(DRAFT_KEY, { palette: state.palette, current: state.current, note: $("[data-ct-note]").value, savedId: state.savedId });
    if (ok) $("[data-ct-draft-state]").textContent = "草稿已自动保存在当前浏览器";
    return ok;
  }
  function snapshot() { return JSON.stringify({ palette: state.palette, selected: state.selected, savedId: state.savedId }); }
  function commit(fn) {
    const before = snapshot(); fn();
    if (before !== snapshot()) { undo.push(before); if (undo.length > 60) undo.shift(); redo = []; }
    renderPalette(); persist();
  }
  function restore(value) {
    const data = JSON.parse(value);
    state.palette = C.normalizePalette(data.palette); state.selected = data.selected; state.savedId = data.savedId;
    if (state.selected >= state.palette.colors.length) state.selected = -1;
    if (state.selected >= 0) { const color = state.palette.colors[state.selected]; setColor(color.hex, color.label, "选中的色卡"); }
    renderPalette(); persist();
  }
  function suggestions(container, values, source) {
    container.replaceChildren();
    values.forEach((value, i) => {
      const hex = typeof value === "string" ? value : value.hex;
      const b = element("button", "ct-suggestion"); b.type = "button"; b.dataset.ctSuggest = hex; b.dataset.ctSource = source;
      b.setAttribute("aria-label", `查看颜色 ${hex}`);
      const paint = element("span", "ct-suggestion-paint"); paint.style.backgroundColor = hex;
      b.append(paint, element("code", "", hex));
      if (source === "image") b.append(element("small", "", `约 ${(value.proportion * 100).toFixed(1)}%`));
      else b.append(element("small", "", hex === state.current ? "当前主色" : `搭配 ${i + 1}`));
      container.append(b);
    });
  }
  function renderCurrent(updateSliders = true) {
    const values = C.formats(state.current), paint = $("[data-ct-current]");
    paint.style.backgroundColor = state.current; paint.style.color = C.ink(state.current);
    $("[data-ct-current-hex]").textContent = state.current;
    $("[data-ct-color]").value = state.current;
    $("[data-ct-value]").value = state.current; $("[data-ct-value]").removeAttribute("aria-invalid");
    $("[data-ct-add]").disabled = state.palette.colors.length >= C.MAX_COLORS;
    $("[data-ct-update]").disabled = false;
    for (const key of ["hex", "rgb", "hsl"]) $(`[data-ct-${key}]`).textContent = values[key];
    if (updateSliders) {
      const values = C.hsl(state.current);
      ["h", "s", "l"].forEach((key, i) => { $(`[data-ct-${key}]`).value = Math.round(values[i]) % (i === 0 ? 360 : 101); });
    }
    ["h", "s", "l"].forEach(key => { $(`[data-ct-${key}-out]`).textContent = $(`[data-ct-${key}]`).value + (key === "h" ? "°" : "%"); });
    suggestions($("[data-ct-harmony]"), C.harmony(state.current, $("[data-ct-harmony-type]").value), "harmony");
    renderVision();
  }
  function setColor(hex, note, source = "可点击色块调整") {
    const value = C.parse(hex); if (!value) return;
    state.current = value;
    if (note !== undefined) $("[data-ct-note]").value = note;
    $("[data-ct-current-label]").textContent = source;
    renderCurrent(); persist();
  }
  function selectIndex(index) {
    state.selected = index;
    const color = state.palette.colors[index];
    if (color) setColor(color.hex, color.label, "选中的色卡");
    renderPalette();
  }
  function renderPalette() {
    const colors = state.palette.colors, container = $("[data-ct-swatches]");
    const focused = document.activeElement?.closest?.("[data-ct-select]");
    const focusIndex = focused && root.contains(focused) ? Number(focused.dataset.ctSelect) : -1;
    $("[data-ct-palette-name]").value = state.palette.name;
    $("[data-ct-palette-count]").textContent = `${colors.length} 色`;
    $("[data-ct-empty]").hidden = colors.length > 0;
    container.replaceChildren();
    colors.forEach((color, i) => {
      const item = element("article", "ct-swatch"); item.dataset.ctIndex = i;
      const b = element("button", "ct-swatch-color"); b.type = "button"; b.dataset.ctSelect = i;
      b.setAttribute("aria-pressed", String(i === state.selected)); b.setAttribute("aria-label", `选择 ${color.label || "颜色 " + (i + 1)} ${color.hex}`);
      const paint = element("span", "ct-swatch-paint"); paint.style.backgroundColor = color.hex;
      b.append(paint, element("span", "ct-swatch-label", color.label || `颜色 ${i + 1}`), element("code", "ct-swatch-hex", color.hex));
      const handle = element("button", "ct-reorder", "⠿"); handle.type = "button"; handle.draggable = true; handle.dataset.ctDrag = i; handle.setAttribute("aria-label", `拖动颜色 ${i + 1} 排序，也可选中后使用前移和后移`);
      item.append(b, handle); container.append(item);
    });
    if (focusIndex >= 0) $(`[data-ct-select="${Math.min(focusIndex, colors.length - 1)}"]`)?.focus();
    const hasSelection = state.selected >= 0 && state.selected < colors.length;
    $("[data-ct-selection]").hidden = !hasSelection; $("[data-ct-update]").hidden = !hasSelection;
    if (hasSelection) $("[data-ct-selected-name]").textContent = `已选：${colors[state.selected].label || "颜色 " + (state.selected + 1)} · 在“当前颜色”里修改，点击“更新选中色”`;
    $("[data-ct-move='-1']").disabled = !hasSelection || state.selected === 0;
    $("[data-ct-move='1']").disabled = !hasSelection || state.selected === colors.length - 1;
    $("[data-ct-undo]").disabled = undo.length === 0; $("[data-ct-redo]").disabled = redo.length === 0;
    for (const key of ["save", "export", "copy-all"]) $(`[data-ct-${key}]`).disabled = colors.length === 0;
    const invalid = $("[data-ct-value]").getAttribute("aria-invalid") === "true";
    $("[data-ct-add]").disabled = colors.length >= C.MAX_COLORS || invalid;
    $("[data-ct-update]").disabled = invalid;
    $("[data-ct-preview-area]").hidden = colors.length === 0;
    $("[data-ct-ribbon]").replaceChildren(...colors.map(c => { const s = element("span"); s.style.backgroundColor = c.hex; s.title = c.label || c.hex; return s; }));
    $("[data-ct-saved-count]").textContent = saved.length;
    renderVision();
  }
  function addColors(values) {
    const existing = new Set(state.palette.colors.map(c => c.hex));
    const additions = values.map(value => ({ hex: C.parse(typeof value === "string" ? value : value.hex), label: "" })).filter(c => c.hex && !existing.has(c.hex) && (existing.add(c.hex), true));
    if (!additions.length) { message("这些颜色已经在色卡里了。"); return; }
    const room = C.MAX_COLORS - state.palette.colors.length;
    if (!room) { message("一套色卡最多 40 色。可以新建另一套配色。", true); return; }
    commit(() => { state.palette.colors.push(...additions.slice(0, room)); state.selected = -1; });
    message(`已加入 ${Math.min(room, additions.length)} 个颜色。${room < additions.length ? "色卡已达到 40 色上限。" : "可选中色卡添加备注。"}`);
  }
  async function copy(text) {
    const page = root;
    try { await navigator.clipboard.writeText(text); if (root === page) message("已复制。"); }
    catch (_) {
      if (root !== page) return;
      const area = element("textarea"); area.value = text; area.className = "sr-only";
      const previous = document.activeElement; root.append(area); area.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch (_) { /* Manual fallback below. */ }
      area.remove(); previous?.focus();
      if (ok) message("已复制。");
      else { $("[data-ct-value]").focus(); $("[data-ct-value]").select(); message("浏览器未允许复制，请选择颜色值后按 Ctrl / ⌘ + C。", true); }
    }
  }
  function fileName(ext) { return (state.palette.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim().slice(0, 70) || "我的配色") + "." + ext; }
  function download(blob, name) {
    const page = root;
    for (const previous of urls) URL.revokeObjectURL(previous); urls.clear();
    const url = URL.createObjectURL(blob); urls.add(url);
    const link = $("[data-ct-download]"); link.href = url; link.download = name; link.textContent = name;
    $("[data-ct-download-row]").hidden = false; link.click();
    const preview = $("[data-ct-export-content]"); preview.replaceChildren(); $("[data-ct-export-preview]").hidden = false;
    if (blob.type.startsWith("image/")) { const img = element("img"); img.src = url; img.alt = name + " 导出预览"; preview.append(img); }
    else blob.text().then(text => { if (root === page && urls.has(url)) preview.replaceChildren(element("pre", "", text)); });
  }
  function clipped(ctx, text, width) {
    let result = text;
    if (ctx.measureText(result).width <= width) return result;
    const chars = [...result];
    while (chars.length && ctx.measureText(chars.join("") + "…").width > width) chars.pop();
    return chars.join("") + "…";
  }
  function canvasBlob(canvas) { return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("图片导出失败，请重试。")), "image/png")); }
  async function exportPalette() {
    if (!state.palette.colors.length) return;
    const page = root, palette = C.normalizePalette(state.palette), type = $("[data-ct-export-format]").value, name = fileName(type);
    try {
      let blob;
      if (type === "json") blob = new Blob([JSON.stringify(palette, null, 2)], { type: "application/json" });
      else if (type === "css") blob = new Blob([C.cssPalette(palette)], { type: "text/css" });
      else if (type === "svg") blob = new Blob([C.svgPalette(palette)], { type: "image/svg+xml" });
      else {
        const layout = C.exportLayout(palette.colors.length), canvas = element("canvas"); canvas.width = layout.width; canvas.height = layout.height;
        const ctx = canvas.getContext("2d"); ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#1E293B"; ctx.font = "700 32px system-ui, sans-serif"; ctx.fillText(clipped(ctx, palette.name, 1120), 40, 65);
        ctx.fillStyle = "#475569"; ctx.font = "16px system-ui, sans-serif"; ctx.fillText(`${palette.colors.length} 色 · sRGB · 魔方的妙妙工具`, 40, 100);
        palette.colors.forEach((c, i) => {
          const x = 40 + (i % layout.columns) * layout.cellWidth, y = 135 + Math.floor(i / layout.columns) * 260, width = layout.cellWidth - 16;
          ctx.fillStyle = c.hex; ctx.fillRect(x, y, width, 164);
          ctx.fillStyle = "#1E293B"; ctx.font = "18px system-ui, sans-serif"; ctx.fillText(clipped(ctx, c.label || `颜色 ${i + 1}`, width - 24), x + 12, y + 197);
          ctx.fillStyle = "#475569"; ctx.font = "16px Consolas, monospace"; ctx.fillText(c.hex, x + 12, y + 225);
        });
        blob = await canvasBlob(canvas); canvas.width = canvas.height = 1;
      }
      if (root !== page) return;
      download(blob, name); message(`${type.toUpperCase()} 文件已生成${type === "json" ? "，可用于备份和导入。" : "。"}`);
    } catch (error) { if (root === page) message(error.message || "导出失败，请重试。", true); }
  }
  function renderLibrary() {
    const list = $("[data-ct-saved-list]"); list.replaceChildren();
    if (!saved.length) list.append(element("p", "ct-hint", "还没有保存的配色。先加入颜色，再点击“保存方案”。"));
    saved.forEach(item => {
      const card = element("article", "ct-saved-item"), strip = element("div", "ct-saved-strip"), actions = element("div", "ct-row");
      item.colors.forEach(c => { const paint = element("span"); paint.style.backgroundColor = c.hex; strip.append(paint); });
      for (const [action, label] of [["load", "打开"], ["duplicate", "打开副本"], ["remove", "删除"]]) { const b = button(label); b.dataset.ctSavedAction = action; b.dataset.ctSavedId = item.id; actions.append(b); }
      card.append(element("h3", "", item.name), strip, actions); list.append(card);
    });
    $("[data-ct-library-undo]").hidden = !deleted;
    $("[data-ct-saved-count]").textContent = saved.length;
  }
  function savePalette() {
    if (!state.palette.colors.length) return;
    const index = saved.findIndex(item => item.id === state.savedId);
    if (index < 0 && saved.length >= 30) { message("最多保存 30 套方案。请先导出或删除不需要的方案。", true); return; }
    const item = { ...C.normalizePalette(state.palette), id: index >= 0 ? state.savedId : (window.crypto?.randomUUID?.() || `palette-${Date.now()}-${Math.random().toString(36).slice(2)}`), updated: new Date().toISOString() };
    const next = [...saved]; if (index >= 0) next[index] = item; else next.unshift(item);
    if (!writeStorage(SAVED_KEY, next)) { message("浏览器暂不能保存，请使用导出备份。", true); return; }
    saved = next; state.savedId = item.id; renderLibrary(); persist(); message(`已${index >= 0 ? "更新" : "保存"}“${item.name}”。`);
  }
  async function importPalette(file) {
    if (!file) return;
    if (file.size > 256 * 1024) { message("JSON 色卡过大，请选择小于 256 KB 的文件。", true); return; }
    const page = root;
    try {
      const content = await file.text(); if (root !== page) return;
      const palette = C.normalizePalette(JSON.parse(content));
      if (!palette.colors.length) throw new Error("这份色卡没有颜色。");
      commit(() => { state.palette = palette; state.selected = -1; state.savedId = null; });
      setColor(palette.colors[0].hex, palette.colors[0].label, "导入的色卡");
      $("[data-ct-dialog]").close(); message(`已导入“${palette.name}”，共 ${palette.colors.length} 色。`);
    } catch (error) { if (root === page) { const text = error instanceof SyntaxError ? "JSON 无法读取，请选择颜色工具导出的色卡。" : error.message; $("[data-ct-library-status]").textContent = text; message(text, true); } }
  }
  function cancelExtraction() {
    extractJob++; clearTimeout(extractTimer); extractTimer = null;
    if (worker) worker.terminate(); worker = null;
    if (root) { $("[data-ct-image]").removeAttribute("aria-busy"); $("[data-ct-extracted-add]").disabled = true; }
  }
  function clearImage(announce = false) {
    imageJob++; cancelExtraction();
    if (bitmap) bitmap.close(); bitmap = null; crop = null; drag = null; extracted = [];
    if (root) {
      $("[data-ct-image]").hidden = true; $("[data-ct-extracted]").replaceChildren();
      const canvas = $("[data-ct-canvas]"); canvas.width = canvas.height = 1;
      $("[data-ct-crop]").hidden = true; $("[data-ct-crosshair]").hidden = true;
      root.removeAttribute("aria-busy"); if (announce) message("已移除图片，色卡仍然保留。");
    }
  }
  function drawCrop(region = crop) {
    const overlay = $("[data-ct-crop]"); overlay.hidden = !region;
    if (region) { overlay.style.left = region.x * 100 + "%"; overlay.style.top = region.y * 100 + "%"; overlay.style.width = region.width * 100 + "%"; overlay.style.height = region.height * 100 + "%"; }
    const values = region || { x: 0, y: 0, width: 1, height: 1 };
    for (const key of ["x", "y", "width", "height"]) $(`[data-ct-region="${key}"]`).value = Math.round(values[key] * 1000) / 10;
  }
  function extractImage() {
    if (!bitmap || !root) return;
    cancelExtraction(); extracted = []; $("[data-ct-extracted]").replaceChildren();
    const id = extractJob, r = crop || { x: 0, y: 0, width: 1, height: 1 };
    const width = Math.max(1, Math.round(bitmap.width * r.width)), height = Math.max(1, Math.round(bitmap.height * r.height));
    const scale = Math.min(1, 280 / Math.max(width, height));
    const sample = element("canvas"); sample.width = Math.max(1, Math.round(width * scale)); sample.height = Math.max(1, Math.round(height * scale));
    const ctx = sample.getContext("2d", { willReadFrequently: true }); ctx.drawImage(bitmap, bitmap.width * r.x, bitmap.height * r.y, width, height, 0, 0, sample.width, sample.height);
    const data = ctx.getImageData(0, 0, sample.width, sample.height);
    $("[data-ct-extract-status]").textContent = "正在提取配色…"; $("[data-ct-image]").setAttribute("aria-busy", "true");
    const fail = text => { if (!root || id !== extractJob) return; cancelExtraction(); $("[data-ct-extract-status]").textContent = text; message(text, true); };
    try {
      worker = new Worker(new URL("js/color-tools-worker.js", document.baseURI));
      worker.onmessage = ({ data }) => {
        if (!root || id !== extractJob || data.id !== id) return;
        if (data.error) { fail(data.error); return; }
        clearTimeout(extractTimer); worker.terminate(); worker = null; $("[data-ct-image]").removeAttribute("aria-busy");
        extracted = data.colors.filter(c => C.parse(c.hex));
        suggestions($("[data-ct-extracted]"), extracted, "image"); $("[data-ct-extracted-add]").disabled = !extracted.length;
        $("[data-ct-extract-status]").textContent = extracted.length ? `${crop ? "选区" : "整张图片"} · 提取 ${extracted.length} 色` : "区域内没有可提取的颜色";
      };
      worker.onerror = () => fail("配色组件未能运行，请刷新页面后重试。");
      extractTimer = setTimeout(() => fail("提取超时，请缩小选区后重试。"), 20000);
      worker.postMessage({ id, buffer: data.data.buffer, width: sample.width, height: sample.height, count: Number($("[data-ct-count]").value) }, [data.data.buffer]);
    } catch (_) { fail("此浏览器暂不能提取配色，仍可直接点击图片取色。"); }
    sample.width = sample.height = 1;
  }
  async function loadImage(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif|bmp|x-ms-bmp)$/i.test(file.type) && !(file.type === "" && /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name))) { message("请选择 PNG、JPG、WebP、GIF 或 BMP 图片。", true); return; }
    if (file.size > 20 * 1024 * 1024) { message("图片超过 20 MB，请压缩后再试。", true); return; }
    clearImage(); const id = imageJob; root.setAttribute("aria-busy", "true"); message("正在读取图片…");
    try {
      const next = await createImageBitmap(file);
      if (!root || id !== imageJob) { next.close(); return; }
      if (next.width * next.height > 40000000) { next.close(); throw new Error("图片超过 4000 万像素，请缩小后再试。"); }
      bitmap = next; point = { x: .5, y: .5 }; imageMode = "pick";
      const canvas = $("[data-ct-canvas]"), scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale)); canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      $(".ct-canvas-wrap").style.maxWidth = Math.min(1200, 460 * bitmap.width / bitmap.height) + "px";
      $("[data-ct-image-name]").textContent = `${file.name || "粘贴的图片"} · ${bitmap.width} × ${bitmap.height}`;
      $("[data-ct-image]").hidden = false; root.removeAttribute("aria-busy"); drawCrop();
      $$('[data-ct-image-mode]').forEach(b => b.setAttribute("aria-pressed", String(b.dataset.ctImageMode === "pick")));
      message("图片已就绪。点图片取色，或框选区域提取配色。"); extractImage();
    } catch (error) {
      if (!root || id !== imageJob) return;
      root.removeAttribute("aria-busy"); message(error.message?.includes("4000") ? error.message : "图片无法读取，文件可能损坏或格式不受支持。请换一张图片。", true);
    }
  }
  function acceptFiles(files) { if (files.length > 1) { message("请每次放入一张图片。", true); return; } loadImage(files[0]); }
  function position(event) { const rect = $("[data-ct-canvas]").getBoundingClientRect(); return { x: C.clamp((event.clientX - rect.left) / rect.width), y: C.clamp((event.clientY - rect.top) / rect.height) }; }
  function pixelAt(p, apply = false) {
    if (!bitmap) return;
    const x = Math.min(bitmap.width - 1, Math.floor(p.x * bitmap.width)), y = Math.min(bitmap.height - 1, Math.floor(p.y * bitmap.height));
    const sample = element("canvas"); sample.width = sample.height = 1; const ctx = sample.getContext("2d", { willReadFrequently: true }); ctx.drawImage(bitmap, x, y, 1, 1, 0, 0, 1, 1);
    const rgba = ctx.getImageData(0, 0, 1, 1).data, hex = C.toHex([...rgba].slice(0, 3));
    $("[data-ct-pixel]").textContent = `${x + 1}, ${y + 1} · ${rgba[3] ? hex : "透明像素"}${rgba[3] > 0 && rgba[3] < 255 ? " · 半透明，读取原始 RGB" : ""}`;
    const cursor = $("[data-ct-crosshair]"); cursor.hidden = false; cursor.style.left = p.x * 100 + "%"; cursor.style.top = p.y * 100 + "%";
    if (apply) { if (!rgba[3]) message("这个位置是透明的，请点有颜色的区域。", true); else { setColor(hex, undefined, "来自图片"); message(`已取到 ${hex}，可以加入色卡。`); } }
  }
  async function screenPick() {
    if (!window.isSecureContext || typeof window.EyeDropper !== "function") { message("屏幕取色需要桌面 Chrome / Edge，以及 HTTPS 或 localhost。当前可以上传图片取色。", true); return; }
    const page = root; screenController?.abort(); screenController = new AbortController();
    const controller = screenController; $("[data-ct-screen]").disabled = true; message("请点击屏幕上的颜色，按 Esc 取消。");
    try {
      const result = await new EyeDropper().open({ signal: controller.signal });
      if (root !== page || controller.signal.aborted) return;
      setColor(result.sRGBHex, undefined, "来自屏幕"); message(`已取到 ${state.current}，可以加入色卡。`);
    } catch (error) { if (root === page && !controller.signal.aborted) message(error.name === "AbortError" ? "已取消取色，颜色没有改变。" : "屏幕取色未能完成，请重试或上传图片。", error.name !== "AbortError"); }
    finally { if (root === page) $("[data-ct-screen]").disabled = false; if (screenController === controller) screenController = null; }
  }
  function renderGradient(rebuild = true) {
    if (rebuild) {
      const stops = $("[data-ct-stops]"); stops.replaceChildren();
      gradientStops.forEach((stop, i) => {
        const card = element("div", "ct-stop"), colorLabel = element("label", "", `颜色 ${i + 1}`), posLabel = element("label", "", "位置 %");
        const color = element("input"); color.type = "color"; color.value = stop.hex; color.dataset.ctStopColor = i;
        const pos = element("input", "input"); pos.type = "number"; pos.min = "0"; pos.max = "100"; pos.step = "1"; pos.value = stop.pos; pos.dataset.ctStopPos = i;
        const remove = element("button", "", "移除节点"); remove.type = "button"; remove.dataset.ctStopRemove = i; remove.disabled = gradientStops.length <= 2;
        colorLabel.append(color); posLabel.append(pos); card.append(colorLabel, posLabel, remove); stops.append(card);
      });
    }
    const css = C.gradient(gradientStops, $("[data-ct-gradient-type]").value, $("[data-ct-gradient-angle]").value);
    $("[data-ct-gradient-preview]").style.background = css; $("[data-ct-gradient-code]").textContent = `background: ${css};`;
    $("[data-ct-gradient-add]").disabled = gradientStops.length >= 8;
    $("[data-ct-gradient-angle]").disabled = $("[data-ct-gradient-type]").value === "radial";
    gradientValid = !$("[data-ct-stops] [aria-invalid='true']") && ($("[data-ct-gradient-type]").value === "radial" || !$("[data-ct-gradient-angle]").hasAttribute("aria-invalid"));
    $("[data-ct-gradient-copy]").disabled = $("[data-ct-gradient-export]").disabled = !gradientValid;
  }
  async function exportGradient() {
    if (!gradientValid) return;
    const page = root, canvas = element("canvas"); canvas.width = 1200; canvas.height = 675;
    const ctx = canvas.getContext("2d"), radial = $("[data-ct-gradient-type]").value === "radial", angle = Number($("[data-ct-gradient-angle]").value) * Math.PI / 180;
    const dx = Math.sin(angle), dy = -Math.cos(angle), length = Math.abs(1200 * dx) + Math.abs(675 * dy);
    const fill = radial ? ctx.createRadialGradient(600, 337.5, 0, 600, 337.5, Math.hypot(600, 337.5)) : ctx.createLinearGradient(600 - dx * length / 2, 337.5 - dy * length / 2, 600 + dx * length / 2, 337.5 + dy * length / 2);
    [...gradientStops].sort((a, b) => a.pos - b.pos).forEach(s => fill.addColorStop(s.pos / 100, s.hex)); ctx.fillStyle = fill; ctx.fillRect(0, 0, 1200, 675);
    try { const blob = await canvasBlob(canvas); if (root === page) { download(blob, "渐变配色.png"); message("渐变 PNG 文件已生成。"); } } catch (error) { if (root === page) message(error.message, true); }
    canvas.width = canvas.height = 1;
  }
  function renderContrast() {
    const fg = $("[data-ct-contrast-fg]").value, bg = $("[data-ct-contrast-bg]").value, ratio = C.contrast(fg, bg);
    $("[data-ct-contrast-preview]").style.color = fg; $("[data-ct-contrast-preview]").style.backgroundColor = bg;
    $("[data-ct-ratio]").textContent = ratio.toFixed(2) + " : 1";
    for (const [key, threshold, label] of [["aa", 4.5, "AA 正文"], ["large", 3, "AA 大字"], ["aaa", 7, "AAA 正文"]]) $(`[data-ct-contrast-${key}]`).textContent = `${ratio >= threshold ? "✓ 通过" : "× 未通过"} ${label}`;
  }
  function renderVision() {
    const container = $("[data-ct-vision]"); if (!container) return;
    const colors = state.palette.colors.length ? state.palette.colors : [{ hex: state.current }]; container.replaceChildren();
    for (const [type, label] of [["normal", "原始配色"], ["protan", "红色觉预览"], ["deutan", "绿色觉预览"], ["tritan", "蓝色觉预览"], ["gray", "灰度"]]) {
      const row = element("div", "ct-vision-row"), strip = element("div", "ct-vision-strip");
      colors.forEach(c => { const paint = element("span"); const hex = C.simulate(c.hex, type); paint.style.backgroundColor = hex; paint.title = hex; strip.append(paint); });
      row.append(element("span", "", label), strip); container.append(row);
    }
  }
  function setTab(name, focus = false) {
    $$('[data-ct-tab]').forEach(b => { const active = b.dataset.ctTab === name; b.setAttribute("aria-selected", String(active)); b.tabIndex = active ? 0 : -1; if (active && focus) b.focus(); });
    $$('[data-ct-tool]').forEach(panel => { panel.hidden = panel.dataset.ctTool !== name; });
  }
  function bindActions() {
    listen($("[data-ct-help-toggle]"), "click", toggleHelp);
    listen($("[data-ct-help-close]"), "click", () => closeHelp(true));
    listen($("[data-ct-help-panel]"), "toggle", event => { if (event.newState === "closed") { $("[data-ct-help-panel]").hidden = true; $("[data-ct-help-toggle]").setAttribute("aria-expanded", "false"); } });
    listen(document, "pointerdown", event => { if (!$("[data-ct-help-panel]").hidden && !$("[data-ct-help]").contains(event.target)) closeHelp(); });
    listen(document, "focusin", event => { if (!$("[data-ct-help-panel]").hidden && !$("[data-ct-help]").contains(event.target)) closeHelp(); });
    listen(document, "keydown", event => { if (event.key === "Escape" && !$("[data-ct-help-panel]").hidden) { event.preventDefault(); closeHelp(true); } });
    listen(window, "resize", positionHelp); listen(window, "scroll", positionHelp);
    listen(root, "click", event => {
      const b = event.target.closest("button"); if (!b || !root.contains(b)) return;
      if (b.hasAttribute("data-ct-select")) selectIndex(Number(b.dataset.ctSelect));
      else if (b.hasAttribute("data-ct-suggest")) { setColor(b.dataset.ctSuggest, undefined, b.dataset.ctSource === "image" ? "图片提取的颜色" : "自动配色"); message("已选中颜色，可加入色卡或更新选中色。"); }
      else if (b.hasAttribute("data-ct-copy")) copy(C.formats(state.current)[b.dataset.ctCopy]);
      else if (b.hasAttribute("data-ct-move")) {
        const target = state.selected + Number(b.dataset.ctMove); if (target < 0 || target >= state.palette.colors.length) return;
        commit(() => { const [color] = state.palette.colors.splice(state.selected, 1); state.palette.colors.splice(target, 0, color); state.selected = target; }); message("已调整色卡顺序。");
      } else if (b.hasAttribute("data-ct-background")) { $("[data-ct-ribbon-wrap]").style.backgroundColor = b.dataset.ctBackground; $$('[data-ct-background]').forEach(item => item.setAttribute("aria-pressed", String(item === b))); }
      else if (b.hasAttribute("data-ct-tab")) setTab(b.dataset.ctTab);
      else if (b.hasAttribute("data-ct-image-mode")) { imageMode = b.dataset.ctImageMode; $$('[data-ct-image-mode]').forEach(item => item.setAttribute("aria-pressed", String(item === b))); message(imageMode === "crop" ? "在图片上拖出一个矩形，只提取这个区域的颜色。" : "点击图片取色；方向键和 Enter 也可以操作。"); }
      else if (b.hasAttribute("data-ct-stop-remove")) { gradientStops.splice(Number(b.dataset.ctStopRemove), 1); renderGradient(); }
      else if (b.hasAttribute("data-ct-contrast-use")) { $(`[data-ct-contrast-${b.dataset.ctContrastUse}]`).value = state.current; renderContrast(); }
      else if (b.hasAttribute("data-ct-saved-action")) {
        const item = saved.find(c => c.id === b.dataset.ctSavedId); if (!item) return;
        if (b.dataset.ctSavedAction === "remove") {
          const next = saved.filter(c => c.id !== item.id);
          if (!writeStorage(SAVED_KEY, next)) { $("[data-ct-library-status]").textContent = "删除未能保存，请重试。"; return; }
          deleted = { item, index: saved.indexOf(item) }; saved = next; renderLibrary(); $("[data-ct-library-status]").textContent = "已删除，可撤销。";
        } else {
          commit(() => { state.palette = C.normalizePalette(item); state.selected = -1; state.savedId = b.dataset.ctSavedAction === "duplicate" ? null : item.id; if (!state.savedId) state.palette.name += " 副本"; });
          setColor(item.colors[0].hex, item.colors[0].label, "保存的配色"); $("[data-ct-dialog]").close(); message(`已打开“${state.palette.name}”。`);
        }
      }
    });
    listen($("[data-ct-screen]"), "click", screenPick);
    listen($("[data-ct-upload]"), "click", () => $("[data-ct-file]").click());
    listen($("[data-ct-file]"), "change", event => { acceptFiles(event.target.files); event.target.value = ""; });
    listen($("[data-ct-color]"), "input", event => setColor(event.target.value, undefined, "手动调整"));
    const applyValue = () => {
      const field = $("[data-ct-value]"), value = C.parse(field.value);
      if (!value) { field.setAttribute("aria-invalid", "true"); $("[data-ct-add]").disabled = $("[data-ct-update]").disabled = true; message("颜色值不正确。可以输入 #547AC0、rgb(84,122,192) 或 hsl(220,46%,54%)。", true); return; }
      setColor(value, undefined, "手动输入"); message("颜色已更新，可加入色卡。");
    };
    listen($("[data-ct-value]"), "change", applyValue);
    listen($("[data-ct-value]"), "keydown", event => { if (event.key === "Enter") { event.preventDefault(); applyValue(); } });
    for (const key of ["h", "s", "l"]) listen($(`[data-ct-${key}]`), "input", () => { state.current = C.fromHsl(...["h", "s", "l"].map(k => Number($(`[data-ct-${k}]`).value))); renderCurrent(false); persist(); });
    listen($("[data-ct-note]"), "input", persist);
    listen($("[data-ct-add]"), "click", () => {
      if (state.palette.colors.length >= C.MAX_COLORS) return;
      commit(() => { state.palette.colors.push({ hex: state.current, label: $("[data-ct-note]").value.trim() }); state.selected = -1; });
      $("[data-ct-note]").value = ""; persist();
      message(`已加入第 ${state.palette.colors.length} 个颜色。继续取色可再添加，修改已有颜色请点“更新选中色”。`);
    });
    listen($("[data-ct-update]"), "click", () => { if (state.selected < 0) return; commit(() => { state.palette.colors[state.selected] = { hex: state.current, label: $("[data-ct-note]").value.trim() }; }); message("已更新选中色卡。"); });
    listen($("[data-ct-delete]"), "click", () => { if (state.selected < 0) return; commit(() => { state.palette.colors.splice(state.selected, 1); state.selected = -1; }); message("已删除颜色，可以撤销。"); });
    let nameBefore;
    listen($("[data-ct-palette-name]"), "focus", () => { nameBefore = snapshot(); });
    listen($("[data-ct-palette-name]"), "input", event => { state.palette.name = event.target.value.slice(0, 80); persist(); });
    listen($("[data-ct-palette-name]"), "blur", () => {
      state.palette.name = state.palette.name.trim() || "我的配色";
      if (nameBefore && nameBefore !== snapshot()) { undo.push(nameBefore); if (undo.length > 60) undo.shift(); redo = []; }
      nameBefore = null; renderPalette(); persist();
    });
    listen($("[data-ct-new]"), "click", () => { commit(() => { state.palette = C.normalizePalette({ name: "我的配色", colors: [] }); state.selected = -1; state.savedId = null; }); $("[data-ct-note]").value = ""; persist(); message("已新建配色，可撤销返回上一套。"); });
    listen($("[data-ct-undo]"), "click", () => { if (!undo.length) return; redo.push(snapshot()); restore(undo.pop()); message("已撤销上一步。"); });
    listen($("[data-ct-redo]"), "click", () => { if (!redo.length) return; undo.push(snapshot()); restore(redo.pop()); message("已重做。"); });
    listen($("[data-ct-save]"), "click", savePalette);
    listen($("[data-ct-copy-all]"), "click", () => copy(state.palette.colors.map(c => c.hex).join("\n")));
    listen($("[data-ct-export]"), "click", exportPalette);
    listen($("[data-ct-library]"), "click", () => { renderLibrary(); $("[data-ct-library-status]").textContent = ""; $("[data-ct-dialog]").showModal(); });
    listen($("[data-ct-dialog-close]"), "click", () => $("[data-ct-dialog]").close());
    listen($("[data-ct-import]"), "click", () => $("[data-ct-json]").click());
    listen($("[data-ct-json]"), "change", event => { importPalette(event.target.files[0]); event.target.value = ""; });
    listen($("[data-ct-library-undo]"), "click", () => {
      if (!deleted || saved.length >= 30) return;
      const next = [...saved]; next.splice(deleted.index, 0, deleted.item);
      if (writeStorage(SAVED_KEY, next)) { saved = next; deleted = null; renderLibrary(); $("[data-ct-library-status]").textContent = "已恢复删除的配色。"; }
    });
    listen($("[data-ct-image-close]"), "click", () => clearImage(true));
    listen($("[data-ct-count]"), "change", extractImage);
    listen($("[data-ct-extracted-add]"), "click", () => addColors(extracted));
    listen($("[data-ct-crop-reset]"), "click", () => { crop = null; drawCrop(); extractImage(); message("已改为提取整张图片。"); });
    listen($("[data-ct-region-apply]"), "click", () => {
      const values = Object.fromEntries(["x", "y", "width", "height"].map(key => [key, Number($(`[data-ct-region="${key}"]`).value) / 100]));
      if (Object.values(values).some(n => !Number.isFinite(n) || n < 0) || values.width <= 0 || values.height <= 0 || values.x + values.width > 1.000001 || values.y + values.height > 1.000001) { message("选区必须在图片内，宽和高应大于 0%。", true); return; }
      crop = values; drawCrop(); extractImage(); message("已应用选区。");
    });
    const canvas = $("[data-ct-canvas]");
    listen(canvas, "pointerdown", event => { if (!bitmap || event.button !== 0) return; point = position(event); canvas.setPointerCapture(event.pointerId); if (imageMode === "crop") { drag = { start: point, previous: crop }; $("[data-ct-crosshair]").hidden = true; } });
    listen(canvas, "pointermove", event => { if (!bitmap) return; point = position(event); if (drag) drawCrop(C.region(drag.start, point)); else if (imageMode === "pick") pixelAt(point); });
    listen(canvas, "pointerup", event => {
      if (!bitmap) return; point = position(event);
      if (drag) { const next = C.region(drag.start, point); crop = next.width * canvas.width >= 3 && next.height * canvas.height >= 3 ? next : drag.previous; drag = null; drawCrop(); extractImage(); message(crop ? "已框选区域，正在提取配色。" : "请拖出一个矩形选区。"); }
      else if (imageMode === "pick") pixelAt(point, true);
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    });
    listen(canvas, "pointercancel", () => { if (drag) { crop = drag.previous; drag = null; drawCrop(); } });
    listen(canvas, "keydown", event => {
      if (!bitmap) return;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " "].includes(event.key)) event.preventDefault(); else return;
      const step = event.shiftKey ? 20 : 1;
      if (event.key === "ArrowLeft") point.x = C.clamp(point.x - step / bitmap.width);
      if (event.key === "ArrowRight") point.x = C.clamp(point.x + step / bitmap.width);
      if (event.key === "ArrowUp") point.y = C.clamp(point.y - step / bitmap.height);
      if (event.key === "ArrowDown") point.y = C.clamp(point.y + step / bitmap.height);
      pixelAt(point, event.key === "Enter" || event.key === " ");
    });
    listen($("[data-ct-harmony-type]"), "change", () => renderCurrent());
    listen($("[data-ct-harmony-add]"), "click", () => addColors(C.harmony(state.current, $("[data-ct-harmony-type]").value)));
    listen($("[data-ct-tabs]") || $(".ct-tabs"), "keydown", event => {
      const tabs = $$('[data-ct-tab]'), index = tabs.indexOf(event.target); if (index < 0) return;
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; setTab(tabs[next].dataset.ctTab, true);
    });
    listen($("[data-ct-stops]"), "input", event => {
      const field = event.target;
      if (field.hasAttribute("data-ct-stop-color")) { gradientStops[Number(field.dataset.ctStopColor)].hex = field.value; renderGradient(false); }
      if (field.hasAttribute("data-ct-stop-pos")) {
        if (!field.value.trim() || !field.checkValidity()) { field.setAttribute("aria-invalid", "true"); gradientValid = false; $("[data-ct-gradient-copy]").disabled = $("[data-ct-gradient-export]").disabled = true; return; }
        field.removeAttribute("aria-invalid"); gradientStops[Number(field.dataset.ctStopPos)].pos = Number(field.value); renderGradient(false);
      }
    });
    listen($("[data-ct-gradient-type]"), "change", () => renderGradient(false));
    listen($("[data-ct-gradient-angle]"), "input", event => { if (event.target.checkValidity() && event.target.value !== "") { event.target.removeAttribute("aria-invalid"); renderGradient(false); } else { event.target.setAttribute("aria-invalid", "true"); $("[data-ct-gradient-copy]").disabled = $("[data-ct-gradient-export]").disabled = true; gradientValid = false; } });
    listen($("[data-ct-gradient-add]"), "click", () => { if (gradientStops.length < 8) { gradientStops.push({ hex: state.current, pos: 50 }); renderGradient(); } });
    listen($("[data-ct-gradient-palette]"), "click", () => { if (state.palette.colors.length < 2) { message("先在我的配色里加入至少 2 个颜色。", true); return; } const colors = state.palette.colors.slice(0, 8); gradientStops = colors.map((c, i) => ({ hex: c.hex, pos: Math.round(i * 100 / (colors.length - 1)) })); renderGradient(); message(`已使用色卡中的前 ${colors.length} 个颜色。`); });
    listen($("[data-ct-gradient-preset]"), "change", event => {
      const presets = { sea: ["#80D0C7", "#13547A"], sunset: ["#F6D365", "#FDA085", "#C85073"], lavender: ["#C4B5FD", "#93C5FD"], forest: ["#D9ED92", "#52B788", "#1B4332"] }, colors = presets[event.target.value];
      if (colors) { gradientStops = colors.map((hex, i) => ({ hex, pos: i * 100 / (colors.length - 1) })); renderGradient(); }
    });
    listen($("[data-ct-gradient-copy]"), "click", () => { if (gradientValid) copy($("[data-ct-gradient-code]").textContent); });
    listen($("[data-ct-gradient-export]"), "click", exportGradient);
    for (const key of ["fg", "bg"]) listen($(`[data-ct-contrast-${key}]`), "input", renderContrast);
    listen($("[data-ct-contrast-swap]"), "click", () => { const fg = $("[data-ct-contrast-fg]"), bg = $("[data-ct-contrast-bg]"), value = fg.value; fg.value = bg.value; bg.value = value; renderContrast(); });
  }
  function bindTransfers() {
    listen(document, "paste", event => {
      if ($("[data-ct-dialog]").open) return;
      const files = [...(event.clipboardData?.items || [])].filter(i => i.kind === "file").map(i => i.getAsFile()).filter(Boolean);
      if (files.length) { event.preventDefault(); acceptFiles(files); }
    });
    let depth = 0;
    listen(document, "dragenter", event => { if ([...(event.dataTransfer?.types || [])].includes("Files")) { event.preventDefault(); depth++; root.classList.add("is-file-over"); } });
    listen(document, "dragover", event => { if ([...(event.dataTransfer?.types || [])].includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } });
    listen(document, "dragleave", () => { if (--depth <= 0) { depth = 0; root.classList.remove("is-file-over"); } });
    listen(document, "drop", event => {
      if (![...(event.dataTransfer?.types || [])].includes("Files")) return;
      event.preventDefault(); depth = 0; root.classList.remove("is-file-over");
      if ($("[data-ct-dialog]").open) { $("[data-ct-library-status]").textContent = "导入色卡请使用“导入 JSON 色卡”按钮。"; return; }
      acceptFiles(event.dataTransfer.files);
    });
    listen($("[data-ct-swatches]"), "dragstart", event => {
      const handle = event.target.closest("[data-ct-drag]"); if (!handle) { event.preventDefault(); return; }
      draggedIndex = Number(handle.dataset.ctDrag); event.dataTransfer.setData("application/x-claudeone-color", String(draggedIndex)); event.dataTransfer.effectAllowed = "move";
    });
    listen($("[data-ct-swatches]"), "dragover", event => { if (draggedIndex < 0) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; const target = event.target.closest("[data-ct-index]"); $$('[data-ct-index]').forEach(item => item.classList.toggle("is-dragover", item === target)); });
    listen($("[data-ct-swatches]"), "drop", event => {
      if (draggedIndex < 0) return; event.preventDefault(); const target = event.target.closest("[data-ct-index]");
      if (target) { const index = Number(target.dataset.ctIndex), from = draggedIndex; if (from !== index) { commit(() => { const [color] = state.palette.colors.splice(from, 1); state.palette.colors.splice(index, 0, color); state.selected = index; }); setColor(state.palette.colors[index].hex, state.palette.colors[index].label, "选中的色卡"); message("已调整色卡顺序。"); } }
      draggedIndex = -1;
    });
    listen($("[data-ct-swatches]"), "dragend", () => { draggedIndex = -1; $$('[data-ct-index]').forEach(item => item.classList.remove("is-dragover")); });
  }
  function mount(container) {
    unmount(); root = container.querySelector("[data-ct]"); if (!root) return;
    ac = new AbortController();
    const draft = readStorage(DRAFT_KEY, {}); let palette;
    try { palette = C.normalizePalette(draft.palette || { name: "我的配色", colors: [] }); } catch (_) { palette = C.normalizePalette({ name: "我的配色", colors: [] }); }
    state = { palette, current: C.parse(draft.current) || "#547AC0", selected: -1, savedId: typeof draft.savedId === "string" ? draft.savedId : null };
    const data = readStorage(SAVED_KEY, []); saved = [];
    if (Array.isArray(data)) for (const item of data.slice(0, 30)) { try { const palette = C.normalizePalette(item); if (palette.colors.length && typeof item.id === "string") saved.push({ ...palette, id: item.id, updated: item.updated }); } catch (_) { /* Ignore damaged saved records. */ } }
    $("[data-ct-note]").value = typeof draft.note === "string" ? draft.note.slice(0, 80) : "";
    gradientStops = [{ hex: "#80D0C7", pos: 0 }, { hex: "#13547A", pos: 100 }];
    if (!window.isSecureContext || typeof window.EyeDropper !== "function") { $("[data-ct-screen]").disabled = true; $("[data-ct-screen]").title = "当前浏览器不支持，请使用图片取色"; message("此浏览器可使用图片取色；屏幕取色请用桌面 Chrome / Edge，在 HTTPS 或 localhost 上打开。"); }
    bindActions(); bindTransfers(); renderCurrent(); renderPalette(); renderGradient(); renderContrast();
  }
  function unmount() {
    imageJob++; screenController?.abort(); screenController = null;
    if (root) { closeHelp(); clearImage(); $("[data-ct-dialog]").close(); }
    if (ac) ac.abort();
    for (const url of urls) URL.revokeObjectURL(url); urls.clear();
    root = ac = state = saved = deleted = bitmap = null; undo = []; redo = []; extracted = []; drag = null; draggedIndex = -1;
  }
  window.__page_colors = { mount, unmount };
})();
