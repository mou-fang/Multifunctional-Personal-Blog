/* ===== claudeOne :: image-scramble-worker.js =====
 * Keeps PixelFlux transforms and PNG packing away from the UI thread.
 */

"use strict";

importScripts("image-scramble-core.js");

function postProgress(requestId, value, label) {
  self.postMessage({
    type: "progress",
    requestId: requestId,
    value: Math.max(0, Math.min(1, value)),
    label: label,
  });
}

function serializeError(error) {
  return {
    message: error && error.message ? error.message : "图片处理失败",
    name: error && error.name ? error.name : "Error",
  };
}

self.addEventListener("message", async function (event) {
  var payload = event.data || {};
  var requestId = payload.requestId;

  try {
    if (payload.mode === "scramble") {
      var source = new Uint8Array(payload.rgbaBuffer);
      var checksum = self.PixelFlux.checksumHex(source);
      postProgress(requestId, 0.08, "正在生成随机像素轨道");
      var scrambled = self.PixelFlux.scrambleRgba(
        source,
        payload.width,
        payload.height,
        payload.seed,
        function (progress) {
          postProgress(requestId, 0.1 + progress * 0.7, "正在交换像素与颜色");
        }
      );
      source = null;

      var metadata = self.PixelFlux.makeMetadata({
        width: payload.width,
        height: payload.height,
        seed: payload.seed,
        checksum: checksum,
        originalNameB64: payload.originalNameB64 || "",
      });
      postProgress(requestId, 0.84, "正在封装可逆 PNG");
      // Scrambled RGB data is noise-like and barely compresses. Stored DEFLATE
      // is both faster and supported by the tiny fallback decoder in the core.
      var scrambledPng = await self.PixelFlux.encodePngRgba(
        scrambled,
        payload.width,
        payload.height,
        metadata,
        { compression: "store" }
      );
      postProgress(requestId, 1, "混淆完成");
      self.postMessage({
        type: "result",
        requestId: requestId,
        mode: "scramble",
        pngBuffer: scrambledPng.buffer,
        metadata: metadata,
        width: payload.width,
        height: payload.height,
      }, [scrambledPng.buffer]);
      return;
    }

    if (payload.mode === "restore") {
      postProgress(requestId, 0.06, "正在读取 PixelFlux 数据");
      var decoded = await self.PixelFlux.decodePngRgba(payload.pngBuffer);
      var meta = decoded.metadata;
      if (!self.PixelFlux.isPixelFluxMetadata(meta)) {
        throw new Error("没有检测到可恢复的 PixelFlux 混淆标记");
      }
      if (meta.width !== decoded.width || meta.height !== decoded.height) {
        throw new Error("混淆图尺寸与恢复信息不一致，文件可能已被修改");
      }

      postProgress(requestId, 0.22, "正在反向追踪像素轨道");
      var restored = self.PixelFlux.restoreRgba(
        decoded.rgba,
        decoded.width,
        decoded.height,
        meta.seed,
        function (progress) {
          postProgress(requestId, 0.22 + progress * 0.6, "正在还原像素与颜色");
        }
      );
      var restoredChecksum = self.PixelFlux.checksumHex(restored);
      if (restoredChecksum !== meta.checksum) {
        throw new Error("完整性校验失败：混淆图可能经过压缩、裁剪或重新保存");
      }

      decoded = null;
      postProgress(requestId, 0.86, "正在生成还原 PNG");
      var restoredPng = await self.PixelFlux.encodePngRgba(
        restored,
        meta.width,
        meta.height,
        null,
        { compression: "deflate" }
      );
      postProgress(requestId, 1, "还原完成");
      self.postMessage({
        type: "result",
        requestId: requestId,
        mode: "restore",
        pngBuffer: restoredPng.buffer,
        metadata: null,
        sourceMetadata: meta,
        width: meta.width,
        height: meta.height,
      }, [restoredPng.buffer]);
      return;
    }

    throw new Error("未知的 PixelFlux 处理模式");
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId: requestId,
      error: serializeError(error),
    });
  }
});
