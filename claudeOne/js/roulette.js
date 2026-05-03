/* ===== claudeOne :: roulette.js =====
 * Russian Roulette game. Pure plain-JS state machine, no framework.
 * Phases: setup → playing → ended.
 * SPA lifecycle: window.__page_game
 */

(function roulette() {
  "use strict";

  var container = null;
  var ac = null;

  const CFG = window.CLAUDE_ONE_CONFIG;
  const CS = window.ClaudeOne;
  const C = CFG && CFG.limits ? CFG.limits : {};
  const { escapeHtml, clamp, toast } = CS || {};

  function _esc(s) { return escapeHtml ? escapeHtml(s) : String(s); }
  function _clamp(v, lo, hi) { return clamp ? clamp(v, lo, hi) : Math.max(lo, Math.min(hi, v)); }
  function _toast(t, k) { return toast ? toast(t, k) : void 0; }

  // --- State ---------------------------------------------------------------
  const COLORS = ["#6f9bff", "#5fc8ff", "#8c83ff", "#ff8a7a", "#ffb457",
                  "#74d29b", "#f47ab9", "#a5d760", "#5fb8d2", "#e39dff"];

  const state = {
    phase: "setup",
    players: [
      makePlayer("Player 1"),
      makePlayer("Player 2"),
    ],
    chamberSize: 6,
    bulletCount: 1,
    endCondition: "bullets-empty",
    turnOrder: "fixed",
    autoSpin: true,
    revealAfterMiss: false,
    // Play-time state:
    chamber: [],         // array of booleans of length chamberSize; true = bullet
    chamberPointer: 0,   // next position to fire from
    currentIdx: 0,       // index into playOrder
    playOrder: [],       // indices into players[]
    turns: [],           // log: [{player, result, chamberPos}]
    bulletsFired: 0,
    roundsCompleted: 0,  // tracked to implement "one-round"
    ended: false,
    outcome: null,       // {kind, winners: [names], eliminated: [names]}
    firing: false,       // guard against rapid clicks during autoSpin delay
  };

  function makePlayer(name) {
    return {
      id: "p_" + Math.random().toString(36).slice(2, 9),
      name,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alive: true,
    };
  }

  // --- DOM refs (rebuilt each mount) ---------------------------------------
  var els = {};

  function collectElements() {
    els.setupView = container.querySelector("[data-view-setup]");
    els.playView = container.querySelector("[data-view-play]");
    els.endView = container.querySelector("[data-view-end]");
    els.playerList = container.querySelector("[data-player-list]");
    els.addPlayerBtn = container.querySelector("[data-add-player]");
    els.playerCountLabel = container.querySelector("[data-player-count]");
    els.chamberStepper = container.querySelector("[data-stepper-chamber]");
    els.bulletStepper = container.querySelector("[data-stepper-bullets]");
    els.endCondRadios = container.querySelectorAll('input[name="endCondition"]');
    els.turnOrderRadios = container.querySelectorAll('input[name="turnOrder"]');
    els.autoSpinToggle = container.querySelector('[data-toggle-autospin]');
    els.revealToggle = container.querySelector('[data-toggle-reveal]');
    els.startBtn = container.querySelector("[data-start]");
    els.chamberSvg = container.querySelector("[data-chamber]");
    els.currentPlayer = container.querySelector("[data-current-player]");
    els.fireBtn = container.querySelector("[data-fire]");
    els.turnLog = container.querySelector("[data-turn-log]");
    els.resultBanner = container.querySelector("[data-result]");
    els.endBanner = container.querySelector("[data-end-banner]");
    els.endActions = container.querySelector("[data-end-actions]");
    els.newGameBtn = container.querySelector("[data-new-game]");
    els.sameSettingsBtn = container.querySelector("[data-same-settings]");
    els.chamberInfo = container.querySelector("[data-chamber-info]");
    els.remainingPlayers = container.querySelector("[data-remaining-players]");
  }

  // --- Render: setup -------------------------------------------------------
  function renderPlayerList() {
    els.playerList.innerHTML = "";
    state.players.forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "player-row";
      row.setAttribute("draggable", "true");
      row.dataset.idx = String(i);
      row.innerHTML = `
        <span class="player-row__handle" aria-hidden="true">☰</span>
        <span class="player-row__dot" style="background:${_esc(p.color)}"></span>
        <input class="player-row__name input" value="${_esc(p.name)}"
               maxlength="${C.playerNameMax || 24}" aria-label="Player name" />
        <button class="player-row__remove btn btn-ghost btn-sm" aria-label="Remove">✕</button>
      `;
      const input = row.querySelector("input");
      input.addEventListener("input", (e) => {
        state.players[i].name = e.target.value.slice(0, C.playerNameMax || 24);
      }, { signal: ac.signal });
      const removeBtn = row.querySelector(".player-row__remove");
      removeBtn.disabled = state.players.length <= (C.playersMin || 2);
      removeBtn.addEventListener("click", () => {
        state.players.splice(i, 1);
        renderPlayerList();
        updatePlayerCountLabel();
        clampSettings();
      }, { signal: ac.signal });
      // Drag-and-drop reorder
      row.addEventListener("dragstart", (e) => {
        row.setAttribute("data-dragging", "true");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(i));
      });
      row.addEventListener("dragend", () => {
        row.removeAttribute("data-dragging");
        container.querySelectorAll(".player-row[data-drop-over]").forEach((r) => r.removeAttribute("data-drop-over"));
      });
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        row.setAttribute("data-drop-over", "true");
      });
      row.addEventListener("dragleave", () => row.removeAttribute("data-drop-over"));
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        row.removeAttribute("data-drop-over");
        const from = Number(e.dataTransfer.getData("text/plain"));
        const to = i;
        if (Number.isNaN(from) || from === to) return;
        const [moved] = state.players.splice(from, 1);
        state.players.splice(to, 0, moved);
        renderPlayerList();
      });
      els.playerList.appendChild(row);
    });
  }

  function updatePlayerCountLabel() {
    if (els.playerCountLabel) els.playerCountLabel.textContent = String(state.players.length);
  }

  function clampSettings() {
    state.chamberSize = _clamp(state.chamberSize, C.chamberMin || 4, C.chamberMax || 12);
    state.bulletCount = _clamp(state.bulletCount, 1, state.chamberSize - 1);
    renderChamberStepper();
    renderBulletStepper();
  }

  function renderChamberStepper() {
    const val = els.chamberStepper && els.chamberStepper.querySelector(".stepper__value");
    if (val) val.textContent = String(state.chamberSize);
  }
  function renderBulletStepper() {
    const val = els.bulletStepper && els.bulletStepper.querySelector(".stepper__value");
    if (val) val.textContent = String(state.bulletCount);
  }

  // Steppers
  function wireStepper(el, onDelta) {
    if (!el) return;
    const minus = el.querySelector('[data-op="minus"]');
    const plus = el.querySelector('[data-op="plus"]');
    if (minus) minus.addEventListener("click", () => onDelta(-1), { signal: ac.signal });
    if (plus) plus.addEventListener("click", () => onDelta(+1), { signal: ac.signal });
  }

  // --- Render: play --------------------------------------------------------
  function buildChamberSvg() {
    const size = 260;
    const cx = size / 2;
    const cy = size / 2;
    const rOuter = size / 2 - 10;
    const rInner = size / 2 - 58;
    const slots = state.chamberSize;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 " + size + " " + size);
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("aria-hidden", "true");
    // Outer ring
    const ringBg = document.createElementNS(svgNS, "circle");
    ringBg.setAttribute("cx", String(cx));
    ringBg.setAttribute("cy", String(cy));
    ringBg.setAttribute("r", String(rOuter));
    ringBg.setAttribute("fill", "rgba(0,0,0,0.05)");
    ringBg.setAttribute("stroke", "currentColor");
    ringBg.setAttribute("stroke-opacity", "0.15");
    ringBg.setAttribute("stroke-width", "2");
    svg.appendChild(ringBg);
    // Slots
    const g = document.createElementNS(svgNS, "g");
    g.setAttribute("class", "chamber-slots");
    svg.appendChild(g);
    for (let i = 0; i < slots; i++) {
      const angle = (i / slots) * Math.PI * 2 - Math.PI / 2;
      const sx = cx + Math.cos(angle) * (rOuter + rInner) / 2;
      const sy = cy + Math.sin(angle) * (rOuter + rInner) / 2;
      const slot = document.createElementNS(svgNS, "circle");
      slot.setAttribute("cx", String(sx));
      slot.setAttribute("cy", String(sy));
      slot.setAttribute("r", "18");
      const isBullet = !!state.chamber[i];
      const loaded = isBullet && (state.revealAfterMiss || state.ended);
      slot.setAttribute("fill", loaded ? "#ff5f6d" : "rgba(255,255,255,0.12)");
      slot.setAttribute("stroke", "currentColor");
      slot.setAttribute("stroke-opacity", "0.35");
      slot.setAttribute("stroke-width", "1.5");
      slot.dataset.slot = String(i);
      g.appendChild(slot);
      // Small dot for fired slots
      if (i < state.chamberPointer) {
        const mark = document.createElementNS(svgNS, "circle");
        mark.setAttribute("cx", String(sx));
        mark.setAttribute("cy", String(sy));
        mark.setAttribute("r", "5");
        mark.setAttribute("fill", "currentColor");
        mark.setAttribute("opacity", "0.5");
        g.appendChild(mark);
      }
    }
    // Pointer arrow at the "firing" angle
    const pointerAngle = (state.chamberPointer / slots) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(pointerAngle) * (rOuter + 2);
    const py = cy + Math.sin(pointerAngle) * (rOuter + 2);
    const ax = cx + Math.cos(pointerAngle) * (rOuter - 26);
    const ay = cy + Math.sin(pointerAngle) * (rOuter - 26);
    const arrow = document.createElementNS(svgNS, "line");
    arrow.setAttribute("x1", String(px));
    arrow.setAttribute("y1", String(py));
    arrow.setAttribute("x2", String(ax));
    arrow.setAttribute("y2", String(ay));
    arrow.setAttribute("stroke", "currentColor");
    arrow.setAttribute("stroke-width", "3");
    arrow.setAttribute("stroke-linecap", "round");
    svg.appendChild(arrow);
    return svg;
  }

  function renderChamber(spinning) {
    if (!els.chamberSvg) return;
    const svg = buildChamberSvg();
    els.chamberSvg.innerHTML = "";
    els.chamberSvg.appendChild(svg);
    els.chamberSvg.setAttribute("data-spinning", String(!!spinning));
    if (els.chamberInfo) {
      els.chamberInfo.textContent = state.chamberSize + " 位弹巢 · " + state.bulletCount + " 发 · 已触发 " + state.bulletsFired + "/" + state.bulletCount;
    }
  }

  function renderCurrentPlayer() {
    if (!els.currentPlayer) return;
    const p = state.players[state.playOrder[state.currentIdx]];
    if (!p) {
      els.currentPlayer.textContent = "—";
      return;
    }
    els.currentPlayer.innerHTML = `
      <span class="player-badge" style="background:${_esc(p.color)}"></span>
      <span>${_esc(p.name)}</span>
    `;
    if (els.remainingPlayers) {
      const alive = state.players.filter((p) => p.alive).length;
      els.remainingPlayers.textContent = alive + " / " + state.players.length + " 名玩家在场";
    }
  }

  function renderTurnLog() {
    if (!els.turnLog) return;
    els.turnLog.innerHTML = "";
    state.turns.slice().reverse().forEach((t) => {
      const row = document.createElement("li");
      row.className = "turn-log__row";
      const kind = t.result === "bullet" ? "bullet" : "miss";
      row.innerHTML = `
        <span class="turn-log__tag" data-kind="${kind}">${kind === "bullet" ? "中弹" : "安全"}</span>
        <span class="turn-log__name">${_esc(t.player)}</span>
        <span class="turn-log__slot muted">槽位 ${t.chamberPos + 1}</span>
      `;
      els.turnLog.appendChild(row);
    });
  }

  // --- Play logic ----------------------------------------------------------
  function start() {
    const minPlayers = C.playersMin || 2;
    const maxPlayers = C.playersMax || 10;
    const nameMax = C.playerNameMax || 24;
    if (state.players.length < minPlayers) {
      _toast("至少需要 " + minPlayers + " 名玩家", "err");
      return;
    }
    // Sanitize names
    state.players.forEach((p) => {
      p.name = (p.name || "").trim().slice(0, nameMax) || "匿名";
      p.alive = true;
    });
    // Build chamber
    buildChamber();
    // Build play order
    const idxs = state.players.map((_, i) => i);
    state.playOrder = state.turnOrder === "random" ? shuffle(idxs) : idxs;
    state.currentIdx = 0;
    state.turns = [];
    state.bulletsFired = 0;
    state.roundsCompleted = 0;
    state.ended = false;
    state.outcome = null;
    state.phase = "playing";
    renderPhase();
  }

  function buildChamber() {
    const slots = new Array(state.chamberSize).fill(false);
    const positions = [];
    while (positions.length < state.bulletCount) {
      const p = Math.floor(Math.random() * state.chamberSize);
      if (!positions.includes(p)) positions.push(p);
    }
    positions.forEach((p) => (slots[p] = true));
    state.chamber = slots;
    state.chamberPointer = 0;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function advanceCurrentIdx() {
    const n = state.playOrder.length;
    let nextIdx = state.currentIdx;
    for (let i = 0; i < n; i++) {
      nextIdx = (nextIdx + 1) % n;
      const p = state.players[state.playOrder[nextIdx]];
      if (p && p.alive) {
        // Did we wrap around past position 0? That's a full round.
        if (nextIdx <= state.currentIdx) state.roundsCompleted += 1;
        state.currentIdx = nextIdx;
        return true;
      }
    }
    return false; // no alive player remaining
  }

  var fireTimer = null;

  function fire() {
    if (state.ended || state.firing) return;
    const playerRef = state.players[state.playOrder[state.currentIdx]];
    if (!playerRef || !playerRef.alive) {
      advanceCurrentIdx();
      return;
    }

    state.firing = true;
    if (els.fireBtn) {
      els.fireBtn.setAttribute("data-firing", "true");
      setTimeout(() => els.fireBtn && els.fireBtn.removeAttribute("data-firing"), 460);
    }

    const doFire = () => {
      const pos = state.chamberPointer;
      const isBullet = state.chamber[pos];
      state.chamberPointer += 1;
      if (isBullet) state.bulletsFired += 1;
      const entry = {
        player: playerRef.name,
        result: isBullet ? "bullet" : "miss",
        chamberPos: pos,
      };
      state.turns.push(entry);
      showResult(entry);

      if (isBullet && state.endCondition === "last-standing") {
        playerRef.alive = false;
      }
      // Decide if game ends
      if (decideEnd()) {
        state.ended = true;
        state.phase = "ended";
        renderPhase();
        state.firing = false;
        return;
      }
      // Advance player
      const ok = advanceCurrentIdx();
      if (!ok) {
        state.ended = true;
        state.phase = "ended";
        renderPhase();
        state.firing = false;
        return;
      }
      // Auto-spin between turns?
      if (state.autoSpin && !isBullet) {
        rebuildChamberBetweenTurns();
      }
      renderChamber(state.autoSpin);
      renderCurrentPlayer();
      renderTurnLog();
      state.firing = false;
    };

    if (state.autoSpin) {
      renderChamber(true);
      fireTimer = setTimeout(doFire, 900);
    } else {
      doFire();
    }
  }

  function rebuildChamberBetweenTurns() {
    const remaining = state.chamber.length - state.chamberPointer;
    if (remaining <= 0) return;
    const unfiredBullets = state.chamber.slice(state.chamberPointer).filter(Boolean).length;
    const slots = new Array(remaining).fill(false);
    const positions = [];
    while (positions.length < unfiredBullets) {
      const p = Math.floor(Math.random() * remaining);
      if (!positions.includes(p)) positions.push(p);
    }
    positions.forEach((p) => (slots[p] = true));
    state.chamber = state.chamber.slice(0, state.chamberPointer).concat(slots);
  }

  function showResult(entry) {
    if (!els.resultBanner) return;
    els.resultBanner.setAttribute("data-kind", entry.result);
    els.resultBanner.textContent =
      entry.result === "bullet"
        ? "砰！" + entry.player + " 中弹（第 " + (entry.chamberPos + 1) + " 槽）"
        : "咔嗒…… " + entry.player + " 安全通过";
    els.resultBanner.style.animation = "none";
    void els.resultBanner.offsetWidth;
    els.resultBanner.style.animation = "";
  }

  function decideEnd() {
    if (state.endCondition === "bullets-empty") {
      if (state.bulletsFired >= state.bulletCount) {
        state.outcome = computeOutcome("bullets-empty");
        return true;
      }
    } else if (state.endCondition === "one-round") {
      if (state.turns.length >= state.playOrder.length) {
        state.outcome = computeOutcome("one-round");
        return true;
      }
    } else if (state.endCondition === "last-standing") {
      const alive = state.players.filter((p) => p.alive);
      if (alive.length <= 1) {
        state.outcome = computeOutcome("last-standing");
        return true;
      }
      if (state.bulletsFired >= state.bulletCount) {
        state.outcome = computeOutcome("last-standing");
        return true;
      }
    }
    return false;
  }

  function computeOutcome(kind) {
    const hit = state.turns.filter((t) => t.result === "bullet").map((t) => t.player);
    const alive = state.players.filter((p) => p.alive).map((p) => p.name);
    if (kind === "last-standing") {
      return { kind, winners: alive, eliminated: hit };
    }
    if (kind === "one-round") {
      return {
        kind,
        winners: state.players
          .filter((p) => !hit.includes(p.name))
          .map((p) => p.name),
        eliminated: hit,
      };
    }
    return {
      kind,
      winners: state.players
        .filter((p) => !hit.includes(p.name))
        .map((p) => p.name),
      eliminated: hit,
    };
  }

  // --- View switching ------------------------------------------------------
  function renderPhase() {
    if (els.setupView) els.setupView.classList.toggle("hidden", state.phase !== "setup");
    if (els.playView) els.playView.classList.toggle("hidden", state.phase !== "playing");
    if (els.endView) els.endView.classList.toggle("hidden", state.phase !== "ended");
    if (state.phase === "playing") {
      renderChamber(false);
      renderCurrentPlayer();
      renderTurnLog();
      if (els.resultBanner) {
        els.resultBanner.textContent = "准备好了就按下扳机";
        els.resultBanner.removeAttribute("data-kind");
      }
    } else if (state.phase === "ended") {
      renderEndBanner();
      renderChamber(false);
    }
  }

  function renderEndBanner() {
    if (!state.outcome || !els.endBanner) return;
    const o = state.outcome;
    const winStr = o.winners.length
      ? o.winners.map((n) => "<strong>" + _esc(n) + "</strong>").join("、")
      : "无";
    const lossStr = o.eliminated.length
      ? o.eliminated.map((n) => _esc(n)).join("、")
      : "无";
    let kindText = "";
    if (o.kind === "last-standing") kindText = o.winners.length ? "最后幸存者胜出" : "团灭";
    else if (o.kind === "one-round") kindText = "一轮结束";
    else kindText = "所有子弹已触发";
    els.endBanner.innerHTML = `
      <span class="pill pill--accent">${_esc(kindText)}</span>
      <h2>胜利：${winStr}</h2>
      <p class="muted">退场：${lossStr}</p>
      <p class="muted">总回合：${state.turns.length} · 中弹：${state.outcome.eliminated.length}</p>
    `;
  }

  // --- Wire up -------------------------------------------------------------
  function wire() {
    // Player list
    renderPlayerList();
    updatePlayerCountLabel();
    if (els.addPlayerBtn) {
      els.addPlayerBtn.addEventListener("click", () => {
        if (state.players.length >= (C.playersMax || 10)) {
          _toast("最多 " + (C.playersMax || 10) + " 名玩家", "err");
          return;
        }
        state.players.push(makePlayer("Player " + (state.players.length + 1)));
        renderPlayerList();
        updatePlayerCountLabel();
      }, { signal: ac.signal });
    }

    // Steppers
    wireStepper(els.chamberStepper, (d) => {
      state.chamberSize = _clamp(state.chamberSize + d, C.chamberMin || 4, C.chamberMax || 12);
      state.bulletCount = _clamp(state.bulletCount, 1, state.chamberSize - 1);
      renderChamberStepper();
      renderBulletStepper();
    });
    wireStepper(els.bulletStepper, (d) => {
      state.bulletCount = _clamp(state.bulletCount + d, 1, state.chamberSize - 1);
      renderBulletStepper();
    });
    renderChamberStepper();
    renderBulletStepper();

    // Radios
    (els.endCondRadios || []).forEach((r) => {
      if (r.value === state.endCondition) r.checked = true;
      r.addEventListener("change", (e) => {
        if (e.target.checked) state.endCondition = e.target.value;
      }, { signal: ac.signal });
    });
    (els.turnOrderRadios || []).forEach((r) => {
      if (r.value === state.turnOrder) r.checked = true;
      r.addEventListener("change", (e) => {
        if (e.target.checked) state.turnOrder = e.target.value;
      }, { signal: ac.signal });
    });

    // Toggles
    if (els.autoSpinToggle) {
      els.autoSpinToggle.checked = state.autoSpin;
      els.autoSpinToggle.addEventListener("change", (e) => (state.autoSpin = e.target.checked), { signal: ac.signal });
    }
    if (els.revealToggle) {
      els.revealToggle.checked = state.revealAfterMiss;
      els.revealToggle.addEventListener("change", (e) => (state.revealAfterMiss = e.target.checked), { signal: ac.signal });
    }

    // Start / Fire / End actions
    if (els.startBtn) els.startBtn.addEventListener("click", start, { signal: ac.signal });
    if (els.fireBtn) els.fireBtn.addEventListener("click", fire, { signal: ac.signal });

    if (els.newGameBtn) {
      els.newGameBtn.addEventListener("click", () => {
        state.phase = "setup";
        renderPhase();
      }, { signal: ac.signal });
    }
    if (els.sameSettingsBtn) {
      els.sameSettingsBtn.addEventListener("click", start, { signal: ac.signal });
    }

    renderPhase();
  }

  function mount(el) {
    container = el;
    ac = new AbortController();
    fireTimer = null;
    collectElements();
    wire();
  }

  function unmount() {
    if (ac) { ac.abort(); ac = null; }
    if (fireTimer) { clearTimeout(fireTimer); fireTimer = null; }
    state.firing = false;
    container = null;
  }

  window.__page_game = { mount: mount, unmount: unmount };
})();
