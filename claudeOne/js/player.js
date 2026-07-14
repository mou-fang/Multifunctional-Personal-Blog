/* ===== claudeOne :: player.js =====
 * Global audio player — survives page navigation in the SPA shell.
 *   - Reads playlist from window.__MUSIC_PLAYLIST (injected by music/playlist.js).
 *   - Playback: play / pause / next / prev / seek / volume / mute.
 *   - Modes: shuffle (on/off), repeat (off / one / all).
 *   - UI: expand (full bar) / minimize (thin floating strip).
 *   - Drag & drop: audio files → added to queue, metadata from filename.
 *   - State persisted to localStorage (volume, last track).
 * Exposes: window.ClaudeOnePlayer
 */

(function initPlayer() {

  /* ---- DOM refs ----------------------------------------------------------- */
  const root         = document.querySelector("[data-global-player]");
  const coverImg     = document.querySelector("[data-gp-cover]");
  const coverPh      = document.querySelector("[data-gp-cover-placeholder]");
  const titleEl      = document.querySelector("[data-gp-title]");
  const metaEl       = document.querySelector("[data-gp-meta]");
  const sourceEl     = document.querySelector("[data-gp-source]");
  const progressWrap = document.querySelector("[data-gp-progress-wrap]");
  const progressFill = document.querySelector("[data-gp-progress-fill]");
  const progressThumb= document.querySelector("[data-gp-progress-thumb]");
  const currentTEl   = document.querySelector("[data-gp-current-time]");
  const durationEl   = document.querySelector("[data-gp-duration]");
  const playBtn      = document.querySelector("[data-gp-play]");
  const prevBtn      = document.querySelector("[data-gp-prev]");
  const nextBtn      = document.querySelector("[data-gp-next]");
  const modeBtn     = document.querySelector("[data-gp-mode]");
  const volumeSlider = document.querySelector("[data-gp-volume]");
  const volumeIcon   = document.querySelector("[data-gp-volume-icon]");
  const playlistBtn  = document.querySelector("[data-gp-playlist]");
  const expandBtn    = document.querySelector("[data-gp-expand]");
  const audioEl      = document.querySelector("[data-gp-audio]");

  /* ---- State -------------------------------------------------------------- */
  let playlist   = [];
  let currentIdx = -1;
  let isPlaying  = false;
  let volume     = 80;
  let lastVolume = 80;
  let muted      = false;
  let shuffle    = false;
  let shuffleOrder = [];
  let shufflePos   = -1;
  let repeatMode = "off";
  let minimized  = false;
  let trackLoadError = false;

  const STORAGE_VOL  = "claudeOne:player-volume";
  const STORAGE_IDX  = "claudeOne:player-last-idx";
  const STORAGE_TIME = "claudeOne:player-last-time";
  const STORAGE_SHUFFLE = "claudeOne:player-shuffle";
  const STORAGE_REPEAT  = "claudeOne:player-repeat";
  const STORAGE_MIN     = "claudeOne:player-minimized";

  /* ---- Helpers ------------------------------------------------------------ */
  function fmtTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function revokeTrackObjectUrl(track) {
    if (!track || !track.objectUrlOwned || !track.src || !track.src.startsWith("blob:")) return;
    try { URL.revokeObjectURL(track.src); } catch (_) {}
    track.objectUrlOwned = false;
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_VOL, volume); } catch (_) {}
    try { localStorage.setItem(STORAGE_IDX, currentIdx); } catch (_) {}
    try { localStorage.setItem(STORAGE_SHUFFLE, shuffle ? "1" : "0"); } catch (_) {}
    try { localStorage.setItem(STORAGE_REPEAT, repeatMode); } catch (_) {}
    try { localStorage.setItem(STORAGE_MIN, minimized ? "1" : "0"); } catch (_) {}
  }

  function loadSavedState() {
    try {
      const v = localStorage.getItem(STORAGE_VOL);
      if (v !== null) volume = Math.max(0, Math.min(100, parseInt(v, 10) || 80));
      lastVolume = volume || 80;
    } catch (_) {}
    try {
      const s = localStorage.getItem(STORAGE_SHUFFLE);
      shuffle = s === "1";
    } catch (_) {}
    try {
      const r = localStorage.getItem(STORAGE_REPEAT);
      if (r === "off" || r === "one") repeatMode = r;
      else if (r === "all") repeatMode = "off";
    } catch (_) {}
    if (repeatMode === "one") {
      shuffle = false;
      shuffleOrder = [];
      shufflePos = -1;
    }
    try {
      const m = localStorage.getItem(STORAGE_MIN);
      minimized = m === "1";
    } catch (_) {}
  }

  /* ---- Mute helpers -------------------------------------------------------- */
  function updateVolumeIcon() {
    if (!volumeIcon) return;
    if (muted || volume === 0) {
      volumeIcon.innerHTML = "&#x1F507;"; // 🔇
    } else if (volume < 33) {
      volumeIcon.innerHTML = "&#x1F508;"; // 🔈
    } else if (volume < 66) {
      volumeIcon.innerHTML = "&#x1F509;"; // 🔉
    } else {
      volumeIcon.innerHTML = "&#x1F50A;"; // 🔊
    }
  }

  function applyVolume() {
    audioEl.volume = muted ? 0 : volume / 100;
    if (volumeSlider) volumeSlider.value = muted ? 0 : volume;
    updateVolumeIcon();
  }

  function unmute() {
    if (muted) {
      muted = false;
      if (volume === 0) volume = lastVolume || 50;
      applyVolume();
    }
  }

  /* ---- Shuffle helpers ---------------------------------------------------- */
  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function buildShuffleOrder(anchorIdx) {
    const len = playlist.length;
    if (len === 0) { shuffleOrder = []; shufflePos = -1; return; }
    const arr = [];
    for (let i = 0; i < len; i++) arr.push(i);

    if (anchorIdx >= 0 && anchorIdx < len) {
      const rest = shuffleArray(arr.filter(function (idx) { return idx !== anchorIdx; }));
      shuffleOrder = [anchorIdx].concat(rest);
      shufflePos = 0;
      return;
    }

    shuffleOrder = shuffleArray(arr);
    shufflePos = currentIdx >= 0 ? shuffleOrder.indexOf(currentIdx) : 0;
    if (shufflePos < 0) shufflePos = 0;
  }

  function ensureShuffleOrder() {
    if (!shuffle) return;
    if (!shuffleOrder.length || shuffleOrder.length !== playlist.length) {
      buildShuffleOrder(currentIdx);
      return;
    }
    for (let i = 0; i < shuffleOrder.length; i++) {
      if (shuffleOrder[i] < 0 || shuffleOrder[i] >= playlist.length) {
        buildShuffleOrder(currentIdx);
        return;
      }
    }
  }

  function syncShufflePosToCurrent() {
    if (!shuffle) return;
    ensureShuffleOrder();
    shufflePos = shuffleOrder.indexOf(currentIdx);
    if (shufflePos < 0) buildShuffleOrder(currentIdx);
  }

  function getNextIndex() {
    if (!playlist.length) return -1;
    if (shuffle) {
      ensureShuffleOrder();
      if (currentIdx < 0) {
        if (shufflePos < 0) shufflePos = 0;
        return shuffleOrder[shufflePos] || 0;
      }
      if (shufflePos < 0 || shuffleOrder[shufflePos] !== currentIdx) syncShufflePosToCurrent();
      if (shuffleOrder.length <= 1) return currentIdx >= 0 ? currentIdx : 0;
      if (shufflePos >= shuffleOrder.length - 1) {
        buildShuffleOrder(currentIdx);
        shufflePos = 1;
        return shuffleOrder[shufflePos];
      }
      shufflePos++;
      return shuffleOrder[shufflePos];
    }
    const next = currentIdx + 1;
    if (next >= playlist.length) return -1;
    return next;
  }

  function getPrevIndex() {
    if (!playlist.length) return -1;
    if (shuffle) {
      ensureShuffleOrder();
      if (currentIdx < 0) {
        if (shufflePos < 0) shufflePos = 0;
        return shuffleOrder[shufflePos] || 0;
      }
      if (shufflePos < 0 || shuffleOrder[shufflePos] !== currentIdx) syncShufflePosToCurrent();
      if (shuffleOrder.length <= 1) return currentIdx >= 0 ? currentIdx : 0;
      if (shufflePos <= 0) shufflePos = shuffleOrder.length - 1;
      else shufflePos--;
      return shuffleOrder[shufflePos];
    }
    if (currentIdx <= 0) return playlist.length - 1;
    return currentIdx - 1;
  }

  /* ---- UI updates --------------------------------------------------------- */
  function updatePlayBtn() {
    if (!playBtn) return;
    playBtn.innerHTML = isPlaying ? "&#x23F8;" : "&#x25B6;";
    playBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
  }

  function getPlaybackMode() {
    if (repeatMode === "one") return "one";
    return shuffle ? "shuffle" : "sequence";
  }

  function applyPlaybackModeEffects() {
    var shouldLoop = getPlaybackMode() === "one";
    audioEl.loop = shouldLoop;
    if (shouldLoop) audioEl.setAttribute("loop", "");
    else audioEl.removeAttribute("loop");
  }

  function updateModeBtn() {
    applyPlaybackModeEffects();
    if (!modeBtn) return;
    var stableMode = getPlaybackMode();
    var stableLabel = stableMode === "shuffle" ? "随机" : stableMode === "one" ? "单曲" : "顺序";
    var stableTitle = stableMode === "shuffle" ? "随机播放" : stableMode === "one" ? "单曲循环" : "顺序播放";
    modeBtn.textContent = stableLabel;
    modeBtn.setAttribute("title", stableTitle);
    modeBtn.setAttribute("aria-label", stableTitle);
    modeBtn.setAttribute("data-mode", stableMode);
    modeBtn.style.fontSize = "0.7rem";
    modeBtn.style.fontWeight = "700";
    modeBtn.style.width = "auto";
    modeBtn.style.padding = "4px 10px";
    if (stableMode !== "sequence") {
      modeBtn.classList.add("global-player__btn--active");
    } else {
      modeBtn.classList.remove("global-player__btn--active");
    }
  }

  function setPlaybackMode(mode) {
    if (mode === "shuffle") {
      shuffle = true;
      repeatMode = "off";
      buildShuffleOrder(currentIdx);
    } else if (mode === "one") {
      shuffle = false;
      shuffleOrder = [];
      shufflePos = -1;
      repeatMode = "one";
    } else {
      shuffle = false;
      shuffleOrder = [];
      shufflePos = -1;
      repeatMode = "off";
    }
    updateModeBtn();
    saveState();
  }

  function updateCover(track) {
    if (!coverImg || !coverPh) return;
    if (track && track.cover && (track.cover.startsWith("data:image") || track.cover.startsWith("./") || track.cover.startsWith("blob:"))) {
      coverImg.src = track.cover;
      coverImg.hidden = false;
      coverPh.hidden = true;
    } else {
      coverImg.hidden = true;
      coverPh.hidden = false;
      if (track && track.title) {
        coverPh.textContent = track.title.charAt(0).toUpperCase();
      } else {
        coverPh.textContent = "?";
      }
    }
  }

  function updateTrackInfo(track) {
    if (!track) {
      if (titleEl) titleEl.textContent = "";
      if (metaEl) metaEl.textContent = "";
      if (sourceEl) sourceEl.textContent = "";
      if (durationEl) durationEl.textContent = "";
      if (currentTEl) currentTEl.textContent = "00:00";
      if (progressFill) progressFill.style.width = "0%";
      updateCover(null);
      return;
    }
    if (titleEl) titleEl.textContent = track.title || "Unknown";
    const parts = [];
    if (track.artist && track.artist !== "Unknown Artist") parts.push(track.artist);
    if (track.album) parts.push(track.album);
    if (metaEl) metaEl.textContent = parts.join(" · ") || " ";
    // Source badge
    if (sourceEl) {
      if (track.source === "external" || track.source === "drag") {
        sourceEl.textContent = track.source === "drag" ? "drag & drop" : "music tool";
        sourceEl.className = "global-player__source global-player__source--tool";
      } else {
        sourceEl.textContent = "project";
        sourceEl.className = "global-player__source global-player__source--project";
      }
    }
    updateCover(track);
  }

  function setMinimized(min) {
    minimized = min;
    if (min) {
      root.setAttribute("data-minimized", "");
      document.body.removeAttribute("data-player-expanded");
    } else {
      root.removeAttribute("data-minimized");
      document.body.setAttribute("data-player-expanded", "");
    }
    if (expandBtn) {
      expandBtn.innerHTML = min ? "&#x25B2;" : "&#x2500;";
      expandBtn.setAttribute("title", min ? "Expand player" : "Minimize player");
      expandBtn.setAttribute("aria-label", min ? "Expand player" : "Minimize player");
    }
    saveState();
    emitPlayerChange("viewchange");
  }

  function cloneTrack(track, index) {
    if (!track) return null;
    return {
      index: index,
      src: track.src || "",
      title: track.title || "Unknown",
      artist: track.artist || "",
      album: track.album || "",
      duration: track.duration || "",
      cover: track.cover || "",
      source: track.source || ""
    };
  }

  function getPublicState() {
    return {
      playing: isPlaying,
      currentTime: audioEl.currentTime || 0,
      duration: audioEl.duration || 0,
      volume: muted ? 0 : volume,
      mute: muted,
      currentIndex: currentIdx,
      track: currentIdx >= 0 && currentIdx < playlist.length ? cloneTrack(playlist[currentIdx], currentIdx) : null,
      mode: getPlaybackMode(),
      shuffle: shuffle,
      repeat: repeatMode,
      minimized: minimized,
      playlistLength: playlist.length
    };
  }

  function emitPlayerChange(reason) {
    if (typeof window.CustomEvent !== "function") return;
    window.dispatchEvent(new CustomEvent("claudeone:playerchange", {
      detail: Object.assign({ reason: reason || "state" }, getPublicState())
    }));
  }

  function openPlaylistPage() {
    if (window.__ClaudeOneRouter && typeof window.__ClaudeOneRouter.go === "function") {
      window.__ClaudeOneRouter.go("playlist");
    } else {
      window.location.hash = "#/playlist";
    }
  }

  /* ---- Audio events ------------------------------------------------------- */
  function onAudioLoaded() {
    trackLoadError = false;
    if (durationEl) durationEl.textContent = fmtTime(audioEl.duration);
    updateProgress();
  }

  function onAudioTimeUpdate() {
    if (!trackLoadError) updateProgress();
  }

  function replayCurrentTrack() {
    if (currentIdx < 0 || currentIdx >= playlist.length) return;
    trackLoadError = false;
    try { audioEl.currentTime = 0; } catch (_) {}
    updateProgress();

    audioEl.play().then(function () {
      isPlaying = true;
      root.removeAttribute("hidden");
      root.setAttribute("data-playing", "");
      updatePlayBtn();
      saveState();
      emitPlayerChange("repeatone");
    }).catch(function (e) {
      console.warn("[player] Repeat-one replay blocked:", e.message);
      isPlaying = false;
      root.removeAttribute("data-playing");
      updatePlayBtn();
    });
  }

  function updateProgress() {
    const dur = audioEl.duration;
    const cur = audioEl.currentTime;
    if (Number.isFinite(dur) && dur > 0) {
      const pct = (cur / dur) * 100;
      if (progressFill) progressFill.style.width = pct + "%";
      if (progressThumb) progressThumb.style.left = pct + "%";
      if (currentTEl) currentTEl.textContent = fmtTime(cur);
      try { localStorage.setItem(STORAGE_TIME, String(cur)); } catch (_) {}
    }
  }

  function onAudioEnded() {
    if (getPlaybackMode() === "one") {
      replayCurrentTrack();
      return;
    }
    // Remove external/drag tracks after playback — they are temporary
    if (currentIdx >= 0 && currentIdx < playlist.length) {
      var src = playlist[currentIdx].source;
      if (src === "external" || src === "drag") {
        var removed = playlist.splice(currentIdx, 1)[0];
        revokeTrackObjectUrl(removed);
        // Adjust index: if we removed the last track, go to start
        if (currentIdx >= playlist.length) currentIdx = playlist.length - 1;
        if (shuffle) buildShuffleOrder(currentIdx);
        if (playlist.length === 0) {
          currentIdx = -1;
          isPlaying = false;
          updatePlayBtn();
          root.removeAttribute("data-playing");
          root.setAttribute("hidden", "");
          updateTrackInfo(null);
          return;
        }
      }
    }
    var nextIdx = getNextIndex();
    if (nextIdx < 0) {
      isPlaying = false;
      updatePlayBtn();
      root.removeAttribute("data-playing");
      audioEl.currentTime = 0;
      updateProgress();
      return;
    }
    loadAndPlay(nextIdx);
  }

  function onAudioError() {
    trackLoadError = true;
    if (getPlaybackMode() === "one") {
      isPlaying = false;
      updatePlayBtn();
      root.removeAttribute("data-playing");
      return;
    }
    setTimeout(function () {
      if (trackLoadError) {
        const nextIdx = getNextIndex();
        if (nextIdx >= 0 && nextIdx !== currentIdx) {
          loadAndPlay(nextIdx);
        } else {
          isPlaying = false;
          updatePlayBtn();
          root.removeAttribute("data-playing");
        }
      }
    }, 500);
  }

  /* ---- Core playback ------------------------------------------------------ */
  function loadAndPlay(idx) {
    if (idx < 0 || idx >= playlist.length) return;
    currentIdx = idx;
    if (shuffle) syncShufflePosToCurrent();
    trackLoadError = false;
    const track = playlist[idx];
    updateTrackInfo(track);
    emitPlayerChange("trackchange");

    audioEl.src = track.src;
    audioEl.load();
    applyPlaybackModeEffects();
    audioEl.play().then(function () {
      isPlaying = true;
      root.removeAttribute("hidden");
      root.setAttribute("data-playing", "");
      updatePlayBtn();
      saveState();
    }).catch(function (e) {
      console.warn("[player] Autoplay blocked:", e.message);
      isPlaying = false;
      root.removeAttribute("data-playing");
      updatePlayBtn();
      root.removeAttribute("hidden");
      if (minimized) setMinimized(false);
    });
  }

  function playCurrent() {
    if (currentIdx < 0 && playlist.length > 0) {
      loadAndPlay(0);
      return;
    }
    applyPlaybackModeEffects();
    audioEl.play().then(function () {
      isPlaying = true;
      root.setAttribute("data-playing", "");
      updatePlayBtn();
    }).catch(function (e) {
      console.warn("[player] Play blocked:", e.message);
    });
  }

  function pauseCurrent() {
    audioEl.pause();
    isPlaying = false;
    root.removeAttribute("data-playing");
    updatePlayBtn();
  }

  /* ---- Public API --------------------------------------------------------- */
  var API = {
    play: function () {
      if (!playlist.length) return;
      if (minimized) setMinimized(false);
      playCurrent();
    },

    pause: function () { pauseCurrent(); },

    toggle: function () {
      if (!playlist.length) return;
      if (isPlaying) pauseCurrent(); else playCurrent();
    },

    load: function (track) {
      if (!track || !track.src) return;
      root.removeAttribute("hidden");
      if (minimized) setMinimized(false);
      var idx = playlist.length;
      playlist.push({
        src: track.src,
        title: track.title || "Unknown",
        artist: track.artist || "",
        album: track.album || "",
        duration: track.duration || "",
        cover: track.cover || "",
        source: "external",
        objectUrlOwned: track.src.indexOf("blob:") === 0
      });
      if (shuffle) buildShuffleOrder(idx);
      loadAndPlay(idx);
    },

    next: function () {
      if (!playlist.length) return;
      var n = getNextIndex();
      if (n < 0) n = 0;
      loadAndPlay(n);
    },

    prev: function () {
      if (!playlist.length) return;
      if (audioEl.currentTime > 3) {
        audioEl.currentTime = 0;
        updateProgress();
        return;
      }
      loadAndPlay(getPrevIndex());
    },

    skipTo: function (idx) {
      if (idx >= 0 && idx < playlist.length) loadAndPlay(idx);
    },

    seek: function (seconds) {
      if (!Number.isFinite(seconds)) return;
      audioEl.currentTime = Math.max(0, Math.min(seconds, audioEl.duration || 0));
      updateProgress();
    },

    setVolume: function (v) {
      volume = Math.max(0, Math.min(100, Number(v) || 0));
      muted = false;
      lastVolume = volume || 80;
      applyVolume();
      saveState();
    },

    toggleMute: function () {
      if (muted) {
        muted = false;
        if (volume === 0) volume = lastVolume || 50;
      } else {
        muted = true;
        lastVolume = volume || 80;
      }
      applyVolume();
      saveState();
    },

    cycleMode: function () {
      var nextMode = "sequence";
      var currentMode = getPlaybackMode();
      if (currentMode === "sequence") {
        nextMode = "shuffle";
        if (window.ClaudeOne && window.ClaudeOne.toast) window.ClaudeOne.toast("随机播放", "ok", 1800);
      } else if (currentMode === "shuffle") {
        nextMode = "one";
        if (window.ClaudeOne && window.ClaudeOne.toast) window.ClaudeOne.toast("单曲循环", "ok", 1800);
      } else {
        nextMode = "sequence";
        if (window.ClaudeOne && window.ClaudeOne.toast) window.ClaudeOne.toast("顺序播放", "ok", 1800);
      }
      setPlaybackMode(nextMode);
      emitPlayerChange("modechange");
    },

    addTracks: function (tracks) {
      if (!Array.isArray(tracks) || !tracks.length) return;
      playlist = playlist.concat(tracks);
      if (shuffle) buildShuffleOrder(currentIdx);
      if (currentIdx < 0 && playlist.length > 0) {
        loadAndPlay(0);
      }
      if (minimized && tracks.length > 0) setMinimized(false);
      emitPlayerChange("playlistchange");
    },

    removeTrack: function (idx) {
      if (idx < 0 || idx >= playlist.length) return;
      var removedTrack = playlist.splice(idx, 1)[0];
      if (idx === currentIdx) {
        audioEl.pause();
        audioEl.src = "";
        revokeTrackObjectUrl(removedTrack);
        isPlaying = false;
        updatePlayBtn();
        root.removeAttribute("data-playing");
        if (playlist.length > 0) {
          loadAndPlay(Math.min(idx, playlist.length - 1));
        } else {
          currentIdx = -1;
          updateTrackInfo(null);
          root.setAttribute("hidden", "");
        }
      } else if (idx < currentIdx) {
        revokeTrackObjectUrl(removedTrack);
        currentIdx--;
      } else {
        revokeTrackObjectUrl(removedTrack);
      }
      if (shuffle && playlist.length > 0) buildShuffleOrder(currentIdx);
      emitPlayerChange("playlistchange");
    },

    getState: function () {
      return getPublicState();
    },

    getPlaylist: function () {
      return playlist.map(function (track, index) { return cloneTrack(track, index); });
    },

    getSequentialPlaylist: function () {
      return playlist.map(function (track, index) { return cloneTrack(track, index); });
    },

    expand: function () { setMinimized(false); },
    minimize: function () { setMinimized(true); },
    openPlaylist: function () { openPlaylistPage(); },
    isMinimized: function () { return minimized; },

    on: function (event, fn) {
      if (typeof fn !== "function") return;
      switch (event) {
        case "play":       audioEl.addEventListener("play", fn); break;
        case "pause":      audioEl.addEventListener("pause", fn); break;
        case "timeupdate": audioEl.addEventListener("timeupdate", fn); break;
        case "ended":      audioEl.addEventListener("ended", fn); break;
        case "trackchange":
          audioEl.addEventListener("loadedmetadata", function _fn() {
            fn({ index: currentIdx, track: playlist[currentIdx] });
          });
          break;
      }
    }
  };

  /* ---- Drag & drop -------------------------------------------------------- */
  var dragCounter = 0;
  var SUPPORTED_EXTS = [".mp3", ".flac", ".wav", ".ogg", ".aac", ".m4a", ".wma", ".opus", ".webm", ".aiff"];

  function isAudioFile(file) {
    var name = file.name.toLowerCase();
    return SUPPORTED_EXTS.some(function (ext) { return name.endsWith(ext); });
  }

  function extractMetaFromFile(file) {
    var name = file.name;
    var ext = SUPPORTED_EXTS.find(function (e) { return name.toLowerCase().endsWith(e); }) || "";
    var base = name.slice(0, name.length - ext.length);
    var dash = base.indexOf(" - ");
    var title, artist;
    if (dash > 0) {
      artist = base.slice(0, dash).trim();
      title = base.slice(dash + 3).trim();
    } else {
      title = base.trim();
      artist = "Unknown Artist";
    }
    return { title: title, artist: artist };
  }

  root.addEventListener("dragenter", function (e) {
    e.preventDefault();
    dragCounter++;
    root.setAttribute("data-dragover", "");
  });

  root.addEventListener("dragleave", function (e) {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) root.removeAttribute("data-dragover");
  });

  root.addEventListener("dragover", function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });

  root.addEventListener("drop", function (e) {
    e.preventDefault();
    dragCounter = 0;
    root.removeAttribute("data-dragover");
    var files = Array.from(e.dataTransfer.files || []).filter(isAudioFile);
    if (!files.length) return;
    if (minimized) setMinimized(false);

    var tracks = files.map(function (file) {
      var meta = extractMetaFromFile(file);
      return {
        src: URL.createObjectURL(file),
        title: meta.title,
        artist: meta.artist,
        album: "",
        duration: "",
        cover: "",
        source: "drag",
        objectUrlOwned: true
      };
    });

    if (!playlist.length && tracks.length > 0) {
      updateTrackInfo(tracks[0]);
      root.removeAttribute("hidden");
    }

    playlist = playlist.concat(tracks);
    if (shuffle) buildShuffleOrder(currentIdx);
    if (currentIdx < 0 && playlist.length > 0) {
      loadAndPlay(0);
    }
    emitPlayerChange("playlistchange");
    if (window.ClaudeOne && window.ClaudeOne.toast) {
      window.ClaudeOne.toast("Added " + tracks.length + " track(s)", "ok", 2000);
    }
  });

  /* ---- Click events ------------------------------------------------------- */
  playBtn && playBtn.addEventListener("click", function (e) {
    if (!playlist.length) return;
    e.stopPropagation();
    if (isPlaying) pauseCurrent(); else playCurrent();
  });

  prevBtn && prevBtn.addEventListener("click", function () {
    if (!playlist.length) return;
    if (audioEl.currentTime > 3) {
      audioEl.currentTime = 0;
      updateProgress();
      return;
    }
    var idx = getPrevIndex();
    if (idx >= 0) loadAndPlay(idx);
  });

  nextBtn && nextBtn.addEventListener("click", function () {
    if (!playlist.length) return;
    var idx = getNextIndex();
    if (idx < 0) idx = 0;
    loadAndPlay(idx);
  });

  modeBtn && modeBtn.addEventListener("click", function () {
    API.cycleMode();
  });

  playlistBtn && playlistBtn.addEventListener("click", function () {
    openPlaylistPage();
  });

  volumeSlider && volumeSlider.addEventListener("input", function () {
    volume = parseInt(volumeSlider.value, 10) || 0;
    if (volume > 0) unmute();
    if (volume === 0) muted = true;
    lastVolume = volume || lastVolume;
    applyVolume();
    saveState();
  });

  volumeIcon && volumeIcon.addEventListener("click", function () {
    API.toggleMute();
  });

  expandBtn && expandBtn.addEventListener("click", function () {
    setMinimized(!minimized);
  });

  root.addEventListener("click", function (e) {
    if (!minimized) return;
    if (e.target.closest("button, input, [data-gp-progress-wrap]")) return;
    if (root.contains(e.target)) {
      setMinimized(false);
    }
  });

  // Progress bar — click + drag to seek
  if (progressWrap) {
    var seekDragging = false;

    function seekFromEvent(e) {
      if (!audioEl.duration) return;
      var rect = progressWrap.getBoundingClientRect();
      var pct = (e.clientX - rect.left) / rect.width;
      audioEl.currentTime = Math.max(0, Math.min(pct, 1)) * audioEl.duration;
      updateProgress();
    }

    progressWrap.addEventListener("pointerdown", function (e) {
      seekDragging = true;
      root.setAttribute("data-seeking", "");
      seekFromEvent(e);
      progressWrap.setPointerCapture(e.pointerId);
    });

    progressWrap.addEventListener("pointermove", function (e) {
      if (!seekDragging) return;
      seekFromEvent(e);
    });

    var stopSeek = function () {
      seekDragging = false;
      root.removeAttribute("data-seeking");
    };
    progressWrap.addEventListener("pointerup", stopSeek);
    progressWrap.addEventListener("pointercancel", stopSeek);
  }

  /* ---- Audio events ------------------------------------------------------- */
  audioEl.addEventListener("loadedmetadata", onAudioLoaded);
  audioEl.addEventListener("timeupdate", onAudioTimeUpdate);
  audioEl.addEventListener("ended", onAudioEnded);
  audioEl.addEventListener("error", onAudioError);
  audioEl.addEventListener("play", function () {
    isPlaying = true;
    root.setAttribute("data-playing", "");
    updatePlayBtn();
    saveState();
    emitPlayerChange("play");
  });
  audioEl.addEventListener("pause", function () {
    isPlaying = false;
    root.removeAttribute("data-playing");
    updatePlayBtn();
    emitPlayerChange("pause");
  });

  /* ---- Keyboard ----------------------------------------------------------- */
  document.addEventListener("keydown", function (e) {
    var tag = document.activeElement ? document.activeElement.tagName : "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    /* Skip if a game page is active — those own their own Space handling */
    var curPage = document.body.getAttribute("data-page") || "";
    if (curPage === "onlyup" || curPage === "snake" || curPage === "doom" || curPage === "abyss") return;
    if (e.code === "Space" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      API.toggle();
    }
  });

  /* ---- Init --------------------------------------------------------------- */
  function init() {
    loadSavedState();
    applyVolume();

    var raw = window.__MUSIC_PLAYLIST;
    if (Array.isArray(raw) && raw.length > 0) {
      playlist = raw.map(function (t, i) {
        return {
          src: t.file || t.src || "",
          title: t.title || "Unknown",
          artist: t.artist || "Unknown Artist",
          album: t.album || "",
          duration: t.duration || "",
          cover: t.cover || "",
          source: "playlist"
        };
      });
    }

    var savedIdx = -1;
    try {
      var si = localStorage.getItem(STORAGE_IDX);
      if (si !== null) savedIdx = parseInt(si, 10);
    } catch (_) {}
    if (savedIdx >= 0 && savedIdx < playlist.length) {
      currentIdx = savedIdx;
    }
    if (shuffle && playlist.length > 0) buildShuffleOrder(currentIdx);

    updateModeBtn();

    if (playlist.length > 0) {
      root.removeAttribute("hidden");
      if (minimized) {
        setMinimized(true);
      } else {
        setMinimized(false);
        var playIdx = currentIdx >= 0 ? currentIdx : 0;
        currentIdx = playIdx;
        var track = playlist[playIdx];
        updateTrackInfo(track);
        audioEl.src = track.src;
        applyPlaybackModeEffects();
        try {
          var savedTime = parseFloat(localStorage.getItem(STORAGE_TIME));
          if (savedTime > 0) {
            audioEl.addEventListener("loadedmetadata", function restore() {
              audioEl.currentTime = savedTime;
              updateProgress();
              audioEl.removeEventListener("loadedmetadata", restore);
            }, { once: true });
          }
        } catch (_) {}
        audioEl.play().then(function () {
          isPlaying = true;
          root.setAttribute("data-playing", "");
          updatePlayBtn();
        }).catch(function () {
          isPlaying = false;
          updatePlayBtn();
          // Browser blocked autoplay — wait for first user interaction
          root.setAttribute("data-waiting-interaction", "");
          var resumeOnInteract = function () {
            root.removeAttribute("data-waiting-interaction");
            if (isPlaying || !playlist.length) return;
            audioEl.play().then(function () {
              isPlaying = true;
              root.setAttribute("data-playing", "");
              updatePlayBtn();
            }).catch(function () {});
          };
          document.addEventListener("click", resumeOnInteract, { once: true });
          document.addEventListener("keydown", resumeOnInteract, { once: true });
          document.addEventListener("touchstart", resumeOnInteract, { once: true });
        });
      }
    } else {
      updateTrackInfo(null);
      root.removeAttribute("hidden");
      var inner = root.querySelector(".global-player__inner");
      if (inner) {
        inner.style.display = "none";
        var empty = document.createElement("div");
        empty.className = "global-player__empty";
        empty.innerHTML = "<strong>Playlist is empty</strong><span>Drop audio files here or run addmusic.bat to scan the music/ folder</span>";
        root.appendChild(empty);
        setTimeout(function () { setMinimized(true); }, 4000);
      }
    }

    window.ClaudeOnePlayer = API;
    emitPlayerChange("ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
