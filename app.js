const STORAGE_KEY = "roulette-royale-state-v2";
const LEGACY_PALETTE = ["#ff4545", "#ff7b7b", "#c70f2c", "#6d0a18", "#ffb0b0", "#9a1226"];
const palette = ["#87c8ff", "#9eb8ff", "#b8d7ff", "#7aa7ff", "#dcecff", "#98a9f7"];

const DEFAULT_CONFIG = {
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

const PHASE_LABELS = {
  idle: "等待开始",
  loading: "装弹上膛",
  aiming: "瞄准中",
  running: "进行中",
  ended: "已结束",
};

function uid() {
  return `p-${Math.random().toString(36).slice(2, 9)}`;
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function hexToRgba(hex, alpha) {
  if (typeof hex !== "string") return `rgba(138, 190, 255, ${alpha})`;
  const value = hex.trim().replace("#", "");
  if (![3, 6].includes(value.length)) return `rgba(138, 190, 255, ${alpha})`;
  const normalized = value.length === 3 ? value.split("").map((char) => `${char}${char}`).join("") : value;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function createSessionState(players = []) {
  return {
    started: false,
    phaseKey: "idle",
    phase: PHASE_LABELS.idle,
    turn: 0,
    currentPlayerIndex: 0,
    cylinder: [],
    currentChamberIndex: 0,
    bulletsRemaining: 0,
    aliveIds: players.map((player) => player.id),
    eliminatedIds: [],
    history: [],
    pendingAnimation: false,
    autoTimer: null,
  };
}

const state = {
  view: "setup",
  players: [],
  config: { ...DEFAULT_CONFIG },
  session: createSessionState(),
};

const els = {
  setupView: document.querySelector("#setupView"),
  gameView: document.querySelector("#gameView"),
  goToSetupBtn: document.querySelector("#goToSetupBtn"),
  goToGameBtn: document.querySelector("#goToGameBtn"),
  setupPlayerCount: document.querySelector("#setupPlayerCount"),
  setupBulletLabel: document.querySelector("#setupBulletLabel"),
  setupRuleLabel: document.querySelector("#setupRuleLabel"),
  playerList: document.querySelector("#playerList"),
  playerCardTemplate: document.querySelector("#playerCardTemplate"),
  addPlayerBtn: document.querySelector("#addPlayerBtn"),
  quickStartBtn: document.querySelector("#quickStartBtn"),
  resetAllBtn: document.querySelector("#resetAllBtn"),
  startFromSetupBtn: document.querySelector("#startFromSetupBtn"),
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
  resultBanner: document.querySelector("#resultBanner"),
  phaseLabel: document.querySelector("#phaseLabel"),
  roundBadge: document.querySelector("#roundBadge"),
  remainingBulletsLabel: document.querySelector("#remainingBulletsLabel"),
  currentPlayerLabel: document.querySelector("#currentPlayerLabel"),
  alivePlayersLabel: document.querySelector("#alivePlayersLabel"),
  ruleLabel: document.querySelector("#ruleLabel"),
  alivePlayerChips: document.querySelector("#alivePlayerChips"),
  eliminatedPlayerChips: document.querySelector("#eliminatedPlayerChips"),
  historyList: document.querySelector("#historyList"),
  cylinder: document.querySelector("#cylinder"),
  targetBoard: document.querySelector("#targetBoard"),
  arena: document.querySelector(".arena"),
  gunBarrel: document.querySelector("#gunBarrel"),
  gunRig: document.querySelector(".gun-rig"),
  muzzleFlash: document.querySelector("#muzzleFlash"),
  shellRain: document.querySelector("#shellRain"),
  startGameBtn: document.querySelector("#startGameBtn"),
  nextTurnBtn: document.querySelector("#nextTurnBtn"),
  autoPlayBtn: document.querySelector("#autoPlayBtn"),
  restartBtn: document.querySelector("#restartBtn"),
};

function setPhase(key) {
  state.session.phaseKey = key;
  state.session.phase = PHASE_LABELS[key] || PHASE_LABELS.idle;
}

function defaultPlayers() {
  return [
    { id: uid(), name: "玩家 1", title: "冷面选手", color: palette[0] },
    { id: uid(), name: "玩家 2", title: "静默操盘手", color: palette[1] },
    { id: uid(), name: "玩家 3", title: "观察员", color: palette[2] },
    { id: uid(), name: "玩家 4", title: "赌徒", color: palette[3] },
  ];
}

function sanitizeConfig(raw = {}) {
  const next = { ...DEFAULT_CONFIG, ...(raw || {}) };
  next.chamberCount = clampInt(next.chamberCount, 2, 12, DEFAULT_CONFIG.chamberCount);
  next.bulletCount = clampInt(next.bulletCount, 1, next.chamberCount, DEFAULT_CONFIG.bulletCount);
  next.fixedTurns = clampInt(next.fixedTurns, 1, 50, DEFAULT_CONFIG.fixedTurns);
  next.endRule = ["allBulletsUsed", "oneFullRound", "fixedTurns"].includes(next.endRule)
    ? next.endRule
    : DEFAULT_CONFIG.endRule;
  next.eliminationMode = ["eliminate", "survive"].includes(next.eliminationMode)
    ? next.eliminationMode
    : DEFAULT_CONFIG.eliminationMode;
  next.spinMode = ["sequence", "respin"].includes(next.spinMode)
    ? next.spinMode
    : DEFAULT_CONFIG.spinMode;
  next.autoAdvance = raw.autoAdvance === undefined ? DEFAULT_CONFIG.autoAdvance : Boolean(raw.autoAdvance);
  next.soundEnabled = raw.soundEnabled === undefined ? DEFAULT_CONFIG.soundEnabled : Boolean(raw.soundEnabled);
  next.historyDetail = raw.historyDetail === undefined ? DEFAULT_CONFIG.historyDetail : Boolean(raw.historyDetail);
  return next;
}

function normalizePlayer(player, index) {
  const fallback = palette[index % palette.length];
  const rawColor = typeof player?.color === "string" ? player.color : fallback;
  const lower = rawColor.toLowerCase();
  const safeColor = LEGACY_PALETTE.includes(lower) ? fallback : rawColor;
  const fallbackNames = defaultPlayers();
  return {
    id: typeof player?.id === "string" && player.id ? player.id : uid(),
    name: typeof player?.name === "string" && player.name.trim() ? player.name.trim() : `玩家 ${index + 1}`,
    title: typeof player?.title === "string" && player.title.trim() ? player.title.trim() : fallbackNames[index % fallbackNames.length].title,
    color: safeColor,
  };
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ players: state.players, config: state.config }));
}

