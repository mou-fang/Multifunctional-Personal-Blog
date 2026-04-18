const STORAGE_KEY = "roulette-royale-state-v1";
const palette = ["#f09b57", "#9cd3d6", "#ff8c7a", "#86d48e", "#d8c06e", "#c7a7ff"];

const state = {
  players: [],
  config: {
    chamberCount: 6,
    bulletCount: 1,
    endRule: "allBulletsUsed",
    fixedTurns: 8,
    eliminationMode: "eliminate",
    spinMode: "sequence",
    autoAdvance: false,
    soundEnabled: true,
    historyDetail: true,
  },
  session: {
    started: false,
    phase: "等待开始",
    turn: 0,
    currentPlayerIndex: 0,
    cylinder: [],
    currentChamberIndex: 0,
    bulletsRemaining: 0,
    aliveIds: [],
    eliminatedIds: [],
    history: [],
    winnerText: "",
    autoPlayTimer: null,
  },
};

const els = {
  playerList: document.querySelector("#playerList"),
  playerCardTemplate: document.querySelector("#playerCardTemplate"),
  addPlayerBtn: document.querySelector("#addPlayerBtn"),
  quickStartBtn: document.querySelector("#quickStartBtn"),
  resetAllBtn: document.querySelector("#resetAllBtn"),
  chamberCountInput: document.querySelector("#chamberCountInput"),
  bulletCountInput: document.querySelector("#bulletCountInput"),
  endRuleSelect: document.querySelector("#endRuleSelect"),
  fixedTurnsInput: document.querySelector("#fixedTurnsInput"),
  eliminationModeSelect: document.querySelector("#eliminationModeSelect"),
  spinModeSelect: document.querySelector("#spinModeSelect"),
  autoAdvanceToggle: document.querySelector("#autoAdvanceToggle"),
  soundToggle: document.querySelector("#soundToggle"),
  historyDetailToggle: document.querySelector("#historyDetailToggle"),
  ruleSummary: document.querySelector("#ruleSummary"),
  startGameBtn: document.querySelector("#startGameBtn"),
  nextTurnBtn: document.querySelector("#nextTurnBtn"),
  autoPlayBtn: document.querySelector("#autoPlayBtn"),
  restartBtn: document.querySelector("#restartBtn"),
  phaseLabel: document.querySelector("#phaseLabel"),
  roundBadge: document.querySelector("#roundBadge"),
  currentPlayerLabel: document.querySelector("#currentPlayerLabel"),
  remainingBulletsLabel: document.querySelector("#remainingBulletsLabel"),
  alivePlayersLabel: document.querySelector("#alivePlayersLabel"),
  ruleLabel: document.querySelector("#ruleLabel"),
  cylinder: document.querySelector("#cylinder"),
  cylinderHint: document.querySelector("#cylinderHint"),
  resultBanner: document.querySelector("#resultBanner"),
  alivePlayerChips: document.querySelector("#alivePlayerChips"),
  eliminatedPlayerChips: document.querySelector("#eliminatedPlayerChips"),
  historyList: document.querySelector("#historyList"),
};

