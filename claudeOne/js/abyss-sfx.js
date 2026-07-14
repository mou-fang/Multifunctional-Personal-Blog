/* ===== claudeOne :: abyss-sfx.js =====
 * 《深渊协议》8-bit 合成音效引擎。用 Web Audio API 现场合成方波/三角波/锯齿波/噪声，
 * 营造复古像素游戏几-bit 音色，无需任何音频资源文件。
 * 挂到 window.__ABYSS_SFX__，供 abyss.js 调用。
 * 加载顺序：page-registry.js 的 js 数组中须排在 abyss.js 之前。
 * 浏览器策略：AudioContext 在首次用户交互后延迟创建（autoplay 策略），切页 suspend。
 */
(function (host) {
  "use strict";

  var ctx = null;       // AudioContext
  var master = null;    // 主增益
  var enabled = true;   // 是否启用（静音开关）
  var lastPlay = {};    // 限频记录：{sfxName: lastTimestamp}

  // 限频间隔（ms）：高频音效避免叠成噪声
  var THROTTLE = {
    shoot: 70, hit: 50, enemyDie: 40, pickupXp: 30, pickupGold: 60, hurt: 120, heal: 200,
  };

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      var AC = host.AudioContext || host.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  // 唤醒（首次交互后调用，解锁 autoplay）
  function resume() {
    var c = ensureCtx();
    if (c && c.state === "suspended") { try { c.resume(); } catch (e) {} }
  }
  // 切页时挂起，释放音频资源
  function suspend() {
    if (ctx && ctx.state === "running") { try { ctx.suspend(); } catch (e) {} }
  }
  function setEnabled(v) { enabled = !!v; if (master) master.gain.value = v ? 0.32 : 0; }
  function isEnabled() { return enabled; }

  // 限频：返回 true 表示应播放
  function allow(name) {
    if (!enabled) return false;
    var now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    var gap = THROTTLE[name] || 0;
    if (gap > 0 && lastPlay[name] && now - lastPlay[name] < gap) return false;
    lastPlay[name] = now;
    return true;
  }

  // ---- 基础合成：单音 ----
  // type: "square"(方波,经典8bit) / "triangle"(三角,柔和) / "sawtooth"(锯齿,刺耳) / "sine"
  // freqStart→freqEnd 频率滑动；dur 秒；vol 音量；decay 衰减曲线指数
  function tone(type, freqStart, freqEnd, dur, vol, decay) {
    var c = ensureCtx(); if (!c || !enabled) return;
    var t0 = c.currentTime;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    if (freqEnd !== freqStart) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * (decay || 1));
    osc.connect(g); g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // ---- 噪声合成（爆炸/受击/破碎）----
  function noise(dur, vol, filterFreq) {
    var c = ensureCtx(); if (!c || !enabled) return;
    var t0 = c.currentTime;
    var bufSize = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, bufSize, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    var src = c.createBufferSource(); src.buffer = buf;
    var g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    var filt = c.createBiquadFilter();
    filt.type = "lowpass"; filt.frequency.value = filterFreq || 2000;
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  // ---- 音色组合（多音叠加）----
  function combo(parts) {
    parts.forEach(function (p) {
      if (p.kind === "tone") tone(p.type, p.f0, p.f1, p.dur, p.vol, p.decay);
      else if (p.kind === "noise") noise(p.dur, p.vol, p.filter);
    });
  }

  // ============ 对外音效（abyss.js 调用）============
  var SFX = {
    resume: resume, suspend: suspend, setEnabled: setEnabled, isEnabled: isEnabled,
    // 武器发射：方波短促 pew
    shoot: function (kind) {
      if (!allow("shoot")) return;
      var base = 660;
      if (kind === "missile" || kind === "carpet_bomb") base = 220;
      else if (kind === "railgun" || kind === "beam") base = 880;
      else if (kind === "ice_lance") base = 990;
      tone("square", base, base * 0.5, 0.08, 0.18, 1);
    },
    // 命中敌人：噪声 + 低方波
    hit: function (crit) {
      if (!allow("hit")) return;
      noise(0.05, crit ? 0.22 : 0.12, crit ? 3000 : 1800);
      if (crit) tone("square", 1200, 600, 0.06, 0.15, 1);
    },
    // 击杀敌人：下降音
    enemyDie: function () {
      if (!allow("enemyDie")) return;
      tone("square", 440, 110, 0.12, 0.16, 1);
      noise(0.06, 0.08, 1200);
    },
    // 玩家受伤：低频锯齿 + 噪声
    hurt: function () {
      if (!allow("hurt")) return;
      tone("sawtooth", 200, 80, 0.18, 0.22, 1);
      noise(0.1, 0.12, 800);
    },
    // 拾取经验：三角波上升
    pickupXp: function () {
      if (!allow("pickupXp")) return;
      tone("triangle", 660, 990, 0.06, 0.12, 1);
    },
    // 拾取金币：两音上升
    pickupGold: function () {
      if (!allow("pickupGold")) return;
      tone("square", 880, 880, 0.05, 0.14, 1);
      setTimeout(function () { tone("square", 1320, 1320, 0.06, 0.14, 1); }, 50);
    },
    // 治疗：柔和上升
    heal: function () {
      if (!allow("heal")) return;
      tone("triangle", 523, 784, 0.16, 0.14, 1);
    },
    // 升级：4 音琶音
    levelUp: function () {
      var notes = [523, 659, 784, 1047];
      notes.forEach(function (f, i) {
        setTimeout(function () { tone("square", f, f, 0.12, 0.18, 1); }, i * 70);
      });
    },
    // Boss 出现：低频隆隆
    bossSpawn: function () {
      tone("sawtooth", 110, 55, 0.5, 0.28, 1);
      noise(0.5, 0.14, 400);
      setTimeout(function () { tone("square", 220, 110, 0.3, 0.18, 1); }, 200);
    },
    // Boss 击败：胜利琶音
    bossKill: function () {
      var notes = [392, 523, 659, 784, 1047];
      notes.forEach(function (f, i) {
        setTimeout(function () { tone("square", f, f, 0.14, 0.2, 1); }, i * 80);
      });
      setTimeout(function () { noise(0.3, 0.16, 3000); }, 400);
    },
    // 进化/终极：辉煌上行
    evolve: function () {
      var notes = [523, 659, 784, 1047, 1319];
      notes.forEach(function (f, i) {
        setTimeout(function () { tone("square", f, f, 0.12, 0.2, 1); tone("triangle", f * 2, f * 2, 0.1, 0.1, 1); }, i * 60);
      });
    },
    // 升级选择确认：清脆点击
    select: function () {
      tone("square", 880, 880, 0.05, 0.18, 1);
      setTimeout(function () { tone("square", 1320, 1320, 0.05, 0.16, 1); }, 40);
    },
    // 暂停/恢复：低 click
    pause: function () { tone("square", 330, 330, 0.06, 0.16, 1); },
    resumeSnd: function () { tone("square", 440, 440, 0.06, 0.16, 1); },
    // 游戏开始：上行号角
    start: function () {
      [392, 523, 659].forEach(function (f, i) {
        setTimeout(function () { tone("square", f, f, 0.14, 0.2, 1); }, i * 90);
      });
    },
    // 通关：长胜利
    win: function () {
      [523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) {
        setTimeout(function () { tone("square", f, f, 0.16, 0.22, 1); tone("triangle", f / 2, f / 2, 0.16, 0.12, 1); }, i * 110);
      });
    },
    // 死亡：下行哀鸣
    gameOver: function () {
      [440, 392, 330, 262, 196].forEach(function (f, i) {
        setTimeout(function () { tone("sawtooth", f, f * 0.95, 0.22, 0.2, 1); }, i * 140);
      });
      setTimeout(function () { noise(0.4, 0.14, 600); }, 700);
    },
  };

  host.__ABYSS_SFX__ = SFX;
})(typeof window !== "undefined" ? window : globalThis);
