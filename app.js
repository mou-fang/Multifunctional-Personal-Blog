const STORAGE_KEY = "roulette-royale-state-v2";
const palette = ["#ff4545", "#ff7b7b", "#c70f2c", "#6d0a18", "#ffb0b0", "#9a1226"];

const state = {
  view: "setup",
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
    pendingAnimation: false,
    autoTimer: null,
  },
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
  gunBarrel: document.querySelector("#gunBarrel"),
  muzzleFlash: document.querySelector("#muzzleFlash"),
  shellRain: document.querySelector("#shellRain"),
  startGameBtn: document.querySelector("#startGameBtn"),
  nextTurnBtn: document.querySelector("#nextTurnBtn"),
  autoPlayBtn: document.querySelector("#autoPlayBtn"),
  restartBtn: document.querySelector("#restartBtn"),
};

function uid() { return `p-${Math.random().toString(36).slice(2, 9)}`; }
function delay(ms) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }

function defaultPlayers() {
  return [
    { id: uid(), name: "玩家 1", title: "冷面选手", color: palette[0] },
    { id: uid(), name: "玩家 2", title: "压轴位", color: palette[1] },
    { id: uid(), name: "玩家 3", title: "观察者", color: palette[2] },
    { id: uid(), name: "玩家 4", title: "赌徒", color: palette[4] },
  ];
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
    pendingAnimation: false,
    autoTimer: null,
  };
}

function hydrate() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    state.players = defaultPlayers();
    resetSession();
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    state.players = parsed.players?.length ? parsed.players : defaultPlayers();
    state.config = { ...state.config, ...(parsed.config || {}) };
  } catch {
    state.players = defaultPlayers();
  }
  resetSession();
}

function setView(view) {
  state.view = view;
  els.setupView.classList.toggle("active", view === "setup");
  els.gameView.classList.toggle("active", view === "game");
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildCylinder(bulletCount = state.config.bulletCount) {
  const chamberCount = Number(state.config.chamberCount);
  const count = Math.min(Number(bulletCount), chamberCount);
  return shuffle(Array.from({ length: chamberCount }, (_, index) => ({ slot: index, loaded: index < count, fired: false })));
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
  state.session.history.unshift({ id: uid(), turn: state.session.turn, title, detail, type, playerId });
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
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type === "hit" ? "sawtooth" : "triangle";
  oscillator.frequency.value = type === "hit" ? 96 : 420;
  gain.gain.value = 0.001;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (type === "hit" ? 0.26 : 0.12));
  oscillator.start(now);
  oscillator.stop(now + (type === "hit" ? 0.32 : 0.16));
}

function addPlayer(seed = {}) {
  const index = state.players.length;
  state.players.push({ id: uid(), name: seed.name || `玩家 ${index + 1}`, title: seed.title || "待命中", color: seed.color || palette[index % palette.length] });
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
  const player = state.players.find((item) => item.id === id);
  if (!player) return;
  player[key] = value;
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
    node.querySelector(".player-order").textContent = index + 1;
    node.querySelector(".name-input").value = player.name;
    node.querySelector(".title-input").value = player.title;
    node.querySelector(".color-input").value = player.color;
    node.querySelector(".preview-name").textContent = player.name;
    node.querySelector(".preview-title").textContent = player.title;
    node.querySelector(".player-dot").style.background = player.color;
    node.querySelector(".name-input").addEventListener("input", (event) => updatePlayer(player.id, "name", event.target.value || `玩家 ${index + 1}`));
    node.querySelector(".title-input").addEventListener("input", (event) => updatePlayer(player.id, "title", event.target.value || "待命中"));
    node.querySelector(".color-input").addEventListener("input", (event) => updatePlayer(player.id, "color", event.target.value));
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
  els.setupPlayerCount.textContent = String(state.players.length);
  els.setupBulletLabel.textContent = `${state.config.chamberCount} / ${state.config.bulletCount}`;
  const labels = { allBulletsUsed: "直到子弹打完", oneFullRound: "全员一轮", fixedTurns: `${state.config.fixedTurns} 回合` };
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
  const center = 63;
  const radius = 40;
  cylinderData.forEach((slot, index) => {
    const angle = (Math.PI * 2 * index) / cylinderData.length - Math.PI / 2;
    const item = document.createElement("div");
    item.className = "cylinder-slot";
    item.style.left = `${center + Math.cos(angle) * radius - 14}px`;
    item.style.top = `${center + Math.sin(angle) * radius - 14}px`;
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
    card.className = "target-card";
    card.dataset.playerId = player.id;
    if (current && current.id === player.id && state.session.started) card.classList.add("active");
    if (state.session.eliminatedIds.includes(player.id)) card.classList.add("eliminated");
    card.innerHTML = `<span class="target-order">#${index + 1}</span><div class="target-name">${player.name}</div><div class="target-title">${player.title}</div><div class="crack"></div>`;
    card.style.borderColor = `${player.color}55`;
    els.targetBoard.appendChild(card);
  });
}

