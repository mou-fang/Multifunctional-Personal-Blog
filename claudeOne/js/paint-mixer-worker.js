"use strict";
importScripts("../libs/spectral-3.0.0/spectral.js", "paint-mixer-core.js?v=20261008-chief-2");
self.onmessage = function ({ data }) {
  try {
    const result = PaintMixerCore.solve(data, progress => self.postMessage({ job: data.job, progress }));
    self.postMessage({ job: data.job, result });
  } catch (error) { self.postMessage({ job: data.job, error: error.message || "配方计算失败，请调整颜料范围后重试。" }); }
};
