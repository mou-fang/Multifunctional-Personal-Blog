/* Decode away from the UI; terminating this worker cancels the current scan. */
"use strict";
importScripts("../libs/jsqr/jsQR.js");
self.onmessage = function (event) {
  const { buffer, width, height } = event.data;
  try {
    const code = jsQR(new Uint8ClampedArray(buffer), width, height, { inversionAttempts: "attemptBoth" });
    self.postMessage({ text: code ? code.data : null });
  } catch (_) {
    self.postMessage({ error: "二维码识别失败，请换一张清晰的图片重试。" });
  }
};
