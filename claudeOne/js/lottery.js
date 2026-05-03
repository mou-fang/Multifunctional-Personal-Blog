/* ===== claudeOne :: lottery.js =====
 * Live-event lottery. Winner selection uses Web Crypto only:
 * crypto.getRandomValues() + rejection sampling for unbiased integers.
 * Animation is presentation-only and never decides the result.
 * SPA lifecycle: window.__page_lottery
 */

(function lottery() {
  "use strict";

  var container = null;
  var ac = null;

  /* Dependencies (kept as locals so mount always works even if globals change) */
  function _storageGet(key) {
    try { return window.localStorage.getItem(key); } catch(e) { return null; }
  }
  function _storageSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch(e) { return false; }
  }

  const STORAGE_KEY = "claudeOne:lottery-state-v2";
  const NAME_MAX = 24;
  const PARTICIPANT_MAX = 300;
  const PRIZE_NAME_MAX = 24;
  const PRIZE_QUOTA_MAX = 100;

  const SECTOR_COLORS = [
    "#ffd76a", "#ff5d7c", "#8f6cff", "#5fd18d", "#5ba8ff", "#ff9a4b",
    "#f7c948", "#ef476f", "#7bdff2", "#b8f35f", "#f15bb5", "#00bbf9",
  ];

  const DEFAULT_NAMES = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank"];
  const DEFAULT_PRIZES = [
    { name: "一等奖", quota: 1 },
    { name: "二等奖", quota: 3 },
    { name: "三等奖", quota: 5 },
  ];

  const state = {
    participants: [],
    prizes: [],
    winners: [],
    currentPrizeId: "",
    currentAngle: 0,
    spinning: false,
    editingParticipantId: "",
    editingPrizeId: "",
    pendingResetAll: false,
    pendingClearParticipants: false,
    pendingWinner: null,
  };

  var els = {};
  var spinFallbackTimer = null;

  /* Helpers */
  function hasWebCrypto() {
    return !!(window.crypto && typeof window.crypto.getRandomValues === "function");
  }

  function randomInt(maxExclusive) {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError("randomInt requires a positive safe integer");
    }
    if (!hasWebCrypto()) {
      throw new Error("Web Crypto is not available in this browser");
    }
    if (maxExclusive === 1) return 0;

    const range = 0x100000000;
    const limit = range - (range % maxExclusive);
    const buffer = new Uint32Array(1);
    let value = 0;
    do {
      window.crypto.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= limit);
    return value % maxExclusive;
  }

  function randomId(prefix) {
    const buffer = new Uint32Array(2);
    window.crypto.getRandomValues(buffer);
    return prefix + "_" + Array.from(buffer, (n) => n.toString(16).padStart(8, "0")).join("");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clampNumber(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  function normalizeName(value, maxLen) {
    maxLen = maxLen || NAME_MAX;
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLen);
  }

  function makeParticipant(name, index) {
    return {
      id: randomId("person"),
      name: normalizeName(name) || "未命名",
      color: SECTOR_COLORS[index % SECTOR_COLORS.length],
    };
  }

  function makePrize(name, quota) {
    return {
      id: randomId("prize"),
      name: normalizeName(name, PRIZE_NAME_MAX) || "新奖项",
      quota: clampNumber(quota, 1, PRIZE_QUOTA_MAX),
    };
  }

  function defaultState() {
    const participants = DEFAULT_NAMES.map(makeParticipant);
    const prizes = DEFAULT_PRIZES.map((p) => makePrize(p.name, p.quota));
    return {
      participants: participants,
      prizes: prizes,
      winners: [],
      currentPrizeId: prizes[0].id,
      currentAngle: 0,
    };
  }

  function sanitizeSaved(raw) {
    if (!raw || typeof raw !== "object") return defaultState();
    const participants = Array.isArray(raw.participants)
      ? raw.participants.slice(0, PARTICIPANT_MAX).map((p, i) => ({
          id: typeof p.id === "string" && p.id ? p.id : randomId("person"),
          name: normalizeName(p.name) || "未命名",
          color: typeof p.color === "string" && p.color ? p.color : SECTOR_COLORS[i % SECTOR_COLORS.length],
        }))
      : [];

    const prizes = Array.isArray(raw.prizes)
      ? raw.prizes.slice(0, 24).map((p) => ({
          id: typeof p.id === "string" && p.id ? p.id : randomId("prize"),
          name: normalizeName(p.name, PRIZE_NAME_MAX) || "奖项",
          quota: clampNumber(p.quota, 1, PRIZE_QUOTA_MAX),
        }))
      : [];

    const participantIds = new Set(participants.map((p) => p.id));
    const prizeIds = new Set(prizes.map((p) => p.id));
    const winners = Array.isArray(raw.winners)
      ? raw.winners.filter((w) => participantIds.has(w.participantId) && prizeIds.has(w.prizeId)).map((w, i) => ({
          participantId: w.participantId,
          prizeId: w.prizeId,
          name: normalizeName(w.name) || "未命名",
          prizeName: normalizeName(w.prizeName, PRIZE_NAME_MAX) || "奖项",
          color: typeof w.color === "string" && w.color ? w.color : SECTOR_COLORS[i % SECTOR_COLORS.length],
          rank: Number.isSafeInteger(w.rank) ? w.rank : i + 1,
        }))
      : [];

    if (participants.length === 0 || prizes.length === 0) return defaultState();

    return {
      participants: participants,
      prizes: prizes,
      winners: winners,
      currentPrizeId: prizeIds.has(raw.currentPrizeId) ? raw.currentPrizeId : prizes[0].id,
      currentAngle: Number.isFinite(raw.currentAngle) ? raw.currentAngle : 0,
    };
  }

  function loadState() {
    let loaded = null;
    try {
      const raw = _storageGet(STORAGE_KEY);
      loaded = raw ? JSON.parse(raw) : null;
    } catch (e) {
      loaded = null;
    }
    Object.assign(state, sanitizeSaved(loaded));
  }

  function saveState() {
    _storageSet(STORAGE_KEY, JSON.stringify({
      participants: state.participants,
      prizes: state.prizes,
      winners: state.winners,
      currentPrizeId: state.currentPrizeId,
      currentAngle: state.currentAngle % 360,
    }));
  }

  function currentPrize() {
    return state.prizes.find((p) => p.id === state.currentPrizeId) || state.prizes[0];
  }

  function winnerIds() {
    return new Set(state.winners.map((w) => w.participantId));
  }

  function activeParticipants() {
    const won = winnerIds();
    return state.participants.filter((p) => !won.has(p.id));
  }

  function prizeWinners(prizeId) {
    return state.winners.filter((w) => w.prizeId === prizeId);
  }

  function remainingForPrize(prize) {
    if (!prize) return 0;
    return Math.max(0, prize.quota - prizeWinners(prize.id).length);
  }

  function collectElements() {
    els.wheelFrame = container.querySelector("[data-wheel-frame]");
    els.wheelRotor = container.querySelector("[data-wheel-rotor]");
    els.bulbRing = container.querySelector("[data-bulb-ring]");
    els.spinBtn = container.querySelector("[data-spin-btn]");
    els.spinSubtitle = container.querySelector("[data-spin-subtitle]");
    els.currentPrize = container.querySelector("[data-current-prize]");
    els.prizeProgress = container.querySelector("[data-prize-progress]");
    els.activeCount = container.querySelector("[data-active-count]");
    els.winnerCount = container.querySelector("[data-winner-count]");
    els.prizeCount = container.querySelector("[data-prize-count]");
    els.prizeList = container.querySelector("[data-prize-list]");
    els.prizeForm = container.querySelector("[data-prize-form]");
    els.prizeName = container.querySelector("[data-prize-name]");
    els.prizeQuota = container.querySelector("[data-prize-quota]");
    els.prizeSubmit = container.querySelector("[data-prize-submit]");
    els.prizeCancel = container.querySelector("[data-prize-cancel]");
    els.participantList = container.querySelector("[data-participant-list]");
    els.participantForm = container.querySelector("[data-participant-form]");
    els.participantName = container.querySelector("[data-participant-name]");
    els.participantSubmit = container.querySelector("[data-participant-submit]");
    els.participantCancel = container.querySelector("[data-participant-cancel]");
    els.bulkInput = container.querySelector("[data-bulk-input]");
    els.importParticipants = container.querySelector("[data-import-participants]");
    els.clearBulk = container.querySelector("[data-clear-bulk]");
    els.clearParticipants = container.querySelector("[data-clear-participants]");
    els.resetWinners = container.querySelector("[data-reset-winners]");
    els.resetAll = container.querySelector("[data-reset-all]");
    els.copyWinners = container.querySelector("[data-copy-winners]");
    els.winnerList = container.querySelector("[data-winner-list]");
    els.confettiLayer = container.querySelector("[data-confetti-layer]");
    els.randomStatus = container.querySelector("[data-random-status]");
    /* reveal modal: first look inside container, then fallback to document */
    els.reveal = container.querySelector("[data-winner-reveal]") || document.querySelector("[data-winner-reveal]");
    els.revealPrize = document.querySelector("[data-reveal-prize]");
    els.revealName = document.querySelector("[data-reveal-name]");
    els.revealCopy = document.querySelector("[data-reveal-copy]");
    els.revealClose = document.querySelector("[data-reveal-close]");
  }

  function buildBulbRing() {
    if (!els.bulbRing) return;
    els.bulbRing.innerHTML = "";
    const count = 44;
    const radius = 50;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const bulb = document.createElement("span");
      bulb.className = "bulb";
      bulb.style.left = (50 + radius * Math.cos(angle)) + "%";
      bulb.style.top = (50 + radius * Math.sin(angle)) + "%";
      bulb.style.animationDelay = (i * 0.035) + "s";
      els.bulbRing.appendChild(bulb);
    }
  }

  function sectorPath(cx, cy, r, startAngle, endAngle) {
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return [
      "M", cx, cy,
      "L", x1.toFixed(2), y1.toFixed(2),
      "A", r, r, 0, largeArc, 1, x2.toFixed(2), y2.toFixed(2),
      "Z",
    ].join(" ");
  }

  function buildWheel() {
    if (!els.wheelRotor) return;
    const active = activeParticipants();
    const count = active.length;
    const cx = 300;
    const cy = 300;
    const r = 274;
    let html = '<circle class="wheel-rim" cx="300" cy="300" r="286" />';

    if (count === 0) {
      html += '<circle cx="300" cy="300" r="250" fill="rgba(255,255,255,0.08)" />';
      html += '<text class="wheel-empty-text" x="300" y="292">暂无可抽人数</text>';
      html += '<text class="wheel-empty-text" x="300" y="326" style="font-size:15px;opacity:.65">请添加名单或重置中奖状态</text>';
    } else {
      const slice = (Math.PI * 2) / count;
      active.forEach((p, i) => {
        const start = i * slice - Math.PI / 2;
        const end = start + slice;
        html += '<path class="wheel-sector" d="' + sectorPath(cx, cy, r, start, end) +
          '" fill="' + escapeHtml(p.color) + '" data-person-id="' + escapeHtml(p.id) + '" />';

        if (count <= 36) {
          const mid = start + slice / 2;
          const labelRadius = count <= 12 ? r * 0.61 : r * 0.69;
          const label = count <= 18 ? p.name : String(i + 1);
          const fontSize = count <= 12 ? 18 : count <= 18 ? 14 : 12;
          html += '<text class="wheel-label' + (count > 18 ? " wheel-label--small" : "") +
            '" x="' + (cx + labelRadius * Math.cos(mid)).toFixed(1) +
            '" y="' + (cy + labelRadius * Math.sin(mid)).toFixed(1) +
            '" font-size="' + fontSize + '">' + escapeHtml(label) + '</text>';
        }
      });
    }

    html += '<circle class="wheel-center" cx="300" cy="300" r="48" />';
    html += '<circle class="wheel-center-dot" cx="300" cy="300" r="18" />';
    els.wheelRotor.innerHTML = html;
    applyLabelCounterRotation(state.currentAngle, true);
  }

  function applyLabelCounterRotation(angle, instant) {
    if (!els.wheelRotor) return;
    const labels = els.wheelRotor.querySelectorAll(".wheel-label");
    if (instant) els.wheelRotor.dataset.instant = "true";
    labels.forEach((label) => {
      label.style.transform = "rotate(" + (-angle) + "deg)";
    });
    if (instant) {
      requestAnimationFrame(function() {
        if (!state.spinning) delete els.wheelRotor.dataset.instant;
      });
    }
  }

  function renderPrizes() {
    if (!els.prizeList) return;
    const prize = currentPrize();
    els.prizeList.innerHTML = "";
    state.prizes.forEach((p) => {
      const used = prizeWinners(p.id).length;
      const item = document.createElement("div");
      item.className = "prize-item";
      item.dataset.active = p.id === state.currentPrizeId ? "true" : "false";
      item.innerHTML = `
        <div class="item-main">
          <strong>${escapeHtml(p.name)}</strong>
          <small>${used} / ${p.quota} 名 · 剩余 ${Math.max(0, p.quota - used)} 名</small>
        </div>
        <button class="tiny-btn" data-select-prize="${escapeHtml(p.id)}" type="button">选择</button>
        <div class="item-actions">
          <button class="tiny-btn" data-edit-prize="${escapeHtml(p.id)}" type="button">编辑</button>
          <button class="tiny-btn" data-delete-prize="${escapeHtml(p.id)}" data-danger="true" type="button">删除</button>
        </div>
      `;
      els.prizeList.appendChild(item);
    });
  }

  function renderParticipants() {
    if (!els.participantList) return;
    els.participantList.innerHTML = "";
    const won = winnerIds();
    if (state.participants.length === 0) {
      els.participantList.innerHTML = '<div class="empty-state">暂无参与者，请添加或批量导入名单。</div>';
      return;
    }

    state.participants.forEach((p, index) => {
      const hasWon = won.has(p.id);
      const item = document.createElement("div");
      item.className = "person-item";
      item.innerHTML = `
        <span class="color-dot" style="background:${escapeHtml(p.color)}"></span>
        <div class="item-main">
          <strong>${escapeHtml(index + 1)}. ${escapeHtml(p.name)}</strong>
          <small>${hasWon ? "已中奖，不再参与后续抽奖" : "可参与抽奖"}</small>
        </div>
        <div class="item-actions">
          <button class="tiny-btn" data-edit-person="${escapeHtml(p.id)}" type="button">编辑</button>
          <button class="tiny-btn" data-delete-person="${escapeHtml(p.id)}" data-danger="true" type="button">删除</button>
        </div>
      `;
      els.participantList.appendChild(item);
    });
  }

  function renderWinners() {
    if (!els.winnerList) return;
    els.winnerList.innerHTML = "";
    if (state.winners.length === 0) {
      els.winnerList.innerHTML = '<div class="empty-state">还没有中奖记录。</div>';
      return;
    }

    state.winners.forEach((w, i) => {
      const item = document.createElement("div");
      item.className = "winner-item";
      item.innerHTML = `
        <span class="rank-chip">${i + 1}</span>
        <div class="item-main">
          <strong>${escapeHtml(w.name)}</strong>
          <small>${escapeHtml(w.prizeName)}</small>
        </div>
      `;
      els.winnerList.appendChild(item);
    });
  }

  function renderStats() {
    const active = activeParticipants();
    const prize = currentPrize();
    const remain = remainingForPrize(prize);
    const drawn = prize ? prizeWinners(prize.id).length : 0;

    if (els.currentPrize) els.currentPrize.textContent = prize ? prize.name : "暂无奖项";
    if (els.prizeProgress) els.prizeProgress.textContent = prize ? "剩余 " + remain + " / " + prize.quota + " 名" : "请添加奖项";
    if (els.activeCount) els.activeCount.textContent = String(active.length);
    if (els.winnerCount) els.winnerCount.textContent = String(state.winners.length);
    if (els.prizeCount) els.prizeCount.textContent = String(state.prizes.length);
    if (els.spinSubtitle) {
      els.spinSubtitle.textContent = prize
        ? (remain > 0 ? "可抽 " + active.length + " 人 · 已开 " + drawn + " 名" : "当前奖项已抽满")
        : "请先添加奖项";
    }

    const canDraw = !state.spinning && hasWebCrypto() && prize && remain > 0 && active.length > 0;
    if (els.spinBtn) {
      els.spinBtn.disabled = !canDraw;
      var spinSpan = els.spinBtn.querySelector("span");
      if (spinSpan) {
        spinSpan.textContent = state.spinning
          ? "抽取中"
          : !hasWebCrypto()
            ? "随机源不可用"
            : prize && remain <= 0
              ? "切换奖项"
              : active.length <= 0
                ? "无可抽人数"
                : "开始抽奖";
      }
    }

    if (!hasWebCrypto() && els.randomStatus) {
      els.randomStatus.textContent = "安全随机不可用";
    }
  }

  function renderForms() {
    if (els.participantSubmit) els.participantSubmit.textContent = state.editingParticipantId ? "保存" : "添加";
    if (els.participantCancel) els.participantCancel.hidden = !state.editingParticipantId;
    if (els.prizeSubmit) els.prizeSubmit.textContent = state.editingPrizeId ? "保存奖项" : "添加奖项";
    if (els.prizeCancel) els.prizeCancel.hidden = !state.editingPrizeId;
  }

  function renderAll() {
    renderPrizes();
    renderParticipants();
    renderWinners();
    buildWheel();
    renderStats();
    renderForms();
  }

  function resetParticipantForm() {
    state.editingParticipantId = "";
    if (els.participantName) els.participantName.value = "";
    renderForms();
  }

  function resetPrizeForm() {
    state.editingPrizeId = "";
    if (els.prizeName) els.prizeName.value = "";
    if (els.prizeQuota) els.prizeQuota.value = "1";
    renderForms();
  }

  function upsertParticipant(name) {
    const clean = normalizeName(name);
    if (!clean) {
      var toastFn = window.ClaudeOne && window.ClaudeOne.toast;
      if (toastFn) toastFn("请输入参与者姓名", "err");
      return;
    }
    if (state.editingParticipantId) {
      const target = state.participants.find((p) => p.id === state.editingParticipantId);
      if (target) target.name = clean;
      state.winners.forEach((w) => {
        if (w.participantId === state.editingParticipantId) w.name = clean;
      });
      var t2 = window.ClaudeOne && window.ClaudeOne.toast;
      if (t2) t2("参与者已更新", "ok");
    } else {
      if (state.participants.length >= PARTICIPANT_MAX) {
        var t3 = window.ClaudeOne && window.ClaudeOne.toast;
        if (t3) t3("参与者最多 " + PARTICIPANT_MAX + " 人", "err");
        return;
      }
      state.participants.push(makeParticipant(clean, state.participants.length));
      var t4 = window.ClaudeOne && window.ClaudeOne.toast;
      if (t4) t4("已添加参与者", "ok");
    }
    resetParticipantForm();
    saveState();
    renderAll();
  }

  function deleteParticipant(id) {
    state.participants = state.participants.filter((p) => p.id !== id);
    state.winners = state.winners.filter((w) => w.participantId !== id);
    if (state.editingParticipantId === id) resetParticipantForm();
    saveState();
    renderAll();
  }

  function editParticipant(id) {
    const p = state.participants.find((person) => person.id === id);
    if (!p) return;
    state.editingParticipantId = id;
    if (els.participantName) {
      els.participantName.value = p.name;
      els.participantName.focus();
    }
    renderForms();
  }

  function importParticipants() {
    if (!els.bulkInput) return;
    const lines = els.bulkInput.value.split(/\r?\n/).map((line) => normalizeName(line)).filter(Boolean);
    if (lines.length === 0) {
      var t = window.ClaudeOne && window.ClaudeOne.toast;
      if (t) t("请先粘贴名单", "err");
      return;
    }
    const existing = new Set(state.participants.map((p) => p.name.toLowerCase()));
    let added = 0;
    for (const name of lines) {
      if (state.participants.length >= PARTICIPANT_MAX) break;
      const key = name.toLowerCase();
      if (existing.has(key)) continue;
      existing.add(key);
      state.participants.push(makeParticipant(name, state.participants.length));
      added++;
    }
    els.bulkInput.value = "";
    saveState();
    renderAll();
    var t2 = window.ClaudeOne && window.ClaudeOne.toast;
    if (t2) t2("已导入 " + added + " 人", added > 0 ? "ok" : "err");
  }

  function upsertPrize(name, quota) {
    const clean = normalizeName(name, PRIZE_NAME_MAX);
    if (!clean) {
      var t = window.ClaudeOne && window.ClaudeOne.toast;
      if (t) t("请输入奖项名称", "err");
      return;
    }
    const q = clampNumber(quota, 1, PRIZE_QUOTA_MAX);
    if (state.editingPrizeId) {
      const target = state.prizes.find((p) => p.id === state.editingPrizeId);
      if (target) {
        target.name = clean;
        target.quota = q;
        state.winners.forEach((w) => {
          if (w.prizeId === target.id) w.prizeName = clean;
        });
      }
      var t2 = window.ClaudeOne && window.ClaudeOne.toast;
      if (t2) t2("奖项已更新", "ok");
    } else {
      state.prizes.push(makePrize(clean, q));
      state.currentPrizeId = state.prizes[state.prizes.length - 1].id;
      var t3 = window.ClaudeOne && window.ClaudeOne.toast;
      if (t3) t3("已添加奖项", "ok");
    }
    resetPrizeForm();
    saveState();
    renderAll();
  }

  function deletePrize(id) {
    if (state.prizes.length <= 1) {
      var t = window.ClaudeOne && window.ClaudeOne.toast;
      if (t) t("至少保留一个奖项", "err");
      return;
    }
    state.prizes = state.prizes.filter((p) => p.id !== id);
    state.winners = state.winners.filter((w) => w.prizeId !== id);
    if (state.currentPrizeId === id) state.currentPrizeId = state.prizes[0].id;
    if (state.editingPrizeId === id) resetPrizeForm();
    saveState();
    renderAll();
  }

  function editPrize(id) {
    const p = state.prizes.find((prize) => prize.id === id);
    if (!p) return;
    state.editingPrizeId = id;
    if (els.prizeName) {
      els.prizeName.value = p.name;
      els.prizeName.focus();
    }
    if (els.prizeQuota) els.prizeQuota.value = String(p.quota);
    renderForms();
  }

  function spin() {
    if (state.spinning) return;
    const prize = currentPrize();
    const active = activeParticipants();
    if (!prize || remainingForPrize(prize) <= 0 || active.length === 0) return;

    let winnerIndex = 0;
    try {
      winnerIndex = randomInt(active.length);
    } catch (err) {
      var t = window.ClaudeOne && window.ClaudeOne.toast;
      if (t) t(err.message || "安全随机源不可用", "err");
      renderStats();
      return;
    }

    const winner = active[winnerIndex];
    const sectorAngle = 360 / active.length;
    const sectorCenter = winnerIndex * sectorAngle + sectorAngle / 2;
    const previousAngle = state.currentAngle % 360;
    const fullTurns = 2160 + randomInt(5) * 360;
    const visualJitter = (randomInt(10001) / 10000 - 0.5) * sectorAngle * 0.48;
    const targetAngle = state.currentAngle + fullTurns + ((360 - previousAngle - sectorCenter + 360) % 360) + visualJitter;

    state.spinning = true;
    state.pendingWinner = { winner: winner, prize: prize, targetAngle: targetAngle };
    renderStats();
    if (els.wheelFrame) els.wheelFrame.dataset.spinning = "true";
    if (els.wheelRotor) {
      els.wheelRotor.dataset.instant = "true";
      els.wheelRotor.style.transform = "rotate(" + previousAngle + "deg)";
    }
    applyLabelCounterRotation(previousAngle, true);

    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        if (!els.wheelRotor) return;
        delete els.wheelRotor.dataset.instant;
        els.wheelRotor.style.transform = "rotate(" + targetAngle + "deg)";
        applyLabelCounterRotation(targetAngle);
        state.currentAngle = targetAngle;
        clearTimeout(spinFallbackTimer);
        spinFallbackTimer = setTimeout(resolveSpin, 5700);
      });
    });
  }

  function resolveSpin() {
    if (!state.spinning || !state.pendingWinner) return;
    clearTimeout(spinFallbackTimer);
    spinFallbackTimer = null;

    const winner = state.pendingWinner.winner;
    const prize = state.pendingWinner.prize;
    state.pendingWinner = null;
    state.spinning = false;
    if (els.wheelFrame) delete els.wheelFrame.dataset.spinning;

    const rank = prizeWinners(prize.id).length + 1;
    state.winners.push({
      participantId: winner.id,
      prizeId: prize.id,
      name: winner.name,
      prizeName: prize.name,
      color: winner.color,
      rank: rank,
    });

    saveState();
    renderAll();
    launchConfetti();
    showWinner(winner.name, prize.name, rank);
  }

  function launchConfetti() {
    if (!els.confettiLayer) return;
    const colors = ["#ffd76a", "#ff5d7c", "#8f6cff", "#5fd18d", "#5ba8ff", "#ff9a4b", "#ffffff"];
    els.confettiLayer.innerHTML = "";
    for (let i = 0; i < 90; i++) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = randomInt(10000) / 100 + "%";
      piece.style.background = colors[randomInt(colors.length)];
      piece.style.animationDelay = (randomInt(50) / 100) + "s";
      piece.style.setProperty("--fall-dur", (220 + randomInt(160)) / 100 + "s");
      piece.style.setProperty("--spin", (360 + randomInt(1080)) + "deg");
      els.confettiLayer.appendChild(piece);
    }
    setTimeout(function() { if (els.confettiLayer) els.confettiLayer.innerHTML = ""; }, 4300);
  }

  function showWinner(name, prizeName, rank) {
    if (els.revealPrize) els.revealPrize.textContent = prizeName + " · 第 " + rank + " 名";
    if (els.revealName) els.revealName.textContent = name;
    if (els.revealCopy) els.revealCopy.textContent = "恭喜 " + name + " 中奖";
    if (els.reveal) {
      els.reveal.hidden = false;
      els.reveal.setAttribute("data-visible", "true");
      els.reveal.setAttribute("aria-hidden", "false");
    }
  }

  function hideWinner() {
    if (els.reveal) {
      els.reveal.removeAttribute("data-visible");
      els.reveal.setAttribute("aria-hidden", "true");
      els.reveal.hidden = true;
    }
  }

  function copyWinnerNames() {
    if (state.winners.length === 0) {
      var t = window.ClaudeOne && window.ClaudeOne.toast;
      if (t) t("暂无中奖记录可复制", "err");
      return;
    }
    const text = state.winners.map((w) => w.name).join("\n");

    const fallback = function() {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch(e) { ok = false; }
      document.body.removeChild(ta);
      var t2 = window.ClaudeOne && window.ClaudeOne.toast;
      if (t2) t2(ok ? "已复制 " + state.winners.length + " 位中奖者" : "复制失败，请手动选择", ok ? "ok" : "err");
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function() {
          var t = window.ClaudeOne && window.ClaudeOne.toast;
          if (t) t("已复制 " + state.winners.length + " 位中奖者", "ok");
        })
        .catch(fallback);
    } else {
      fallback();
    }
  }

  function resetWinnersOnly() {
    state.winners = [];
    state.currentAngle = 0;
    state.spinning = false;
    state.pendingWinner = null;
    if (els.wheelRotor) {
      els.wheelRotor.dataset.instant = "true";
      els.wheelRotor.style.transform = "rotate(0deg)";
    }
    applyLabelCounterRotation(0, true);
    saveState();
    renderAll();
    var t = window.ClaudeOne && window.ClaudeOne.toast;
    if (t) t("中奖状态已重置", "ok");
  }

  function resetEverything() {
    Object.assign(state, defaultState(), {
      spinning: false,
      editingParticipantId: "",
      editingPrizeId: "",
      pendingResetAll: false,
      pendingClearParticipants: false,
    });
    if (els.bulkInput) els.bulkInput.value = "";
    resetParticipantForm();
    resetPrizeForm();
    saveState();
    renderAll();
    var t = window.ClaudeOne && window.ClaudeOne.toast;
    if (t) t("抽奖页已恢复默认", "ok");
  }

  function requireSecondClick(button, key, confirmText, action) {
    if (!state[key]) {
      state[key] = true;
      const original = button.textContent;
      button.textContent = confirmText;
      setTimeout(function() {
        state[key] = false;
        button.textContent = original;
      }, 2600);
      return;
    }
    state[key] = false;
    action();
  }

  function wireEvents() {
    if (els.spinBtn) els.spinBtn.addEventListener("click", spin, { signal: ac.signal });
    if (els.wheelRotor) {
      els.wheelRotor.addEventListener("transitionend", function(e) {
        if (e.propertyName === "transform") resolveSpin();
      }, { signal: ac.signal });
    }

    if (els.participantForm) {
      els.participantForm.addEventListener("submit", function(e) {
        e.preventDefault();
        upsertParticipant(els.participantName ? els.participantName.value : "");
      }, { signal: ac.signal });
    }
    if (els.participantCancel) els.participantCancel.addEventListener("click", resetParticipantForm, { signal: ac.signal });
    if (els.importParticipants) els.importParticipants.addEventListener("click", importParticipants, { signal: ac.signal });
    if (els.clearBulk) els.clearBulk.addEventListener("click", function() { if (els.bulkInput) els.bulkInput.value = ""; }, { signal: ac.signal });
    if (els.clearParticipants) {
      els.clearParticipants.addEventListener("click", function() {
        requireSecondClick(els.clearParticipants, "pendingClearParticipants", "再次点击清空", function() {
          state.participants = [];
          state.winners = [];
          saveState();
          renderAll();
        });
      }, { signal: ac.signal });
    }

    if (els.prizeForm) {
      els.prizeForm.addEventListener("submit", function(e) {
        e.preventDefault();
        upsertPrize(els.prizeName ? els.prizeName.value : "", els.prizeQuota ? els.prizeQuota.value : 1);
      }, { signal: ac.signal });
    }
    if (els.prizeCancel) els.prizeCancel.addEventListener("click", resetPrizeForm, { signal: ac.signal });

    if (els.prizeList) {
      els.prizeList.addEventListener("click", function(e) {
        const select = e.target.closest("[data-select-prize]");
        const edit = e.target.closest("[data-edit-prize]");
        const del = e.target.closest("[data-delete-prize]");
        if (select) {
          state.currentPrizeId = select.dataset.selectPrize;
          saveState();
          renderAll();
        } else if (edit) {
          editPrize(edit.dataset.editPrize);
        } else if (del) {
          deletePrize(del.dataset.deletePrize);
        }
      }, { signal: ac.signal });
    }

    if (els.participantList) {
      els.participantList.addEventListener("click", function(e) {
        const edit = e.target.closest("[data-edit-person]");
        const del = e.target.closest("[data-delete-person]");
        if (edit) editParticipant(edit.dataset.editPerson);
        if (del) deleteParticipant(del.dataset.deletePerson);
      }, { signal: ac.signal });
    }

    if (els.resetWinners) els.resetWinners.addEventListener("click", resetWinnersOnly, { signal: ac.signal });
    if (els.resetAll) {
      els.resetAll.addEventListener("click", function() {
        requireSecondClick(els.resetAll, "pendingResetAll", "再次点击重置", resetEverything);
      }, { signal: ac.signal });
    }
    if (els.copyWinners) els.copyWinners.addEventListener("click", copyWinnerNames, { signal: ac.signal });
    if (els.revealClose) els.revealClose.addEventListener("click", hideWinner, { signal: ac.signal });
    if (els.reveal) {
      els.reveal.addEventListener("click", function(e) {
        if (e.target === els.reveal) hideWinner();
      }, { signal: ac.signal });
    }
    document.addEventListener("keydown", function(e) {
      if (e.key === "Escape") hideWinner();
      if (e.key === "Enter" && document.activeElement === document.body && !state.spinning) spin();
    }, { signal: ac.signal });
  }

  function mount(el) {
    container = el;
    ac = new AbortController();
    spinFallbackTimer = null;
    /* Reset per-mount ephemeral state */
    state.spinning = false;
    state.pendingWinner = null;
    state.pendingResetAll = false;
    state.pendingClearParticipants = false;
    state.editingParticipantId = "";
    state.editingPrizeId = "";

    collectElements();
    loadState();
    buildBulbRing();
    wireEvents();
    renderAll();
  }

  function unmount() {
    if (ac) { ac.abort(); ac = null; }
    if (spinFallbackTimer) { clearTimeout(spinFallbackTimer); spinFallbackTimer = null; }
    state.spinning = false;
    state.pendingWinner = null;
    container = null;
  }

  window.__page_lottery = { mount: mount, unmount: unmount };
})();
