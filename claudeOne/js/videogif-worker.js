/* One transferred RGBA frame at a time; acknowledge before the next seek. */
'use strict'
var exports = {}
var module = { exports: exports }
var bootError = ''
try { importScripts('../libs/gifenc/gifenc.js') } catch (e) { bootError = e.message }
var job = null
self.onmessage = function (event) {
  var msg = event.data || {}
  try {
    if (bootError || typeof exports.GIFEncoder !== 'function') throw new Error('编码器加载失败，请刷新页面重试')
    if (msg.type === 'start') {
      if (!Number.isInteger(msg.width) || !Number.isInteger(msg.height) || msg.width < 1 || msg.height < 1 || msg.width > 1920 || msg.height > 1920 || !Number.isInteger(msg.total) || msg.total < 1 || msg.total > 1800 || [32, 64, 128, 256].indexOf(msg.colors) < 0) throw new Error('编码参数无效')
      job = { id: msg.id, width: msg.width, height: msg.height, total: msg.total, colors: msg.colors, repeat: msg.repeat, done: 0, gif: exports.GIFEncoder() }
      self.postMessage({ id: msg.id, type: 'ready' })
    } else if (job && job.id === msg.id && msg.type === 'frame') {
      if (msg.index !== job.done || job.done >= job.total || !(msg.rgba instanceof ArrayBuffer) || msg.rgba.byteLength !== job.width * job.height * 4 || !Number.isFinite(msg.delay) || msg.delay < 20 || msg.delay > 655350) throw new Error('帧数据或顺序无效')
      var rgba = new Uint8Array(msg.rgba)
      var palette = exports.quantize(rgba, job.colors, { format: 'rgb565' })
      var index = exports.applyPalette(rgba, palette, 'rgb565')
      job.gif.writeFrame(index, job.width, job.height, { palette: palette, delay: msg.delay, repeat: job.repeat })
      job.done++
      if (job.gif.bytesView().byteLength > 100 * 1024 * 1024) throw new Error('GIF 超过 100 MB，请缩短片段或减小尺寸')
      self.postMessage({ id: job.id, type: 'progress', done: job.done, total: job.total })
    } else if (job && job.id === msg.id && msg.type === 'finish') {
      if (job.done !== job.total) throw new Error('视频帧尚未处理完成')
      job.gif.finish()
      var bytes = job.gif.bytes().slice().buffer
      self.postMessage({ id: job.id, type: 'done', bytes: bytes }, [bytes])
      job = null
    }
  } catch (e) {
    job = null
    self.postMessage({ id: msg.id, type: 'error', message: e.message || String(e) })
  }
}
