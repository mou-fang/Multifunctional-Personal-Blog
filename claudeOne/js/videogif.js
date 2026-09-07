/* Video to GIF — per-file edits, abortable streaming conversion, SPA lifecycle. */
;(function () {
  'use strict'
  var core = window.VideoGifCore
  var common = window.ClaudeOne || {}
  var esc = common.escapeHtml || function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
  var container, lifecycle, dom = {}, files = [], selectedId = null, sequence = 0, task = null, playing = false, raf = 0
  var clamp = core.clamp
  function qs (s) { return container.querySelector(s) }
  function on (el, type, fn) { if (el) el.addEventListener(type, fn, { signal: lifecycle.signal }) }
  function current () { return files.find(function (f) { return f.id === selectedId }) }
  function edit () { var f = current(); return f && f.edit }
  function settingsKey (item) { try { return JSON.stringify(core.plan(item.edit, item)) } catch (e) { return '' } }
  function fmt (n) { return n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB' }
  function time (s) { return Number(s).toFixed(2).replace(/0$/, '') }
  function aborted () { return new DOMException('已取消', 'AbortError') }
  function check (signal) { if (signal.aborted) throw aborted() }
  function message (text, error) { if (!container) return; dom.notice.textContent = text; dom.notice.dataset.error = error ? 'true' : 'false'; dom.notice.hidden = !text }
  function releaseVideo (v) { v.pause(); v.removeAttribute('src'); v.load() }
  function releaseFile (f) { f.controller.abort(); URL.revokeObjectURL(f.url); if (f.gif) URL.revokeObjectURL(f.gif.url) }

  // Every media wait has an error path, timeout and abort cleanup, including same-time seeks.
  function waitMedia (video, event, ready, signal, action) {
    return new Promise(function (resolve, reject) {
      var timer
      function cleanup () { clearTimeout(timer); video.removeEventListener(event, ok); video.removeEventListener('error', fail); signal.removeEventListener('abort', cancel) }
      function ok () { if (!ready()) return; cleanup(); resolve() }
      function fail () { cleanup(); reject(new Error('浏览器无法解码此视频，请换用 H.264 MP4 或 WebM 文件')) }
      function cancel () { cleanup(); reject(aborted()) }
      if (signal.aborted) { reject(aborted()); return }
      video.addEventListener(event, ok)
      video.addEventListener('error', fail)
      signal.addEventListener('abort', cancel, { once: true })
      timer = setTimeout(function () { cleanup(); reject(new Error('读取视频超时，请尝试更短的视频或其他格式')) }, 15000)
      try { if (action) action(); ok() } catch (e) { cleanup(); reject(e) }
    })
  }
  function seek (video, t, signal) {
    if (!video.seeking && video.readyState >= 2 && Math.abs(video.currentTime - t) < 0.00001) { check(signal); return Promise.resolve() }
    return waitMedia(video, 'seeked', function () { return !video.seeking && video.readyState >= 2 }, signal, function () { video.currentTime = t })
  }
  async function readMeta (item) {
    var v = document.createElement('video'), signal = item.controller.signal
    v.preload = 'auto'; v.muted = true; v.playsInline = true
    try {
      await waitMedia(v, 'loadeddata', function () { return v.readyState >= 2 }, signal, function () { v.src = item.url; v.load() })
      check(signal)
      if (!Number.isFinite(v.duration) || v.duration <= 0 || !v.videoWidth || !v.videoHeight) throw new Error('此视频缺少有效时长或画面信息，请重新导出为 MP4 / WebM')
      item.vw = v.videoWidth; item.vh = v.videoHeight; item.duration = v.duration
      item.edit = core.defaults(item.vw, item.vh, item.duration)
      var canvas = document.createElement('canvas')
      var scale = 96 / Math.max(item.vw, item.vh)
      canvas.width = Math.max(1, Math.round(item.vw * scale)); canvas.height = Math.max(1, Math.round(item.vh * scale))
      canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height)
      item.thumb = canvas.toDataURL('image/jpeg', 0.65)
      item.status = 'pending'
    } catch (e) {
      if (signal.aborted) return
      item.status = 'error'; item.error = e.message
    } finally { releaseVideo(v) }
    if (!signal.aborted && container) {
      renderFiles()
      if (selectedId === item.id) selectFile(item.id, true)
    }
  }
  function addFiles (incoming) {
    if (task) return
    var added = [], skipped = 0, duplicates = 0
    Array.from(incoming).forEach(function (file) {
      if (!file.type.startsWith('video/') && !/\.(mp4|m4v|webm|mov|mkv|avi|ogv)$/i.test(file.name)) { skipped++; return }
      if (files.some(function (f) { return f.name === file.name && f.file.size === file.size && f.file.lastModified === file.lastModified })) { duplicates++; return }
      var item = { id: ++sequence, file: file, name: file.name, url: URL.createObjectURL(file), status: 'loading', error: '', gif: null, edit: null, controller: new AbortController() }
      files.push(item); added.push(item)
      item.ready = readMeta(item)
    })
    if (added.length) selectFile(added[0].id)
    renderFiles()
    message((skipped ? '已跳过 ' + skipped + ' 个非视频文件。' : '') + (duplicates ? '已跳过 ' + duplicates + ' 个重复文件。' : ''))
  }
  function renderFiles () {
    if (!container) return
    dom.fileList.innerHTML = files.map(function (f) {
      var labels = { loading: '读取中', pending: f.gif ? '设置已修改' : '待生成', processing: '生成中', done: '已生成', error: '无法生成' }
      return '<div class="vg-file-item" data-selected="' + (f.id === selectedId) + '">' +
        (f.thumb ? '<img class="vg-file-item__thumb" src="' + f.thumb + '" alt="" />' : '<span class="vg-file-item__thumb vg-file-item__thumb--ph" aria-hidden="true">▶</span>') +
        '<button type="button" class="vg-file-item__info" data-select="' + f.id + '" aria-pressed="' + (f.id === selectedId) + '"' + (task ? ' disabled' : '') + '><span class="vg-file-item__name">' + esc(f.name) + '</span><span class="vg-file-item__meta">' + (f.duration ? time(f.duration) + ' 秒 · ' : '') + fmt(f.file.size) + '</span><span class="vg-file-item__status" data-status="' + f.status + '">' + labels[f.status] + '</span></button>' +
        '<button type="button" class="vg-file-item__btn vg-file-item__btn--danger" data-remove="' + f.id + '" aria-label="移除 ' + esc(f.name) + '"' + (task ? ' disabled' : '') + '>×</button></div>'
    }).join('')
    dom.batch.hidden = files.length < 2
    dom.batch.disabled = !!task || !files.some(function (f) { return f.status !== 'done' })
    dom.clear.hidden = !files.length
    dom.clear.disabled = !!task
    dom.fileInput.disabled = !!task
    dom.fileCount.textContent = files.length ? files.length + ' 个视频 · 设置分别保存' : '支持多选，所有处理均在本地完成'
  }
  function selectFile (id, internal) {
    if (task && !internal) return
    stopPlayback()
    selectedId = id
    var item = current()
    if (!internal) message(item && item.error || '', !!(item && item.error))
    dom.editorBody.hidden = !item || !item.edit
    dom.empty.hidden = !!(item && item.edit)
    dom.emptyText.textContent = !item ? '选一个视频，把精彩片段变成 GIF' : item.status === 'loading' ? '正在读取视频…' : item.error
    renderFiles()
    if (!item || !item.edit) { releaseVideo(dom.video); return }
    dom.curName.textContent = item.name
    dom.curMeta.textContent = item.vw + ' × ' + item.vh + ' · ' + time(item.duration) + ' 秒'
    dom.video.src = item.url
    dom.video.poster = item.thumb || ''
    dom.video.load()
    dom.stageInner.style.aspectRatio = item.vw + ' / ' + item.vh
    dom.stageInner.style.width = 'min(100%, ' + (340 * item.vw / item.vh) + 'px)'
    renderEdit()
    renderResult()
  }
  function activate (group, attribute, value) {
    group.querySelectorAll('[' + attribute + ']').forEach(function (button) {
      var active = button.getAttribute(attribute) === String(value)
      button.dataset.active = String(active); button.setAttribute('aria-pressed', String(active))
    })
  }
  function renderEdit () {
    var e = edit(), item = current()
    if (!e) return
    dom.start.value = time(e.start); dom.end.value = time(e.end)
    dom.start.max = item.duration; dom.end.max = item.duration
    dom.fps.value = e.fps; dom.fpsVal.textContent = e.fps
    dom.width.value = e.width; dom.height.value = e.height; dom.keepRatio.checked = e.keepRatio
    dom.width.placeholder = Math.round(e.crop.w); dom.height.placeholder = Math.round(e.crop.h)
    dom.custom.hidden = e.size !== 'custom'
    dom.cropToggle.setAttribute('aria-pressed', String(e.cropEnabled))
    dom.cropToggle.textContent = e.cropEnabled ? '完成裁剪' : '裁剪画面'
    dom.cropRect.hidden = !e.cropEnabled; dom.cropLayer.hidden = !e.cropEnabled; dom.cropFields.hidden = !e.cropEnabled
    activate(dom.presets, 'data-vg-preset', e.preset)
    activate(dom.sizes, 'data-vg-size', e.size)
    activate(dom.colors, 'data-vg-color', e.colors)
    activate(dom.loops, 'data-vg-loop', e.loop)
    renderTimeline(); renderCrop(); renderSummary()
  }
  function changed (custom) {
    var item = current()
    if (!item || !item.edit) return
    if (custom) item.edit.preset = ''
    if (item.gif) item.status = settingsKey(item) === item.gif.settings ? 'done' : 'pending'
    else item.status = 'pending'
    item.error = ''
    renderSummary(); renderResult(); renderFiles()
  }
  function renderSummary () {
    var item = current()
    if (!item || !item.edit) return
    var text, invalid = false
    try {
      var p = core.plan(item.edit, item)
      text = time(p.duration) + ' 秒 · ' + p.width + ' × ' + p.height + ' px · ' + p.fps + ' fps · ' + p.frames + ' 帧'
    } catch (e) { text = e.message; invalid = true }
    dom.summary.textContent = text; dom.summary.dataset.error = String(invalid)
    dom.generate.disabled = !!task || invalid
    dom.regenerate.disabled = !!task || invalid
    dom.fps.style.setProperty('--vg-range', ((item.edit.fps - 3) / 27 * 100) + '%')
  }
  function renderTimeline () {
    var e = edit(), item = current()
    if (!e) return
    var start = e.start / item.duration * 100, end = e.end / item.duration * 100
    dom.rangeStart.style.left = start + '%'; dom.rangeEnd.style.left = end + '%'
    dom.timeline.style.setProperty('--vg-sel-start', start + '%'); dom.timeline.style.setProperty('--vg-sel-end', end + '%')
    ;[[dom.rangeStart, 'start'], [dom.rangeEnd, 'end']].forEach(function (pair) {
      pair[0].setAttribute('aria-valuemin', '0'); pair[0].setAttribute('aria-valuemax', String(item.duration)); pair[0].setAttribute('aria-valuenow', String(e[pair[1]])); pair[0].setAttribute('aria-valuetext', time(e[pair[1]]) + ' 秒')
    })
    dom.duration.textContent = '已选 ' + time(e.end - e.start) + ' 秒'
  }
  function setRange (which, value, preview) {
    if (!edit() || task) return
    stopPlayback()
    var e = edit(), r = core.normalizeRange(which === 'start' ? value : e.start, which === 'end' ? value : e.end, current().duration, which)
    e.start = r.start; e.end = r.end
    dom.start.value = time(e.start); dom.end.value = time(e.end)
    renderTimeline(); changed()
    if (preview) { try { dom.video.currentTime = which === 'start' ? e.start : Math.max(e.start, e.end - 0.02) } catch (err) {} }
  }
  function stopPlayback () {
    playing = false; cancelAnimationFrame(raf); raf = 0
    if (dom.video) dom.video.pause()
    if (dom.play) { dom.play.textContent = '▶ 预览片段'; dom.play.setAttribute('aria-pressed', 'false') }
  }
  async function play () {
    if (playing) { stopPlayback(); return }
    if (!edit() || task) return
    var item = current()
    try {
      dom.video.currentTime = item.edit.start
      playing = true
      await dom.video.play()
      if (!playing || current() !== item || task) return
      dom.play.textContent = 'Ⅱ 暂停预览'; dom.play.setAttribute('aria-pressed', 'true')
      function tick () {
        if (!playing) return
        if (dom.video.currentTime >= item.edit.end - 0.015 || dom.video.ended) { dom.video.currentTime = item.edit.start; dom.video.play().catch(stopPlayback) }
        dom.playhead.style.left = (dom.video.currentTime / item.duration * 100) + '%'
        raf = requestAnimationFrame(tick)
      }
      tick()
    } catch (e) { stopPlayback(); message('暂时无法预览，请重新选择视频', true) }
  }
  function renderCrop () {
    var e = edit(), item = current()
    if (!e) return
    var c = e.crop, left = c.x / item.vw * 100, top = c.y / item.vh * 100, right = (c.x + c.w) / item.vw * 100, bottom = (c.y + c.h) / item.vh * 100
    Object.assign(dom.cropRect.style, { left: left + '%', top: top + '%', width: (right - left) + '%', height: (bottom - top) + '%' })
    dom.cropLayer.style.clipPath = 'polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ' + left + '% ' + top + '%, ' + right + '% ' + top + '%, ' + right + '% ' + bottom + '%, ' + left + '% ' + bottom + '%, ' + left + '% ' + top + '%)'
    dom.cropInfo.textContent = Math.round(c.w) + ' × ' + Math.round(c.h) + ' · ' + (c.w === item.vw && c.h === item.vh ? '完整画面' : '已裁剪')
    ;['x', 'y', 'w', 'h'].forEach(function (key) { dom['crop' + key].value = Math.round(c[key]) })
  }
  function cropChanged () {
    var e = edit()
    if (e.keepRatio && Number(e.width) > 0) { e.height = Math.max(1, Math.round(e.crop.h * Number(e.width) / e.crop.w)); dom.height.value = e.height }
    renderCrop(); changed()
  }
  function bindCrop () {
    var drag = null
    on(dom.cropRect, 'pointerdown', function (ev) {
      if (!edit() || task || !edit().cropEnabled) return
      ev.preventDefault()
      drag = { id: selectedId, mode: ev.target.dataset.vgHandle || 'move', x: ev.clientX, y: ev.clientY, crop: Object.assign({}, edit().crop) }
      dom.cropRect.setPointerCapture(ev.pointerId)
    })
    on(dom.cropRect, 'pointermove', function (ev) {
      if (!drag || drag.id !== selectedId || task) return
      var bounds = dom.stageInner.getBoundingClientRect(), item = current(), c = drag.crop
      var dx = (ev.clientX - drag.x) / bounds.width * item.vw, dy = (ev.clientY - drag.y) / bounds.height * item.vh
      var x = c.x, y = c.y, right = c.x + c.w, bottom = c.y + c.h
      if (drag.mode === 'move') {
        x = clamp(c.x + dx, 0, item.vw - c.w); y = clamp(c.y + dy, 0, item.vh - c.h); right = x + c.w; bottom = y + c.h
      } else {
        if (drag.mode.includes('w')) x = clamp(c.x + dx, 0, right - 1)
        if (drag.mode.includes('e')) right = clamp(right + dx, x + 1, item.vw)
        if (drag.mode.includes('n')) y = clamp(c.y + dy, 0, bottom - 1)
        if (drag.mode.includes('s')) bottom = clamp(bottom + dy, y + 1, item.vh)
      }
      edit().crop = { x: Math.round(x), y: Math.round(y), w: Math.max(1, Math.round(right) - Math.round(x)), h: Math.max(1, Math.round(bottom) - Math.round(y)) }
      cropChanged()
    })
    ;['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (type) { on(dom.cropRect, type, function () { drag = null }) })
    on(dom.cropToggle, 'click', function () { edit().cropEnabled = !edit().cropEnabled; renderEdit() })
    on(dom.resetCrop, 'click', function () { var item = current(); item.edit.crop = { x: 0, y: 0, w: item.vw, h: item.vh }; cropChanged() })
    ;['x', 'y', 'w', 'h'].forEach(function (key) {
      function updateCrop (event) {
        var raw = dom['crop' + key].value
        if (event.type === 'input' && raw === '') return
        var c = edit().crop, item = current(), n = Math.round(Number(dom['crop' + key].value) || 0)
        if (key === 'x') c.x = clamp(n, 0, item.vw - c.w)
        if (key === 'y') c.y = clamp(n, 0, item.vh - c.h)
        if (key === 'w') c.w = clamp(n, 1, item.vw - c.x)
        if (key === 'h') c.h = clamp(n, 1, item.vh - c.y)
        cropChanged()
        if (event.type === 'input') dom['crop' + key].value = raw
      }
      on(dom['crop' + key], 'input', updateCrop)
      on(dom['crop' + key], 'blur', updateCrop)
    })
  }
  function setBusy () {
    dom.controls.disabled = !!task
    dom.cancel.hidden = !task; dom.progress.hidden = !task
    dom.generate.hidden = !!task; dom.regenerate.disabled = !!task
    dom.editor.setAttribute('aria-busy', String(!!task))
    renderFiles(); renderSummary()
  }
  function progress (value, text) { if (!container) return; dom.progressFill.style.width = value + '%'; dom.progressBar.setAttribute('aria-valuenow', String(Math.round(value))); dom.progressText.textContent = text }
  function workerRequest (worker, id, payload, expected, signal, transfer) {
    return new Promise(function (resolve, reject) {
      var timer
      function cleanup () { clearTimeout(timer); worker.removeEventListener('message', receive); worker.removeEventListener('error', fail); worker.removeEventListener('messageerror', fail); signal.removeEventListener('abort', cancel) }
      function receive (event) {
        var data = event.data || {}
        if (data.id !== id) return
        if (data.type === 'error') { cleanup(); reject(new Error(data.message)); return }
        if (data.type === expected) { cleanup(); resolve(data) }
      }
      function fail () { cleanup(); reject(new Error('GIF 编码器运行失败，请刷新后重试')) }
      function cancel () { cleanup(); reject(aborted()) }
      if (signal.aborted) { reject(aborted()); return }
      worker.addEventListener('message', receive); worker.addEventListener('error', fail); worker.addEventListener('messageerror', fail); signal.addEventListener('abort', cancel, { once: true })
      timer = setTimeout(function () { cleanup(); reject(new Error('GIF 编码超时，请减小输出尺寸后重试')) }, 30000)
      try { worker.postMessage(Object.assign({ id: id }, payload), transfer || []) } catch (e) { cleanup(); reject(e) }
    })
  }
  async function convert (item, signal, label) {
    var p = core.plan(item.edit, item), settings = JSON.stringify(p)
    var worker, video = document.createElement('video'), canvas = document.createElement('canvas'), id = ++sequence
    video.muted = true; video.preload = 'auto'; video.playsInline = true
    item.status = 'processing'; item.error = ''; renderFiles()
    try {
      check(signal)
      worker = new Worker('./js/videogif-worker.js')
      await workerRequest(worker, id, { type: 'start', width: p.width, height: p.height, colors: p.colors, repeat: p.repeat, total: p.frames }, 'ready', signal)
      await waitMedia(video, 'loadeddata', function () { return video.readyState >= 2 }, signal, function () { video.src = item.url; video.load() })
      canvas.width = p.width; canvas.height = p.height
      var ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('无法创建画布，请减小尺寸后重试')
      for (var i = 0; i < p.frames; i++) {
        await seek(video, p.times[i], signal)
        check(signal)
        ctx.drawImage(video, p.crop.x, p.crop.y, p.crop.w, p.crop.h, 0, 0, p.width, p.height)
        var buffer = ctx.getImageData(0, 0, p.width, p.height).data.buffer
        await workerRequest(worker, id, { type: 'frame', index: i, rgba: buffer, delay: p.delays[i] }, 'progress', signal, [buffer])
        progress((i + 1) / p.frames * 98, label + '已处理 ' + (i + 1) + ' / ' + p.frames + ' 帧')
      }
      var result = await workerRequest(worker, id, { type: 'finish' }, 'done', signal)
      check(signal)
      var blob = new Blob([result.bytes], { type: 'image/gif' })
      if (item.gif) URL.revokeObjectURL(item.gif.url)
      item.gif = { url: URL.createObjectURL(blob), size: blob.size, width: p.width, height: p.height, frames: p.frames, fps: p.fps, duration: p.duration, settings: settings }
      item.status = 'done'
    } finally {
      if (worker) worker.terminate()
      releaseVideo(video); canvas.width = 0; canvas.height = 0
    }
  }
  function waitReady (promise, signal) {
    return new Promise(function (resolve, reject) {
      function cancel () { reject(aborted()) }
      if (signal.aborted) { cancel(); return }
      signal.addEventListener('abort', cancel, { once: true })
      promise.then(function (result) { signal.removeEventListener('abort', cancel); resolve(result) }, function (error) { signal.removeEventListener('abort', cancel); reject(error) })
    })
  }
  async function startJobs (batch) {
    if (task) return
    var queue = batch ? files.filter(function (f) { return f.status !== 'done' }) : [current()].filter(Boolean)
    if (!queue.length) return
    stopPlayback(); message('')
    var active = { controller: new AbortController() }, succeeded = 0, failed = 0
    task = active; setBusy()
    try {
      for (var i = 0; i < queue.length; i++) {
        check(active.controller.signal)
        var item = queue[i], label = batch ? '视频 ' + (i + 1) + '/' + queue.length + ' · ' : ''
        progress(0, label + '准备视频…')
        // The metadata promise settles on decode errors, timeouts and file cancellation.
        await waitReady(item.ready, active.controller.signal)
        check(active.controller.signal)
        selectFile(item.id, true)
        try {
          if (!item.edit) throw new Error(item.error || '视频读取失败')
          await convert(item, active.controller.signal, label)
          succeeded++
          renderResult()
        } catch (e) {
          if (active.controller.signal.aborted) { item.status = item.gif && settingsKey(item) === item.gif.settings ? 'done' : 'pending'; throw e }
          failed++; item.status = 'error'; item.error = e.message
          message(item.name + '：' + e.message, true)
          if (!batch) break
        }
      }
      check(active.controller.signal)
      if (batch) message('批量完成：' + succeeded + ' 个成功' + (failed ? '，' + failed + ' 个失败，可在列表中查看并重试。' : '。点击视频可预览和下载。'), failed > 0)
      else if (succeeded) message('GIF 已生成，可以预览和下载。')
    } catch (e) { if (container && task === active) message(active.controller.signal.aborted ? '已取消，队列中剩余视频不会继续生成。' : e.message, !active.controller.signal.aborted) }
    finally {
      if (task === active) {
        task = null
        if (container) { setBusy(); renderFiles(); renderResult() }
      }
    }
  }
  function renderResult () {
    var item = current(), gif = item && item.gif
    dom.result.hidden = !gif
    if (!gif) { dom.resultImg.removeAttribute('src'); return }
    dom.resultImg.src = gif.url
    dom.resultInfo.textContent = fmt(gif.size) + ' · ' + gif.width + ' × ' + gif.height + ' · ' + time(gif.duration) + ' 秒 · ' + gif.frames + ' 帧'
    var stale = settingsKey(item) !== gif.settings
    dom.resultNote.textContent = stale ? '设置已修改，下方预览为上次结果。重新生成后生效。' : '生成完成 · 点击下载保存到设备'
    dom.download.textContent = stale ? '下载上次结果' : '下载 GIF'
  }
  function download () {
    var item = current()
    if (!item || !item.gif) return
    var a = document.createElement('a')
    a.href = item.gif.url; a.download = item.name.replace(/\.[^.]+$/, '') + '.gif'
    document.body.appendChild(a); a.click(); a.remove()
  }
  function bind () {
    on(dom.fileInput, 'change', function () { addFiles(dom.fileInput.files); dom.fileInput.value = '' })
    on(dom.zone, 'dragover', function (e) { e.preventDefault(); if (!task) dom.zone.dataset.dragover = 'true' })
    on(dom.zone, 'dragleave', function () { dom.zone.dataset.dragover = 'false' })
    on(dom.zone, 'drop', function (e) { e.preventDefault(); dom.zone.dataset.dragover = 'false'; addFiles(e.dataTransfer.files) })
    on(dom.fileList, 'click', function (e) {
      if (task) return
      var select = e.target.closest('[data-select]'), remove = e.target.closest('[data-remove]')
      if (select) selectFile(Number(select.dataset.select))
      if (remove) {
        var id = Number(remove.dataset.remove), item = files.find(function (f) { return f.id === id })
        files = files.filter(function (f) { return f.id !== id })
        if (selectedId === id) selectFile(files.length ? files[0].id : null)
        releaseFile(item); renderFiles()
      }
    })
    on(dom.clear, 'click', function () { if (task) return; var old = files; files = []; selectFile(null); old.forEach(releaseFile); message('') })
    on(dom.batch, 'click', function () { startJobs(true) })
    on(dom.generate, 'click', function () { startJobs(false) })
    on(dom.regenerate, 'click', function () { startJobs(false) })
    on(dom.cancel, 'click', function () { if (task) task.controller.abort() })
    on(dom.download, 'click', download)
    on(dom.play, 'click', play)
    on(dom.video, 'loadeddata', function () {
      var item = current()
      if (item && item.edit && !playing) {
        try { dom.video.currentTime = item.edit.start } catch (e) {}
      }
    })
    on(dom.video, 'timeupdate', function () { if (current() && current().duration) dom.playhead.style.left = (dom.video.currentTime / current().duration * 100) + '%' })
    ;['start', 'end'].forEach(function (which) {
      function updateRange (event) {
        var raw = dom[which].value
        if (event.type === 'input' && raw === '') return
        setRange(which, raw, true)
        if (event.type === 'input') dom[which].value = raw
      }
      on(dom[which], 'input', updateRange)
      on(dom[which], 'blur', updateRange)
    })
    on(dom.full, 'click', function () { edit().start = 0; setRange('end', current().duration, true) })
    ;[[dom.rangeStart, 'start'], [dom.rangeEnd, 'end']].forEach(function (pair) {
      var dragging = false, id
      function move (ev) {
        if (!dragging || id !== selectedId || task) return
        var r = dom.timeline.getBoundingClientRect()
        setRange(pair[1], clamp((ev.clientX - r.left) / r.width, 0, 1) * current().duration, true)
      }
      on(pair[0], 'pointerdown', function (ev) { if (task) return; ev.preventDefault(); dragging = true; id = selectedId; pair[0].setPointerCapture(ev.pointerId); move(ev) })
      on(pair[0], 'pointermove', move)
      ;['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (type) { on(pair[0], type, function () { dragging = false }) })
      on(pair[0], 'keydown', function (ev) {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) return
        ev.preventDefault()
        var value = ev.key === 'Home' ? 0 : ev.key === 'End' ? current().duration : edit()[pair[1]] + (ev.key === 'ArrowLeft' ? -1 : 1) * (ev.shiftKey ? 1 : 0.1)
        setRange(pair[1], value, true)
      })
    })
    on(dom.timeline, 'click', function (ev) { if (task || ev.target.closest('[role="slider"]')) return; var r = dom.timeline.getBoundingClientRect(); dom.video.currentTime = clamp((ev.clientX - r.left) / r.width, 0, 1) * current().duration })
    on(dom.presets, 'click', function (ev) {
      var button = ev.target.closest('[data-vg-preset]'); if (!button) return
      var key = button.dataset.vgPreset
      Object.assign(edit(), core.presets[key], { preset: key, width: '', height: '' })
      renderEdit(); changed()
    })
    ;[[dom.sizes, 'data-vg-size', 'size'], [dom.colors, 'data-vg-color', 'colors'], [dom.loops, 'data-vg-loop', 'loop']].forEach(function (group) {
      on(group[0], 'click', function (ev) { var button = ev.target.closest('[' + group[1] + ']'); if (!button) return; edit()[group[2]] = button.getAttribute(group[1]); if (group[2] !== 'loop') edit().preset = ''; renderEdit(); changed() })
    })
    on(dom.fps, 'input', function () { edit().fps = Number(dom.fps.value); edit().preset = ''; dom.fpsVal.textContent = edit().fps; activate(dom.presets, 'data-vg-preset', ''); changed() })
    ;['width', 'height'].forEach(function (key) {
      on(dom[key], 'input', function () {
        var e = edit(); e[key] = dom[key].value
        if (e.keepRatio && Number(e[key]) > 0) {
          var other = key === 'width' ? 'height' : 'width', ratio = key === 'width' ? e.crop.h / e.crop.w : e.crop.w / e.crop.h
          e[other] = Math.max(1, Math.round(Number(e[key]) * ratio)); dom[other].value = e[other]
        }
        changed(true)
      })
    })
    on(dom.keepRatio, 'change', function () { edit().keepRatio = dom.keepRatio.checked; cropChanged() })
    bindCrop()
  }
  function mount (element) {
    container = element; lifecycle = new AbortController()
    var refs = { zone: 'upload', fileInput: 'file-input', fileList: 'file-list', fileCount: 'file-count', batch: 'batch', clear: 'clear', editor: 'editor', editorBody: 'editor-body', empty: 'empty', emptyText: 'empty-text', curName: 'cur-name', curMeta: 'cur-meta', video: 'video', stageInner: 'stage-inner', cropRect: 'crop-rect', cropLayer: 'crop-layer', cropFields: 'crop-fields', cropToggle: 'crop-toggle', resetCrop: 'reset-crop', cropInfo: 'crop-info', cropx: 'crop-x', cropy: 'crop-y', cropw: 'crop-w', croph: 'crop-h', start: 'start-input', end: 'end-input', rangeStart: 'range-start', rangeEnd: 'range-end', timeline: 'timeline', playhead: 'playhead', duration: 'duration', play: 'play-sel', full: 'full', presets: 'preset-group', sizes: 'size-group', colors: 'color-group', loops: 'loop-group', fps: 'fps', fpsVal: 'fps-val', width: 'manual-width', height: 'manual-height', keepRatio: 'keep-ratio', custom: 'custom', controls: 'controls', generate: 'generate', cancel: 'cancel', regenerate: 'regenerate', summary: 'summary', progress: 'progress', progressBar: 'progress-bar', progressFill: 'progress-fill', progressText: 'progress-text', result: 'result-wrap', resultImg: 'result-img', resultInfo: 'result-info', resultNote: 'result-note', download: 'download', notice: 'notice' }
    Object.keys(refs).forEach(function (key) { dom[key] = qs('[data-vg-' + refs[key] + ']') })
    bind(); selectFile(null)
  }
  function unmount () {
    if (task) task.controller.abort()
    task = null
    if (lifecycle) lifecycle.abort()
    stopPlayback()
    if (dom.video) releaseVideo(dom.video)
    files.forEach(releaseFile); files = []; selectedId = null
    container = null; dom = {}
  }
  window.__page_videogif = { mount: mount, unmount: unmount }
})()
