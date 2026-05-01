/* ===== claudeOne :: compress.js ===== */
;(function () {
  'use strict'
  const C = window.ClaudeOne || {}
  const $ = (s, p) => (p || document).querySelector(s)
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)]
  const esc = C.escapeHtml || (s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]))
  const clamp = C.clamp || ((v, lo, hi) => Math.min(hi, Math.max(lo, v)))
  const fmt = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB'
  const toast = C.toast || (() => {})

  /* ---- State ---- */
  const state = {
    files: [],        // { id, file, name, size, type, width, height, thumb }
    results: [],      // { id, origFile, resultBlob, resultUrl, origUrl, origW, origH, outW, outH, origSize, outSize, ratio, status, error, abortCtrl }
    processing: false,
    aborted: false
  }
  let idSeq = 0

  /* ---- DOM refs ---- */
  const dom = {
    zone: $('[data-upload-zone]'),
    fileInput: $('[data-file-input]'),
    fileList: $('[data-file-list]'),
    startBtn: $('[data-start-compress]'),
    cancelBtn: $('[data-cancel-compress]'),
    clearBtn: $('[data-clear-all]'),
    progressWrap: $('[data-progress-wrap]'),
    progressText: $('[data-progress-text]'),
    progressCount: $('[data-progress-count]'),
    progressFill: $('[data-progress-fill]'),
    resultsSection: $('[data-results-section]'),
    resultsBody: $('[data-results-body]'),
    resultsEmpty: $('[data-results-empty]'),
    resultsSummary: $('[data-results-summary]'),
    downloadAllBtn: $('[data-download-all]'),
    downloadZipBtn: $('[data-download-zip]'),
    recompressBtn: $('[data-recompress]'),
    clearResultsBtn: $('[data-clear-results]'),
    qualitySlider: $('[data-quality]'),
    qualityVal: $('[data-quality-val]'),
    previewModal: $('[data-preview-modal]'),
    previewTitle: $('[data-preview-title]'),
    previewOrigImg: $('[data-preview-original]'),
    previewOrigInfo: $('[data-preview-original-info]'),
    previewCompImg: $('[data-preview-compressed]'),
    previewCompInfo: $('[data-preview-compressed-info]'),
    previewClose: $('[data-preview-close]'),
    namingPreview: $('[data-naming-preview]')
  }

  /* ---- Params ---- */
  function getParams () {
    const quality = parseFloat(dom.qualitySlider.value)
    const maxDimEl = $('[data-maxdim][data-active="true"]')
    let maxDim = 0
    if (maxDimEl) {
      const v = maxDimEl.dataset.maxdim
      maxDim = v === 'custom' ? parseInt($('[data-custom-maxdim]').value) || 0 : parseInt(v) || 0
    }
    const manualW = parseInt($('[data-manual-width]').value) || 0
    const manualH = parseInt($('[data-manual-height]').value) || 0
    const fmtEl = $('[data-format][data-active="true"]')
    const outputFormat = fmtEl ? fmtEl.dataset.format : 'keep'
    const maxSizeEl = $('[data-maxsize][data-active="true"]')
    let maxSizeMB = 0
    if (maxSizeEl) maxSizeMB = parseFloat(maxSizeEl.dataset.maxsize) || 0

    return {
      quality,
      maxDim,
      manualW,
      manualH,
      keepRatio: !$('[data-switch="keepRatio"] input') || $('[data-switch="keepRatio"] input').checked,
      outputFormat,
      maxSizeMB,
      useWebWorker: !$('[data-switch="useWebWorker"] input') || $('[data-switch="useWebWorker"] input').checked,
      preserveExif: $('[data-switch="preserveExif"] input') ? $('[data-switch="preserveExif"] input').checked : false,
      fixOrientation: $('[data-switch="fixOrientation"] input') ? $('[data-switch="fixOrientation"] input').checked : false,
      initialQuality: parseFloat($('[data-initial-quality]')?.value) || 0.8,
      maxIteration: parseInt($('[data-max-iteration]')?.value) || 10,
      bgColor: $('[data-bg-color]')?.value || '#ffffff',
      concurrency: parseInt($('[data-concurrency][data-active="true"]')?.dataset.concurrency) || 3,
      naming: $('[data-naming][data-active="true"]')?.dataset.naming || 'suffix_compressed',
      namingPrefix: $('[data-naming-prefix]')?.value || '',
      namingSuffix: $('[data-naming-suffix]')?.value || ''
    }
  }

  function getOutputMime (params, origType) {
    if (params.outputFormat === 'keep') return origType
    return params.outputFormat
  }

  function getExt (mime) {
    if (mime.includes('jpeg')) return 'jpg'
    if (mime.includes('png')) return 'png'
    if (mime.includes('webp')) return 'webp'
    return 'jpg'
  }

  function buildOutputName (origName, params, outMime) {
    const dot = origName.lastIndexOf('.')
    const base = dot > 0 ? origName.slice(0, dot) : origName
    const ext = getExt(outMime)
    const n = params.naming
    if (n === 'suffix_compressed') return base + '_compressed.' + ext
    if (n === 'suffix_format') {
      const fmtNames = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
      return base + '_' + (fmtNames[outMime] || ext) + '.' + ext
    }
    if (n === 'custom') return (params.namingPrefix || '') + base + (params.namingSuffix || '') + '.' + ext
    return base + '_compressed.' + ext
  }

  /* ---- File list ---- */
  function addFiles (fileArr) {
    for (const f of fileArr) {
      if (!f.type.startsWith('image/')) continue
      if (state.files.some(x => x.name === f.name && x.size === f.size)) continue
      const id = ++idSeq
      const url = URL.createObjectURL(f)
      const img = new Image()
      img.onload = () => {
        state.files.push({ id, file: f, name: f.name, size: f.size, type: f.type, width: img.naturalWidth, height: img.naturalHeight, thumb: url })
        renderFileList()
      }
      img.onerror = () => URL.revokeObjectURL(url)
      img.src = url
    }
  }

  function removeFile (id) {
    const idx = state.files.findIndex(x => x.id === id)
    if (idx < 0) return
    URL.revokeObjectURL(state.files[idx].thumb)
    state.files.splice(idx, 1)
    renderFileList()
  }

  function renderFileList () {
    const list = dom.fileList
    if (!list) return
    if (!state.files.length) { list.innerHTML = ''; return }
    list.innerHTML = state.files.map(f => `
      <div class="compress-file-item" data-fid="${f.id}">
        <img class="compress-file-item__thumb" src="${f.thumb}" alt="" />
        <div class="compress-file-item__info">
          <div class="compress-file-item__name">${esc(f.name)}</div>
          <div class="compress-file-item__meta">
            <span>${f.width} x ${f.height}</span>
            <span>${fmt(f.size)}</span>
            <span>${f.type.split('/')[1].toUpperCase()}</span>
          </div>
        </div>
        <button class="compress-file-item__remove btn-icon" data-remove-file="${f.id}" type="button" title="移除">&times;</button>
      </div>`).join('')
  }

  /* ---- Progress ---- */
  function showProgress (text, done, total) {
    dom.progressWrap.hidden = false
    dom.progressText.textContent = text
    dom.progressCount.textContent = done + ' / ' + total
    dom.progressFill.style.width = total ? ((done / total) * 100).toFixed(1) + '%' : '0%'
  }
  function hideProgress () { dom.progressWrap.hidden = true }

  /* ---- Image load ---- */
  function loadImage (file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => { resolve({ img, url }) }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('无法加载图片: ' + file.name)) }
      img.src = url
    })
  }

  /* ---- Canvas pipeline ---- */
  function calcScale (w, h, maxDim, manualW, manualH, keepRatio) {
    if (manualW && manualH) return { tw: manualW, th: manualH }
    if (manualW && keepRatio) return { tw: manualW, th: Math.round(h * manualW / w) }
    if (manualH && keepRatio) return { tw: Math.round(w * manualH / h), th: manualH }
    if (maxDim && (w > maxDim || h > maxDim)) {
      const s = maxDim / Math.max(w, h)
      return { tw: Math.round(w * s), th: Math.round(h * s) }
    }
    return { tw: w, th: h }
  }

  function hslToRgb (h, s, l) {
    h /= 360; s /= 100; l /= 100
    let r, g, b
    if (s === 0) { r = g = b = l } else {
      const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p }
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q
      r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3)
    }
    return [r * 255, g * 255, b * 255]
  }

  function adjustColor (r, g, b, sat, bri, con) {
    let h, s, l
    const rf = r / 255, gf = g / 255, bf = b / 255
    const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf), d = max - min
    l = (max + min) / 2
    if (d === 0) { h = 0; s = 0 } else {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      if (max === rf) h = ((gf - bf) / d + (gf < bf ? 6 : 0)) / 6
      else if (max === gf) h = ((bf - rf) / d + 2) / 6
      else h = ((rf - gf) / d + 4) / 6
    }
    h *= 360; s *= 100; l *= 100
    s = clamp(s + sat, 0, 100)
    l = clamp(l + bri, 0, 100)
    return hslToRgb(h, s, l)
  }

  function applyPixelEffects (ctx, w, h, img, params) {
    if (!params.pixelStroke && !params.gridLines) return
    const imgData = ctx.getImageData(0, 0, w, h)
    const d = imgData.data
    if (params.pixelStroke) {
      const bs = params.blockSize || 8
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'
      ctx.lineWidth = 0.5
      for (let y = 0; y < h; y += bs) for (let x = 0; x < w; x += bs) ctx.strokeRect(x, y, bs, bs)
    }
    if (params.gridLines) {
      ctx.strokeStyle = params.gridColor || '#000'
      ctx.globalAlpha = (params.gridOpacity || 30) / 100
      const bs = params.blockSize || 8
      ctx.lineWidth = 0.5
      for (let y = 0; y < h; y += bs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
      for (let x = 0; x < w; x += bs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
      ctx.globalAlpha = 1
    }
  }

  function canvasPipeline (img, file, params) {
    const ow = img.naturalWidth, oh = img.naturalHeight
    const { tw, th } = calcScale(ow, oh, params.maxDim, params.manualW, params.manualH, params.keepRatio)
    const cvs = document.createElement('canvas')
    cvs.width = tw; cvs.height = th
    const ctx = cvs.getContext('2d')

    // Fill background for JPEG
    const outMime = getOutputMime(params, file.type)
    if (outMime === 'image/jpeg' || outMime === 'image/png' && params.bgColor) {
      ctx.fillStyle = params.bgColor
      ctx.fillRect(0, 0, tw, th)
    }

    ctx.drawImage(img, 0, 0, tw, th)

    // Color adjustments
    const sat = parseFloat($('[data-saturation]')?.value) || 0
    const bri = parseFloat($('[data-brightness]')?.value) || 0
    const con = parseFloat($('[data-contrast]')?.value) || 0
    if (sat !== 0 || bri !== 0 || con !== 0) {
      const imgData = ctx.getImageData(0, 0, tw, th)
      const d = imgData.data
      for (let i = 0; i < d.length; i += 4) {
        const [nr, ng, nb] = adjustColor(d[i], d[i + 1], d[i + 2], sat, bri, con)
        d[i] = nr; d[i + 1] = ng; d[i + 2] = nb
      }
      ctx.putImageData(imgData, 0, 0)
    }

    const quality = outMime === 'image/png' ? undefined : params.initialQuality
    return new Promise(resolve => {
      cvs.toBlob(blob => {
        resolve({ blob, width: tw, height: th })
      }, outMime, quality)
    })
  }

  /* ---- Compression with quality iteration ---- */
  function compressBlob (blob, params, abortSignal) {
    const maxIter = params.maxIteration
    const origSize = blob.size
    const targetBytes = params.maxSizeMB > 0 ? params.maxSizeMB * 1024 * 1024 : Infinity
    let bestBlob = blob
    let lo = 0.1, hi = 1.0

    if (blob.size <= targetBytes) return Promise.resolve(blob)

    const iter = async (n) => {
      if (abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError')
      if (n >= maxIter || hi - lo < 0.02) return
      const q = (lo + hi) / 2
      const out = await imageCompression(blobToFile(blob, 'tmp'), {
        maxSizeMB: params.maxSizeMB || 10,
        maxWidthOrHeight: params.maxDim || undefined,
        initialQuality: q,
        useWebWorker: params.useWebWorker,
        signal: abortSignal
      })
      const outBlob = out.size < blob.size ? out : blob
      if (outBlob.size <= targetBytes) {
        bestBlob = outBlob
        lo = q
      } else {
        hi = q
      }
      if (lo < hi) await iter(n + 1)
      bestBlob = outBlob.size < bestBlob.size ? outBlob : bestBlob
    }

    return iter(0).then(() => bestBlob)
  }

  function blobToFile (blob, name) {
    return new File([blob], name || 'tmp', { type: blob.type })
  }

  /* ---- Process single image ---- */
  async function processImage (fileItem, params, abortSignal) {
    const { img, url } = await loadImage(fileItem.file)
    try {
      const { blob, width, height } = await canvasPipeline(img, fileItem.file, params)
      let resultBlob = blob

      if (params.maxSizeMB > 0 && blob.size > params.maxSizeMB * 1024 * 1024) {
        resultBlob = await compressBlob(blob, params, abortSignal)
      }

      const outMime = getOutputMime(params, fileItem.type)
      const outName = buildOutputName(fileItem.name, params, outMime)
      const resultFile = new File([resultBlob], outName, { type: outMime })
      const resultUrl = URL.createObjectURL(resultFile)
      const origUrl = URL.createObjectURL(fileItem.file)

      return {
        id: fileItem.id,
        origFile: fileItem,
        resultFile,
        resultUrl,
        origUrl,
        origW: fileItem.width,
        origH: fileItem.height,
        outW: width,
        outH: height,
        origSize: fileItem.size,
        outSize: resultFile.size,
        ratio: ((1 - resultFile.size / fileItem.size) * 100).toFixed(1),
        status: 'done'
      }
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  /* ---- Concurrent batch ---- */
  async function processAll () {
    if (!state.files.length) { toast('请先上传图片', 'warn'); return }
    const params = getParams()
    const files = [...state.files]
    const total = files.length
    let done = 0
    state.processing = true
    state.aborted = false
    state.results = []
    const mainAbort = new AbortController()

    dom.startBtn.hidden = true
    dom.cancelBtn.hidden = false
    dom.clearBtn.hidden = true
    dom.resultsSection.hidden = false
    dom.resultsBody.innerHTML = ''
    dom.resultsEmpty.style.display = 'none'
    dom.resultsSummary.textContent = '处理中...'
    showProgress('准备中...', 0, total)

    const queue = files.slice()
    const concurrency = params.concurrency || Math.min(navigator.hardwareConcurrency || 3, 4)

    const worker = async () => {
      while (queue.length && !state.aborted) {
        const item = queue.shift()
        const idx = done
        showProgress('压缩: ' + item.name, done, total)
        try {
          const r = await processImage(item, params, mainAbort.signal)
          state.results.push(r)
        } catch (e) {
          if (e.name === 'AbortError') { state.aborted = true; break }
          state.results.push({ id: item.id, origFile: item, status: 'error', error: e.message, origSize: item.size, origW: item.width, origH: item.height, origUrl: URL.createObjectURL(item.file) })
        }
        done++
        showProgress(state.aborted ? '已取消' : '处理中...', done, total)
        renderResults()
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker())
    await Promise.all(workers)

    state.processing = false
    dom.startBtn.hidden = false
    dom.cancelBtn.hidden = true
    dom.clearBtn.hidden = false
    dom.downloadAllBtn.hidden = !state.results.some(r => r.status === 'done')
    dom.downloadZipBtn.hidden = !state.results.some(r => r.status === 'done')
    dom.recompressBtn.hidden = false
    dom.clearResultsBtn.hidden = false

    const successCount = state.results.filter(r => r.status === 'done').length
    const totalSaved = state.results.filter(r => r.status === 'done').reduce((s, r) => s + (r.origSize - r.outSize), 0)
    dom.resultsSummary.textContent = state.aborted
      ? '已取消，完成 ' + successCount + ' / ' + total
      : '完成 ' + successCount + ' / ' + total + '，共节省 ' + fmt(Math.max(0, totalSaved))
    hideProgress()
  }

  /* ---- Render results table ---- */
  function renderResults () {
    const tbody = dom.resultsBody
    if (!tbody) return
    tbody.innerHTML = state.results.map(r => {
      const origFmt = r.origFile ? r.origFile.type.split('/')[1].toUpperCase() : '?'
      const outFmt = r.resultFile ? r.resultFile.type.split('/')[1].toUpperCase() : '?'
      const statusLabel = r.status === 'done' ? '完成' : r.status === 'error' ? '失败' : '处理中'
      const ratioClass = r.status === 'done' ? (parseFloat(r.ratio) > 0 ? 'true' : 'false') : ''
      return `<tr>
        <td>${r.origUrl ? '<img class="compress-results__thumb" src="' + r.origUrl + '" alt="" />' : ''}</td>
        <td>${esc(r.origFile ? r.origFile.name : '?')}</td>
        <td>${origFmt}</td>
        <td>${outFmt}</td>
        <td>${r.origW || '?'} x ${r.origH || '?'}</td>
        <td>${r.outW || '?'} x ${r.outH || '?'}</td>
        <td>${fmt(r.origSize || 0)}</td>
        <td>${r.outSize ? fmt(r.outSize) : '-'}</td>
        <td><span class="compress-results__ratio" data-good="${ratioClass}">${r.status === 'done' ? r.ratio + '%' : '-'}</span></td>
        <td><span class="compress-results__status" data-status="${r.status}">${statusLabel}</span></td>
        <td>${r.status === 'done' ? `
          <div class="compress-results__actions">
            <button class="compress-results__btn" data-download="${r.id}" title="下载">&#8681;</button>
            <button class="compress-results__btn" data-preview="${r.id}" title="对比预览">&#128269;</button>
          </div>` : r.status === 'error' ? '<span class="muted" style="font-size:0.75rem">' + esc(r.error || '') + '</span>' : ''}</td>
      </tr>`
    }).join('')
  }

  /* ---- Download helpers ---- */
  function downloadBlob (blob, name) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 200)
  }

  function downloadSingle (id) {
    const r = state.results.find(x => x.id === id)
    if (!r || !r.resultFile) return
    downloadBlob(r.resultFile, r.resultFile.name)
  }

  function downloadAll () {
    for (const r of state.results) {
      if (r.status === 'done' && r.resultFile) downloadBlob(r.resultFile, r.resultFile.name)
    }
  }

  async function downloadZip () {
    const doneResults = state.results.filter(r => r.status === 'done' && r.resultFile)
    if (!doneResults.length) return
    const zip = new JSZip()
    for (const r of doneResults) {
      zip.file(r.resultFile.name, r.resultFile)
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(blob, 'compressed_images.zip')
  }

  /* ---- Preview modal ---- */
  function openPreview (id) {
    const r = state.results.find(x => x.id === id)
    if (!r || r.status !== 'done') return
    dom.previewOrigImg.src = r.origUrl
    dom.previewOrigInfo.textContent = r.origW + ' x ' + r.origH + ' | ' + fmt(r.origSize)
    dom.previewCompImg.src = r.resultUrl
    dom.previewCompInfo.textContent = r.outW + ' x ' + r.outH + ' | ' + fmt(r.outSize) + ' | -' + r.ratio + '%'
    dom.previewModal.dataset.open = 'true'
  }

  function closePreview () {
    dom.previewModal.dataset.open = 'false'
  }

  /* ---- Naming preview ---- */
  function updateNamingPreview () {
    const p = getParams()
    const outMime = p.outputFormat === 'keep' ? 'image/jpeg' : p.outputFormat
    const name = buildOutputName('photo.jpg', p, outMime)
    dom.namingPreview.textContent = '输出示例: ' + name
  }

  /* ---- Init ---- */
  function init () {
    // Upload zone click
    dom.zone?.addEventListener('click', e => {
      if (e.target.closest('button')) return
      dom.fileInput?.click()
    })
    dom.fileInput?.addEventListener('change', () => {
      if (dom.fileInput.files.length) addFiles(dom.fileInput.files)
      dom.fileInput.value = ''
    })

    // Drag & drop
    dom.zone?.addEventListener('dragover', e => { e.preventDefault(); dom.zone.dataset.dragover = 'true' })
    dom.zone?.addEventListener('dragleave', () => { dom.zone.dataset.dragover = 'false' })
    dom.zone?.addEventListener('drop', e => {
      e.preventDefault(); dom.zone.dataset.dragover = 'false'
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
    })

    // Remove file
    dom.fileList?.addEventListener('click', e => {
      const btn = e.target.closest('[data-remove-file]')
      if (btn) removeFile(parseInt(btn.dataset.removeFile))
    })

    // Action buttons
    dom.startBtn?.addEventListener('click', () => processAll())
    dom.cancelBtn?.addEventListener('click', () => { state.aborted = true })
    dom.clearBtn?.addEventListener('click', () => {
      state.files.forEach(f => URL.revokeObjectURL(f.thumb))
      state.files = []
      renderFileList()
    })
    dom.downloadAllBtn?.addEventListener('click', () => downloadAll())
    dom.downloadZipBtn?.addEventListener('click', () => downloadZip())
    dom.recompressBtn?.addEventListener('click', () => processAll())
    dom.clearResultsBtn?.addEventListener('click', () => {
      state.results.forEach(r => { URL.revokeObjectURL(r.origUrl); URL.revokeObjectURL(r.resultUrl) })
      state.results = []
      dom.resultsSection.hidden = true
      dom.resultsBody.innerHTML = ''
      dom.downloadAllBtn.hidden = true
      dom.downloadZipBtn.hidden = true
      dom.recompressBtn.hidden = true
      dom.clearResultsBtn.hidden = true
    })

    // Results table: download & preview
    dom.resultsBody?.addEventListener('click', e => {
      const dlBtn = e.target.closest('[data-download]')
      if (dlBtn) { downloadSingle(parseInt(dlBtn.dataset.download)); return }
      const pvBtn = e.target.closest('[data-preview]')
      if (pvBtn) openPreview(parseInt(pvBtn.dataset.preview))
    })

    // Preview modal
    dom.previewClose?.addEventListener('click', closePreview)
    dom.previewModal?.addEventListener('click', e => { if (e.target === dom.previewModal) closePreview() })

    // Keyboard
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePreview() })

    /* ---- Quality slider ---- */
    dom.qualitySlider?.addEventListener('input', () => {
      dom.qualityVal.textContent = parseFloat(dom.qualitySlider.value).toFixed(2)
    })

    /* ---- Quality presets ---- */
    $$('[data-quality-presets] .pill').forEach(el => {
      if (parseFloat(el.dataset.qualityPreset) === parseFloat(dom.qualitySlider.value)) el.dataset.active = 'true'
      el.addEventListener('click', () => {
        const v = el.dataset.qualityPreset
        dom.qualitySlider.value = v
        dom.qualityVal.textContent = parseFloat(v).toFixed(2)
        $$('[data-quality-presets] .pill').forEach(p => { p.dataset.active = 'false' })
        el.dataset.active = 'true'
      })
    })

    /* ---- Max file size pills ---- */
    $$('[data-maxsize-group] .pill').forEach(el => {
      el.addEventListener('click', () => {
        $$('[data-maxsize-group] .pill').forEach(p => { p.dataset.active = 'false' })
        el.dataset.active = 'true'
        $('[data-custom-maxsize-wrap]').hidden = el.dataset.maxsize !== '0'
      })
    })

    /* ---- Max dimension pills ---- */
    $$('[data-maxdim-group] .pill').forEach(el => {
      el.addEventListener('click', () => {
        $$('[data-maxdim-group] .pill').forEach(p => { p.dataset.active = 'false' })
        el.dataset.active = 'true'
        const customInput = $('[data-custom-maxdim]')
        customInput.style.display = el.dataset.maxdim === 'custom' ? '' : 'none'
      })
    })

    /* ---- Format pills ---- */
    $$('[data-format-group] .pill').forEach(el => {
      el.addEventListener('click', () => {
        $$('[data-format-group] .pill').forEach(p => { p.dataset.active = 'false' })
        el.dataset.active = 'true'
        const hint = $('[data-format-hint]')
        if (hint) {
          const f = el.dataset.format
          if (f === 'image/webp') {
            const c = document.createElement('canvas')
            const supported = c.toDataURL('image/webp').indexOf('data:image/webp') === 0
            hint.textContent = supported ? 'WebP 格式通常比 JPG 小 25-35%' : '当前浏览器不支持 WebP 输出'
            hint.style.display = ''
          } else if (f === 'image/png') {
            hint.textContent = 'PNG 为无损格式，文件可能比 JPG 大'
            hint.style.display = ''
          } else {
            hint.style.display = 'none'
          }
        }
      })
    })

    /* ---- Naming pills ---- */
    $$('[data-naming-group] .pill').forEach(el => {
      el.addEventListener('click', () => {
        $$('[data-naming-group] .pill').forEach(p => { p.dataset.active = 'false' })
        el.dataset.active = 'true'
        const wrap = $('[data-custom-naming-wrap]')
        if (wrap) wrap.hidden = el.dataset.naming !== 'custom'
        updateNamingPreview()
      })
    })

    /* ---- Concurrency pills ---- */
    $$('[data-concurrency-group] .pill').forEach(el => {
      el.addEventListener('click', () => {
        $$('[data-concurrency-group] .pill').forEach(p => { p.dataset.active = 'false' })
        el.dataset.active = 'true'
      })
    })

    /* ---- Advanced sliders ---- */
    const iqSlider = $('[data-initial-quality]')
    const iqVal = $('[data-initial-quality-val]')
    if (iqSlider && iqVal) iqSlider.addEventListener('input', () => { iqVal.textContent = parseFloat(iqSlider.value).toFixed(2) })

    const miSlider = $('[data-max-iteration]')
    const miVal = $('[data-max-iteration-val]')
    if (miSlider && miVal) miSlider.addEventListener('input', () => { miVal.textContent = miSlider.value })

    /* ---- Naming inputs ---- */
    $$('[data-naming-prefix], [data-naming-suffix]').forEach(el => {
      el.addEventListener('input', updateNamingPreview)
    })
    updateNamingPreview()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
})()
