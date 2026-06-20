/* ===== claudeOne :: videogif-worker.js =====
 * 同源 Web Worker：负责把主线程抽好的 RGBA 帧编码成 GIF。
 * 运行在 worker-src 'self' CSP 下，通过 importScripts 加载本地 vendored gifenc。
 * gifenc 的 CJS 构建依赖宿主提供 exports/module，故在 importScripts 前预声明 shim。
 *
 * 协议（与 videogif.js 约定）：
 *   入: { id, type:'encode', frames:[Uint8Array], width, height, delay, repeat,
 *         maxColors, format, fps }   — frames 已是裁剪+缩放后的目标尺寸 RGBA
 *   出: { id, type:'progress', done, total }
 *       { id, type:'done', bytes }      — bytes 为 ArrayBuffer，可被 transfer
 *       { id, type:'error', message }
 */
'use strict'

/* gifenc CJS shim —— 必须在 importScripts 之前定义 */
var exports = {}
var module = { exports: exports }

try {
  importScripts('../libs/gifenc/gifenc.js')
} catch (e) {
  self.postMessage({ type: 'error', message: '加载 gifenc 失败: ' + e.message })
}

var GIFEncoder = exports.GIFEncoder
var quantize = exports.quantize
var applyPalette = exports.applyPalette

/* 校验：库是否成功加载 */
if (typeof GIFEncoder !== 'function' || typeof quantize !== 'function' || typeof applyPalette !== 'function') {
  self.postMessage({ type: 'error', message: 'gifenc 接口缺失，无法编码' })
}

/* 帧间复用调色板：对动画连续帧，复用首帧调色板可减小体积并保持色彩一致。
 * gifenc 的 writeFrame 在 first 帧写入全局色表，后续帧若传入 palette 则用局部色表。
 * 这里采用「每帧独立量化 + 首帧作为全局」策略，兼顾质量与兼容性。 */
function encode(frames, width, height, opts) {
  var delay = opts.delay
  var repeat = opts.repeat
  var maxColors = opts.maxColors || 256
  var format = opts.format || 'rgb565'

  if (!frames || !frames.length) throw new Error('没有可编码的帧')

  var gif = GIFEncoder()
  var globalPalette = null
  var total = frames.length

  for (var i = 0; i < total; i++) {
    var rgba = frames[i]

    /* 第一帧：量化得到全局调色板 */
    var palette
    if (i === 0) {
      globalPalette = quantize(rgba, maxColors, { format: format })
      palette = globalPalette
    } else {
      /* 后续帧复用全局调色板以避免每帧局部色表膨胀体积；
       * 若色彩差异大可改为每帧重算，但默认走体积最优 */
      palette = globalPalette
    }

    var index = applyPalette(rgba, palette, format)
    gif.writeFrame(index, width, height, {
      data: index,
      palette: palette,
      delay: delay,
      repeat: repeat
    })

    /* 报告进度，让出事件循环避免长时间阻塞 worker 消息队列 */
    if (i % 2 === 0 || i === total - 1) {
      self.postMessage({ type: 'progress', done: i + 1, total: total })
    }
  }

  gif.finish()
  var bytes = gif.bytes()
  /* 拷贝到独立 ArrayBuffer 以便 transfer；gifenc 的内部 buffer 可能被复用 */
  var out = new ArrayBuffer(bytes.length)
  new Uint8Array(out).set(bytes)
  return out
}

self.onmessage = function (e) {
  var msg = e.data || {}
  var id = msg.id
  if (msg.type !== 'encode') return

  try {
    var frames = msg.frames
    var width = msg.width
    var height = msg.height
    if (!Array.isArray(frames) || !frames.length) {
      self.postMessage({ id: id, type: 'error', message: '帧数据为空' })
      return
    }

    var bytes = encode(frames, width, height, {
      delay: msg.delay,
      repeat: msg.repeat,
      maxColors: msg.maxColors,
      format: msg.format
    })

    self.postMessage({ id: id, type: 'done', bytes: bytes }, [bytes])
  } catch (err) {
    self.postMessage({ id: id, type: 'error', message: (err && err.message) || String(err) })
  }
}