function stopAutoPlay() {
  if (state.session.autoTimer) {
    window.clearTimeout(state.session.autoTimer);
    state.session.autoTimer = null;
  }
}

function resetSession() {
  stopAutoPlay();
  state.session = createSessionState(state.players);
}

function hydrate() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state.players = defaultPlayers();
    state.config = { ...DEFAULT_CONFIG };
    resetSession();
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    state.players = Array.isArray(parsed.players) && parsed.players.length
      ? parsed.players.map((player, index) => normalizePlayer(player, index))
      : defaultPlayers();
    state.config = sanitizeConfig(parsed.config);
  } catch {
    state.players = defaultPlayers();
    state.config = { ...DEFAULT_CONFIG };
  }

  resetSession();
}

function syncSceneState() {
  document.body.dataset.view = state.view;
  document.body.dataset.phase = state.session.phaseKey;
  document.body.dataset.started = String(state.session.started);
  els.goToSetupBtn.classList.toggle("is-current", state.view === "setup");
  els.goToGameBtn.classList.toggle("is-current", state.view === "game");
  els.goToSetupBtn.setAttribute("aria-pressed", String(state.view === "setup"));
  els.goToGameBtn.setAttribute("aria-pressed", String(state.view === "game"));
}

function setView(view) {
  state.view = view;
  els.setupView.classList.toggle("active", view === "setup");
  els.gameView.classList.toggle("active", view === "game");
  syncSceneState();
}