function renderStatus() {
  const current = getCurrentPlayer();
  els.phaseLabel.textContent = state.session.phase;
  els.roundBadge.textContent = `第 ${state.session.turn} 轮`;
  els.remainingBulletsLabel.textContent = String(state.session.bulletsRemaining);
  els.currentPlayerLabel.textContent = current ? current.name : "未开始";
  els.alivePlayersLabel.textContent = String(getAlivePlayers().length);
  const labels = { allBulletsUsed: "直到子弹打完", oneFullRound: "所有人轮一遍", fixedTurns: `固定 ${state.config.fixedTurns} 回合` };
  els.ruleLabel.textContent = labels[state.config.endRule];
}

function renderChips() {
  els.alivePlayerChips.innerHTML = "";
  els.eliminatedPlayerChips.innerHTML = "";
  const alive = getAlivePlayers();
  const dead = state.players.filter((player) => state.session.eliminatedIds.includes(player.id));
  alive.forEach((player) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.style.setProperty("--chip-color", player.color);
    chip.textContent = player.name;
    els.alivePlayerChips.appendChild(chip);
  });
  if (!alive.length) els.alivePlayerChips.textContent = "无人存活";
  dead.forEach((player) => {
    const chip = document.createElement("span");
    chip.className = "chip eliminated";
    chip.style.setProperty("--chip-color", player.color);
    chip.textContent = player.name;
    els.eliminatedPlayerChips.appendChild(chip);
  });
  if (!dead.length) els.eliminatedPlayerChips.textContent = "暂无淘汰";
}

