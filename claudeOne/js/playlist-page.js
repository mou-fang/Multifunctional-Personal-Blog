/* ===== claudeOne :: playlist-page.js =====
 * Full playlist view for the global audio player.
 */

(function bootstrapPlaylistPage() {
  "use strict";

  var container = null;
  var ac = null;

  function esc(value) {
    if (window.ClaudeOne && typeof window.ClaudeOne.escapeHtml === "function") {
      return window.ClaudeOne.escapeHtml(value);
    }
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtTime(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return "";
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function getPlayer() {
    return window.ClaudeOnePlayer || null;
  }

  function normalizeTrack(track, index) {
    track = track || {};
    return {
      index: Number.isInteger(track.index) ? track.index : index,
      src: track.src || track.file || "",
      title: track.title || "Unknown",
      artist: track.artist || "Unknown Artist",
      album: track.album || "",
      duration: track.duration || "",
      cover: track.cover || "",
      source: track.source || "playlist"
    };
  }

  function getTracks() {
    var player = getPlayer();
    var raw = [];
    if (player && typeof player.getSequentialPlaylist === "function") {
      raw = player.getSequentialPlaylist();
    } else if (player && typeof player.getPlaylist === "function") {
      raw = player.getPlaylist();
    } else if (Array.isArray(window.__MUSIC_PLAYLIST)) {
      raw = window.__MUSIC_PLAYLIST;
    }
    return raw.map(normalizeTrack);
  }

  function getState() {
    var player = getPlayer();
    if (player && typeof player.getState === "function") return player.getState();
    return { currentIndex: -1, playing: false, mode: "sequence", playlistLength: 0 };
  }

  function sourceText(source) {
    switch (source) {
      case "drag": return "拖拽临时";
      case "external": return "音乐工具";
      case "playlist": return "本地歌单";
      default: return source || "项目音乐";
    }
  }

  function modeText(state) {
    if (state.shuffle || state.mode === "shuffle") return "随机";
    if (state.repeat === "one" || state.mode === "one") return "单曲";
    return "顺序";
  }

  function srcText(src) {
    if (!src) return "未记录";
    if (src.indexOf("blob:") === 0) return "浏览器临时音频";
    return src.replace(/^\.\//, "");
  }

  function coverHTML(track) {
    if (track.cover && (
      track.cover.indexOf("data:image") === 0 ||
      track.cover.indexOf("./") === 0 ||
      track.cover.indexOf("blob:") === 0
    )) {
      return '<img src="' + esc(track.cover) + '" alt="" loading="lazy" />';
    }
    return '<span>' + esc((track.title || "?").charAt(0).toUpperCase()) + '</span>';
  }

  function detailHTML(label, value, wide) {
    return '<span class="playlist-track__field' + (wide ? " playlist-track__field--wide" : "") + '">' +
      '<b>' + esc(label) + '</b>' +
      '<em>' + esc(value || "未标记") + '</em>' +
      '</span>';
  }

  function renderEmpty(listEl, summaryEl) {
    if (summaryEl) summaryEl.innerHTML = '<span>0 首</span>';
    if (!listEl) return;
    listEl.innerHTML =
      '<div class="playlist-empty">' +
        '<span class="playlist-empty__icon">&#9835;</span>' +
        '<strong>歌单为空</strong>' +
        '<span>把音乐放进 music 文件夹并重新扫描，或拖拽音频到播放器。</span>' +
      '</div>';
  }

  function render() {
    if (!container) return;
    var listEl = container.querySelector("[data-playlist-list]");
    var summaryEl = container.querySelector("[data-playlist-summary]");
    var tracks = getTracks();
    var state = getState();

    if (!tracks.length) {
      renderEmpty(listEl, summaryEl);
      return;
    }

    var currentTitle = state.track && state.track.title ? state.track.title : "未播放";
    if (summaryEl) {
      summaryEl.innerHTML =
        '<span>' + tracks.length + ' 首</span>' +
        '<span>' + esc(modeText(state)) + '</span>' +
        '<span>' + esc(currentTitle) + '</span>';
    }

    if (!listEl) return;
    listEl.innerHTML = tracks.map(function (track, pos) {
      var active = track.index === state.currentIndex;
      var duration = track.duration || (active ? fmtTime(state.duration) : "") || "未知";
      var status = active ? (state.playing ? "正在播放" : "已选中") : "播放";
      var order = String(pos + 1).padStart(2, "0");
      return '' +
        '<button class="playlist-track" type="button" data-play-track="' + track.index + '"' +
          (active ? ' data-active="true"' : '') +
          (active && state.playing ? ' data-playing="true"' : '') +
          ' aria-label="播放 ' + esc(track.title) + '">' +
          '<span class="playlist-track__order">' + order + '</span>' +
          '<span class="playlist-track__cover">' + coverHTML(track) + '</span>' +
          '<span class="playlist-track__main">' +
            '<span class="playlist-track__title">' + esc(track.title) + '</span>' +
            '<span class="playlist-track__artist">' + esc(track.artist || "Unknown Artist") + '</span>' +
            '<span class="playlist-track__details">' +
              detailHTML("专辑", track.album, false) +
              detailHTML("时长", duration, false) +
              detailHTML("来源", sourceText(track.source), false) +
              detailHTML("文件", srcText(track.src), true) +
            '</span>' +
          '</span>' +
          '<span class="playlist-track__status">' + esc(status) + '</span>' +
        '</button>';
    }).join("");
  }

  function onClick(e) {
    var item = e.target.closest("[data-play-track]");
    if (!item) return;
    var idx = parseInt(item.getAttribute("data-play-track"), 10);
    var player = getPlayer();
    if (!player || !Number.isFinite(idx)) {
      if (window.ClaudeOne && window.ClaudeOne.toast) window.ClaudeOne.toast("播放器还没准备好", "err");
      return;
    }
    if (typeof player.skipTo === "function") player.skipTo(idx);
    render();
  }

  function mount(el) {
    container = el;
    ac = new AbortController();
    render();
    el.addEventListener("click", onClick, { signal: ac.signal });
    window.addEventListener("claudeone:playerchange", render, { signal: ac.signal });
    if (window.ClaudeOne && typeof window.ClaudeOne.refreshReveal === "function") {
      window.ClaudeOne.refreshReveal();
    }
  }

  function unmount() {
    if (ac) ac.abort();
    ac = null;
    container = null;
  }

  window.__page_playlist = { mount: mount, unmount: unmount };
})();
