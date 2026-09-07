/* Video GIF: shared, deterministic validation and timing. */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.VideoGifCore = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'
  var presets = {
    standard: { fps: 15, colors: 128, size: '480' },
    smooth: { fps: 24, colors: 256, size: '720' },
    small: { fps: 10, colors: 64, size: '360' },
    sticker: { fps: 8, colors: 32, size: '240' }
  }
  function clamp (n, lo, hi) { return Math.max(lo, Math.min(hi, n)) }
  function defaults (width, height, duration) {
    return { start: 0, end: Math.min(5, duration), crop: { x: 0, y: 0, w: width, h: height },
      fps: 15, colors: 128, size: '480', width: '', height: '', keepRatio: true, loop: 0, preset: 'standard', cropEnabled: false }
  }
  function normalizeRange (start, end, duration, changed) {
    var gap = Math.min(0.02, duration)
    start = clamp(Number(start) || 0, 0, Math.max(0, duration - gap))
    end = clamp(Number(end) || gap, gap, duration)
    if (changed === 'end') start = Math.min(start, end - gap)
    else end = Math.max(end, start + gap)
    return { start: start, end: end }
  }
  function outputSize (edit) {
    var w = edit.crop.w, h = edit.crop.h
    if (edit.size === 'custom') {
      var mw = edit.width === '' ? 0 : Number(edit.width)
      var mh = edit.height === '' ? 0 : Number(edit.height)
      if (!isFinite(mw) || !isFinite(mh) || mw < 0 || mh < 0) throw new Error('请输入有效的输出宽高')
      if (edit.width !== '' && mw < 1 || edit.height !== '' && mh < 1) throw new Error('输出宽高至少为 1 像素')
      if (mw) { h = edit.keepRatio || !mh ? h * mw / w : mh; w = mw }
      else if (mh) { w = w * mh / h; h = mh }
    } else {
      var scale = Number(edit.size) > 0 ? Math.min(1, Number(edit.size) / Math.max(w, h)) : 1
      w *= scale; h *= scale
    }
    return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) }
  }
  function plan (edit, meta) {
    if (![meta.vw, meta.vh, meta.duration].every(function (v) { return isFinite(v) && v > 0 })) throw new Error('无法读取视频尺寸或时长，请换用 MP4 或 WebM 视频')
    var crop = edit.crop
    if (![crop.x, crop.y, crop.w, crop.h].every(Number.isFinite) || crop.x < 0 || crop.y < 0 || crop.w <= 0 || crop.h <= 0 || crop.x + crop.w > meta.vw + 0.01 || crop.y + crop.h > meta.vh + 0.01) throw new Error('裁剪区域超出视频范围，请重置裁剪')
    var size = outputSize(edit)
    if (size.w > 1920 || size.h > 1920) throw new Error('输出最长边不能超过 1920 像素，请选择较小尺寸')
    var fps = Number(edit.fps), duration = edit.end - edit.start
    if (!Number.isFinite(fps) || fps < 3 || fps > 30) throw new Error('帧率需要在 3–30 fps 之间')
    if (!Number.isFinite(duration) || edit.start < 0 || edit.end > meta.duration + 0.001 || duration < 0.0199) throw new Error('请选择至少 0.02 秒的有效片段')
    var count = Math.max(1, Math.ceil(duration * fps - 1e-7))
    if (count > 1800 || count * size.w * size.h > 250000000) throw new Error('当前片段处理量较大，请缩短片段、减小尺寸或降低帧率')
    if ([32, 64, 128, 256].indexOf(Number(edit.colors)) < 0) throw new Error('颜色数无效')
    if ([0, 1, 3, 5].indexOf(Number(edit.loop)) < 0) throw new Error('循环次数无效')
    // GIF stores centiseconds. Distribute rounding so 15/24 fps does not drift.
    var times = [], delays = [], previous = 0
    for (var i = 0; i < count; i++) {
      times.push(edit.start + i / fps)
      var boundary = Math.round(Math.min(duration, (i + 1) / fps) * 100)
      if (i === count - 1 && i > 0 && boundary - previous < 2) {
        delays[i - 1] += (boundary - previous) * 10
        times.pop()
      } else delays.push((boundary - previous) * 10)
      previous = boundary
    }
    var loop = Number(edit.loop)
    return { width: size.w, height: size.h, fps: fps, colors: Number(edit.colors), repeat: loop === 0 ? 0 : loop === 1 ? -1 : loop - 1,
      crop: { x: crop.x, y: crop.y, w: crop.w, h: crop.h }, times: times, delays: delays,
      frames: times.length, duration: previous / 100 }
  }
  return { presets: presets, clamp: clamp, defaults: defaults, normalizeRange: normalizeRange, outputSize: outputSize, plan: plan }
})
