/* ===== claudeOne :: easter-egg.js ===== */
(function initEasterEgg() {
  "use strict";

  const WARNING_TEXT = "不要按播放/暂停按钮！";
  const CLICK_WINDOW_MS = 5000;
  const CLICK_LIMIT = 5;
  const IDLE_WARNING_MS = 60000;
  const IDLE_TRIGGER_CHANCE = 0.25;
  const CORRUPT_MS = 5000;
  const BLANK_MS = 2000;
  const JUMPSCARE_SRC = "./imge/jumpscare.webp";

  const state = {
    phase: "idle",
    preWarningClicks: [],
    postWarningClicks: [],
    idleTimer: 0,
    locked: false,
    audioCtx: null,
    soundPlayed: false,
    warningPushed: false,
    boundPlayButton: null,
    lastPlayClickEvent: null,
  };

  const blockedEvents = [
    "click",
    "dblclick",
    "pointerdown",
    "pointerup",
    "pointermove",
    "keydown",
    "keyup",
    "input",
    "change",
    "submit",
    "dragstart",
    "dragover",
    "drop",
    "touchstart",
    "touchmove",
    "touchend",
  ];

  function boot() {
    installOverlays();
    state.idleTimer = window.setTimeout(() => {
      if (Math.random() < IDLE_TRIGGER_CHANCE) triggerWarning("idle");
    }, IDLE_WARNING_MS);

    document.addEventListener("click", onPlayPauseClick, true);
    bindPlayPauseButton();
    window.addEventListener("claudeone:playerchange", bindPlayPauseButton);
    blockedEvents.forEach((type) => {
      document.addEventListener(type, blockWhenLocked, true);
    });

    ["pointerdown", "keydown", "touchstart"].forEach((type) => {
      document.addEventListener(type, warmAudio, { capture: true, passive: true });
    });
  }

  function bindPlayPauseButton() {
    const button = document.querySelector("[data-gp-play]");
    if (!button || button === state.boundPlayButton) return;
    state.boundPlayButton = button;
    button.addEventListener("click", onPlayPauseClick, true);
  }

  function installOverlays() {
    if (!document.querySelector("[data-easter-void]")) {
      const voidLayer = document.createElement("div");
      voidLayer.className = "easter-void";
      voidLayer.setAttribute("data-easter-void", "");
      document.body.appendChild(voidLayer);
    }

    if (!document.querySelector("[data-easter-jumpscare]")) {
      const layer = document.createElement("div");
      layer.className = "easter-jumpscare";
      layer.setAttribute("data-easter-jumpscare", "");

      const img = document.createElement("img");
      img.src = JUMPSCARE_SRC;
      img.alt = "";
      img.decoding = "async";
      img.draggable = false;

      layer.appendChild(img);
      document.body.appendChild(layer);
    }
  }

  function onPlayPauseClick(event) {
    const target = closestPlayPauseButton(event.target);
    if (!target) return;
    if (state.lastPlayClickEvent === event) return;
    state.lastPlayClickEvent = event;

    warmAudio();

    if (state.phase === "idle") {
      if (recordClick(state.preWarningClicks) > CLICK_LIMIT) {
        triggerWarning("click");
      }
      return;
    }

    if (state.phase === "warned") {
      if (recordClick(state.postWarningClicks) > CLICK_LIMIT) {
        event.preventDefault();
        event.stopImmediatePropagation();
        startCollapse();
      }
    }
  }

  function closestPlayPauseButton(target) {
    let node = target;
    if (node && node.nodeType !== 1) node = node.parentElement;
    return node && node.closest ? node.closest("[data-gp-play]") : null;
  }

  function recordClick(bucket) {
    const now = performance.now();
    bucket.push(now);
    while (bucket.length && now - bucket[0] > CLICK_WINDOW_MS) bucket.shift();
    return bucket.length;
  }

  function triggerWarning(reason) {
    if (state.phase !== "idle") return;
    state.phase = "warned";
    window.clearTimeout(state.idleTimer);
    document.body.setAttribute("data-easter-phase", "warned");
    state.postWarningClicks = [];

    const openWarning = () => {
      const assistant = window.ClaudeOneAssistant;
      if (assistant && typeof assistant.openWithGeometry === "function") {
        assistant.openWithGeometry(getWarningAssistantGeometry());
      } else if (assistant && typeof assistant.open === "function") {
        assistant.open();
      }
      if (!state.warningPushed && assistant && typeof assistant.pushMessage === "function") {
        state.warningPushed = true;
        assistant.pushMessage("assistant", WARNING_TEXT, {
          tone: "nightmare",
          silent: true,
        });
      }
      scrollAssistantToBottom(assistant);
    };

    openWarning();
    window.setTimeout(openWarning, reason === "idle" ? 220 : 80);
  }

  function scrollAssistantToBottom(assistant) {
    if (!assistant || typeof assistant.scrollToBottom !== "function") return;
    assistant.scrollToBottom();
    window.setTimeout(() => assistant.scrollToBottom(), 120);
    window.setTimeout(() => assistant.scrollToBottom(), 420);
    window.setTimeout(() => assistant.scrollToBottom(), 760);
  }

  function getWarningAssistantGeometry() {
    const viewportW = Math.max(320, window.innerWidth || document.documentElement.clientWidth || 320);
    const viewportH = Math.max(480, window.innerHeight || document.documentElement.clientHeight || 480);
    const player = document.querySelector("[data-global-player]");
    const playerRect = player && !player.hidden ? player.getBoundingClientRect() : null;
    const compact = viewportW <= 720;
    const marginX = compact ? 10 : 28;
    const top = compact ? 12 : 24;
    const playerClearance = playerRect
      ? Math.max(compact ? 122 : 148, viewportH - playerRect.top + (compact ? 18 : 26))
      : (compact ? 118 : 140);
    const maxHeight = Math.max(360, viewportH - top - playerClearance);
    const width = Math.min(compact ? viewportW - marginX * 2 : 540, viewportW - marginX * 2);
    const height = Math.min(compact ? 620 : 640, maxHeight);
    const left = compact ? marginX : Math.max(marginX, viewportW - width - Math.max(36, viewportW * 0.08));
    return { left, top, width, height };
  }

  function startCollapse() {
    if (state.phase !== "warned") return;
    state.phase = "corrupt";
    state.locked = true;
    document.body.setAttribute("data-easter-phase", "corrupt");
    document.body.setAttribute("data-easter-locked", "true");
    document.body.setAttribute("aria-busy", "true");
    pauseMusic();

    const active = document.activeElement;
    if (active && typeof active.blur === "function") active.blur();

    window.setTimeout(showBlank, CORRUPT_MS);
  }

  function pauseMusic() {
    try {
      if (window.ClaudeOnePlayer && typeof window.ClaudeOnePlayer.pause === "function") {
        window.ClaudeOnePlayer.pause();
      }
    } catch (_) {
      /* no-op */
    }

    const audio = document.querySelector("[data-gp-audio]");
    try {
      if (audio && typeof audio.pause === "function") audio.pause();
    } catch (_) {
      /* no-op */
    }
  }

  function showBlank() {
    if (state.phase !== "corrupt") return;
    state.phase = "blank";
    document.body.setAttribute("data-easter-phase", "blank");
    window.setTimeout(showJumpscare, BLANK_MS);
  }

  function showJumpscare() {
    if (state.phase !== "blank") return;
    state.phase = "jumpscare";
    installOverlays();
    document.body.setAttribute("data-easter-phase", "jumpscare");
    playErrorStack();
  }

  function blockWhenLocked(event) {
    if (!state.locked) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function warmAudio() {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!state.audioCtx) {
      try {
        state.audioCtx = new AudioContextCtor();
      } catch (_) {
        return null;
      }
    }
    if (state.audioCtx.state === "suspended") {
      state.audioCtx.resume().catch(() => {});
    }
    return state.audioCtx;
  }

  function playErrorStack() {
    if (state.soundPlayed) return;
    state.soundPlayed = true;

    const ctx = warmAudio();
    if (!ctx) return;

    const start = () => scheduleErrorStack(ctx);
    if (ctx.state === "suspended") {
      ctx.resume().then(start).catch(() => {});
    } else {
      start();
    }
  }

  function scheduleErrorStack(ctx) {
    const now = ctx.currentTime;
    const master = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    const compressor = ctx.createDynamicsCompressor();

    shaper.curve = makeDistortionCurve(68);
    shaper.oversample = "4x";

    compressor.threshold.setValueAtTime(-20, now);
    compressor.knee.setValueAtTime(8, now);
    compressor.ratio.setValueAtTime(8, now);
    compressor.attack.setValueAtTime(0.003, now);
    compressor.release.setValueAtTime(0.18, now);

    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.22, now + 0.025);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.82);

    master.connect(shaper);
    shaper.connect(compressor);
    compressor.connect(ctx.destination);

    const pattern = [
      [0.00, 880, "square", 0.09, 0.32],
      [0.07, 659, "square", 0.08, 0.24],
      [0.14, 1046, "triangle", 0.10, 0.22],
      [0.24, 523, "square", 0.11, 0.25],
      [0.36, 1175, "square", 0.07, 0.2],
      [0.43, 784, "triangle", 0.08, 0.2],
      [0.55, 1479, "square", 0.06, 0.16],
      [0.64, 988, "square", 0.09, 0.22],
      [0.78, 740, "triangle", 0.12, 0.19],
      [0.98, 1568, "square", 0.07, 0.18],
      [1.08, 392, "sawtooth", 0.22, 0.2],
      [1.28, 1318, "square", 0.14, 0.17],
    ];

    pattern.forEach(([offset, frequency, type, duration, volume], index) => {
      scheduleTone(ctx, master, now + offset, frequency, type, duration, volume, index);
    });

    [0.02, 0.32, 0.7, 1.1].forEach((offset, index) => {
      scheduleNoise(ctx, master, now + offset, 0.18 + index * 0.035, 0.16 - index * 0.02);
    });

    window.setTimeout(() => {
      try { master.disconnect(); } catch (_) {}
      try { shaper.disconnect(); } catch (_) {}
      try { compressor.disconnect(); } catch (_) {}
    }, 2300);
  }

  function scheduleTone(ctx, output, start, frequency, type, duration, volume, index) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * 0.72), start + duration);
    osc.detune.setValueAtTime(index % 2 ? -18 : 23, start);
    osc.detune.linearRampToValueAtTime(index % 2 ? 31 : -27, start + duration);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(output);
    osc.start(start);
    osc.stop(start + duration + 0.04);
  }

  function scheduleNoise(ctx, output, start, duration, volume) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      const fade = 1 - i / data.length;
      data[i] = (Math.random() * 2 - 1) * fade;
    }

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1800, start);
    filter.frequency.exponentialRampToValueAtTime(360, start + duration);
    filter.Q.setValueAtTime(2.8, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  function makeDistortionCurve(amount) {
    const samples = 2048;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i += 1) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