function shuffle(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function buildCylinder(bulletCount = state.config.bulletCount) {
  const chamberCount = Number(state.config.chamberCount);
  const count = Math.min(Number(bulletCount), chamberCount);
  return shuffle(
    Array.from({ length: chamberCount }, (_, index) => ({
      slot: index,
      loaded: index < count,
      fired: false,
    })),
  );
}

function getAlivePlayers() {
  return state.players.filter((player) => state.session.aliveIds.includes(player.id));
}

function getCurrentPlayer() {
  const alivePlayers = getAlivePlayers();
  if (!alivePlayers.length) return null;
  return alivePlayers[state.session.currentPlayerIndex % alivePlayers.length];
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

function updateBanner(text) {
  els.resultBanner.textContent = text;
}

function validateConfig() {
  if (state.players.length < 2) return "至少需要 2 名玩家。";
  if (Number(state.config.bulletCount) < 1) return "至少需要 1 发子弹。";
  if (Number(state.config.bulletCount) > Number(state.config.chamberCount)) return "子弹不能多于枪膛。";
  return "";
}

function playSound(type) {
  if (!state.config.soundEnabled) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type === "hit" ? "sawtooth" : "triangle";
  oscillator.frequency.value = type === "hit" ? 92 : 428;
  gain.gain.value = 0.001;
  oscillator.connect(gain);
  gain.connect(context.destination);
  const now = context.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (type === "hit" ? 0.28 : 0.14));
  oscillator.start(now);
  oscillator.stop(now + (type === "hit" ? 0.34 : 0.18));
  oscillator.onended = () => {
    context.close().catch(() => {});
  };
}

function addPlayer(seed = {}) {
  const index = state.players.length;
  state.players.push(
    normalizePlayer(
      {
        id: uid(),
        name: seed.name,
        title: seed.title,
        color: seed.color || palette[index % palette.length],
      },
      index,
    ),
  );
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
  const playerIndex = state.players.findIndex((item) => item.id === id);
  if (playerIndex === -1) return;
  const player = state.players[playerIndex];
  if (key === "name") player.name = value.trim() || `玩家 ${playerIndex + 1}`;
  if (key === "title") player.title = value.trim() || "待命中";
  if (key === "color") player.color = value;
  resetSession();
  persist();
  render();
}

function movePlayer(draggedId, targetId) {
  if (draggedId === targetId) return;
  const from = state.players.findIndex((player) => player.id === draggedId);
  const to = state.players.findIndex((player) => player.id === targetId);
  if (from === -1 || to === -1) return;
  const [moved] = state.players.splice(from, 1);
  state.players.splice(to, 0, moved);
  resetSession();
  persist();
  render();
}

function renderPlayerCards() {
  els.playerList.innerHTML = "";
  state.players.forEach((player, index) => {
    const node = els.playerCardTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = player.id;
    node.style.setProperty("--player-tone", hexToRgba(player.color, 0.16));
    node.querySelector(".player-order").textContent = String(index + 1);
    node.querySelector(".name-input").value = player.name;
    node.querySelector(".title-input").value = player.title;
    node.querySelector(".color-input").value = player.color;
    node.querySelector(".preview-name").textContent = player.name;
    node.querySelector(".preview-title").textContent = player.title;
    node.querySelector(".player-dot").style.background = player.color;
    node.querySelector(".name-input").addEventListener("input", (event) => updatePlayer(player.id, "name", event.target.value));
    node.querySelector(".title-input").addEventListener("input", (event) => updatePlayer(player.id, "title", event.target.value));
    node.querySelector(".color-input").addEventListener("input", (event) => updatePlayer(player.id, "color", event.target.value));
    node.querySelector(".remove-btn").addEventListener("click", () => removePlayer(player.id));
    node.addEventListener("dragstart", (event) => {
      node.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
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
    node.addEventListener("dragleave", () => node.classList.remove("drag-over"));
    node.addEventListener("drop", (event) => {
      event.preventDefault();
      node.classList.remove("drag-over");
      movePlayer(event.dataTransfer.getData("text/plain"), player.id);
    });
    els.playerList.appendChild(node);
  });
}

function renderSetupSummary() {
  const labels = {
    allBulletsUsed: "直到子弹打完",
    oneFullRound: "全员一轮",
    fixedTurns: `${state.config.fixedTurns} 回合`,
  };
  els.setupPlayerCount.textContent = String(state.players.length);
  els.setupBulletLabel.textContent = `${state.config.chamberCount} / ${state.config.bulletCount}`;
  els.setupRuleLabel.textContent = labels[state.config.endRule];
  els.ruleSummary.textContent =
    `当前配置：${state.config.chamberCount} 格枪膛，${state.config.bulletCount} 发子弹。` +
    `${labels[state.config.endRule]}。` +
    `${state.config.eliminationMode === "eliminate" ? "命中后淘汰。" : "命中后保留。"} ` +
    `${state.config.spinMode === "respin" ? "每次重新洗牌。" : "枪膛按顺序推进。"} `;
}

function renderCylinder() {
  const cylinderData = state.session.cylinder.length ? state.session.cylinder : buildCylinder(state.config.bulletCount);
  const layout = document.createElement("div");
  layout.className = "cylinder-layout";
  const center = 67;
  const radius = 44;

  cylinderData.forEach((slot, index) => {
    const angle = (Math.PI * 2 * index) / cylinderData.length - Math.PI / 2;
    const item = document.createElement("div");
    item.className = "cylinder-slot";
    item.style.left = `${center + Math.cos(angle) * radius - 15}px`;
    item.style.top = `${center + Math.sin(angle) * radius - 15}px`;
    item.textContent = slot.loaded ? (slot.fired ? "已" : "弹") : "空";
    if (!slot.loaded) item.classList.add("empty");
    if (slot.fired) item.classList.add("fired");
    if (state.session.started && index === state.session.currentChamberIndex % cylinderData.length) item.classList.add("current");
    layout.appendChild(item);
  });

  els.cylinder.innerHTML = "";
  els.cylinder.appendChild(layout);
}

function renderTargetBoard() {
  els.targetBoard.innerHTML = "";
  const current = getCurrentPlayer();

  state.players.forEach((player, index) => {
    const card = document.createElement("article");
    const order = document.createElement("span");
    const name = document.createElement("div");
    const title = document.createElement("div");
    const crack = document.createElement("div");

    card.className = "target-card";
    card.dataset.playerId = player.id;
    card.style.setProperty("--player-tone", hexToRgba(player.color, 0.18));
    card.style.borderColor = hexToRgba(player.color, 0.34);
    if (current && current.id === player.id && state.session.started) card.classList.add("active");
    if (state.session.eliminatedIds.includes(player.id)) card.classList.add("eliminated");

    order.className = "target-order";
    order.textContent = `SEQUENCE ${String(index + 1).padStart(2, "0")}`;
    name.className = "target-name";
    name.textContent = player.name;
    title.className = "target-title";
    title.textContent = player.title;
    crack.className = "crack";

    card.append(order, name, title, crack);
    els.targetBoard.appendChild(card);
  });
}

function syncArenaHeight() {
  if (!els.arena || !els.targetBoard) return;

  const boardStyle = window.getComputedStyle(els.targetBoard);
  if (boardStyle.position !== "absolute") {
    els.arena.style.minHeight = "";
    return;
  }

  const cards = [...els.targetBoard.querySelectorAll(".target-card")];
  const gap = Number.parseFloat(boardStyle.rowGap || boardStyle.gap || "16") || 16;
  const cardsHeight = cards.reduce((total, card) => total + card.getBoundingClientRect().height, 0);
  const contentHeight = cardsHeight + Math.max(cards.length - 1, 0) * gap;
  const arenaBaseHeight = 680;
  const boardPadding = 60;
  const requiredHeight = Math.max(arenaBaseHeight, Math.ceil(contentHeight + boardPadding));

  els.arena.style.minHeight = `${requiredHeight}px`;
}

function renderStatus() {
  const current = getCurrentPlayer();
  const ruleLabels = {
    allBulletsUsed: "直到子弹打完",
    oneFullRound: "所有人轮一遍",
    fixedTurns: `固定 ${state.config.fixedTurns} 回合`,
  };
  els.phaseLabel.textContent = state.session.phase;
  els.roundBadge.textContent = `第 ${state.session.turn} 轮`;
  els.remainingBulletsLabel.textContent = String(state.session.bulletsRemaining);
  els.currentPlayerLabel.textContent = current ? current.name : "未开始";
  els.alivePlayersLabel.textContent = String(getAlivePlayers().length);
  els.ruleLabel.textContent = ruleLabels[state.config.endRule];
}

function makeChip(text, className) {
  const chip = document.createElement("span");
  chip.className = className;
  chip.textContent = text;
  return chip;
}

function renderChips() {
  els.alivePlayerChips.innerHTML = "";
  els.eliminatedPlayerChips.innerHTML = "";

  const alive = getAlivePlayers();
  const dead = state.players.filter((player) => state.session.eliminatedIds.includes(player.id));

  if (!alive.length) {
    els.alivePlayerChips.appendChild(makeChip("无人存活", "chip chip-empty"));
  } else {
    alive.forEach((player) => {
      const chip = makeChip(player.name, "chip");
      chip.style.setProperty("--chip-color", player.color);
      chip.style.setProperty("--chip-glow", hexToRgba(player.color, 0.18));
      els.alivePlayerChips.appendChild(chip);
    });
  }

  if (!dead.length) {
    els.eliminatedPlayerChips.appendChild(makeChip("暂无淘汰", "chip chip-empty"));
  } else {
    dead.forEach((player) => {
      const chip = makeChip(player.name, "chip eliminated");
      chip.style.setProperty("--chip-color", player.color);
      chip.style.setProperty("--chip-glow", hexToRgba(player.color, 0.16));
      els.eliminatedPlayerChips.appendChild(chip);
    });
  }
}

function renderHistory() {
  els.historyList.innerHTML = "";
  const list = state.config.historyDetail
    ? state.session.history
    : state.session.history.filter((item) => item.type === "system");

  if (!list.length) {
    const emptyItem = document.createElement("li");
    const title = document.createElement("strong");
    const detail = document.createElement("div");
    emptyItem.className = "safe";
    title.textContent = "暂无记录";
    detail.textContent = "开始游戏后，这里会显示每一枪的状态变化。";
    emptyItem.append(title, detail);
    els.historyList.appendChild(emptyItem);
    return;
  }

  list.forEach((entry) => {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    const detail = document.createElement("div");
    item.className = entry.type === "hit" ? "hit" : "safe";
    title.textContent = entry.title;
    detail.textContent = entry.detail;
    item.append(title, detail);
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

function render() {
  syncSceneState();
  syncInputs();
  renderPlayerCards();
  renderSetupSummary();
  renderStatus();
  renderCylinder();
  renderTargetBoard();
  syncArenaHeight();
  syncShotEffects(state.session.started ? getCurrentPlayer()?.id : null);
  renderChips();
  renderHistory();
  persist();
}

function updateConfig(key, value) {
  if (key === "chamberCount") {
    state.config.chamberCount = clampInt(value, 2, 12, DEFAULT_CONFIG.chamberCount);
    state.config.bulletCount = Math.min(state.config.bulletCount, state.config.chamberCount);
  } else if (key === "bulletCount") {
    state.config.bulletCount = clampInt(value, 1, state.config.chamberCount, DEFAULT_CONFIG.bulletCount);
  } else if (key === "fixedTurns") {
    state.config.fixedTurns = clampInt(value, 1, 50, DEFAULT_CONFIG.fixedTurns);
  } else {
    state.config[key] = value;
  }

  resetSession();
  updateBanner("设置已更新，进入游戏后会重新装弹。");
  render();
}

function quickStart() {
  state.players = defaultPlayers();
  state.config = {
    ...DEFAULT_CONFIG,
    bulletCount: 2,
  };
  resetSession();
  updateBanner("已加载示例配置，可以直接开局。");
  render();
}

function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  state.players = defaultPlayers();
  state.config = { ...DEFAULT_CONFIG };
  resetSession();
  updateBanner("已恢复默认设置。");
  render();
}

function resolveEndCondition() {
  const alive = getAlivePlayers();
  if (!alive.length) return "所有玩家都已淘汰，本局结束。";
  if (alive.length === 1 && state.config.eliminationMode === "eliminate") return `${alive[0].name} 成为最后存活者。`;
  if (state.config.endRule === "allBulletsUsed" && state.session.bulletsRemaining <= 0) return "所有子弹都已打出，本局结束。";
  if (state.config.endRule === "oneFullRound" && state.session.turn >= state.players.length) return "所有玩家都已轮过一遍，本局结束。";
  if (state.config.endRule === "fixedTurns" && state.session.turn >= Number(state.config.fixedTurns)) return `已达到 ${state.config.fixedTurns} 次固定回合，本局结束。`;
  return "";
}

function scheduleAutoPlay() {
  stopAutoPlay();
  state.session.autoTimer = window.setTimeout(() => {
    advanceTurn();
  }, 1450);
}

function syncShotEffects(playerId = null) {
  if (!els.arena || !els.gunBarrel || !els.muzzleFlash || !els.shellRain || !els.cylinder) return;

  const arenaRect = els.arena.getBoundingClientRect();
  const barrelRect = els.gunBarrel.getBoundingClientRect();
  const cylinderRect = els.cylinder.getBoundingClientRect();
  const muzzlePoint = {
    x: barrelRect.right - arenaRect.left - 4,
    y: barrelRect.top - arenaRect.top + barrelRect.height / 2,
  };
  const shellOrigin = {
    x: cylinderRect.left - arenaRect.left + cylinderRect.width * 0.78,
    y: cylinderRect.top - arenaRect.top + cylinderRect.height * 0.34,
  };

  els.muzzleFlash.style.left = `${muzzlePoint.x}px`;
  els.muzzleFlash.style.top = `${muzzlePoint.y}px`;
  els.shellRain.style.left = `${shellOrigin.x}px`;
  els.shellRain.style.top = `${shellOrigin.y}px`;

  if (!playerId) {
    els.muzzleFlash.style.setProperty("--shot-angle", "0deg");
    els.muzzleFlash.style.setProperty("--trail-length", "42px");
    els.shellRain.style.setProperty("--shell-x", "112px");
    els.shellRain.style.setProperty("--shell-y", "96px");
    els.shellRain.style.setProperty("--shell-rotation", "292deg");
    return;
  }

  const target = document.querySelector(`[data-player-id="${playerId}"]`);
  if (!target) return;
  const targetRect = target.getBoundingClientRect();
  const targetCenter = {
    x: targetRect.left - arenaRect.left + targetRect.width / 2,
    y: targetRect.top - arenaRect.top + targetRect.height / 2,
  };
  const trailLength = Math.max(52, targetCenter.x - muzzlePoint.x - 26);
  const ejectionAngle = Math.PI / 2.3;
  const shellDistance = 124;

  els.muzzleFlash.style.setProperty("--shot-angle", "0deg");
  els.muzzleFlash.style.setProperty("--trail-length", `${trailLength}px`);
  els.shellRain.style.setProperty("--shell-x", `${Math.cos(ejectionAngle) * shellDistance}px`);
  els.shellRain.style.setProperty("--shell-y", `${Math.sin(ejectionAngle) * shellDistance}px`);
  els.shellRain.style.setProperty("--shell-rotation", `${(ejectionAngle * 180) / Math.PI + 220}deg`);
}

function resetGunAim() {
  if (els.gunRig) els.gunRig.style.transform = "translateY(0px)";
  syncShotEffects();
}

function getGunBaseCenterY() {
  if (!els.gunRig || !els.gunBarrel) return 0;
  return els.gunRig.offsetTop + els.gunBarrel.offsetTop + els.gunBarrel.offsetHeight / 2;
}

function animateAim(playerId) {
  const target = document.querySelector(`[data-player-id="${playerId}"]`);
  if (!target || !els.gunRig || !els.arena || !els.gunBarrel) return;
  const arenaRect = els.arena.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const targetCenterY = targetRect.top - arenaRect.top + targetRect.height / 2;
  const translateY = targetCenterY - getGunBaseCenterY();

  els.gunRig.style.transform = `translateY(${translateY}px)`;
  syncShotEffects(playerId);
}

async function playIntroAnimation() {
  state.session.pendingAnimation = true;
  setPhase("loading");
  updateBanner("正在装弹、上膛，并锁定第一位玩家。");
  render();
  els.cylinder.classList.add("spin");
  playSound("safe");
  await delay(920);
  els.cylinder.classList.remove("spin");
  const current = getCurrentPlayer();
  if (current) animateAim(current.id);
  setPhase("running");
  state.session.pendingAnimation = false;
  render();
}

function markTarget(playerId, type) {
  const card = document.querySelector(`[data-player-id="${playerId}"]`);
  if (!card) return;
  card.classList.remove("safe", "hit");
  void card.offsetWidth;
  card.classList.add(type);
}

async function startGame() {
  const issue = validateConfig();
  if (issue) {
    window.alert(issue);
    return false;
  }

  stopAutoPlay();
  state.session = createSessionState(state.players);
  state.session.started = true;
  state.session.turn = 0;
  state.session.currentPlayerIndex = 0;
  state.session.cylinder = buildCylinder();
  state.session.currentChamberIndex = 0;
  state.session.bulletsRemaining = Number(state.config.bulletCount);
  state.session.aliveIds = state.players.map((player) => player.id);
  state.session.eliminatedIds = [];
  state.session.history = [];
  setPhase("loading");
  pushHistory("游戏开始", `本局共有 ${state.players.length} 名玩家，完成随机装弹。`, "system");
  resetGunAim();
  setView("game");
  render();
  await playIntroAnimation();
  updateBanner("装弹完成，枪口已经锁定当前玩家。");
  return true;
}

async function advanceTurn() {
  if (!state.session.started || state.session.pendingAnimation) {
    if (!state.session.started) window.alert("请先开始新游戏。");
    return;
  }

  const player = getCurrentPlayer();
  if (!player) {
    updateBanner("没有可继续的玩家。");
    return;
  }

  if (state.config.spinMode === "respin") {
    setPhase("loading");
    render();
    state.session.cylinder = buildCylinder(state.session.bulletsRemaining);
    state.session.currentChamberIndex = 0;
    els.cylinder.classList.add("spin");
    await delay(720);
    els.cylinder.classList.remove("spin");
  }

  animateAim(player.id);
  state.session.pendingAnimation = true;
  state.session.turn += 1;
  setPhase("aiming");
  render();
  await delay(520);

  const chamberIndex = state.session.currentChamberIndex % state.session.cylinder.length;
  const slot = state.session.cylinder[chamberIndex];
  const hit = Boolean(slot?.loaded && !slot?.fired);
  if (slot) slot.fired = true;

  els.muzzleFlash.classList.add("fire");
  els.shellRain.classList.add("fire");
  playSound(hit ? "hit" : "safe");
  await delay(200);
  els.muzzleFlash.classList.remove("fire");
  els.shellRain.classList.remove("fire");

  if (hit) {
    state.session.bulletsRemaining = Math.max(0, state.session.bulletsRemaining - 1);
    markTarget(player.id, "hit");
    if (state.config.eliminationMode === "eliminate") {
      state.session.aliveIds = state.session.aliveIds.filter((id) => id !== player.id);
      if (!state.session.eliminatedIds.includes(player.id)) state.session.eliminatedIds.push(player.id);
    }
    pushHistory(
      `第 ${state.session.turn} 枪命中`,
      `${player.name} 被击中${state.config.eliminationMode === "eliminate" ? "并淘汰" : "，但继续留在场上"}。`,
      "hit",
      player.id,
    );
    updateBanner(`${player.name} 中枪了，目标卡已经裂开。`);
  } else {
    markTarget(player.id, "safe");
    pushHistory(`第 ${state.session.turn} 枪空枪`, `${player.name} 扣下扳机，但这一枪是空的。`, "safe", player.id);
    updateBanner(`${player.name} 躲过一枪，目标卡还完整。`);
    const alive = getAlivePlayers();
    if (alive.length) state.session.currentPlayerIndex = (state.session.currentPlayerIndex + 1) % alive.length;
  }

  if (state.config.spinMode === "sequence") {
    state.session.currentChamberIndex = (chamberIndex + 1) % state.session.cylinder.length;
  }

  const end = resolveEndCondition();
  if (end) {
    stopAutoPlay();
    state.session.started = false;
    state.session.pendingAnimation = false;
    setPhase("ended");
    pushHistory("游戏结束", end, "system");
    updateBanner(end);
    render();
    return;
  }

  const alive = getAlivePlayers();
  if (hit && alive.length) state.session.currentPlayerIndex = state.session.currentPlayerIndex % alive.length;
  const next = getCurrentPlayer();
  if (next) animateAim(next.id);
  setPhase("running");
  state.session.pendingAnimation = false;
  render();
  if (state.config.autoAdvance) scheduleAutoPlay();
}

function autoPlayWholeGame() {
  if (!state.session.started) {
    startGame().then((started) => {
      if (!started) return;
      state.config.autoAdvance = true;
      render();
      scheduleAutoPlay();
    });
    return;
  }

  state.config.autoAdvance = true;
  render();
  scheduleAutoPlay();
}

function bindEvents() {
  els.goToSetupBtn.addEventListener("click", () => setView("setup"));
  els.goToGameBtn.addEventListener("click", () => setView("game"));
  els.addPlayerBtn.addEventListener("click", () => addPlayer());
  els.quickStartBtn.addEventListener("click", quickStart);
  els.resetAllBtn.addEventListener("click", resetAll);
  els.startFromSetupBtn.addEventListener("click", () => startGame());
  els.chamberCountInput.addEventListener("change", (event) => updateConfig("chamberCount", event.target.value));
  els.bulletCountInput.addEventListener("change", (event) => updateConfig("bulletCount", event.target.value));
  els.endRuleSelect.addEventListener("change", (event) => updateConfig("endRule", event.target.value));
  els.fixedTurnsInput.addEventListener("change", (event) => updateConfig("fixedTurns", event.target.value));
  els.eliminationModeSelect.addEventListener("change", (event) => updateConfig("eliminationMode", event.target.value));
  els.spinModeSelect.addEventListener("change", (event) => updateConfig("spinMode", event.target.value));
  els.autoAdvanceToggle.addEventListener("change", (event) => updateConfig("autoAdvance", event.target.checked));
  els.soundToggle.addEventListener("change", (event) => updateConfig("soundEnabled", event.target.checked));
  els.historyDetailToggle.addEventListener("change", (event) => updateConfig("historyDetail", event.target.checked));
  els.startGameBtn.addEventListener("click", () => startGame());
  els.nextTurnBtn.addEventListener("click", () => advanceTurn());
  els.autoPlayBtn.addEventListener("click", autoPlayWholeGame);
  els.restartBtn.addEventListener("click", () => startGame());
  window.addEventListener("resize", () => {
    syncArenaHeight();
    syncShotEffects(state.session.started ? getCurrentPlayer()?.id : null);
  });
}

hydrate();
bindEvents();
updateBanner("先在设置页配好规则，再进入冷白仪式台。");
render();
