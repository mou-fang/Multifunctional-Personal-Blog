(function () {
  "use strict";
  let root, ac, animation, worker, timer, cancelScan, previewURL, generation = 0;
  const urls = new Set();
  const $ = selector => root.querySelector(selector);
  function listen(target, event, handler) { target.addEventListener(event, handler, { signal: ac.signal }); }
  function message(text, error = false) { $("[data-status]").textContent = text; $("[data-status]").dataset.error = String(error); }
  function stopScan() {
    clearTimeout(timer);
    if (worker) worker.terminate();
    worker = null;
    if (cancelScan) cancelScan(new Error("cancelled"));
    cancelScan = null;
  }
  function revoke(url) { if (url) { URL.revokeObjectURL(url); urls.delete(url); } }
  function idle() {
    generation++; stopScan(); revoke(previewURL); previewURL = null;
    $("[data-preview]").removeAttribute("src");
    $("[data-idle]").hidden = false; $("[data-active]").hidden = true;
    $("[data-reset]").hidden = true; $("[data-result]").hidden = true;
    $("[data-pick-label]").textContent = "把二维码图片拖到这里";
    $("[data-content]").value = ""; $("[data-fields]").replaceChildren();
    $("[data-open]").removeAttribute("href"); $("[data-file]").value = "";
    root.setAttribute("aria-busy", "false"); message(""); animation.setActive(true);
  }
  function decode(imageData) {
    return new Promise((resolve, reject) => {
      cancelScan = reject;
      worker.onmessage = event => {
        clearTimeout(timer); cancelScan = null;
        if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data.text);
      };
      worker.onerror = () => { clearTimeout(timer); cancelScan = null; reject(new Error("识别组件未能加载，请刷新页面后重试。")); };
      timer = setTimeout(() => { stopScan(); reject(new Error("识别超时，请裁剪二维码区域后重试。")); }, 15000);
      worker.postMessage({ buffer: imageData.data.buffer, width: imageData.width, height: imageData.height }, [imageData.data.buffer]);
    });
  }
  function showResult(text) {
    const result = window.QRReaderCore.classify(text);
    $("[data-kind]").textContent = result.label; $("[data-detail]").textContent = result.detail;
    $("[data-content]").value = text;
    $("[data-fields]").replaceChildren();
    for (const [label, value] of result.fields) {
      const dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = label; dd.textContent = value; $("[data-fields]").append(dt, dd);
    }
    const link = $("[data-open]"); link.hidden = !result.href;
    link.removeAttribute("href"); if (result.href) link.href = result.href;
    $("[data-link-note]").hidden = !result.href;
    $("[data-result]").hidden = false; $("[data-scanning]").hidden = true;
    message("已识别为" + result.label + "。" + (text === "" ? "二维码内容为空。" : ""));
  }
  async function readFile(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif|bmp|x-ms-bmp)$/i.test(file.type) && !(file.type === "" && /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name))) {
      message("请选择 PNG、JPG、WebP、GIF 或 BMP 图片。", true); return;
    }
    if (file.size > 20 * 1024 * 1024) { message("图片超过 20 MB，请压缩或裁剪后重试。", true); return; }
    const job = ++generation; stopScan(); revoke(previewURL); previewURL = null;
    animation.setActive(false);
    $("[data-idle]").hidden = true; $("[data-active]").hidden = false;
    $("[data-result]").hidden = true; $("[data-scanning]").hidden = false;
    $("[data-scanning] h2").textContent = "正在读懂这张二维码…";
    $("[data-scanning] p").textContent = "稍等一下，内容马上出现。";
    $(".qread-spinner").hidden = false;
    $("[data-reset]").hidden = false; $("[data-pick-label]").textContent = "再拖一张，继续识别";
    $("[data-filename]").textContent = file.name || "粘贴的图片";
    $("[data-preview]").removeAttribute("src"); $("[data-preview]").hidden = true;
    root.setAttribute("aria-busy", "true"); message("正在识别图片…");
    const url = URL.createObjectURL(file); urls.add(url);
    try {
      const img = new Image(); img.src = url; await img.decode();
      if (job !== generation || !root) { revoke(url); return; }
      if (img.naturalWidth * img.naturalHeight > 40000000) throw new Error("图片尺寸过大，请裁剪二维码区域后重试（最多 4000 万像素）。");
      previewURL = url; $("[data-preview]").src = url; $("[data-preview]").hidden = false;
      worker = new Worker(new URL("js/qr-reader-worker.js", document.baseURI));
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      let found = null;
      // Try a small scan first, then more detail. The worker is cancellable between or during attempts.
      const longest = Math.max(img.naturalWidth, img.naturalHeight);
      const sizes = [...new Set([Math.min(longest, 900), Math.min(longest, 1800), Math.min(longest, 2800)])];
      for (const size of sizes) {
        const scale = size / longest;
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        found = await decode(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (job !== generation || !root) return;
        if (found !== null) break;
      }
      canvas.width = canvas.height = 1;
      if (found === null) throw new Error("没有找到可识别的二维码。请保留完整四边、使用更清晰的图片，或裁剪到二维码附近再试。GIF 仅识别第一帧。");
      showResult(found);
    } catch (error) {
      if (job !== generation || !root) { revoke(url); return; }
      $("[data-scanning] h2").textContent = "这张图片还没读出来";
      $("[data-scanning] p").textContent = "换一张图片，或裁剪后再试。";
      $(".qread-spinner").hidden = true;
      const reason = error.name === "EncodingError" ? "图片无法读取，文件可能已损坏，请换一张图片重试。" : error.message;
      message(reason === "cancelled" ? "识别超时，请裁剪二维码区域后重试。" : reason || "图片无法读取，请换一张图片重试。", true);
      if (previewURL !== url) revoke(url);
    } finally {
      if (job === generation && root) { stopScan(); root.setAttribute("aria-busy", "false"); }
    }
  }
  function acceptFiles(files) {
    if (files.length > 1) { message("请每次放入一张图片，方便对应识别结果。", true); return; }
    readFile(files[0]);
  }
  function mount(container) {
    unmount(); root = container.querySelector("[data-qread]"); if (!root) return;
    ac = new AbortController(); animation = new window.QRReaderAnimation($("[data-animation]"));
    listen($("[data-pick]"), "click", () => $("[data-file]").click());
    listen($("[data-file]"), "change", event => { acceptFiles(event.target.files); event.target.value = ""; });
    listen($("[data-reset]"), "click", idle);
    listen($("[data-motion]"), "click", event => {
      const paused = animation.toggle(); event.target.textContent = paused ? "播放动画" : "暂停动画";
      event.target.setAttribute("aria-pressed", String(paused));
    });
    // Whole-page drop works, while the import area gives visible drag feedback.
    let dragDepth = 0;
    listen(document, "dragenter", event => { if (Array.from(event.dataTransfer?.types || []).includes("Files")) { event.preventDefault(); dragDepth++; $("[data-drop]").classList.add("is-dragover"); } });
    listen(document, "dragover", event => { if (Array.from(event.dataTransfer?.types || []).includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } });
    listen(document, "dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; $("[data-drop]").classList.remove("is-dragover"); } });
    listen(document, "drop", event => { event.preventDefault(); dragDepth = 0; $("[data-drop]").classList.remove("is-dragover"); acceptFiles(event.dataTransfer?.files || []); });
    listen(document, "paste", event => {
      const files = Array.from(event.clipboardData?.items || []).filter(item => item.kind === "file").map(item => item.getAsFile()).filter(Boolean);
      if (files.length) { event.preventDefault(); acceptFiles(files); }
    });
    listen($("[data-copy]"), "click", async () => {
      const job = generation, value = $("[data-content]").value;
      try {
        if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
        await navigator.clipboard.writeText(value);
        if (root && job === generation) message("已复制完整内容。");
      } catch (_) {
        if (root && job === generation) {
          $("[data-content]").focus(); $("[data-content]").select();
          message("内容已选中，请按 Ctrl / ⌘ + C 复制。");
        }
      }
    });
    idle();
  }
  function unmount() {
    generation++; stopScan(); if (ac) ac.abort(); if (animation) animation.destroy();
    for (const url of urls) URL.revokeObjectURL(url); urls.clear();
    root = ac = animation = previewURL = null;
  }
  window.__page_qr_reader = { mount, unmount };
})();
