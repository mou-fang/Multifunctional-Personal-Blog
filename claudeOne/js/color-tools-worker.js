/* A fresh worker is used for each extraction; termination cancels computation. */
"use strict";
importScripts("../libs/color-thief-3.5.0/color-thief.global.js");
self.onmessage = function ({ data }) {
  try {
    const pixels = new Uint8ClampedArray(data.buffer);
    let visible = false;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) { visible = true; break; }
    // Color Thief relaxes its alpha filter on empty regions; keep transparent areas empty.
    if (!visible) { self.postMessage({ id: data.id, colors: [] }); return; }
    const image = new ImageData(pixels, data.width, data.height);
    const colors = ColorThief.getPaletteSync(image, { colorCount: data.count, quality: 1, ignoreWhite: false, alphaThreshold: 1 });
    self.postMessage({ id: data.id, colors: colors.map(c => ({ hex: c.hex().toUpperCase(), proportion: c.proportion || 0 })) });
  } catch (_) {
    self.postMessage({ id: data.id, error: "提取失败，请换一张图片或重新框选区域。" });
  }
};