function renderHistory() {
  els.historyList.innerHTML = "";
  const list = state.config.historyDetail ? state.session.history : state.session.history.filter((item) => item.type === "system");
  if (!list.length) {
    els.historyList.innerHTML = "<li class='safe'><strong>暂无记录</strong><div>开始游戏后这里会显示每一枪。</div></li>";
    return;
  }
  list.forEach((entry) => {
    const item = document.createElement("li");
    item.className = entry.type === "hit" ? "hit" : "safe";
    item.innerHTML = `<strong>${entry.title}</strong><div>${entry.detail}</div>`;
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
  syncInputs();
  renderPlayerCards();
  renderSetupSummary();
  renderStatus();
  renderCylinder();
  renderTargetBoard();
  renderChips();
  renderHistory();
  persist();
}

function updateConfig(key, value) {
  state.config[key] = value;
  if (key === "chamberCount") {
    state.config.chamberCount = Math.max(2, Math.min(12, Number(value) || 6));
    if (state.config.bulletCount > state.config.chamberCount) state.config.bulletCount = state.config.chamberCount;
  }
  if (key === "bulletCount") state.config.bulletCount = Math.max(1, Math.min(state.config.chamberCount, Number(value) || 1));
  if (key === "fixedTurns") state.config.fixedTurns = Math.max(1, Math.min(50, Number(value) || 1));
  resetSession();
  updateBanner("设置已更新，进入游戏后会重新装弹。");
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
  resetSession();
  render();
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
  updateBanner("已恢复默认设置。");
  render();
}

function resolveEndCondition() {
  const alive = getAlivePlayers();
  if (!alive.length) return "所有玩家都已淘汰，游戏结束。";
  if (alive.length === 1 && state.config.eliminationMode === "eliminate") return `${alive[0].name} 成为最后存活者。`;
  if (state.config.endRule === "allBulletsUsed" && state.session.bulletsRemaining <= 0) return "所有子弹都已打出，本局结束。";
  if (state.config.endRule === "oneFullRound" && state.session.turn >= state.players.length) return "所有玩家都已轮过一遍，本局结束。";
  if (state.config.endRule === "fixedTurns" && state.session.turn >= Number(state.config.fixedTurns)) return `已达到 ${state.config.fixedTurns} 次固定回合，本局结束。`;
  return "";
}

function scheduleAutoPlay() {
  stopAutoPlay();
  state.session.autoTimer = window.setTimeout(() => advanceTurn(), 1400);
}

function animateAim(playerId) {
  const target = document.querySelector(`[data-player-id="${playerId}"]`);
  if (!target) return;
  const arenaRect = target.parentElement.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const centerY = targetRect.top - arenaRect.top + targetRect.height / 2;
  const gunY = 170;
  const delta = centerY - gunY;
  const rotate = Math.max(-18, Math.min(18, delta / 16));
  els.gunBarrel.parentElement.style.transform = `translateY(${delta * 0.58}px) rotate(${rotate}deg)`;
}

async function playIntroAnimation() {
  state.session.pendingAnimation = true;
  state.session.phase = "装弹上膛";
  updateBanner("正在装弹，上膛并锁定第一位玩家。");
  render();
  els.cylinder.classList.add("spin");
  playSound("safe");
  await delay(900);
  els.cylinder.classList.remove("spin");
  const current = getCurrentPlayer();
  if (current) animateAim(current.id);
  state.session.phase = "进行中";
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
    return;
  }
  stopAutoPlay();
  state.session.started = true;
  state.session.phase = "装弹上膛";
  state.session.turn = 0;
  state.session.currentPlayerIndex = 0;
  state.session.cylinder = buildCylinder();
  state.session.currentChamberIndex = 0;
  state.session.bulletsRemaining = Number(state.config.bulletCount);
  state.session.aliveIds = state.players.map((player) => player.id);
  state.session.eliminatedIds = [];
  state.session.history = [];
  pushHistory("游戏开始", `本局共有 ${state.players.length} 名玩家，完成随机装弹。`, "system");
  setView("game");
  render();
  await playIntroAnimation();
  updateBanner("装弹完成，枪口已经锁定当前玩家。");
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
    state.session.cylinder = buildCylinder(state.session.bulletsRemaining);
    state.session.currentChamberIndex = 0;
    els.cylinder.classList.add("spin");
    await delay(700);
    els.cylinder.classList.remove("spin");
  }
  animateAim(player.id);
  state.session.pendingAnimation = true;
  state.session.turn += 1;
  state.session.phase = "瞄准中";
  render();
  await delay(500);

  const chamberIndex = state.session.currentChamberIndex % state.session.cylinder.length;
  const slot = state.session.cylinder[chamberIndex];
  const hit = Boolean(slot?.loaded && !slot?.fired);
  if (slot) slot.fired = true;

  els.muzzleFlash.classList.add("fire");
  els.shellRain.classList.add("fire");
  playSound(hit ? "hit" : "safe");
  await delay(180);
  els.muzzleFlash.classList.remove("fire");
  els.shellRain.classList.remove("fire");

  if (hit) {
    state.session.bulletsRemaining = Math.max(0, state.session.bulletsRemaining - 1);
    markTarget(player.id, "hit");
    if (state.config.eliminationMode === "eliminate") {
      state.session.aliveIds = state.session.aliveIds.filter((id) => id !== player.id);
      if (!state.session.eliminatedIds.includes(player.id)) state.session.eliminatedIds.push(player.id);
    }
    pushHistory(`第 ${state.session.turn} 枪命中`, `${player.name} 被击中${state.config.eliminationMode === "eliminate" ? "并淘汰" : "，但继续留在场上"}。`, "hit", player.id);
    updateBanner(`${player.name} 中枪了，卡牌已经裂开。`);
  } else {
    markTarget(player.id, "safe");
    pushHistory(`第 ${state.session.turn} 枪空枪`, `${player.name} 扣下扳机，但这一枪是空的。`, "safe", player.id);
    updateBanner(`${player.name} 躲过一枪，卡牌没有碎裂。`);
    const alive = getAlivePlayers();
    if (alive.length) state.session.currentPlayerIndex = (state.session.currentPlayerIndex + 1) % alive.length;
  }

  if (state.config.spinMode === "sequence") state.session.currentChamberIndex = (chamberIndex + 1) % state.session.cylinder.length;
  const end = resolveEndCondition();
  if (end) {
    state.session.phase = "已结束";
    state.session.started = false;
    pushHistory("游戏结束", end, "system");
    updateBanner(end);
    state.session.pendingAnimation = false;
    render();
    return;
  }

  const alive = getAlivePlayers();
  if (hit && alive.length) state.session.currentPlayerIndex = state.session.currentPlayerIndex % alive.length;
  const next = getCurrentPlayer();
  if (next) animateAim(next.id);
  state.session.phase = "进行中";
  state.session.pendingAnimation = false;
  render();
  if (state.config.autoAdvance) scheduleAutoPlay();
}

function autoPlayWholeGame() {
  if (!state.session.started) {
    startGame().then(() => {
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
}

hydrate();
bindEvents();
updateBanner("先在设置页配好规则，再进入游戏。");
render();