function uid() {
  return `p-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultPlayers() {
  return [
    { id: uid(), name: "1", title: "抽象人", color: palette[0] },
    { id: uid(), name: "2", title: "小丑", color: palette[1] },
    { id: uid(), name: "3", title: "SB", color: palette[2] },
    { id: uid(), name: "4", title: "流浪汉", color: palette[3] },
  ];
}

function persist() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      players: state.players,
      config: state.config,
    }),
  );
}

function stopAutoPlay() {
  if (state.session.autoPlayTimer) {
    window.clearTimeout(state.session.autoPlayTimer);
    state.session.autoPlayTimer = null;
  }
}

function resetSession() {
  stopAutoPlay();
  state.session = {
    started: false,
    phase: "等待开始",
    turn: 0,
    currentPlayerIndex: 0,
    cylinder: [],
    currentChamberIndex: 0,
    bulletsRemaining: 0,
    aliveIds: state.players.map((player) => player.id),
    eliminatedIds: [],
    history: [],
    winnerText: "",
    autoPlayTimer: null,
  };
}

function hydrate() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    state.players = defaultPlayers();
    resetSession();
    return;
  }
  try {
    const parsed = JSON.parse(saved);
    state.players = parsed.players?.length ? parsed.players : defaultPlayers();
    state.config = { ...state.config, ...(parsed.config || {}) };
  } catch (error) {
    console.warn("restore failed", error);
    state.players = defaultPlayers();
  }
  resetSession();
}

function shuffle(array) {
  const copy = [...array];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function buildCylinder(loadedBulletCount = Number(state.config.bulletCount)) {
  const chamberCount = Number(state.config.chamberCount);
  const bulletCount = Math.min(Number(loadedBulletCount), chamberCount);
  const slots = Array.from({ length: chamberCount }, (_, index) => ({
    slot: index,
    loaded: index < bulletCount,
    fired: false,
  }));
  return shuffle(slots);
}

function getAlivePlayers() {
  return state.players.filter((player) => state.session.aliveIds.includes(player.id));
}

function getCurrentPlayer() {
  const alivePlayers = getAlivePlayers();
  if (!alivePlayers.length) {
    return null;
  }
  return alivePlayers[state.session.currentPlayerIndex % alivePlayers.length];
}

function updateBanner(text, mode) {
  els.resultBanner.textContent = text;
  els.resultBanner.className = `result-banner ${mode}`;
}

function pushHistory(title, detail, type, playerId = null) {
  state.session.history.unshift({
    id: uid(),
    turn: state.session.turn,
    title,
    detail,
    type,
    playerId,
  });
}

function validateConfig() {
  if (state.players.length < 2) {
    return "至少需要 2 名玩家。";
  }
  if (state.config.bulletCount < 1) {
    return "至少需要 1 发子弹。";
  }
  if (state.config.bulletCount > state.config.chamberCount) {
    return "子弹数量不能大于枪膛数量。";
  }
  return "";
}

function startGame() {
  const issue = validateConfig();
  if (issue) {
    window.alert(issue);
    return;
  }
  stopAutoPlay();
  state.session.started = true;
  state.session.phase = "进行中";
  state.session.turn = 0;
  state.session.currentPlayerIndex = 0;
  state.session.cylinder = buildCylinder();
  state.session.currentChamberIndex = 0;
  state.session.bulletsRemaining = Number(state.config.bulletCount);
  state.session.aliveIds = state.players.map((player) => player.id);
  state.session.eliminatedIds = [];
  state.session.history = [];
  state.session.winnerText = "";
  pushHistory("游戏开始", `本局共有 ${state.players.length} 名玩家，已完成随机装弹。`, "system");
  updateBanner("游戏已开始，等待第一位玩家扣动扳机。", "live");
  render();
}

function rotatePlayerQueueOnHit(playerId) {
  if (state.config.eliminationMode !== "eliminate") {
    return;
  }
  state.session.aliveIds = state.session.aliveIds.filter((id) => id !== playerId);
  if (!state.session.eliminatedIds.includes(playerId)) {
    state.session.eliminatedIds.push(playerId);
  }
  const alivePlayers = getAlivePlayers();
  state.session.currentPlayerIndex = alivePlayers.length ? state.session.currentPlayerIndex % alivePlayers.length : 0;
}

function resolveEndCondition() {
  const alivePlayers = getAlivePlayers();
  if (!alivePlayers.length) {
    return "所有玩家都已淘汰，游戏结束。";
  }
  if (alivePlayers.length === 1 && state.config.eliminationMode === "eliminate") {
    return `${alivePlayers[0].name} 成为最后存活者。`;
  }
  if (state.config.endRule === "allBulletsUsed" && state.session.bulletsRemaining <= 0) {
    return "所有子弹都已打出，本局结束。";
  }
  if (state.config.endRule === "oneFullRound" && state.session.turn >= state.players.length) {
    return "所有玩家都已轮过一遍，本局结束。";
  }
  if (state.config.endRule === "fixedTurns" && state.session.turn >= Number(state.config.fixedTurns)) {
    return `已达到 ${state.config.fixedTurns} 次固定回合，本局结束。`;
  }
  return "";
}

function finalizeGame(message) {
  state.session.phase = "已结束";
  state.session.started = false;
  state.session.winnerText = message;
  pushHistory("游戏结束", message, "system");
  updateBanner(message, "end");
  stopAutoPlay();
  render();
}

function playSound(type) {
  if (!state.config.soundEnabled) {
    return;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return;
  }
  const context = new AudioCtx();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type === "hit" ? "sawtooth" : "triangle";
  oscillator.frequency.value = type === "hit" ? 110 : 480;
  gain.gain.value = 0.001;
  oscillator.connect(gain);
  gain.connect(context.destination);
  const now = context.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (type === "hit" ? 0.28 : 0.12));
  oscillator.start(now);
  oscillator.stop(now + (type === "hit" ? 0.32 : 0.16));
}

function scheduleAutoPlay() {
  stopAutoPlay();
  state.session.autoPlayTimer = window.setTimeout(() => {
    advanceTurn();
  }, 1100);
}

function advanceTurn() {
  if (!state.session.started) {
    window.alert("请先开始新游戏。");
    return;
  }
  const player = getCurrentPlayer();
  if (!player) {
    finalizeGame("没有可继续的玩家。");
    return;
  }

  if (state.config.spinMode === "respin") {
    state.session.cylinder = buildCylinder(state.session.bulletsRemaining);
    state.session.currentChamberIndex = 0;
  }

  state.session.turn += 1;
  const chamberIndex = state.session.currentChamberIndex % state.session.cylinder.length;
  const slot = state.session.cylinder[chamberIndex];
  const hit = Boolean(slot?.loaded && !slot?.fired);
  if (slot) {
    slot.fired = true;
  }

  if (hit) {
    state.session.bulletsRemaining = Math.max(0, state.session.bulletsRemaining - 1);
    const detail = state.config.eliminationMode === "eliminate"
      ? `${player.name} 被击中并淘汰。`
      : `${player.name} 被击中，但按照当前规则继续留在场上。`;
    pushHistory(`第 ${state.session.turn} 枪命中`, detail, "hit", player.id);
    updateBanner(detail, "live");
    playSound("hit");
    rotatePlayerQueueOnHit(player.id);
  } else {
    const detail = `${player.name} 扣下扳机，结果是空枪。`;
    pushHistory(`第 ${state.session.turn} 枪安全`, detail, "safe", player.id);
    updateBanner(detail, "live");
    playSound("safe");
    const alivePlayers = getAlivePlayers();
    if (alivePlayers.length) {
      state.session.currentPlayerIndex = (state.session.currentPlayerIndex + 1) % alivePlayers.length;
    }
  }

  if (state.config.spinMode === "sequence") {
    state.session.currentChamberIndex = (chamberIndex + 1) % state.session.cylinder.length;
  }

  const ending = resolveEndCondition();
  if (ending) {
    finalizeGame(ending);
    return;
  }

  render();
  if (state.config.autoAdvance) {
    scheduleAutoPlay();
  }
}

function addPlayer(seed = {}) {
  const index = state.players.length;
  state.players.push({
    id: uid(),
    name: seed.name || `玩家 ${index + 1}`,
    title: seed.title || "待命中",
    color: seed.color || palette[index % palette.length],
  });
  resetSession();
  persist();
  render();
}

function removePlayer(id) {
  if (state.players.length <= 2) {
    window.alert("至少保留 2 名玩家。");
    return;
  }
  state.players = state.players.filter((player) => player.id !== id);
  resetSession();
  persist();
  render();
}

function updatePlayer(id, key, value) {
  const target = state.players.find((player) => player.id === id);
  if (!target) {
    return;
  }
  target[key] = value;
  resetSession();
  persist();
  render();
}

function movePlayer(draggedId, targetId) {
  if (draggedId === targetId) {
    return;
  }
  const from = state.players.findIndex((player) => player.id === draggedId);
  const to = state.players.findIndex((player) => player.id === targetId);
  if (from === -1 || to === -1) {
    return;
  }
  const [moved] = state.players.splice(from, 1);
  state.players.splice(to, 0, moved);
  resetSession();
  persist();
  render();
}

function buildRuleSummary() {
  const labels = {
    allBulletsUsed: "直到子弹全部打完才结束。",
    oneFullRound: "所有当前玩家各轮一次就结束。",
    fixedTurns: `进行 ${state.config.fixedTurns} 次扣动扳机后结束。`,
  };
  const eliminationText = state.config.eliminationMode === "eliminate"
    ? "被击中后将从后续顺序中移除。"
    : "被击中后仍保留在队列中，仅记录命中结果。";
  const spinText = state.config.spinMode === "respin"
    ? "每次扣动前都会重新随机枪膛。"
    : "枪膛按顺序推进，更有悬念。";
  els.ruleSummary.textContent =
    `当前配置：${state.config.chamberCount} 格枪膛 / ${state.config.bulletCount} 发子弹。${labels[state.config.endRule]} ${eliminationText} ${spinText}`;
}

function renderPlayerCards() {
  els.playerList.innerHTML = "";
  state.players.forEach((player, index) => {
    const node = els.playerCardTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = player.id;
    node.querySelector(".player-order").textContent = index + 1;
    node.querySelector(".name-input").value = player.name;
    node.querySelector(".title-input").value = player.title;
    node.querySelector(".color-input").value = player.color;
    node.querySelector(".preview-name").textContent = player.name;
    node.querySelector(".preview-title").textContent = player.title;
    node.querySelector(".player-dot").style.background = player.color;

    node.querySelector(".name-input").addEventListener("input", (event) => {
      updatePlayer(player.id, "name", event.target.value || `玩家 ${index + 1}`);
    });
    node.querySelector(".title-input").addEventListener("input", (event) => {
      updatePlayer(player.id, "title", event.target.value || "待命中");
    });
    node.querySelector(".color-input").addEventListener("input", (event) => {
      updatePlayer(player.id, "color", event.target.value);
    });
    node.querySelector(".remove-btn").addEventListener("click", () => removePlayer(player.id));

    node.addEventListener("dragstart", (event) => {
      node.classList.add("dragging");
      event.dataTransfer.setData("text/plain", player.id);
    });
    node.addEventListener("dragend", () => {
      node.classList.remove("dragging");
      document.querySelectorAll(".player-card").forEach((card) => card.classList.remove("drag-over"));
    });
    node.addEventListener("dragover", (event) => {
      event.preventDefault();
      node.classList.add("drag-over");
    });
    node.addEventListener("dragleave", () => {
      node.classList.remove("drag-over");
    });
    node.addEventListener("drop", (event) => {
      event.preventDefault();
      node.classList.remove("drag-over");
      movePlayer(event.dataTransfer.getData("text/plain"), player.id);
    });

    els.playerList.appendChild(node);
  });
}

function renderCylinder() {
  const chamberCount = Number(state.config.chamberCount);
  const cylinder = state.session.cylinder.length
    ? state.session.cylinder
    : Array.from({ length: chamberCount }, (_, index) => ({
        slot: index,
        loaded: index < Number(state.config.bulletCount),
        fired: false,
      }));
  const layout = document.createElement("div");
  layout.className = "cylinder-layout";

  cylinder.forEach((slot, index) => {
    const angle = (Math.PI * 2 * index) / cylinder.length - Math.PI / 2;
    const radius = 82;
    const x = 105 + Math.cos(angle) * radius - 24;
    const y = 105 + Math.sin(angle) * radius - 24;
    const item = document.createElement("div");
    item.className = "cylinder-slot";
    item.style.left = `${x}px`;
    item.style.top = `${y}px`;
    if (!slot.loaded) {
      item.classList.add("empty");
      item.textContent = "空";
    } else {
      item.textContent = slot.fired ? "已发" : "弹";
    }
    if (slot.fired) {
      item.classList.add("fired");
    }
    if (state.session.started && index === state.session.currentChamberIndex % cylinder.length) {
      item.classList.add("current");
    }
    layout.appendChild(item);
  });

  const core = document.createElement("div");
  core.className = "cylinder-core";
  layout.appendChild(core);

  els.cylinder.innerHTML = "";
  els.cylinder.appendChild(layout);
  els.cylinderHint.textContent = state.session.started
    ? "高亮圆点代表下一发将触发的位置"
    : "亮色代表装弹位置，开始后会显示推进位置";
}

function renderChips() {
  els.alivePlayerChips.innerHTML = "";
  els.eliminatedPlayerChips.innerHTML = "";
  const alivePlayers = getAlivePlayers();
  const eliminatedPlayers = state.players.filter((player) => state.session.eliminatedIds.includes(player.id));

  alivePlayers.forEach((player) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.style.setProperty("--chip-color", player.color);
    chip.textContent = player.name;
    els.alivePlayerChips.appendChild(chip);
  });
  if (!alivePlayers.length) {
    els.alivePlayerChips.textContent = "无人存活";
  }

  eliminatedPlayers.forEach((player) => {
    const chip = document.createElement("span");
    chip.className = "chip eliminated";
    chip.style.setProperty("--chip-color", player.color);
    chip.textContent = player.name;
    els.eliminatedPlayerChips.appendChild(chip);
  });
  if (!eliminatedPlayers.length) {
    els.eliminatedPlayerChips.textContent = "暂无淘汰";
  }
}

function renderHistory() {
  els.historyList.innerHTML = "";
  const visibleHistory = state.config.historyDetail
    ? state.session.history
    : state.session.history.filter((entry) => entry.type === "system");
  if (!visibleHistory.length) {
    const empty = document.createElement("li");
    empty.innerHTML = `<div class="history-meta">--</div><div class="history-content"><strong>暂无记录</strong><span>开始游戏后，这里会显示每一枪的时间线。</span></div>`;
    els.historyList.appendChild(empty);
    return;
  }
  visibleHistory.forEach((entry) => {
    const item = document.createElement("li");
    item.classList.add(entry.type === "hit" ? "hit" : "safe");
    const player = state.players.find((current) => current.id === entry.playerId);
    item.innerHTML = `
      <div class="history-meta">回合 ${entry.turn || "-"}</div>
      <div class="history-content">
        <strong>${entry.title}</strong>
        <span>${entry.detail}${player ? ` 角色：${player.name}` : ""}</span>
      </div>
    `;
    els.historyList.appendChild(item);
  });
}

function syncInputs() {
  els.chamberCountInput.value = state.config.chamberCount;
  els.bulletCountInput.value = state.config.bulletCount;
  els.endRuleSelect.value = state.config.endRule;
  els.fixedTurnsInput.value = state.config.fixedTurns;
  els.eliminationModeSelect.value = state.config.eliminationMode;
  els.spinModeSelect.value = state.config.spinMode;
  els.autoAdvanceToggle.checked = state.config.autoAdvance;
  els.soundToggle.checked = state.config.soundEnabled;
  els.historyDetailToggle.checked = state.config.historyDetail;
  els.fixedTurnsInput.disabled = state.config.endRule !== "fixedTurns";
}

function renderStatus() {
  const currentPlayer = getCurrentPlayer();
  els.phaseLabel.textContent = state.session.phase;
  els.roundBadge.textContent = `第 ${state.session.turn} 轮`;
  els.currentPlayerLabel.textContent = currentPlayer ? currentPlayer.name : "未开始";
  els.remainingBulletsLabel.textContent = String(state.session.bulletsRemaining);
  els.alivePlayersLabel.textContent = String(getAlivePlayers().length);
  const ruleMap = {
    allBulletsUsed: "直到子弹打完",
    oneFullRound: "所有人轮一遍",
    fixedTurns: `固定 ${state.config.fixedTurns} 回合`,
  };
  els.ruleLabel.textContent = ruleMap[state.config.endRule];
}

function render() {
  syncInputs();
  buildRuleSummary();
  renderPlayerCards();
  renderStatus();
  renderCylinder();
  renderChips();
  renderHistory();
  persist();
}

function updateConfig(key, value) {
  state.config[key] = value;
  if (key === "chamberCount") {
    state.config.chamberCount = Math.max(2, Math.min(12, Number(value) || 6));
    if (state.config.bulletCount > state.config.chamberCount) {
      state.config.bulletCount = state.config.chamberCount;
    }
  }
  if (key === "bulletCount") {
    state.config.bulletCount = Math.max(1, Math.min(state.config.chamberCount, Number(value) || 1));
  }
  if (key === "fixedTurns") {
    state.config.fixedTurns = Math.max(1, Math.min(50, Number(value) || 1));
  }
  resetSession();
  updateBanner("配置已更新，点击“开始新游戏”重新生成本局。", "muted");
  persist();
  render();
}

function quickStart() {
  state.players = defaultPlayers();
  state.config = {
    chamberCount: 6,
    bulletCount: 2,
    endRule: "allBulletsUsed",
    fixedTurns: 8,
    eliminationMode: "eliminate",
    spinMode: "sequence",
    autoAdvance: false,
    soundEnabled: true,
    historyDetail: true,
  };
  startGame();
}

function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  state.players = defaultPlayers();
  state.config = {
    chamberCount: 6,
    bulletCount: 1,
    endRule: "allBulletsUsed",
    fixedTurns: 8,
    eliminationMode: "eliminate",
    spinMode: "sequence",
    autoAdvance: false,
    soundEnabled: true,
    historyDetail: true,
  };
  resetSession();
  updateBanner("已恢复默认配置。", "muted");
  render();
}

function autoPlayWholeGame() {
  if (!state.session.started) {
    startGame();
  }
  state.config.autoAdvance = true;
  render();
  scheduleAutoPlay();
}

function bindEvents() {
  els.addPlayerBtn.addEventListener("click", () => addPlayer());
  els.quickStartBtn.addEventListener("click", quickStart);
  els.resetAllBtn.addEventListener("click", resetAll);
  els.chamberCountInput.addEventListener("change", (event) => updateConfig("chamberCount", event.target.value));
  els.bulletCountInput.addEventListener("change", (event) => updateConfig("bulletCount", event.target.value));
  els.endRuleSelect.addEventListener("change", (event) => updateConfig("endRule", event.target.value));
  els.fixedTurnsInput.addEventListener("change", (event) => updateConfig("fixedTurns", event.target.value));
  els.eliminationModeSelect.addEventListener("change", (event) => updateConfig("eliminationMode", event.target.value));
  els.spinModeSelect.addEventListener("change", (event) => updateConfig("spinMode", event.target.value));
  els.autoAdvanceToggle.addEventListener("change", (event) => updateConfig("autoAdvance", event.target.checked));
  els.soundToggle.addEventListener("change", (event) => updateConfig("soundEnabled", event.target.checked));
  els.historyDetailToggle.addEventListener("change", (event) => updateConfig("historyDetail", event.target.checked));
  els.startGameBtn.addEventListener("click", startGame);
  els.nextTurnBtn.addEventListener("click", advanceTurn);
  els.autoPlayBtn.addEventListener("click", autoPlayWholeGame);
  els.restartBtn.addEventListener("click", startGame);
}

hydrate();
bindEvents();
updateBanner("配置完成后点击“开始新游戏”。", "muted");
render();
