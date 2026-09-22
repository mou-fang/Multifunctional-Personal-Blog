/* A real QR matrix for https://example.com, dismantled into letter pixels. */
(function () {
  "use strict";
  const MATRIX = ["1111111000011100101111111","1000001000100111101000001","1011101011010010001011101","1011101010000111001011101","1011101011100100101011101","1000001010010011001000001","1111111010101010101111111","0000000010000010100000000","1011111000001000001111100","0100110010110100010100010","1111101011000111100101011","1101110010110101101100001","0111001000011011011010111","1111100010100000100101010","1000001100111001001111011","1001000100010011111110001","1010011011110000111110100","0000000011001111100011000","1111111000000110101010111","1000001011001100100011010","1011101011101011111110101","1011101010000001011011111","1011101011111001000001101","1000001000010010110111001","1111111011010000011111111"];
  window.QRReaderAnimation = function (canvas) {
    const ctx = canvas.getContext("2d");
    const glyph = document.createElement("canvas");
    glyph.width = 250; glyph.height = 32;
    const g = glyph.getContext("2d", { willReadFrequently: true });
    g.font = "bold 20px monospace";
    g.fillText("https://example.com", 0, 23);
    const pixels = g.getImageData(0, 0, 250, 32).data;
    const targets = [];
    for (let x = 0; x < 250; x++) for (let y = 0; y < 32; y++) {
      if (pixels[(y * 250 + x) * 4 + 3] > 100) targets.push({ x: 412 + x * 2.2, y: 108 + y * 2.2 });
    }
    const particles = [];
    for (let x = 0; x < 25; x++) for (let y = 0; y < 25; y++) {
      const index = particles.length;
      particles.push({ x: 78 + x * 6.4, y: 58 + y * 6.4, dark: MATRIX[y][x] === "1", target: targets[Math.floor(index / 625 * targets.length)], delay: index / 625 * 4200 });
    }
    let raf = 0, elapsed = 0, last = 0, enabled = false, manualPause = false, disposed = false;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    function draw(time) {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(box.width * dpr));
      const height = Math.max(1, Math.round(box.height * dpr));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      ctx.setTransform(width / 920, 0, 0, height / 278, 0, 0);
      ctx.clearRect(0, 0, 920, 278);
      const ink = getComputedStyle(canvas).getPropertyValue("--ink").trim() || "#1f3559";
      const phase = time % 10200;
      const fade = phase > 8800 ? 1 - (phase - 8800) / 1400 : 1;
      ctx.globalAlpha = .14;
      ctx.strokeStyle = ink;
      ctx.setLineDash([2, 7]); ctx.beginPath(); ctx.moveTo(274, 138); ctx.lineTo(382, 138); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = .55; ctx.font = "10px monospace"; ctx.fillStyle = ink;
      ctx.fillText("QR CODE", 78, 246); ctx.fillText("DECODED / URL", 412, 90);
      ctx.globalAlpha = fade;
      ctx.fillStyle = "#fff";
      ctx.fillRect(68, 48, 180, 180);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const t = reduced.matches ? 0 : Math.max(0, Math.min(1, (phase - 1400 - p.delay) / 1800));
        const e = t * t * (3 - 2 * t);
        const x = p.x + (p.target.x - p.x) * e;
        const y = p.y + (p.target.y - p.y) * e - Math.sin(t * Math.PI) * (22 + i % 9 * 6);
        const size = 6.4 * (1 - e) + 2.3 * e;
        ctx.globalAlpha = fade;
        const shade = p.dark ? 27 : Math.round(255 - e * 228);
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.fillRect(x, y, size, size);
      }
      if (phase > 7400) {
        ctx.globalAlpha = Math.min(1, (phase - 7400) / 650) * fade;
        ctx.drawImage(glyph, 412, 108, 550, 70.4);
      }
      // A quiet link baseline gives the destination a consistent visual anchor.
      ctx.globalAlpha = .16; ctx.fillStyle = ink; ctx.fillRect(412, 184, 456, 1);
      ctx.globalAlpha = 1;
    }
    function tick(now) {
      raf = 0;
      if (last) elapsed += Math.min(now - last, 80);
      last = now; draw(elapsed); raf = requestAnimationFrame(tick);
    }
    function sync() {
      cancelAnimationFrame(raf); raf = 0; last = 0;
      if (disposed) return;
      canvas.dataset.running = String(enabled && !manualPause && !reduced.matches && !document.hidden);
      if (canvas.dataset.running === "true") raf = requestAnimationFrame(tick);
      else if (enabled) draw(reduced.matches ? 8200 : elapsed);
    }
    const resize = new ResizeObserver(() => { if (enabled) draw(reduced.matches ? 8200 : elapsed); });
    resize.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    return {
      setActive(value) { enabled = value; sync(); },
      toggle() { manualPause = !manualPause; sync(); return manualPause; },
      destroy() { disposed = true; cancelAnimationFrame(raf); resize.disconnect(); document.removeEventListener("visibilitychange", sync); reduced.removeEventListener("change", sync); }
    };
  };
})();
