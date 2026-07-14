/* ===== claudeOne :: videogif.js =====
 * 视频转 GIF 工具 — 批量列表 + 逐个编辑
 * SPA lifecycle: window.__page_videogif
 *
 * 架构：
 *   - 主线程：视频解码 + 逐帧抽帧（<video> seek → canvas drawImage → getImageData）
 *   - Worker（videogif-worker.js）：gifenc 编码（quantize + LZW）
 *   - 取消/切换安全：AbortController + processRunId 代际计数
 */
;(function () {
  'use strict'

  var container = null
  var ac = null

  var C = window.ClaudeOne || {}
  var qs = function (s) { return container ? container.querySelector(s) : null }
  var qsa = function (s) { return container ? Array.prototype.slice.call(container.querySelectorAll(s)) : [] }
  var esc = C.escapeHtml || function (s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] }) }
  var clamp = C.clamp || function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }
  var toast = C.toast || function () {}
  var fmt = function (n) {
    if (n < 1024) return n + ' B'
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
    return (n / 1048576).toFixed(2) + ' MB'
  }
  function fmtTime (s) {
    if (!isFinite(s) || s < 0) s = 0
    var m = Math.floor(s / 60)
    var sec = Math.floor(s % 60)
    var ms = Math.floor((s - Math.floor(s)) * 10)
    return m + ':' + (sec < 10 ? '0' : '') + sec + '.' + ms
  }

  /* ---- State ---- */
  var state = {
    files: [],            // [{id, file, name, size, type, duration, vw, vh, thumb, videoUrl, status, gif, error}]
    selectedId: null,
    processing: false,
    aborted: false,
    abortCtrl: null
  }
  var idSeq = 0
  var processRunId = 0
  var worker = null

  /* 编辑器状态（按选中文件）——抽帧/编码运行期变量 */
  var run = {
    runId: 0,
    cancel: false
  }

  /* DOM refs */
  var dom = {}

  /* ---- Worker ---- */
  function ensureWorker () {
    if (worker) return worker
    try {
      worker = new Worker('./js/videogif-worker.js')
      worker.onmessage = onWorkerMessage
      worker.onerror = function (e) {
        toast('编码 Worker 出错: ' + (e.message || '未知错误'), 'err')
      }
    } catch (e) {
      worker = null
      toast('无法启动编码 Worker', 'err')
    }
    return worker
  }

  function onWorkerMessage (e) {
    var msg = e.data || {}
    /* 启动期致命错误（无 id）：直接提示，不绑定具体运行 */
    if (msg.type === 'error' && msg.id === undefined) {
      toast('编码 Worker 不可用: ' + (msg.message || '未知错误'), 'err')
      if (state.processing) onFail(msg.message || 'Worker 不可用')
      return
    }
    if (msg.id !== run.runId) return /* 过期消息 */
    if (msg.type === 'progress') {
      if (dom.encodeFill) dom.encodeFill.style.width = ((msg.done / msg.total) * 100).toFixed(1) + '%'
      if (dom.encodeText) dom.encodeText.textContent = '编码中 ' + msg.done + ' / ' + msg.total + ' 帧'
    } else if (msg.type === 'done') {
      onEncodeDone(msg.bytes)
    } else if (msg.type === 'error') {
      onFail('编码失败: ' + (msg.message || '未知错误'))
    }
  }

  /* ---- DOM 收集 ---- */
  function collectDom () {
    dom.zone = qs('[data-vg-upload]')
    dom.fileInput = qs('[data-vg-file-input]')
    dom.fileList = qs('[data-vg-file-list]')
    dom.batchBtn = qs('[data-vg-batch]')
    dom.clearBtn = qs('[data-vg-clear]')
    dom.editor = qs('[data-vg-editor]')
    dom.emptyHint = qs('[data-vg-empty]')
    dom.editorBody = qs('[data-vg-editor-body]')
    dom.video = qs('[data-vg-video]')
    dom.stage = qs('[data-vg-stage]')
    dom.cropLayer = qs('[data-vg-crop-layer]')
    dom.cropRect = qs('[data-vg-crop-rect]')
    dom.cropHandles = qs('[data-vg-crop-handles]')
    dom.cropInfo = qs('[data-vg-crop-info]')
    dom.resetCropBtn = qs('[data-vg-reset-crop]')
    dom.timelineTrack = qs('[data-vg-timeline]')
    dom.rangeStart = qs('[data-vg-range-start]')
    dom.rangeEnd = qs('[data-vg-range-end]')
    dom.playhead = qs('[data-vg-playhead]')
    dom.startInput = qs('[data-vg-start-input]')
    dom.endInput = qs('[data-vg-end-input]')
    dom.playSelBtn = qs('[data-vg-play-sel]')
    dom.fpsSlider = qs('[data-vg-fps]')
    dom.fpsVal = qs('[data-vg-fps-val]')
    dom.sizeGroup = qs('[data-vg-size-group]')
    dom.manualWidth = qs('[data-vg-manual-width]')
    dom.manualHeight = qs('[data-vg-manual-height]')
    dom.keepRatio = qs('[data-vg-switch-keepratio]')
    dom.colorGroup = qs('[data-vg-color-group]')
    dom.formatGroup = qs('[data-vg-format-group]')
    dom.loopGroup = qs('[data-vg-loop-group]')
    dom.presetGroup = qs('[data-vg-preset-group]')
    dom.genBtn = qs('[data-vg-generate]')
    dom.cancelBtn = qs('[data-vg-cancel]')
    dom.extractWrap = qs('[data-vg-extract-wrap]')
    dom.extractFill = qs('[data-vg-extract-fill]')
    dom.extractText = qs('[data-vg-extract-text]')
    dom.encodeWrap = qs('[data-vg-encode-wrap]')
    dom.encodeFill = qs('[data-vg-encode-fill]')
    dom.encodeText = qs('[data-vg-encode-text]')
    dom.resultWrap = qs('[data-vg-result-wrap]')
    dom.resultImg = qs('[data-vg-result-img]')
    dom.resultInfo = qs('[data-vg-result-info]')
    dom.downloadBtn = qs('[data-vg-download]')
    dom.regenBtn = qs('[data-vg-regenerate]')
    dom.curName = qs('[data-vg-cur-name]')
    dom.curMeta = qs('[data-vg-cur-meta]')
  }

  /* ---- 文件列表 ---- */
  function addFiles (fileArr) {
    var added = 0
    for (var i = 0; i < fileArr.length; i++) {
      var f = fileArr[i]
      if (!f.type.startsWith('video/')) continue
      if (state.files.some(function (x) { return x.name === f.name && x.size === f.size })) continue
      var id = ++idSeq
      var url = URL.createObjectURL(f)
      var item = {
        id: id, file: f, name: f.name, size: f.size, type: f.type,
        videoUrl: url, thumb: '', duration: 0, vw: 0, vh: 0,
        status: 'pending', gif: null, error: ''
      }
      state.files.push(item)
      added++
      loadMeta(item)
    }
    if (added) {
      renderFileList()
      /* 拖入文件后直接默认开启编辑第一个文件，无需用户手动点编辑 */
      selectFile(state.files[0].id)
    } else {
      toast('未添加视频文件（仅支持视频格式）', 'err')
    }
  }

  function loadMeta (item) {
    var v = document.createElement('video')
    v.preload = 'metadata'
    v.muted = true
    v.src = item.videoUrl
    var done = false
    v.onloadedmetadata = function () {
      if (done || !container) return
      done = true
      item.duration = v.duration || 0
      item.vw = v.videoWidth || 0
      item.vh = v.videoHeight || 0
      /* 生成首帧缩略图 */
      try {
        v.currentTime = Math.min(0.1, (item.duration || 1) * 0.05)
      } catch (e) { /* ignore */ }
    }
    v.onseeked = function () {
      if (!container) return
      try {
        var c = document.createElement('canvas')
        var tw = 96, th = Math.max(1, Math.round(tw * (item.vh || 1) / (item.vw || 1)))
        c.width = tw; c.height = th
        var cx = c.getContext('2d')
        cx.drawImage(v, 0, 0, tw, th)
        item.thumb = c.toDataURL('image/jpeg', 0.6)
      } catch (e) { /* 某些格式无法截帧，留空 */ }
      renderFileList()
    }
    v.onerror = function () {
      if (done || !container) return
      done = true
      item.status = 'error'
      item.error = '无法读取视频'
      renderFileList()
    }
  }

  function removeFile (id) {
    var idx = state.files.findIndex(function (x) { return x.id === id })
    if (idx < 0) return
    var item = state.files[idx]
    URL.revokeObjectURL(item.videoUrl)
    if (item.gif) URL.revokeObjectURL(item.gif.url)
    state.files.splice(idx, 1)
    if (state.selectedId === id) {
      state.selectedId = state.files.length ? state.files[0].id : null
      selectFile(state.selectedId)
    }
    renderFileList()
  }

  function renderFileList () {
    if (!dom.fileList) return
    if (!state.files.length) { dom.fileList.innerHTML = ''; return }
    dom.fileList.innerHTML = state.files.map(function (f) {
      var statusLabel, statusCls
      if (f.status === 'done') { statusLabel = '已生成'; statusCls = 'done' }
      else if (f.status === 'error') { statusLabel = f.error || '失败'; statusCls = 'error' }
      else if (f.status === 'processing') { statusLabel = '处理中'; statusCls = 'processing' }
      else { statusLabel = '待编辑'; statusCls = 'pending' }
      var sel = f.id === state.selectedId ? ' data-selected="true"' : ''
      var thumbHtml = f.thumb
        ? '<img class="vg-file-item__thumb" src="' + f.thumb + '" alt="" />'
        : '<span class="vg-file-item__thumb vg-file-item__thumb--ph">&#127916;</span>'
      var meta = (f.vw ? f.vw + 'x' + f.vh : '—') + ' · ' + (f.duration ? fmtTime(f.duration) : '—') + ' · ' + fmt(f.size)
      return '<div class="vg-file-item" data-fid="' + f.id + '"' + sel + '>' +
        thumbHtml +
        '<div class="vg-file-item__info">' +
          '<div class="vg-file-item__name">' + esc(f.name) + '</div>' +
          '<div class="vg-file-item__meta">' + meta + '</div>' +
          '<span class="vg-file-item__status" data-status="' + statusCls + '">' + esc(statusLabel) + '</span>' +
        '</div>' +
        '<div class="vg-file-item__actions">' +
          '<button class="vg-file-item__btn" data-edit="' + f.id + '" type="button" title="编辑">编辑</button>' +
          '<button class="vg-file-item__btn vg-file-item__btn--danger" data-remove="' + f.id + '" type="button" title="移除">&times;</button>' +
        '</div>' +
      '</div>'
    }).join('')
  }

  /* ---- 选中文件 → 进入编辑器 ---- */
  function selectFile (id) {
    /* 停止当前抽帧/播放 */
    stopPlayback()
    cancelRun()
    state.selectedId = id
    renderFileList()

    var item = id ? state.files.find(function (x) { return x.id === id }) : null
    if (!item) {
      if (dom.editorBody) dom.editorBody.hidden = true
      if (dom.emptyHint) dom.emptyHint.hidden = false
      if (dom.video) { dom.video.removeAttribute('src'); dom.video.load() }
      if (dom.stage) dom.stage.style.aspectRatio = ''
      hideResult()
      return
    }

    if (dom.emptyHint) dom.emptyHint.hidden = true
    if (dom.editorBody) dom.editorBody.hidden = false
    if (dom.curName) dom.curName.textContent = item.name
    if (dom.curMeta) dom.curMeta.textContent = (item.vw ? item.vw + ' × ' + item.vh : '—') + ' · ' + fmtTime(item.duration) + ' · ' + fmt(item.size)

    /* 重置编辑状态 */
    editorState = {
      vw: item.vw, vh: item.vh, duration: item.duration,
      /* 裁剪矩形（原始像素坐标） */
      crop: { x: 0, y: 0, w: item.vw, h: item.vh },
      /* 选段时间 */
      start: 0, end: item.duration,
      playing: false, playRaf: 0
    }
    applyDefaultSize()
    loadVideoIntoStage(item)
    renderTimeline()
    renderCropRect()
    if (item.status === 'done' && item.gif) showResult(item); else hideResult()
  }

  /* 编辑器临时状态 */
  var editorState = null

  function curItem () {
    return state.selectedId ? state.files.find(function (x) { return x.id === state.selectedId }) : null
  }

  function applyDefaultSize () {
    if (!editorState) return
    /* 默认「原尺寸」被选中；尺寸选择已在模板里 default active */
    updateManualSize()
  }

  function loadVideoIntoStage (item) {
    if (!dom.video) return
    dom.video.src = item.videoUrl
    dom.video.muted = true
    dom.video.load()
    /* 若元数据已知，立即适配舞台宽高比；否则等 loadedmetadata 事件 */
    if (item.vw && item.vh) applyStageAspect()
  }

  /* 舞台按视频真实宽高比自适应，避免固定 16:9 导致不同尺寸视频 letterbox 错位 */
  function applyStageAspect () {
    if (!dom.stage || !dom.video) return
    var vw = dom.video.videoWidth, vh = dom.video.videoHeight
    if (vw && vh) {
      dom.stage.style.aspectRatio = vw + ' / ' + vh
    }
  }

  /* ---- 尺寸计算 ---- */
  function getOutSize () {
    if (!editorState) return { w: 0, h: 0 }
    var cw = editorState.crop.w, ch = editorState.crop.h
    if (!cw || !ch) return { w: 0, h: 0 }
    var sel = dom.sizeGroup ? dom.sizeGroup.querySelector('[data-vg-size][data-active="true"]') : null
    var max = 0
    if (sel) {
      var v = sel.getAttribute('data-vg-size')
      if (v === 'custom') {
        var mw = parseInt(dom.manualWidth.value) || 0
        var mh = parseInt(dom.manualHeight.value) || 0
        var keep = dom.keepRatio && dom.keepRatio.checked
        if (mw && mh) return { w: mw, h: mh }
        if (mw && keep) return { w: mw, h: Math.round(ch * mw / cw) }
        if (mh && keep) return { w: Math.round(cw * mh / ch), h: mh }
        if (mw) return { w: mw, h: Math.round(ch * mw / cw) }
        if (mh) return { w: Math.round(cw * mh / ch), h: mh }
        return { w: cw, h: ch }
      }
      max = parseInt(v) || 0
    }
    if (max > 0) {
      var s = max / Math.max(cw, ch)
      if (s < 1) return { w: Math.round(cw * s), h: Math.round(ch * s) }
    }
    return { w: cw, h: ch }
  }

  function updateManualSize () {
    if (!editorState || !dom.manualWidth || !dom.manualHeight) return
    var cw = editorState.crop.w, ch = editorState.crop.h
    var sel = dom.sizeGroup ? dom.sizeGroup.querySelector('[data-vg-size][data-active="true"]') : null
    var isCustom = sel && sel.getAttribute('data-vg-size') === 'custom'
    dom.manualWidth.placeholder = cw || ''
    dom.manualHeight.placeholder = ch || ''
    dom.manualWidth.disabled = !isCustom
    dom.manualHeight.disabled = !isCustom
  }

  /* ---- 时间轴 ---- */
  function renderTimeline () {
    if (!editorState || !dom.timelineTrack) return
    var dur = editorState.duration || 0
    if (dom.startInput) dom.startInput.max = dur.toFixed(2)
    if (dom.endInput) dom.endInput.max = dur.toFixed(2)
    if (dom.startInput) dom.startInput.value = editorState.start.toFixed(2)
    if (dom.endInput) dom.endInput.value = editorState.end.toFixed(2)
    moveRangeHandles()
  }

  function moveRangeHandles () {
    if (!editorState || !dom.rangeStart || !dom.rangeEnd) return
    var dur = editorState.duration || 0
    var sp = dur ? (editorState.start / dur) * 100 : 0
    var ep = dur ? (editorState.end / dur) * 100 : 100
    dom.rangeStart.style.left = sp + '%'
    dom.rangeEnd.style.left = ep + '%'
    /* 选中区间高亮条 */
    if (dom.timelineTrack) {
      dom.timelineTrack.style.setProperty('--vg-sel-start', sp + '%')
      dom.timelineTrack.style.setProperty('--vg-sel-end', ep + '%')
    }
  }

  function movePlayhead (t) {
    if (!dom.playhead) return
    var dur = editorState ? (editorState.duration || 0) : 0
    var p = dur ? clamp(t / dur, 0, 1) * 100 : 0
    dom.playhead.style.left = p + '%'
  }

  /* 拖动时间轴把手 */
  function bindTimelineDrag () {
    function dragHandle (handle, which) {
      var dragging = false
      on(handle, 'pointerdown', function (e) {
        if (!editorState) return
        e.preventDefault()
        dragging = true
        handle.setPointerCapture(e.pointerId)
      })
      on(handle, 'pointermove', function (e) {
        if (!dragging || !editorState) return
        var dur = editorState.duration || 0
        var rect = dom.timelineTrack.getBoundingClientRect()
        var p = clamp((e.clientX - rect.left) / rect.width, 0, 1)
        var t = p * dur
        if (which === 'start') {
          editorState.start = clamp(t, 0, editorState.end - 0.05)
        } else {
          editorState.end = clamp(t, editorState.start + 0.05, dur)
        }
        if (dom.startInput) dom.startInput.value = editorState.start.toFixed(2)
        if (dom.endInput) dom.endInput.value = editorState.end.toFixed(2)
        moveRangeHandles()
      })
      var stopDrag = function (e) {
        if (!dragging) return
        dragging = false
        if (e && handle.releasePointerCapture && e.pointerId !== undefined) {
          try { handle.releasePointerCapture(e.pointerId) } catch (err) {}
        }
      }
      on(handle, 'pointerup', stopDrag)
      on(handle, 'pointercancel', stopDrag)
    }
    if (dom.rangeStart) dragHandle(dom.rangeStart, 'start')
    if (dom.rangeEnd) dragHandle(dom.rangeEnd, 'end')

    /* 点击轨道定位播放头 */
    on(dom.timelineTrack, 'click', function (e) {
      if (!editorState) return
      if (e.target === dom.rangeStart || e.target === dom.rangeEnd) return
      var rect = dom.timelineTrack.getBoundingClientRect()
      var p = clamp((e.clientX - rect.left) / rect.width, 0, 1)
      var t = p * (editorState.duration || 0)
      if (dom.video) { try { dom.video.currentTime = t } catch (err) {} }
      movePlayhead(t)
    })
  }

  /* 选中片段循环播放 */
  function togglePlaySel () {
    if (!editorState || !dom.video) return
    if (editorState.playing) { stopPlayback(); return }
    var v = dom.video
    editorState.playing = true
    if (dom.playSelBtn) dom.playSelBtn.textContent = '停止预览'
    try {
      v.currentTime = editorState.start
    } catch (e) {}
    /* 先启动播放头循环，避免 play() promise 延迟/拒绝导致进度条不动 */
    tickPlay()
    var p = v.play()
    if (p && typeof p.then === 'function') {
      p.catch(function () {
        /* 播放被阻止：回滚状态 */
        if (editorState && editorState.playing) stopPlayback()
      })
    }
  }

  function tickPlay () {
    if (!editorState || !editorState.playing) return
    var v = dom.video
    if (v.currentTime >= editorState.end - 0.02) {
      v.currentTime = editorState.start
    }
    movePlayhead(v.currentTime)
    editorState.playRaf = requestAnimationFrame(tickPlay)
  }

  function stopPlayback () {
    if (!editorState) return
    if (editorState.playing) {
      editorState.playing = false
      if (dom.video) { try { dom.video.pause() } catch (e) {} }
      if (dom.playSelBtn) dom.playSelBtn.textContent = '播放所选片段'
    }
    if (editorState.playRaf) { cancelAnimationFrame(editorState.playRaf); editorState.playRaf = 0 }
  }

  /* ---- 裁剪矩形 ---- */
  function renderCropRect () {
    if (!editorState || !dom.cropRect || !dom.stage) return
    var cw = editorState.crop.w, ch = editorState.crop.h, cx = editorState.crop.x, cy = editorState.crop.y
    var vw = editorState.vw, vh = editorState.vh
    if (!vw || !vh) return
    var lp = (cx / vw) * 100, tp = (cy / vh) * 100, wp = (cw / vw) * 100, hp = (ch / vh) * 100
    var rp = lp + wp, bp = tp + hp
    dom.cropRect.style.left = lp + '%'
    dom.cropRect.style.top = tp + '%'
    dom.cropRect.style.width = wp + '%'
    dom.cropRect.style.height = hp + '%'
    /* 裁剪层遮罩镂空：外圈顺时针绕整层，内圈逆时针绕裁剪框，
     * 借 evenodd 规则挖空裁剪框区域，遮罩只盖在裁剪框之外。 */
    if (dom.cropLayer) {
      var pts = [
        '0% 0%', '100% 0%', '100% 100%', '0% 100%', '0% 0%',      /* 外圈（顺时针） */
        lp + '% ' + tp + '%', lp + '% ' + bp + '%',                /* 内圈（逆时针） */
        rp + '% ' + bp + '%', rp + '% ' + tp + '%', lp + '% ' + tp + '%'
      ].join(', ')
      dom.cropLayer.style.clipPath = 'polygon(' + pts + ')'
      dom.cropLayer.style.webkitClipPath = 'polygon(' + pts + ')'
    }
    if (dom.cropInfo) dom.cropInfo.textContent = Math.round(cw) + ' × ' + Math.round(ch) + ' px（原始坐标）'
  }

  /* 裁剪拖拽：8 个把手 + 中间区域移动 */
  function bindCropDrag () {
    var handles = dom.cropHandles ? dom.cropHandles.querySelectorAll('[data-vg-handle]') : []
    var mode = null
    var startX = 0, startY = 0, orig = null

    function onDown (e, m) {
      if (!editorState) return
      e.preventDefault()
      e.stopPropagation()
      mode = m
      startX = e.clientX; startY = e.clientY
      orig = {
        x: editorState.crop.x, y: editorState.crop.y,
        w: editorState.crop.w, h: editorState.crop.h,
        vw: editorState.vw, vh: editorState.vh
      }
      if (e.currentTarget.setPointerCapture && e.pointerId !== undefined) {
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch (err) {}
      }
    }
    function onMove (e) {
      if (!mode || !editorState || !orig) return
      var rect = dom.stage.getBoundingClientRect()
      var dx = (e.clientX - startX) / rect.width * orig.vw
      var dy = (e.clientY - startY) / rect.height * orig.vh
      var nx = orig.x, ny = orig.y, nw = orig.w, nh = orig.h
      var minSize = 20
      if (mode.indexOf('e') >= 0) nw = clamp(orig.w + dx, minSize, orig.vw - orig.x)
      if (mode.indexOf('s') >= 0) nh = clamp(orig.h + dy, minSize, orig.vh - orig.y)
      if (mode.indexOf('w') >= 0) {
        var maxDx = orig.w - minSize
        var realDx = clamp(dx, -orig.x, maxDx)
        nx = orig.x + realDx; nw = orig.w - realDx
      }
      if (mode.indexOf('n') >= 0) {
        var maxDy = orig.h - minSize
        var realDy = clamp(dy, -orig.y, maxDy)
        ny = orig.y + realDy; nh = orig.h - realDy
      }
      if (mode === 'move') {
        nx = clamp(orig.x + dx, 0, orig.vw - orig.w)
        ny = clamp(orig.y + dy, 0, orig.vh - orig.h)
      }
      editorState.crop = { x: nx, y: ny, w: nw, h: nh }
      renderCropRect()
      updateManualSize()
    }
    function onUp (e) {
      if (!mode) return
      mode = null
      if (e && e.currentTarget && e.currentTarget.releasePointerCapture && e.pointerId !== undefined) {
        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch (err) {}
      }
    }
    handles.forEach(function (h) {
      var m = h.getAttribute('data-vg-handle')
      on(h, 'pointerdown', function (e) { onDown(e, m) })
      on(h, 'pointermove', onMove)
      on(h, 'pointerup', onUp)
      on(h, 'pointercancel', onUp)
    })
    /* 中间矩形整体移动 */
    if (dom.cropRect) {
      on(dom.cropRect, 'pointerdown', function (e) { onDown(e, 'move') })
      on(dom.cropRect, 'pointermove', onMove)
      on(dom.cropRect, 'pointerup', onUp)
      on(dom.cropRect, 'pointercancel', onUp)
    }
  }

  function resetCrop () {
    if (!editorState) return
    editorState.crop = { x: 0, y: 0, w: editorState.vw, h: editorState.vh }
    renderCropRect()
    updateManualSize()
  }

  /* ---- 参数读取 ---- */
  function getParams () {
    var fps = dom.fpsSlider ? parseInt(dom.fpsSlider.value) : 15
    var out = getOutSize()
    var colorSel = dom.colorGroup ? dom.colorGroup.querySelector('[data-vg-color][data-active="true"]') : null
    var maxColors = colorSel ? parseInt(colorSel.getAttribute('data-vg-color')) : 256
    var fmtSel = dom.formatGroup ? dom.formatGroup.querySelector('[data-vg-format][data-active="true"]') : null
    var format = fmtSel ? fmtSel.getAttribute('data-vg-format') : 'rgb565'
    var loopSel = dom.loopGroup ? dom.loopGroup.querySelector('[data-vg-loop][data-active="true"]') : null
    var repeat = loopSel ? parseInt(loopSel.getAttribute('data-vg-loop')) : 0
    return {
      fps: fps,
      outW: out.w, outH: out.h,
      maxColors: maxColors,
      format: format,
      repeat: repeat,
      delay: Math.round(1000 / fps)
    }
  }

  /* ---- 预设 ---- */
  function applyPreset (preset) {
    /* preset: smooth | standard | small | sticker */
    var map = {
      smooth: { fps: 24, color: 256, format: 'rgb565', size: '0' },
      standard: { fps: 15, color: 128, format: 'rgb565', size: '480' },
      small: { fps: 10, color: 64, format: 'rgb565', size: '360' },
      sticker: { fps: 8, color: 32, format: 'rgb565', size: '240' }
    }
    var p = map[preset]
    if (!p) return
    if (dom.fpsSlider) { dom.fpsSlider.value = p.fps; if (dom.fpsVal) dom.fpsVal.textContent = p.fps }
    setSegActive(dom.colorGroup, '[data-vg-color]', p.color, function (el) { return el.getAttribute('data-vg-color') === String(p.color) })
    setSegActive(dom.formatGroup, '[data-vg-format]', p.format, function (el) { return el.getAttribute('data-vg-format') === p.format })
    setSegActive(dom.sizeGroup, '[data-vg-size]', p.size, function (el) { return el.getAttribute('data-vg-size') === p.size })
    updateManualSize()
  }

  function setSegActive (group, selector, _val, matchFn) {
    if (!group) return
    var pills = group.querySelectorAll(selector)
    pills.forEach(function (el) {
      el.setAttribute('data-active', matchFn(el) ? 'true' : 'false')
    })
  }

  /* ---- 生成流程 ---- */
  function generate () {
    var item = curItem()
    if (!item) { toast('请先选择视频', 'err'); return }
    if (state.processing) { toast('正在处理中，请先取消', 'err'); return }
    if (!editorState || !editorState.vw) { toast('视频尚未就绪', 'err'); return }

    var params = getParams()
    if (!params.outW || !params.outH) { toast('输出尺寸无效', 'err'); return }
    if (editorState.end - editorState.start < 0.05) { toast('选段过短', 'err'); return }

    stopPlayback()
    state.processing = true
    state.aborted = false
    run.cancel = false
    var runId = ++processRunId
    run.runId = runId
    var msgId = runId
    if (dom.genBtn) dom.genBtn.hidden = true
    if (dom.cancelBtn) dom.cancelBtn.hidden = false
    if (dom.extractWrap) dom.extractWrap.hidden = false
    if (dom.encodeWrap) dom.encodeWrap.hidden = true
    if (dom.resultWrap) dom.resultWrap.hidden = true
    setExtract(0, '准备抽帧...')
    item.status = 'processing'
    renderFileList()

    extractAndEncode(item, params, runId, msgId)
  }

  function setExtract (pct, text) {
    if (dom.extractFill) dom.extractFill.style.width = pct.toFixed(1) + '%'
    if (dom.extractText) dom.extractText.textContent = text
  }
  function setEncode (pct, text) {
    if (dom.encodeFill) dom.encodeFill.style.width = pct.toFixed(1) + '%'
    if (dom.encodeText) dom.encodeText.textContent = text
  }

  function extractAndEncode (item, params, runId, msgId) {
    var v = dom.video
    if (!v) { onFail('视频元素缺失'); return }
    /* 计算时间点 */
    var start = editorState.start
    var end = editorState.end
    var step = 1 / params.fps
    var times = []
    for (var t = start; t <= end - 0.001; t += step) times.push(t)
    /* 至少 1 帧 */
    if (!times.length) times = [start]
    var total = times.length
    var frames = []
    var idx = 0
    var canvas = document.createElement('canvas')
    canvas.width = params.outW; canvas.height = params.outH
    var ctx = canvas.getContext('2d', { willReadFrequently: true })

    function seekNext () {
      if (!container || runId !== processRunId || run.cancel) { cleanup(); return }
      if (idx >= total) {
        cleanup()
        startEncode(frames, params, runId, msgId)
        return
      }
      var time = times[idx]
      var onSeeked = function () {
        v.removeEventListener('seeked', onSeeked)
        v.removeEventListener('error', onErr)
        if (!container || runId !== processRunId || run.cancel) { cleanup(); return }
        try {
          /* drawImage 源矩形 = 裁剪矩形（原始像素），目标 = 输出尺寸 */
          ctx.drawImage(v,
            editorState.crop.x, editorState.crop.y, editorState.crop.w, editorState.crop.h,
            0, 0, params.outW, params.outH)
          var imgData = ctx.getImageData(0, 0, params.outW, params.outH)
          frames.push(imgData.data)
        } catch (e) {
          cleanup()
          onFail('抽帧失败: ' + (e.message || '未知错误'))
          return
        }
        idx++
        setExtract((idx / total) * 100, '抽帧 ' + idx + ' / ' + total)
        /* 让出事件循环，避免 UI 卡死 */
        setTimeout(seekNext, 0)
      }
      var onErr = function () {
        v.removeEventListener('seeked', onSeeked)
        v.removeEventListener('error', onErr)
        cleanup()
        onFail('视频跳转失败，可能该时间点无法解码')
      }
      v.addEventListener('seeked', onSeeked)
      v.addEventListener('error', onErr)
      try { v.currentTime = time } catch (e) { onErr() }
    }
    function cleanup () { /* 占位，未来扩展 */ }

    /* 确保视频已加载到该源 */
    var onReady = function () {
      v.removeEventListener('loadeddata', onReady)
      seekNext()
    }
    if (v.readyState >= 2) { seekNext() }
    else {
      v.addEventListener('loadeddata', onReady)
      try { v.load() } catch (e) {}
    }
  }

  function startEncode (frames, params, runId, msgId) {
    if (!container || runId !== processRunId || run.cancel) return
    if (!frames.length) { onFail('未能提取到任何帧'); return }
    if (dom.extractWrap) dom.extractWrap.hidden = true
    if (dom.encodeWrap) dom.encodeWrap.hidden = false
    setEncode(0, '编码中 0 / ' + frames.length + ' 帧')
    var w = ensureWorker()
    if (!w) { onFail('编码 Worker 不可用'); return }
    /* 用 msgId 作为 worker 消息 id，与 onWorkerMessage 里的 run.runId 对比 */
    run.runId = msgId
    /* gifenc 在 worker 内部处理；传输帧的 ArrayBuffer 不可转移（getImageData 的 data 是副本，但为安全起见复制一份） */
    var transferFrames = frames.map(function (f) {
      /* f 是 Uint8ClampedArray；构造可转移的 ArrayBuffer 副本 */
      var buf = new ArrayBuffer(f.length)
      new Uint8Array(buf).set(f)
      return buf
    })
    /* 将 ArrayBuffer 包装回 Uint8Array 给 worker（worker 内按 Uint8Array 用） */
    var frameViews = transferFrames.map(function (b) { return new Uint8Array(b) })
    var transferList = transferFrames
    w.postMessage({
      id: msgId, type: 'encode',
      frames: frameViews,
      width: params.outW, height: params.outH,
      delay: params.delay, repeat: params.repeat,
      maxColors: params.maxColors, format: params.format
    }, transferList)
  }

  function onEncodeDone (bytesBuf) {
    var item = curItem()
    if (!item) return
    var bytes = new Uint8Array(bytesBuf)
    var blob = new Blob([bytes], { type: 'image/gif' })
    if (item.gif) URL.revokeObjectURL(item.gif.url)
    item.gif = {
      url: URL.createObjectURL(blob),
      size: blob.size,
      frames: 0,
      duration: editorState.end - editorState.start
    }
    /* 帧数无法从 bytes 反推，用抽帧总数近似；此处用 resultInfo 展示估算 */
    item.status = 'done'
    item.error = ''
    finishRun()
    showResult(item)
    renderFileList()
    toast('GIF 生成完成 (' + fmt(blob.size) + ')', 'ok')
  }

  function onFail (message) {
    var item = curItem()
    if (item) { item.status = 'error'; item.error = message; renderFileList() }
    finishRun()
    toast(message, 'err')
  }

  function finishRun () {
    state.processing = false
    state.aborted = false
    if (dom.genBtn) dom.genBtn.hidden = false
    if (dom.cancelBtn) dom.cancelBtn.hidden = true
    if (dom.extractWrap) dom.extractWrap.hidden = true
    if (dom.encodeWrap) dom.encodeWrap.hidden = true
  }

  function cancelRun () {
    if (!state.processing) return
    run.cancel = true
    state.aborted = true
    processRunId++
    finishRun()
    var item = curItem()
    if (item && item.status === 'processing') { item.status = 'pending'; renderFileList() }
    toast('已取消', 'info')
  }

  /* ---- 结果展示 ---- */
  function showResult (item) {
    if (!dom.resultWrap || !item.gif) return
    dom.resultWrap.hidden = false
    if (dom.resultImg) dom.resultImg.src = item.gif.url
    if (dom.resultInfo) {
      var params = getParams()
      dom.resultInfo.textContent = fmt(item.gif.size) + ' · ' + params.outW + '×' + params.outH + ' · ' + params.fps + 'fps'
    }
  }
  function hideResult () {
    if (dom.resultWrap) dom.resultWrap.hidden = true
  }

  function downloadGif () {
    var item = curItem()
    if (!item || !item.gif) return
    var a = document.createElement('a')
    a.href = item.gif.url
    var dot = item.name.lastIndexOf('.')
    var base = dot > 0 ? item.name.slice(0, dot) : item.name
    a.download = base + '.gif'
    document.body.appendChild(a)
    a.click()
    setTimeout(function () { a.remove() }, 200)
  }

  /* ---- 批量生成全部 ---- */
  function batchGenerate () {
    if (state.processing) { toast('正在处理中', 'err'); return }
    var pending = state.files.filter(function (f) { return f.status !== 'done' && f.status !== 'processing' })
    if (!pending.length) { toast('没有待处理的视频', 'info'); return }
    runBatch(pending.slice(), 0)
  }

  function runBatch (queue, idx) {
    if (idx >= queue.length) {
      toast('批量生成完成', 'ok')
      return
    }
    if (!container) return
    var item = queue[idx]
    selectFile(item.id)
    /* 等待视频元数据 + DOM 更新 */
    var tryGen = function () {
      if (!container) return
      if (!editorState || !editorState.vw) { setTimeout(tryGen, 200); return }
      generate()
      /* 轮询完成 */
      var poll = function () {
        if (!container) return
        if (!state.processing) {
          if (item.status === 'done') runBatch(queue, idx + 1)
          else { toast(item.name + ' 失败，跳过', 'err'); runBatch(queue, idx + 1) }
          return
        }
        setTimeout(poll, 300)
      }
      poll()
    }
    setTimeout(tryGen, 400)
  }

  /* ---- 视频播放头同步 ---- */
  function bindVideoEvents () {
    if (!dom.video) return
    on(dom.video, 'timeupdate', function () {
      if (!editorState) return
      if (editorState.playing) return /* 由 tickPlay 处理 */
      movePlayhead(dom.video.currentTime)
    })
    on(dom.video, 'loadedmetadata', function () {
      if (!dom.video) return
      /* 与文件元数据对齐 */
      var item = curItem()
      if (item) {
        item.vw = dom.video.videoWidth || item.vw
        item.vh = dom.video.videoHeight || item.vh
        item.duration = dom.video.duration || item.duration
      }
      if (editorState) {
        editorState.vw = dom.video.videoWidth || editorState.vw
        editorState.vh = dom.video.videoHeight || editorState.vh
        editorState.duration = dom.video.duration || editorState.duration
        /* 裁剪矩形适配真实视频尺寸（首次加载时 vw/vh 此前为 0） */
        if (editorState.vw && editorState.vh) {
          editorState.crop = { x: 0, y: 0, w: editorState.vw, h: editorState.vh }
        }
        /* 舞台按视频真实宽高比自适应，避免 letterbox 导致裁剪框错位 */
        applyStageAspect()
        renderCropRect()
        renderTimeline()
        /* 元数据就绪后同步播放头到当前时间，避免卡在 0 */
        movePlayhead(dom.video.currentTime || 0)
      }
      if (item) renderFileList()
    })
    /* durationchange 兜底：某些视频 loadedmetadata 时 duration 尚为 Infinity，
     * 待 durationchange 才得到真实时长，此时再刷新时间轴与播放头 */
    on(dom.video, 'durationchange', function () {
      if (!editorState || !dom.video) return
      var d = dom.video.duration
      if (isFinite(d) && d > 0) {
        editorState.duration = d
        var item = curItem()
        if (item) { item.duration = d; renderFileList() }
        /* 若选段越界则收拢到有效范围 */
        if (editorState.end > d) editorState.end = d
        if (editorState.start > editorState.end - 0.05) editorState.start = 0
        renderTimeline()
        movePlayhead(dom.video.currentTime || 0)
      }
    })
  }

  /* ---- 分段控件通用 ---- */
  function bindSeg (group, selector, onChange) {
    if (!group) return
    var pills = group.querySelectorAll(selector)
    pills.forEach(function (el) {
      on(el, 'click', function () {
        pills.forEach(function (p) { p.setAttribute('data-active', 'false') })
        el.setAttribute('data-active', 'true')
        if (onChange) onChange(el)
      })
    })
  }

  /* ---- 事件绑定 ---- */
  function on (el, evt, fn) {
    if (el) el.addEventListener(evt, fn, ac ? { signal: ac.signal } : undefined)
  }

  function init () {
    /* 上传区 */
    on(dom.zone, 'click', function (e) {
      if (e.target.closest('button')) return
      if (dom.fileInput) dom.fileInput.click()
    })
    on(dom.fileInput, 'change', function () {
      if (dom.fileInput && dom.fileInput.files.length) addFiles(dom.fileInput.files)
      if (dom.fileInput) dom.fileInput.value = ''
    })
    on(dom.zone, 'dragover', function (e) { e.preventDefault(); if (dom.zone) dom.zone.setAttribute('data-dragover', 'true') })
    on(dom.zone, 'dragleave', function () { if (dom.zone) dom.zone.setAttribute('data-dragover', 'false') })
    on(dom.zone, 'drop', function (e) {
      e.preventDefault(); if (dom.zone) dom.zone.setAttribute('data-dragover', 'false')
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
    })

    /* 文件列表 */
    on(dom.fileList, 'click', function (e) {
      var editBtn = e.target.closest('[data-edit]')
      if (editBtn) { selectFile(parseInt(editBtn.getAttribute('data-edit'))); return }
      var rmBtn = e.target.closest('[data-remove]')
      if (rmBtn) { removeFile(parseInt(rmBtn.getAttribute('data-remove'))); return }
      var item = e.target.closest('[data-fid]')
      if (item) selectFile(parseInt(item.getAttribute('data-fid')))
    })
    on(dom.batchBtn, 'click', batchGenerate)
    on(dom.clearBtn, 'click', function () {
      state.files.forEach(function (f) {
        URL.revokeObjectURL(f.videoUrl)
        if (f.gif) URL.revokeObjectURL(f.gif.url)
      })
      state.files = []
      state.selectedId = null
      selectFile(null)
      renderFileList()
    })

    /* 裁剪 */
    on(dom.resetCropBtn, 'click', resetCrop)
    bindCropDrag()

    /* 时间轴 */
    bindTimelineDrag()
    on(dom.playSelBtn, 'click', togglePlaySel)
    on(dom.startInput, 'input', function () {
      if (!editorState) return
      var v = parseFloat(dom.startInput.value) || 0
      editorState.start = clamp(v, 0, editorState.end - 0.05)
      moveRangeHandles()
    })
    on(dom.endInput, 'input', function () {
      if (!editorState) return
      var v = parseFloat(dom.endInput.value) || 0
      editorState.end = clamp(v, editorState.start + 0.05, editorState.duration)
      moveRangeHandles()
    })

    /* FPS 滑块 */
    on(dom.fpsSlider, 'input', function () {
      if (dom.fpsVal) dom.fpsVal.textContent = dom.fpsSlider.value
    })

    /* 分段控件 */
    bindSeg(dom.sizeGroup, '[data-vg-size]', function () { updateManualSize() })
    bindSeg(dom.colorGroup, '[data-vg-color]')
    bindSeg(dom.formatGroup, '[data-vg-format]')
    bindSeg(dom.loopGroup, '[data-vg-loop]')
    bindSeg(dom.presetGroup, '[data-vg-preset]', function (el) {
      applyPreset(el.getAttribute('data-vg-preset'))
    })

    /* 手动尺寸 + 保持比例 */
    on(dom.manualWidth, 'input', function () {
      if (!editorState || !dom.keepRatio || !dom.keepRatio.checked) return
      var mw = parseInt(dom.manualWidth.value) || 0
      if (mw && editorState.crop.w) dom.manualHeight.value = Math.round(editorState.crop.h * mw / editorState.crop.w)
    })
    on(dom.manualHeight, 'input', function () {
      if (!editorState || !dom.keepRatio || !dom.keepRatio.checked) return
      var mh = parseInt(dom.manualHeight.value) || 0
      if (mh && editorState.crop.h) dom.manualWidth.value = Math.round(editorState.crop.w * mh / editorState.crop.h)
    })

    /* 生成 */
    on(dom.genBtn, 'click', generate)
    on(dom.cancelBtn, 'click', cancelRun)
    on(dom.regenBtn, 'click', generate)
    on(dom.downloadBtn, 'click', downloadGif)

    bindVideoEvents()

    /* 初始：无选中 */
    selectFile(null)
  }

  function mount (el) {
    container = el
    ac = new AbortController()
    collectDom()
    init()
  }

  function unmount () {
    if (ac) { ac.abort(); ac = null }
    processRunId++
    run.cancel = true
    state.processing = false
    stopPlayback()
    /* 撤销所有 blob URL */
    state.files.forEach(function (f) {
      URL.revokeObjectURL(f.videoUrl)
      if (f.gif) URL.revokeObjectURL(f.gif.url)
    })
    state.files = []
    state.selectedId = null
    if (worker) { try { worker.terminate() } catch (e) {} worker = null }
    if (dom.video) { try { dom.video.pause(); dom.video.removeAttribute('src'); dom.video.load() } catch (e) {} }
    editorState = null
    dom = {}
    container = null
  }

  window.__page_videogif = { mount: mount, unmount: unmount }
})()
