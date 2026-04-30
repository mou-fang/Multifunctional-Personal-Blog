/* ===== claudeOne :: sokoban.js =====
 * Pure front-end Sokoban. Simulation state is independent from rendering:
 * fixed levels, solvable random generation, layered hints, and step-by-step
 * auto-completion all use the same solver.
 */
(function (host) {
  "use strict";

  const STORAGE_KEY = "claudeOne:sokoban-state-v1";
  const DIRS = Object.freeze({
    U: Object.freeze({ id: "U", dx: 0, dy: -1, arrow: "↑", key: "up" }),
    R: Object.freeze({ id: "R", dx: 1, dy: 0, arrow: "→", key: "right" }),
    D: Object.freeze({ id: "D", dx: 0, dy: 1, arrow: "↓", key: "down" }),
    L: Object.freeze({ id: "L", dx: -1, dy: 0, arrow: "←", key: "left" }),
  });
  const DIR_ORDER = Object.freeze([DIRS.U, DIRS.R, DIRS.D, DIRS.L]);

  const DIFFICULTY_LABELS = Object.freeze([
    "",
    "超级简单",
    "简单",
    "轻松",
    "普通",
    "稍难",
    "困难",
    "很难",
    "高难",
    "专家",
    "超级困难",
  ]);

  const SOKOBAN_FIXED_LEVELS = Object.freeze([
    Object.freeze({
      id: "fixed-01",
      name: "入门推箱",
      difficulty: 1,
      map: lines([
        "#####",
        "#@$.#",
        "#####",
      ]),
    }),
    Object.freeze({
      id: "fixed-02",
      name: "直线训练",
      difficulty: 2,
      map: lines([
        "#######",
        "#@ $ .#",
        "#######",
      ]),
    }),
    Object.freeze({
      id: "fixed-03",
      name: "转角",
      difficulty: 3,
      map: lines([
        "######",
        "#@   #",
        "# $  #",
        "#  . #",
        "######",
      ]),
    }),
    Object.freeze({
      id: "fixed-04",
      name: "双箱并行",
      difficulty: 4,
      map: lines([
        "########",
        "#@ $ . #",
        "#  $ . #",
        "########",
      ]),
    }),
    Object.freeze({
      id: "fixed-05",
      name: "错位目标",
      difficulty: 5,
      map: lines([
        "########",
        "#@  .  #",
        "# $$   #",
        "#  .   #",
        "########",
      ]),
    }),
    Object.freeze({
      id: "fixed-06",
      name: "三箱仓库",
      difficulty: 6,
      map: lines([
        "#########",
        "#@ $ .  #",
        "#  $ .  #",
        "#  $ .  #",
        "#########",
      ]),
    }),
    Object.freeze({
      id: "fixed-07",
      name: "隔墙推送",
      difficulty: 7,
      map: lines([
        "#########",
        "#@  $ . #",
        "# # $ . #",
        "#   $ . #",
        "#########",
      ]),
    }),
    Object.freeze({
      id: "fixed-08",
      name: "三箱换位",
      difficulty: 8,
      map: lines([
        "##########",
        "#@  $  .#",
        "# # $$ .#",
        "#    .  #",
        "##########",
      ]),
    }),
    Object.freeze({
      id: "fixed-09",
      name: "专家仓库",
      difficulty: 9,
      map: lines([
        "###########",
        "#@ $ .    #",
        "#  $ .    #",
        "# #$ .    #",
        "#  $ .    #",
        "###########",
      ]),
    }),
    Object.freeze({
      id: "fixed-10",
      name: "超级困难",
      difficulty: 10,
      map: lines([
        "##########",
        "#@  $  .#",
        "# # $$ .#",
        "#   $  .#",
        "#      .#",
        "##########",
      ]),
    }),
  ]);

  const BRUTAL_LIBRARY = Object.freeze([
  Object.freeze({
    boxCount: 4,
    decoyCount: 3,
    pushes: 28,
    map: lines([
      "############",
      "#    #   ###",
      "#         ##",
      "###.# ###*##",
      "###. . ##@##",
      "###  $   $ #",
      "####  $..  #",
      "#######  . #",
      "############",
    ]),
  }),
  Object.freeze({
    boxCount: 4,
    decoyCount: 3,
    pushes: 30,
    map: lines([
      "############",
      "## .  ######",
      "##      $@##",
      "##.$  ###$##",
      "## ######.##",
      "#  ###### ##",
      "# . ####   #",
      "## * ###   #",
      "##.. #######",
      "##   #######",
      "############",
    ]),
  }),
  Object.freeze({
    boxCount: 4,
    decoyCount: 2,
    pushes: 31,
    map: lines([
      "############",
      "#   ########",
      "# .  . #####",
      "## .$  #####",
      "## #   #   #",
      "##$##.$  . #",
      "##@$ . #####",
      "#####  #####",
      "############",
    ]),
  }),
  Object.freeze({
    boxCount: 4,
    decoyCount: 2,
    pushes: 30,
    map: lines([
      "#########",
      "###     #",
      "### .$. #",
      "###   . #",
      "###.$  ##",
      "#  .   ##",
      "#  ##$*##",
      "#####@ ##",
      "#########",
    ]),
  }),
  Object.freeze({
    boxCount: 5,
    decoyCount: 3,
    pushes: 34,
    map: lines([
      "##########",
      "#  #######",
      "#.  . ####",
      "# $      #",
      "# +. *$  #",
      "# . $.  ##",
      "#  .$  ###",
      "###    ###",
      "##########",
    ]),
  }),
  Object.freeze({
    boxCount: 5,
    decoyCount: 3,
    pushes: 32,
    map: lines([
      "#########",
      "#### .. #",
      "###@$   #",
      "#  $..$##",
      "#  .    #",
      "###  .$.#",
      "#####  $#",
      "#### .  #",
      "#########",
    ]),
  }),
  Object.freeze({
    boxCount: 5,
    decoyCount: 3,
    pushes: 31,
    map: lines([
      "##########",
      "##  . .  #",
      "##  .$.  #",
      "#  $ ##. #",
      "#.$ $+$  #",
      "# . ###  #",
      "##########",
    ]),
  }),
  Object.freeze({
    boxCount: 4,
    decoyCount: 2,
    pushes: 37,
    map: lines([
      "#########",
      "#   ## ##",
      "#  $@$.##",
      "#  .#   #",
      "## $    #",
      "## .. *##",
      "## .   ##",
      "###  ####",
      "#########",
    ]),
  }),
  Object.freeze({
    boxCount: 4,
    decoyCount: 2,
    pushes: 28,
    map: lines([
      "############",
      "#   ########",
      "# .  $ #####",
      "###### .   #",
      "#####  $ . #",
      "##### $@$  #",
      "##     ## ##",
      "## . .    ##",
      "##  . ######",
      "############",
    ]),
  }),
  Object.freeze({
    boxCount: 5,
    decoyCount: 2,
    pushes: 29,
    map: lines([
      "#########",
      "#    ## #",
      "## .. $@#",
      "##  $ $.#",
      "##   .$ #",
      "##.  ####",
      "##.$ ####",
      "##  . ###",
      "#########",
    ]),
  }),
  Object.freeze({
    boxCount: 4,
    decoyCount: 3,
    pushes: 30,
    map: lines([
      "#########",
      "### .  ##",
      "### .$ ##",
      "#@$..  ##",
      "# $  $  #",
      "# ..  . #",
      "#####   #",
      "#########",
    ]),
  }),
  Object.freeze({
    boxCount: 4,
    decoyCount: 3,
    pushes: 32,
    map: lines([
      "###########",
      "#####   ###",
      "## .$. .###",
      "# $ # .   #",
      "#@$.  . $.#",
      "######    #",
      "###########",
    ]),
  }),
  Object.freeze({
    boxCount: 5,
    decoyCount: 3,
    pushes: 31,
    map: lines([
      "############",
      "### . ######",
      "###..$ # . #",
      "#   $  #   #",
      "#   .$ ##$##",
      "#  .  . $@##",
      "#      #####",
      "# .  #######",
      "############",
    ]),
  }),
  Object.freeze({
    boxCount: 5,
    decoyCount: 2,
    pushes: 32,
    map: lines([
      "############",
      "#   ###    #",
      "#   ###    #",
      "##.#  ### ##",
      "#   $ ### ##",
      "#   .$   .##",
      "##. .  ## ##",
      "## $.$ .$ ##",
      "###@   #####",
      "############",
    ]),
  }),
  Object.freeze({
    boxCount: 4,
    decoyCount: 3,
    pushes: 30,
    map: lines([
      "############",
      "#######   ##",
      "####### $ ##",
      "##### *  .##",
      "###@   #  ##",
      "###$####  ##",
      "### ###    #",
      "#   $.. .  #",
      "#    . .   #",
      "############",
    ]),
  }),
]);


  const els = {};
  const state = {
    loaded: false,
    mode: "fixed",
    randomMode: "exact",
    progressiveDifficulty: 1,
    levelId: "",
    levelName: "",
    difficulty: 1,
    map: "",
    static: null,
    player: null,
    crates: [],
    moves: 0,
    pushes: 0,
    completed: false,
    hintStage: 0,
    hintPlan: null,
    solutionKey: "",
    solution: null,
    autoplay: false,
    autoTimer: null,
  };

  function lines(rows) {
    return rows.join("\n");
  }

  function keyOf(pos) {
    return pos.x + "," + pos.y;
  }

  function parseKey(key) {
    const parts = key.split(",");
    return { x: Number(parts[0]), y: Number(parts[1]) };
  }

  function add(pos, dir) {
    return { x: pos.x + dir.dx, y: pos.y + dir.dy };
  }

  function samePos(a, b) {
    return a && b && a.x === b.x && a.y === b.y;
  }

  function clonePos(pos) {
    return { x: pos.x, y: pos.y };
  }

  function sortedCrateKeys(crates) {
    return crates.map(keyOf).sort();
  }

  function stateKey(player, crates) {
    return keyOf(player) + "|" + sortedCrateKeys(crates).join(";");
  }

  function storage() {
    if (host.ClaudeOne && host.ClaudeOne.storage) return host.ClaudeOne.storage;
    return {
      get(k) {
        try { return host.localStorage.getItem(k); } catch { return null; }
      },
      set(k, v) {
        try { host.localStorage.setItem(k, v); return true; } catch { return false; }
      },
      remove(k) {
        try { host.localStorage.removeItem(k); } catch { /* noop */ }
      },
    };
  }

  function toast(text, kind) {
    if (host.ClaudeOne && host.ClaudeOne.toast) {
      host.ClaudeOne.toast(text, kind);
    }
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function parseMap(map) {
    const rows = String(map || "").replace(/\r/g, "").split("\n").filter((row) => row.length > 0);
    const height = rows.length;
    const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const walls = new Set();
    const goals = new Set();
    const floor = new Set();
    const crates = [];
    let player = null;

    rows.forEach((raw, y) => {
      const row = raw.padEnd(width, " ");
      for (let x = 0; x < width; x += 1) {
        const ch = row[x];
        const pos = { x, y };
        const key = keyOf(pos);
        if (ch === "#") {
          walls.add(key);
          continue;
        }
        floor.add(key);
        if (ch === ".") goals.add(key);
        if (ch === "$") crates.push(pos);
        if (ch === "@") player = pos;
        if (ch === "*") {
          crates.push(pos);
          goals.add(key);
        }
        if (ch === "+") {
          player = pos;
          goals.add(key);
        }
      }
    });

    if (!player) throw new Error("Sokoban map is missing player");
    if (crates.length === 0 || goals.size === 0) throw new Error("Sokoban map needs crates and goals");
    return { width, height, walls, goals, floor, crates, player };
  }

  function buildMap(width, height, walls, goals, crates, player) {
    const crateSet = new Set(crates.map(keyOf));
    const rows = [];
    for (let y = 0; y < height; y += 1) {
      let row = "";
      for (let x = 0; x < width; x += 1) {
        const pos = { x, y };
        const key = keyOf(pos);
        if (walls.has(key)) row += "#";
        else if (samePos(pos, player) && goals.has(key)) row += "+";
        else if (samePos(pos, player)) row += "@";
        else if (crateSet.has(key) && goals.has(key)) row += "*";
        else if (crateSet.has(key)) row += "$";
        else if (goals.has(key)) row += ".";
        else row += " ";
      }
      rows.push(row.replace(/\s+$/g, ""));
    }
    return rows.join("\n");
  }

  function trimMap(map) {
    const rows = String(map || "").split("\n");
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        if (row[x] !== "#") {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    });
    if (!Number.isFinite(minX)) return map;
    minX = Math.max(0, minX - 1);
    minY = Math.max(0, minY - 1);
    maxX = Math.min(rows.reduce((max, row) => Math.max(max, row.length), 0) - 1, maxX + 1);
    maxY = Math.min(rows.length - 1, maxY + 1);
    return rows.slice(minY, maxY + 1).map((row) => {
      return row.padEnd(maxX + 1, "#").slice(minX, maxX + 1);
    }).join("\n");
  }

  function difficultyText(difficulty) {
    const n = clamp(Number(difficulty) || 1, 1, 10);
    return "难度 " + n + " · " + DIFFICULTY_LABELS[n];
  }

  function setStatus(text, tone) {
    if (!els.status) return;
    els.status.textContent = text;
    if (tone) els.status.dataset.tone = tone;
    else els.status.removeAttribute("data-tone");
  }

  function loadLevel(level, opts = {}) {
    stopAuto();
    const parsed = parseMap(level.map);
    state.mode = level.mode || "fixed";
    state.levelId = level.id;
    state.levelName = level.name;
    state.difficulty = clamp(level.difficulty, 1, 10);
    state.map = level.map;
    state.static = {
      width: parsed.width,
      height: parsed.height,
      walls: parsed.walls,
      goals: parsed.goals,
      floor: parsed.floor,
    };
    state.player = clonePos(parsed.player);
    state.crates = parsed.crates.map(clonePos);
    state.moves = 0;
    state.pushes = 0;
    state.completed = false;
    state.hintStage = 0;
    state.hintPlan = null;
    state.solutionKey = "";
    state.solution = null;
    hideWin();
    renderAll();
    saveState();
    if (opts.focus !== false && els.board) els.board.focus({ preventScroll: true });
    setStatus("关卡已载入：" + (isBrutalActive() ? "深渊难 · 地狱唯一解" : difficultyText(state.difficulty)) + "。", "ok");
  }

  function restoreSavedState() {
    const raw = storage().get(STORAGE_KEY);
    if (!raw) return false;
    try {
      const saved = JSON.parse(raw);
      if (!saved || typeof saved.map !== "string") return false;
      const parsed = parseMap(saved.map);
      const crates = Array.isArray(saved.crates) ? saved.crates : [];
      if (crates.length !== parsed.crates.length) return false;
      state.mode = saved.mode === "random" ? "random" : "fixed";
      state.randomMode = saved.randomMode || "exact";
      state.progressiveDifficulty = clamp(saved.progressiveDifficulty || 1, 1, 10);
      state.levelId = saved.levelId || "restored";
      state.levelName = saved.levelName || "继续上次";
      state.difficulty = clamp(saved.difficulty || 1, 1, 10);
      state.map = saved.map;
      state.static = {
        width: parsed.width,
        height: parsed.height,
        walls: parsed.walls,
        goals: parsed.goals,
        floor: parsed.floor,
      };
      state.player = saved.player && Number.isFinite(saved.player.x) && Number.isFinite(saved.player.y)
        ? clonePos(saved.player)
        : clonePos(parsed.player);
      state.crates = crates.map((p) => ({ x: Number(p.x), y: Number(p.y) }));
      state.moves = Math.max(0, Number(saved.moves) || 0);
      state.pushes = Math.max(0, Number(saved.pushes) || 0);
      state.completed = !!saved.completed;
      state.hintStage = 0;
      state.hintPlan = null;
      state.solutionKey = "";
      state.solution = null;
      renderAll();
      if (state.completed) showWin();
      return true;
    } catch (err) {
      storage().remove(STORAGE_KEY);
      return false;
    }
  }

  function saveState() {
    if (!state.static) return;
    storage().set(STORAGE_KEY, JSON.stringify({
      mode: state.mode,
      randomMode: state.randomMode,
      progressiveDifficulty: state.progressiveDifficulty,
      levelId: state.levelId,
      levelName: state.levelName,
      difficulty: state.difficulty,
      map: state.map,
      player: state.player,
      crates: state.crates,
      moves: state.moves,
      pushes: state.pushes,
      completed: state.completed,
    }));
  }

  function crateIndexAt(pos, crates = state.crates) {
    const key = keyOf(pos);
    return crates.findIndex((crate) => keyOf(crate) === key);
  }

  function isBlocked(pos, crates = state.crates) {
    const key = keyOf(pos);
    return state.static.walls.has(key) || !state.static.floor.has(key) || crateIndexAt(pos, crates) >= 0;
  }

  function isComplete(crates = state.crates, goals = state.static.goals) {
    return crates.length > 0 && crates.every((crate) => goals.has(keyOf(crate)));
  }

  function isBrutalActive() {
    return state.mode === "random" && String(state.levelId || "").startsWith("brutal");
  }

  function clearHint() {
    state.hintStage = 0;
    state.hintPlan = null;
  }

  function executeMove(dirId, opts = {}) {
    if (!state.static || state.completed) return false;
    const dir = DIRS[String(dirId).toUpperCase()];
    if (!dir) return false;
    const target = add(state.player, dir);
    const crateIndex = crateIndexAt(target);
    let pushed = false;

    if (crateIndex >= 0) {
      const beyond = add(target, dir);
      if (isBlocked(beyond)) return false;
      state.crates[crateIndex] = beyond;
      state.player = target;
      state.pushes += 1;
      pushed = true;
    } else {
      if (isBlocked(target)) return false;
      state.player = target;
    }

    state.moves += 1;
    if (!opts.keepHint) clearHint();
    state.solutionKey = "";
    state.solution = null;
    state.completed = isComplete();
    renderAll();
    saveState();

    if (pushed) {
      setStatus("推动了一只箱子。", "ok");
    } else if (!opts.fromAuto) {
      setStatus("移动成功。");
    }
    if (state.completed) handleComplete();
    return true;
  }

  function resetLevel() {
    if (!state.map) return;
    stopAuto();
    const level = {
      id: state.levelId,
      name: state.levelName,
      difficulty: state.difficulty,
      map: state.map,
      mode: state.mode,
    };
    loadLevel(level, { focus: false });
    setStatus("已重置当前关卡。");
  }

  function handleComplete() {
    stopAuto(false);
    state.completed = true;
    clearHint();
    saveState();
    renderAll();
    burstConfetti();
    showWin();
    setStatus("通关完成：" + (isBrutalActive() ? "深渊难 · 地狱唯一解" : difficultyText(state.difficulty)) + "。", "ok");
  }

  function showWin() {
    if (!els.winPanel) return;
    const difficultyLabel = isBrutalActive() ? "深渊难 · 地狱唯一解" : difficultyText(state.difficulty);
    els.winPanel.hidden = false;
    els.winSummary.textContent =
      state.levelName + " · " + difficultyLabel +
      " · " + state.moves + " 步 / " + state.pushes + " 推";
    if (state.mode === "fixed") {
      const index = SOKOBAN_FIXED_LEVELS.findIndex((level) => level.id === state.levelId);
      els.winNext.textContent = index >= SOKOBAN_FIXED_LEVELS.length - 1 ? "回到第 1 关" : "下一关";
    } else if (isBrutalActive()) {
      els.winNext.textContent = "再闯一张地狱图";
    } else if (state.randomMode === "progressive") {
      els.winNext.textContent = state.difficulty >= 10 ? "再来一张高难图" : "下一难度";
    } else {
      els.winNext.textContent = "下一随机关";
    }
  }

  function hideWin() {
    if (els.winPanel) els.winPanel.hidden = true;
  }

  function renderAll() {
    renderHud();
    renderBoard();
    renderFixedLevels();
    renderRandomControls();
  }

  function renderHud() {
    if (!state.static) return;
    const difficultyLabel = isBrutalActive() ? "深渊难 · 地狱唯一解" : difficultyText(state.difficulty);
    els.levelMode.textContent = isBrutalActive()
      ? "深渊难 · 地狱模式"
      : state.mode === "random" ? "随机关卡" : "固定关卡";
    els.levelName.textContent = state.levelName;
    els.moveCount.textContent = String(state.moves);
    els.pushCount.textContent = String(state.pushes);
    els.hudDifficulty.textContent = difficultyLabel;
    els.activeDifficulty.textContent = difficultyLabel;
    els.autoBtn.textContent = state.autoplay ? "停止演示" : "自动完成";
    els.autoBtn.classList.toggle("btn-primary", state.autoplay);
    els.autoBtn.classList.toggle("btn-ghost", !state.autoplay);
  }

  function renderBoard() {
    if (!state.static || !els.board) return;
    const crateSet = new Set(state.crates.map(keyOf));
    const playerKey = keyOf(state.player);
    const hintPath = new Set(state.hintPlan ? state.hintPlan.pathCells : []);
    const hintBox = state.hintPlan ? keyOf(state.hintPlan.box) : "";
    const hintStand = state.hintPlan ? keyOf(state.hintPlan.stand) : "";
    els.board.style.setProperty("--board-w", state.static.width);
    els.board.style.setProperty("--board-h", state.static.height);
    els.board.innerHTML = "";

    for (let y = 0; y < state.static.height; y += 1) {
      for (let x = 0; x < state.static.width; x += 1) {
        const pos = { x, y };
        const key = keyOf(pos);
        const cell = document.createElement("div");
        cell.className = "soko-cell";
        if (state.static.walls.has(key)) cell.classList.add("soko-cell--wall");
        if (!state.static.floor.has(key) && !state.static.walls.has(key)) cell.classList.add("soko-cell--void");
        if (hintPath.has(key) && state.hintStage >= 2) cell.dataset.path = "true";
        if (hintStand === key && state.hintStage >= 2) cell.dataset.stand = "true";

        if (state.static.goals.has(key)) {
          const goal = document.createElement("span");
          goal.className = "soko-goal";
          cell.appendChild(goal);
        }
        if (hintPath.has(key) && state.hintStage >= 2) {
          const dot = document.createElement("span");
          dot.className = "soko-step-dot";
          cell.appendChild(dot);
        }
        if (crateSet.has(key)) {
          const crate = document.createElement("span");
          crate.className = "soko-crate";
          cell.dataset.crate = "true";
          if (state.static.goals.has(key)) cell.dataset.crateGoal = "true";
          if (hintBox === key && state.hintStage >= 1) {
            cell.dataset.hintCrate = "true";
            const arrow = document.createElement("span");
            arrow.className = "soko-arrow";
            arrow.dataset.dir = state.hintPlan.direction;
            arrow.textContent = DIRS[state.hintPlan.direction].arrow;
            cell.appendChild(arrow);
          }
          cell.appendChild(crate);
        }
        if (playerKey === key) {
          const player = document.createElement("span");
          player.className = "soko-player";
          cell.appendChild(player);
        }
        els.board.appendChild(cell);
      }
    }
  }

  function renderFixedLevels() {
    if (!els.fixedLevels || els.fixedLevels.dataset.ready === "true") {
      if (els.fixedLevels) updateFixedActive();
      return;
    }
    els.fixedLevels.innerHTML = "";
    SOKOBAN_FIXED_LEVELS.forEach((level, index) => {
      const btn = document.createElement("button");
      btn.className = "sokoban-level-card";
      btn.type = "button";
      btn.dataset.levelId = level.id;
      btn.innerHTML = [
        '<span class="sokoban-level-card__index">' + String(index + 1).padStart(2, "0") + "</span>",
        '<span class="sokoban-level-card__body"><strong></strong><small></small></span>',
        '<span class="sokoban-level-card__difficulty"></span>',
      ].join("");
      btn.querySelector("strong").textContent = level.name;
      btn.querySelector("small").textContent = "固定关卡";
      btn.querySelector(".sokoban-level-card__difficulty").textContent = difficultyText(level.difficulty);
      btn.addEventListener("click", () => loadLevel({ ...level, mode: "fixed" }));
      els.fixedLevels.appendChild(btn);
    });
    els.fixedLevels.dataset.ready = "true";
    updateFixedActive();
  }

  function updateFixedActive() {
    els.fixedLevels.querySelectorAll("[data-level-id]").forEach((btn) => {
      btn.dataset.active = state.mode === "fixed" && btn.dataset.levelId === state.levelId ? "true" : "false";
    });
  }

  function renderRandomControls() {
    if (!els.randomMode) return;
    els.randomMode.value = state.randomMode;
    els.randomDifficulty.value = String(state.progressiveDifficulty);
    const exact = state.randomMode === "exact";
    els.randomDifficultyField.hidden = !exact;
    if (state.randomMode === "brutal") {
      els.randomNote.textContent =
        "挑战：深渊难 · 地狱模式生成 4-5 箱 + 2-3 个陷阱干扰目标的极端复杂地图。采用多房间结构 + 连续瓶颈 + 墙角陷阱，反向拉箱生成蜿蜒解法，暴力枚举确认地狱唯一解；推错一步万劫不复。";
    } else if (state.randomMode === "progressive") {
      els.randomNote.textContent =
        "渐进模式会从难度 " + state.progressiveDifficulty + " 开始，通关后可以继续生成下一档。";
    } else if (state.randomMode === "mixed") {
      els.randomNote.textContent = "混合模式会随机抽取 1-10 的难度，再生成并验证一张可通关地图。";
    } else {
      els.randomNote.textContent =
        "当前准备生成：" + difficultyText(Number(els.randomDifficulty.value) || 1) + "。";
    }
  }

  function burstConfetti() {
    const wrap = document.querySelector(".sokoban-board-wrap");
    if (!wrap) return;
    for (let i = 0; i < 18; i += 1) {
      const bit = document.createElement("span");
      bit.className = "soko-confetti";
      bit.style.setProperty("--tx", (Math.random() * 420 - 210).toFixed(0) + "px");
      bit.style.setProperty("--ty", (Math.random() * 320 - 180).toFixed(0) + "px");
      bit.style.setProperty("--rot", (Math.random() * 720 - 360).toFixed(0) + "deg");
      bit.style.background = ["#ffd76a", "#6f9bff", "#4fc7a5", "#ff6b7a"][i % 4];
      wrap.appendChild(bit);
      setTimeout(() => bit.remove(), 900);
    }
  }

  function reachableWithPaths(player, crates, staticMap) {
    const crateSet = new Set(crates.map(keyOf));
    const paths = new Map();
    const queue = [clonePos(player)];
    paths.set(keyOf(player), "");
    for (let qi = 0; qi < queue.length; qi += 1) {
      const cur = queue[qi];
      const curPath = paths.get(keyOf(cur));
      DIR_ORDER.forEach((dir) => {
        const next = add(cur, dir);
        const key = keyOf(next);
        if (paths.has(key)) return;
        if (staticMap.walls.has(key) || !staticMap.floor.has(key) || crateSet.has(key)) return;
        paths.set(key, curPath + dir.id.toLowerCase());
        queue.push(next);
      });
    }
    return paths;
  }

  function hasSimpleDeadlock(crateKeys, staticMap) {
    return crateKeys.some((key) => {
      if (staticMap.goals.has(key)) return false;
      const p = parseKey(key);
      const left = staticMap.walls.has(keyOf({ x: p.x - 1, y: p.y }));
      const right = staticMap.walls.has(keyOf({ x: p.x + 1, y: p.y }));
      const up = staticMap.walls.has(keyOf({ x: p.x, y: p.y - 1 }));
      const down = staticMap.walls.has(keyOf({ x: p.x, y: p.y + 1 }));
      return (left || right) && (up || down);
    });
  }

  function solveSnapshot(snapshot, opts = {}) {
    const maxStates = opts.maxStates || 220000;
    const staticMap = snapshot.static;
    const startPlayer = clonePos(snapshot.player);
    const startCrates = sortedCrateKeys(snapshot.crates);
    const startKey = keyOf(startPlayer) + "|" + startCrates.join(";");
    const queue = [{ player: startPlayer, crateKeys: startCrates, moves: "", pushes: 0 }];
    const seen = new Set([startKey]);

    for (let qi = 0; qi < queue.length; qi += 1) {
      const item = queue[qi];
      if (item.crateKeys.every((key) => staticMap.goals.has(key))) {
        return { moves: item.moves, pushes: item.pushes, states: seen.size };
      }

      const crates = item.crateKeys.map(parseKey);
      const crateSet = new Set(item.crateKeys);
      const paths = reachableWithPaths(item.player, crates, staticMap);

      for (let i = 0; i < item.crateKeys.length; i += 1) {
        const box = parseKey(item.crateKeys[i]);
        for (let d = 0; d < DIR_ORDER.length; d += 1) {
          const dir = DIR_ORDER[d];
          const stand = { x: box.x - dir.dx, y: box.y - dir.dy };
          const nextBox = { x: box.x + dir.dx, y: box.y + dir.dy };
          const standKey = keyOf(stand);
          const nextBoxKey = keyOf(nextBox);
          if (!paths.has(standKey)) continue;
          if (staticMap.walls.has(nextBoxKey) || !staticMap.floor.has(nextBoxKey) || crateSet.has(nextBoxKey)) continue;
          const nextCrateKeys = item.crateKeys.slice();
          nextCrateKeys[i] = nextBoxKey;
          nextCrateKeys.sort();
          if (hasSimpleDeadlock(nextCrateKeys, staticMap)) continue;
          const nextPlayer = box;
          const nextKey = keyOf(nextPlayer) + "|" + nextCrateKeys.join(";");
          if (seen.has(nextKey)) continue;
          seen.add(nextKey);
          if (seen.size > maxStates) {
            return null;
          }
          queue.push({
            player: nextPlayer,
            crateKeys: nextCrateKeys,
            moves: item.moves + paths.get(standKey) + dir.id,
            pushes: item.pushes + 1,
          });
        }
      }
    }
    return null;
  }

  function countPushSolutions(snapshot, opts = {}) {
    const maxStates = opts.maxStates || 520000;
    const maxSolutions = opts.maxSolutions || 2;
    const staticMap = snapshot.static;
    const startPlayer = clonePos(snapshot.player);
    const startCrates = sortedCrateKeys(snapshot.crates);
    const startKey = keyOf(startPlayer) + "|" + startCrates.join(";");
    const queue = [{ player: startPlayer, crateKeys: startCrates, pushTrail: "" }];
    const seen = new Set([startKey]);
    const solutions = new Set();

    for (let qi = 0; qi < queue.length; qi += 1) {
      const item = queue[qi];
      if (item.crateKeys.every((key) => staticMap.goals.has(key))) {
        solutions.add(item.pushTrail || "start");
        if (solutions.size >= maxSolutions) {
          return { count: solutions.size, states: seen.size };
        }
        continue;
      }

      const crates = item.crateKeys.map(parseKey);
      const crateSet = new Set(item.crateKeys);
      const paths = reachableWithPaths(item.player, crates, staticMap);

      for (let i = 0; i < item.crateKeys.length; i += 1) {
        const box = parseKey(item.crateKeys[i]);
        for (let d = 0; d < DIR_ORDER.length; d += 1) {
          const dir = DIR_ORDER[d];
          const stand = { x: box.x - dir.dx, y: box.y - dir.dy };
          const nextBox = { x: box.x + dir.dx, y: box.y + dir.dy };
          const standKey = keyOf(stand);
          const nextBoxKey = keyOf(nextBox);
          if (!paths.has(standKey)) continue;
          if (staticMap.walls.has(nextBoxKey) || !staticMap.floor.has(nextBoxKey) || crateSet.has(nextBoxKey)) continue;
          const nextCrateKeys = item.crateKeys.slice();
          nextCrateKeys[i] = nextBoxKey;
          nextCrateKeys.sort();
          if (hasSimpleDeadlock(nextCrateKeys, staticMap)) continue;
          const nextPlayer = box;
          const nextKey = keyOf(nextPlayer) + "|" + nextCrateKeys.join(";");
          if (seen.has(nextKey)) continue;
          seen.add(nextKey);
          if (seen.size > maxStates) {
            return { count: solutions.size, states: seen.size, truncated: true };
          }
          queue.push({
            player: nextPlayer,
            crateKeys: nextCrateKeys,
            pushTrail: item.pushTrail + "|" + item.crateKeys[i] + ">" + nextBoxKey,
          });
        }
      }
    }
    return { count: solutions.size, states: seen.size };
  }

  function currentSnapshot() {
    return {
      static: state.static,
      player: clonePos(state.player),
      crates: state.crates.map(clonePos),
    };
  }

  function getSolution() {
    const key = stateKey(state.player, state.crates);
    if (state.solution && state.solutionKey === key) return state.solution;
    setStatus("正在求解当前局面...");
    const solution = solveSnapshot(currentSnapshot(), { maxStates: 260000 });
    state.solution = solution;
    state.solutionKey = key;
    return solution;
  }

  function buildHintPlan(moves) {
    let pos = clonePos(state.player);
    const pathCells = [];
    let walk = "";
    for (let i = 0; i < moves.length; i += 1) {
      const ch = moves[i];
      const dir = DIRS[ch.toUpperCase()];
      if (!dir) continue;
      if (ch === ch.toLowerCase()) {
        pos = add(pos, dir);
        walk += ch;
        pathCells.push(keyOf(pos));
        continue;
      }
      return {
        walk,
        push: ch,
        direction: dir.id,
        stand: clonePos(pos),
        box: add(pos, dir),
        pathCells,
      };
    }
    return null;
  }

  function requestHint() {
    if (state.autoplay) {
      toast("演示中，先停止再看提示", "err");
      return;
    }
    if (state.completed) {
      setStatus("已经通关了。", "ok");
      return;
    }
    if (!state.hintPlan) {
      const solution = getSolution();
      if (!solution) {
        setStatus("当前局面求解失败，可能已经进入死锁。建议重置。", "err");
        toast("这个局面解不出来，试试重置", "err");
        return;
      }
      state.hintPlan = buildHintPlan(solution.moves);
      state.hintStage = 0;
    }
    if (!state.hintPlan) {
      setStatus("没有可用提示。", "warn");
      return;
    }
    state.hintStage += 1;
    if (state.hintStage === 1) {
      setStatus("提示 1/3：发光的箱子是下一步要推动的箱子。", "ok");
    } else if (state.hintStage === 2) {
      setStatus("提示 2/3：蓝色路径是走到推动站位的路线。", "ok");
    } else {
      const seq = state.hintPlan.walk + state.hintPlan.push;
      clearHint();
      startAuto(seq, { label: "提示演示", delay: 170 });
      return;
    }
    renderBoard();
  }

  function startAuto(sequence, opts = {}) {
    if (!sequence || state.completed) return;
    stopAuto(false);
    state.autoplay = true;
    const steps = sequence.split("");
    const delay = opts.delay || 190;
    setStatus((opts.label || "自动完成") + "中...", "ok");
    renderHud();

    const tick = () => {
      if (!state.autoplay) return;
      const ch = steps.shift();
      if (!ch) {
        stopAuto(false);
        if (!state.completed) setStatus("演示结束。");
        return;
      }
      const moved = executeMove(ch, { fromAuto: true, keepHint: true });
      if (!moved) {
        stopAuto();
        setStatus("演示被当前局面打断，已停止。", "err");
        return;
      }
      if (state.completed) return;
      state.autoTimer = setTimeout(tick, delay);
    };
    state.autoTimer = setTimeout(tick, delay);
  }

  function stopAuto(showStatus = true) {
    if (state.autoTimer) {
      clearTimeout(state.autoTimer);
      state.autoTimer = null;
    }
    if (state.autoplay && showStatus) setStatus("已停止自动演示。");
    state.autoplay = false;
    if (els.autoBtn) renderHud();
  }

  function toggleAuto() {
    if (state.autoplay) {
      stopAuto();
      return;
    }
    if (state.completed) return;
    const solution = getSolution();
    if (!solution) {
      setStatus("当前局面求解失败，可能已经死锁。", "err");
      toast("求解失败，建议重置", "err");
      return;
    }
    clearHint();
    startAuto(solution.moves, { label: "自动完成", delay: 180 });
  }

  function randomSeed() {
    const cryptoObj = host.crypto;
    if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
      const buffer = new Uint32Array(1);
      cryptoObj.getRandomValues(buffer);
      return buffer[0] >>> 0;
    }
    return Math.floor(Math.random() * 0xffffffff) >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function rng() {
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function shuffle(rng, arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function randomId(prefix) {
    return prefix + "-" + randomSeed().toString(16) + "-" + Date.now().toString(36);
  }

  function connectedFloor(width, height, walls) {
    const floor = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const key = keyOf({ x, y });
        if (!walls.has(key)) floor.push({ x, y });
      }
    }
    if (!floor.length) return false;
    const start = floor[0];
    const seen = new Set([keyOf(start)]);
    const queue = [start];
    for (let qi = 0; qi < queue.length; qi += 1) {
      const cur = queue[qi];
      DIR_ORDER.forEach((dir) => {
        const next = add(cur, dir);
        const key = keyOf(next);
        if (seen.has(key) || walls.has(key)) return;
        if (next.x < 0 || next.y < 0 || next.x >= width || next.y >= height) return;
        seen.add(key);
        queue.push(next);
      });
    }
    return seen.size === floor.length;
  }

  function difficultyConfig(difficulty) {
    const d = clamp(difficulty, 1, 10);
    return {
      width: clamp(7 + Math.ceil(d / 2), 7, 13),
      height: clamp(6 + Math.ceil(d / 3), 6, 10),
      boxes: d <= 2 ? 1 : d <= 6 ? 2 : 3,
      pulls: 6 + d * 5,
      minPushes: Math.max(1, Math.floor(d * 1.15)),
      maxPushes: 90,
    };
  }

  function floorCells(width, height, walls) {
    const cells = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pos = { x, y };
        if (!walls.has(keyOf(pos))) cells.push(pos);
      }
    }
    return cells;
  }

  function isWallCorner(pos, walls) {
    const left = walls.has(keyOf({ x: pos.x - 1, y: pos.y }));
    const right = walls.has(keyOf({ x: pos.x + 1, y: pos.y }));
    const up = walls.has(keyOf({ x: pos.x, y: pos.y - 1 }));
    const down = walls.has(keyOf({ x: pos.x, y: pos.y + 1 }));
    return (left || right) && (up || down);
  }

  function carveCell(floor, x, y, width, height) {
    if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) return false;
    floor.add(keyOf({ x, y }));
    return true;
  }

  function carveRoom(floor, cx, cy, rw, rh, width, height) {
    const x0 = cx - Math.floor(rw / 2);
    const y0 = cy - Math.floor(rh / 2);
    for (let y = y0; y < y0 + rh; y += 1) {
      for (let x = x0; x < x0 + rw; x += 1) {
        carveCell(floor, x, y, width, height);
      }
    }
  }

  function carveIrregularFloor(width, height, difficulty, rng) {
    const area = (width - 2) * (height - 2);
    const targetRatio = 0.44 + Math.min(0.18, difficulty * 0.018) + rng() * 0.12;
    const target = clamp(Math.round(area * targetRatio), 14, area - 2);
    const floor = new Set();
    let cursor = {
      x: 1 + Math.floor(rng() * (width - 2)),
      y: 1 + Math.floor(rng() * (height - 2)),
    };
    carveCell(floor, cursor.x, cursor.y, width, height);

    let guard = 0;
    while (floor.size < target && guard < target * 24) {
      guard += 1;
      if (rng() < 0.18 && floor.size > 2) {
        cursor = parseKey(pick(rng, Array.from(floor)));
      }
      const dir = pick(rng, DIR_ORDER);
      cursor = {
        x: clamp(cursor.x + dir.dx, 1, width - 2),
        y: clamp(cursor.y + dir.dy, 1, height - 2),
      };
      carveCell(floor, cursor.x, cursor.y, width, height);
      if (rng() < 0.13) {
        const rw = 2 + Math.floor(rng() * (difficulty > 6 ? 3 : 2));
        const rh = 2 + Math.floor(rng() * 2);
        carveRoom(floor, cursor.x, cursor.y, rw, rh, width, height);
      }
    }

    const dents = Math.floor(2 + difficulty * 0.45);
    for (let i = 0; i < dents; i += 1) {
      const cells = Array.from(floor).map(parseKey);
      if (cells.length <= target * 0.58) break;
      const pos = pick(rng, cells);
      const neighborCount = DIR_ORDER.reduce((count, dir) => {
        return count + (floor.has(keyOf(add(pos, dir))) ? 1 : 0);
      }, 0);
      if (neighborCount >= 2 && neighborCount <= 3) {
        floor.delete(keyOf(pos));
      }
    }
    return floor;
  }

  function wallsFromFloor(width, height, floor) {
    const walls = new Set();
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const key = keyOf({ x, y });
        if (!floor.has(key)) walls.add(key);
      }
    }
    return walls;
  }

  function terrainScore(width, height, walls) {
    let internalWalls = 0;
    let bends = 0;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const pos = { x, y };
        const key = keyOf(pos);
        if (walls.has(key)) {
          internalWalls += 1;
          continue;
        }
        const left = walls.has(keyOf({ x: x - 1, y }));
        const right = walls.has(keyOf({ x: x + 1, y }));
        const up = walls.has(keyOf({ x, y: y - 1 }));
        const down = walls.has(keyOf({ x, y: y + 1 }));
        if ((left || right) && (up || down)) bends += 1;
      }
    }
    return { internalWalls, bends };
  }

  function generateCandidate(difficulty, rng) {
    const cfg = difficultyConfig(difficulty);
    const width = cfg.width;
    const height = cfg.height;
    const carved = carveIrregularFloor(width, height, difficulty, rng);
    const walls = wallsFromFloor(width, height, carved);
    if (!connectedFloor(width, height, walls)) return null;
    const score = terrainScore(width, height, walls);
    if (score.internalWalls < Math.max(3, difficulty)) return null;
    if (score.bends < Math.max(4, difficulty)) return null;

    const allFloor = floorCells(width, height, walls);
    const safeGoals = allFloor.filter((pos) => !isWallCorner(pos, walls));
    if (safeGoals.length < cfg.boxes + 2) return null;
    const goals = new Set();
    while (goals.size < cfg.boxes) {
      goals.add(keyOf(pick(rng, safeGoals)));
    }
    const crates = Array.from(goals).map(parseKey);
    let player = pick(rng, allFloor.filter((pos) => !goals.has(keyOf(pos))));
    let pullCount = 0;

    for (let step = 0; step < cfg.pulls; step += 1) {
      const staticMap = {
        width,
        height,
        walls,
        goals,
        floor: new Set(allFloor.map(keyOf)),
      };
      const paths = reachableWithPaths(player, crates, staticMap);
      const crateSet = new Set(crates.map(keyOf));
      const moves = [];
      crates.forEach((crate, index) => {
        DIR_ORDER.forEach((dir) => {
          const stand = { x: crate.x - dir.dx, y: crate.y - dir.dy };
          const newPlayer = { x: stand.x - dir.dx, y: stand.y - dir.dy };
          const standKey = keyOf(stand);
          const newPlayerKey = keyOf(newPlayer);
          if (!paths.has(standKey)) return;
          if (!staticMap.floor.has(newPlayerKey) || walls.has(newPlayerKey) || crateSet.has(newPlayerKey)) return;
          moves.push({ index, newCrate: stand, newPlayer });
        });
      });
      if (!moves.length) break;
      const move = pick(rng, moves);
      crates[move.index] = move.newCrate;
      player = move.newPlayer;
      pullCount += 1;
    }

    if (pullCount < Math.max(2, Math.floor(cfg.pulls / 3))) return null;
    const map = trimMap(buildMap(width, height, walls, goals, crates, player));
    const parsed = parseMap(map);
    const solution = solveSnapshot({
      static: {
        width: parsed.width,
        height: parsed.height,
        walls: parsed.walls,
        goals: parsed.goals,
        floor: parsed.floor,
      },
      player: parsed.player,
      crates: parsed.crates,
    }, { maxStates: 36000 });
    if (!solution || solution.pushes < cfg.minPushes || solution.pushes > cfg.maxPushes) return null;
    return {
      id: randomId("random"),
      name: "随机迷宫",
      difficulty,
      map,
      mode: "random",
      solution,
    };
  }

  function mirrorMap(map, axis) {
    const rows = map.split("\n");
    if (axis === "x") return rows.map((row) => row.split("").reverse().join("")).join("\n");
    if (axis === "y") return rows.slice().reverse().join("\n");
    return map;
  }

  function generateOpenFallback(difficulty, rng) {
    const d = clamp(difficulty, 1, 10);
    const templates = [
      lines([
        "########",
        "#@ $ . #",
        "### #  #",
        "#      #",
        "########",
      ]),
      lines([
        "#########",
        "# #######",
        "#   . ###",
        "#  $ .$@#",
        "###    ##",
        "####  ###",
        "#########",
      ]),
      lines([
        "########",
        "#      #",
        "##$  . #",
        "#      #",
        "#   .$##",
        "#####@ #",
        "########",
      ]),
      lines([
        "###########",
        "###     ###",
        "###.     ##",
        "##   .   ##",
        "#         #",
        "# #   $   #",
        "#### $   ##",
        "##@$  . ###",
        "###   #####",
        "###########",
      ]),
    ];
    let map = templates[d <= 2 ? 0 : d <= 5 ? 1 : d <= 8 ? 2 : 3];
    if (rng() > 0.5) map = mirrorMap(map, "x");
    if (rng() > 0.65) map = mirrorMap(map, "y");
    return {
      id: randomId("random-maze"),
      name: "随机迷宫",
      difficulty: d,
      map,
      mode: "random",
    };
  }

  function snapshotFromParsed(parsed) {
    return {
      static: {
        width: parsed.width,
        height: parsed.height,
        walls: parsed.walls,
        goals: parsed.goals,
        floor: parsed.floor,
      },
      player: parsed.player,
      crates: parsed.crates,
    };
  }

  function solutionFootprint(parsed, moves) {
    let player = clonePos(parsed.player);
    const crates = parsed.crates.map(clonePos);
    const used = new Set([keyOf(player)]);
    parsed.goals.forEach((key) => used.add(key));
    crates.forEach((crate) => used.add(keyOf(crate)));

    String(moves || "").split("").forEach((ch) => {
      const dir = DIRS[ch.toUpperCase()];
      if (!dir) return;
      const target = add(player, dir);
      const crateIndex = crateIndexAt(target, crates);
      used.add(keyOf(target));
      if (crateIndex >= 0) {
        const beyond = add(target, dir);
        crates[crateIndex] = beyond;
        used.add(keyOf(beyond));
      }
      player = target;
      used.add(keyOf(player));
    });
    return used;
  }

  function walkCells(start, path) {
    const cells = [];
    let pos = clonePos(start);
    String(path || "").split("").forEach((ch) => {
      const dir = DIRS[ch.toUpperCase()];
      if (!dir) return;
      pos = add(pos, dir);
      cells.push(keyOf(pos));
    });
    return cells;
  }

  function brutalSubstrate(width, height, rng) {
    const floor = new Set();
    let cursor = {
      x: 2 + Math.floor(rng() * (width - 4)),
      y: 2 + Math.floor(rng() * (height - 4)),
    };
    carveCell(floor, cursor.x, cursor.y, width, height);

    const strands = 9 + Math.floor(rng() * 5);
    for (let s = 0; s < strands; s += 1) {
      const existing = Array.from(floor);
      if (existing.length) cursor = parseKey(pick(rng, existing));
      let dir = pick(rng, DIR_ORDER);
      const len = 10 + Math.floor(rng() * 18);
      for (let i = 0; i < len; i += 1) {
        if (rng() < 0.38) dir = pick(rng, DIR_ORDER);
        cursor = {
          x: clamp(cursor.x + dir.dx, 1, width - 2),
          y: clamp(cursor.y + dir.dy, 1, height - 2),
        };
        carveCell(floor, cursor.x, cursor.y, width, height);
        if (rng() < 0.18) {
          const side = pick(rng, DIR_ORDER);
          carveCell(floor, cursor.x + side.dx, cursor.y + side.dy, width, height);
        }
        if (rng() < 0.12) {
          carveRoom(floor, cursor.x, cursor.y, 2 + Math.floor(rng() * 3), 2 + Math.floor(rng() * 2), width, height);
        }
      }
    }

    const target = clamp(62 + Math.floor(rng() * 38), 48, (width - 2) * (height - 2) - 8);
    let guard = 0;
    while (floor.size < target && guard < target * 10) {
      guard += 1;
      const anchor = parseKey(pick(rng, Array.from(floor)));
      const dir = pick(rng, DIR_ORDER);
      carveCell(floor, anchor.x + dir.dx, anchor.y + dir.dy, width, height);
    }
    return floor;
  }

  function spreadGoals(cells, boxCount, rng) {
    const shuffled = shuffle(rng, cells);
    const goals = [];
    shuffled.forEach((pos) => {
      if (goals.length >= boxCount) return;
      const farEnough = goals.every((goal) => Math.abs(goal.x - pos.x) + Math.abs(goal.y - pos.y) >= 4);
      if (farEnough) goals.push(pos);
    });
    while (goals.length < boxCount && shuffled.length) {
      const pos = shuffled.pop();
      if (!goals.some((goal) => samePos(goal, pos))) goals.push(pos);
    }
    return goals;
  }

  function chooseWeighted(rng, items) {
    const total = items.reduce((sum, item) => sum + Math.max(0.01, item.weight || 1), 0);
    let roll = rng() * total;
    for (let i = 0; i < items.length; i += 1) {
      roll -= Math.max(0.01, items[i].weight || 1);
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  function buildReverseBrutalCandidate(rng) {
    const width = 13 + Math.floor(rng() * 5);
    const height = 11 + Math.floor(rng() * 5);
    const boxCount = rng() < 0.58 ? 5 : 4;
    const floor = brutalSubstrate(width, height, rng);
    const walls = wallsFromFloor(width, height, floor);
    if (!connectedFloor(width, height, walls)) return null;

    const floorList = floorCells(width, height, walls);
    const safeGoals = floorList.filter((pos) => !isWallCorner(pos, walls));
    if (safeGoals.length < boxCount + 10) return null;
    const goals = new Set(spreadGoals(safeGoals, boxCount, rng).map(keyOf));
    if (goals.size !== boxCount) return null;

    const staticMap = { width, height, walls, goals, floor: new Set(floor) };
    const crates = Array.from(goals).map(parseKey);
    let player = pick(rng, floorList.filter((pos) => !goals.has(keyOf(pos))));
    const trace = new Set([keyOf(player)]);
    const pullCounts = Array(boxCount).fill(0);
    let lastCrate = -1;
    let lastDir = "";
    const targetPulls = (boxCount === 5 ? 34 : 29) + Math.floor(rng() * 11);

    for (let step = 0; step < targetPulls; step += 1) {
      const paths = reachableWithPaths(player, crates, staticMap);
      const crateSet = new Set(crates.map(keyOf));
      const options = [];
      crates.forEach((crate, index) => {
        DIR_ORDER.forEach((dir) => {
          const stand = { x: crate.x - dir.dx, y: crate.y - dir.dy };
          const newPlayer = { x: stand.x - dir.dx, y: stand.y - dir.dy };
          const standKey = keyOf(stand);
          const newPlayerKey = keyOf(newPlayer);
          if (!paths.has(standKey)) return;
          if (!staticMap.floor.has(newPlayerKey) || walls.has(newPlayerKey) || crateSet.has(newPlayerKey)) return;
          const futureCrates = crates.map(clonePos);
          futureCrates[index] = stand;
          const futureKeys = sortedCrateKeys(futureCrates);
          if (hasSimpleDeadlock(futureKeys, staticMap)) return;
          const path = paths.get(standKey);
          let weight = 1 + Math.min(10, path.length) * 0.18;
          if (index !== lastCrate) weight += 1.9;
          if (lastDir && dir.id !== lastDir) weight += 1.25;
          if (!trace.has(keyOf(stand))) weight += 1.2;
          if (!trace.has(newPlayerKey)) weight += 1.2;
          weight += pullCounts[index] < 4 ? 1.8 : 0;
          options.push({ index, dir, stand, newPlayer, path, weight });
        });
      });
      if (!options.length) break;
      const move = chooseWeighted(rng, options);
      walkCells(player, move.path).forEach((key) => trace.add(key));
      trace.add(keyOf(crates[move.index]));
      trace.add(keyOf(move.stand));
      trace.add(keyOf(move.newPlayer));
      crates[move.index] = move.stand;
      player = move.newPlayer;
      pullCounts[move.index] += 1;
      lastCrate = move.index;
      lastDir = move.dir.id;
    }

    if (pullCounts.some((count) => count < 3)) return null;
    return { width, height, walls, floor, goals, crates, player, trace, boxCount };
  }

  function addBrutalPockets(baseFloor, substrateFloor, width, height, rng) {
    const floor = new Set(baseFloor);
    const anchors = shuffle(rng, Array.from(baseFloor).map(parseKey));
    const pocketBudget = 7 + Math.floor(rng() * 8);
    let added = 0;

    anchors.forEach((anchor) => {
      if (added >= pocketBudget) return;
      if (rng() > 0.42) return;
      const dirs = shuffle(rng, DIR_ORDER);
      for (let i = 0; i < dirs.length && added < pocketBudget; i += 1) {
        const first = add(anchor, dirs[i]);
        const firstKey = keyOf(first);
        if (!substrateFloor.has(firstKey) || floor.has(firstKey)) continue;
        floor.add(firstKey);
        added += 1;
        if (rng() < 0.34 && added < pocketBudget) {
          const turn = pick(rng, DIR_ORDER);
          const second = add(first, turn);
          const secondKey = keyOf(second);
          if (second.x > 0 && second.y > 0 && second.x < width - 1 && second.y < height - 1 && substrateFloor.has(secondKey) && !floor.has(secondKey)) {
            floor.add(secondKey);
            added += 1;
          }
        }
        break;
      }
    });
    return floor;
  }

  function crateTrailGoals(parsed, moves, rng, limit) {
    let player = clonePos(parsed.player);
    const crates = parsed.crates.map(clonePos);
    const trail = [];
    String(moves || "").split("").forEach((ch) => {
      const dir = DIRS[ch.toUpperCase()];
      if (!dir) return;
      const target = add(player, dir);
      const crateIndex = crateIndexAt(target, crates);
      if (crateIndex >= 0) {
        const beyond = add(target, dir);
        crates[crateIndex] = beyond;
        trail.push(keyOf(beyond));
      }
      player = target;
    });
    return shuffle(rng, Array.from(new Set(trail))).slice(0, limit);
  }

  function brutalShapeScore(parsed, solution) {
    let branchCells = 0;
    let roomCells = 0;
    let deadEnds = 0;
    parsed.floor.forEach((key) => {
      const pos = parseKey(key);
      const degree = DIR_ORDER.reduce((count, dir) => {
        const nextKey = keyOf(add(pos, dir));
        return count + (parsed.floor.has(nextKey) && !parsed.walls.has(nextKey) ? 1 : 0);
      }, 0);
      if (degree >= 3) branchCells += 1;
      if (degree >= 4) roomCells += 1;
      if (degree <= 1) deadEnds += 1;
    });
    let turns = 0;
    let prev = "";
    String(solution.moves || "").split("").forEach((ch) => {
      const dir = ch.toUpperCase();
      if (!DIRS[dir]) return;
      if (prev && prev !== dir) turns += 1;
      prev = dir;
    });
    const terrain = terrainScore(parsed.width, parsed.height, parsed.walls);
    return { branchCells, roomCells, deadEnds, turns, terrain };
  }

  function buildBrutalTangleMap(rng) {
    const candidate = buildReverseBrutalCandidate(rng);
    if (!candidate) return null;
    const fullMap = buildMap(candidate.width, candidate.height, candidate.walls, candidate.goals, candidate.crates, candidate.player);
    const fullParsed = parseMap(fullMap);
    const fullSolution = solveSnapshot(snapshotFromParsed(fullParsed), { maxStates: 1200000 });
    if (!fullSolution || fullSolution.pushes < candidate.boxCount * 5) return null;

    const footprint = solutionFootprint(fullParsed, fullSolution.moves);
    candidate.goals.forEach((key) => footprint.add(key));
    candidate.crates.forEach((crate) => footprint.add(keyOf(crate)));
    footprint.add(keyOf(candidate.player));
    const pocketedFloor = addBrutalPockets(footprint, candidate.floor, candidate.width, candidate.height, rng);
    const walls = wallsFromFloor(candidate.width, candidate.height, pocketedFloor);
    const goals = new Set(candidate.goals);
    crateTrailGoals(fullParsed, fullSolution.moves, rng, candidate.boxCount + 4).forEach((key) => {
      if (pocketedFloor.has(key)) goals.add(key);
    });

    return trimMap(buildMap(candidate.width, candidate.height, walls, goals, candidate.crates, candidate.player));
  }

  function inInnerBounds(pos, width, height) {
    return pos.x > 0 && pos.y > 0 && pos.x < width - 1 && pos.y < height - 1;
  }

  function adjacentFloorCount(pos, floor, exceptKey) {
    return DIR_ORDER.reduce((count, dir) => {
      const key = keyOf(add(pos, dir));
      if (key === exceptKey) return count;
      return count + (floor.has(key) ? 1 : 0);
    }, 0);
  }

  function perpendicularDirs(dir) {
    if (dir.id === "U" || dir.id === "D") return [DIRS.L, DIRS.R];
    return [DIRS.U, DIRS.D];
  }

  function canCarveRouteCell(pos, floor, width, height, fromKey, blocked, relaxed = false) {
    const key = keyOf(pos);
    if (!inInnerBounds(pos, width, height)) return false;
    if (floor.has(key) || blocked.has(key)) return false;
    if (relaxed) return true;
    return adjacentFloorCount(pos, floor, fromKey) <= 0;
  }

  function carvePocket(anchor, dir, floor, width, height, blocked, rng) {
    const sides = shuffle(rng, perpendicularDirs(dir));
    for (let i = 0; i < sides.length; i += 1) {
      const side = sides[i];
      const pocket = add(anchor, side);
      const key = keyOf(pocket);
      if (!inInnerBounds(pocket, width, height)) continue;
      if (floor.has(key) || blocked.has(key)) continue;
      if (adjacentFloorCount(pocket, floor, keyOf(anchor)) > 0) continue;
      floor.add(key);
      if (rng() < 0.34) {
        const turn = pick(rng, DIR_ORDER);
        const deep = add(pocket, turn);
        const deepKey = keyOf(deep);
        if (inInnerBounds(deep, width, height) && !floor.has(deepKey) && !blocked.has(deepKey) && adjacentFloorCount(deep, floor, key) <= 0) {
          floor.add(deepKey);
        }
      }
      return true;
    }
    return false;
  }

  function carveConnector(current, floor, width, height, blocked, rng, relaxed = false) {
    let pos = clonePos(current);
    let previousDir = null;
    const steps = 3 + Math.floor(rng() * 6);
    for (let step = 0; step < steps; step += 1) {
      const options = shuffle(rng, DIR_ORDER).filter((dir) => {
        if (previousDir && dir.dx === -previousDir.dx && dir.dy === -previousDir.dy && rng() < 0.72) return false;
        const next = add(pos, dir);
        return canCarveRouteCell(next, floor, width, height, keyOf(pos), blocked, relaxed);
      });
      if (!options.length) break;
      const dir = pick(rng, options);
      const next = add(pos, dir);
      floor.add(keyOf(next));
      if (rng() < 0.42) carvePocket(next, dir, floor, width, height, blocked, rng);
      pos = next;
      previousDir = dir;
    }
    return pos;
  }

  function canPlaceLockSegment(start, dir, length, floor, width, height, blocked, relaxed = false) {
    let prevKey = keyOf(start);
    for (let i = 1; i <= length; i += 1) {
      const pos = { x: start.x + dir.dx * i, y: start.y + dir.dy * i };
      if (!canCarveRouteCell(pos, floor, width, height, prevKey, blocked, relaxed)) return false;
      prevKey = keyOf(pos);
    }
    return true;
  }

  function tryPlaceStraightLock(current, dir, floor, goals, blocked, crates, width, height, rng, opts = {}) {
    const length = 6;
    if (!canPlaceLockSegment(current, dir, length, floor, width, height, blocked, !!opts.relaxed)) return null;
    for (let step = 1; step <= length; step += 1) {
      const pos = { x: current.x + dir.dx * step, y: current.y + dir.dy * step };
      floor.add(keyOf(pos));
      if (step > 1 && step < length && rng() < 0.58) carvePocket(pos, dir, floor, width, height, blocked, rng);
    }
    const crate = { x: current.x + dir.dx, y: current.y + dir.dy };
    const finalGoal = { x: current.x + dir.dx * length, y: current.y + dir.dy * length };
    const afterPush = { x: current.x + dir.dx * (length - 1), y: current.y + dir.dy * (length - 1) };
    crates.push(crate);
    goals.add(keyOf(finalGoal));
    blocked.add(keyOf(finalGoal));
    return { current: afterPush, lastDir: dir, type: "straight" };
  }

  function tryPlaceBentLock(current, dir, turnDir, floor, goals, blocked, crates, width, height, rng) {
    const firstLeg = 4;
    const secondLeg = 3 + Math.floor(rng() * 2);
    const turn = { x: current.x + dir.dx * firstLeg, y: current.y + dir.dy * firstLeg };
    const afterFirst = { x: current.x + dir.dx * (firstLeg - 1), y: current.y + dir.dy * (firstLeg - 1) };
    const sideStep = { x: afterFirst.x - turnDir.dx, y: afterFirst.y - turnDir.dy };
    const sideStand = { x: turn.x - turnDir.dx, y: turn.y - turnDir.dy };
    const finalGoal = { x: turn.x + turnDir.dx * secondLeg, y: turn.y + turnDir.dy * secondLeg };
    const afterPush = { x: turn.x + turnDir.dx * (secondLeg - 1), y: turn.y + turnDir.dy * (secondLeg - 1) };
    const cells = [];
    for (let step = 1; step <= firstLeg; step += 1) {
      cells.push({ x: current.x + dir.dx * step, y: current.y + dir.dy * step });
    }
    cells.push(sideStep, sideStand);
    for (let step = 1; step <= secondLeg; step += 1) {
      cells.push({ x: turn.x + turnDir.dx * step, y: turn.y + turnDir.dy * step });
    }

    const seen = new Set();
    for (let i = 0; i < cells.length; i += 1) {
      const key = keyOf(cells[i]);
      if (seen.has(key)) continue;
      seen.add(key);
      if (!inInnerBounds(cells[i], width, height)) return null;
      if (floor.has(key) || blocked.has(key)) return null;
    }

    for (let step = 1; step <= firstLeg; step += 1) {
      const pos = { x: current.x + dir.dx * step, y: current.y + dir.dy * step };
      floor.add(keyOf(pos));
      if (step > 1 && step < firstLeg && rng() < 0.45) carvePocket(pos, dir, floor, width, height, blocked, rng);
    }
    [sideStep, sideStand].forEach((pos) => floor.add(keyOf(pos)));
    for (let step = 1; step <= secondLeg; step += 1) {
      const pos = { x: turn.x + turnDir.dx * step, y: turn.y + turnDir.dy * step };
      floor.add(keyOf(pos));
      if (step < secondLeg && rng() < 0.5) carvePocket(pos, turnDir, floor, width, height, blocked, rng);
    }

    const crate = { x: current.x + dir.dx, y: current.y + dir.dy };
    crates.push(crate);
    goals.add(keyOf(finalGoal));
    blocked.add(keyOf(finalGoal));
    return { current: afterPush, lastDir: turnDir, type: "bent" };
  }

  function buildBrutalMessMap(rng, opts = {}) {
    const width = 21 + Math.floor(rng() * 4);
    const height = 17 + Math.floor(rng() * 4);
    const floor = new Set();
    const goals = new Set();
    const blocked = new Set();
    const crates = [];
    const boxCount = rng() < 0.58 ? 5 : 4;
    const relaxed = !!opts.relaxed;
    let current = {
      x: 3 + Math.floor(rng() * (width - 6)),
      y: 3 + Math.floor(rng() * (height - 6)),
    };
    const player = clonePos(current);
    floor.add(keyOf(current));
    let lastDir = null;
    let bentBudget = opts.allowBent === false ? 0 : 1;

    for (let box = 0; box < boxCount; box += 1) {
      let placed = false;
      const dirs = shuffle(rng, DIR_ORDER).sort((a, b) => {
        const aRepeat = lastDir && a.id === lastDir.id ? 1 : 0;
        const bRepeat = lastDir && b.id === lastDir.id ? 1 : 0;
        return aRepeat - bRepeat;
      });
      for (let i = 0; i < dirs.length; i += 1) {
        const dir = dirs[i];
        const bentOptions = shuffle(rng, perpendicularDirs(dir));
        const preferBent = bentBudget > 0 && rng() < 0.42;
        const plans = preferBent ? ["bent", "straight"] : ["straight", "bent"];
        for (let p = 0; p < plans.length && !placed; p += 1) {
          let result = null;
          if (plans[p] === "bent" && bentBudget > 0) {
            for (let b = 0; b < bentOptions.length && !result; b += 1) {
              result = tryPlaceBentLock(current, dir, bentOptions[b], floor, goals, blocked, crates, width, height, rng);
            }
          } else {
            result = tryPlaceStraightLock(current, dir, floor, goals, blocked, crates, width, height, rng, { relaxed });
          }
          if (!result) continue;
          current = result.current;
          lastDir = result.lastDir;
          if (result.type === "bent") bentBudget -= 1;
          if (box < boxCount - 1) {
            current = carveConnector(current, floor, width, height, blocked, rng, relaxed);
            floor.add(keyOf(current));
          }
          placed = true;
        }
        if (placed) break;
      }
      if (!placed) return null;
    }

    const walls = wallsFromFloor(width, height, floor);
    return trimMap(buildMap(width, height, walls, goals, crates, player));
  }

  function validateBrutalMap(map, boxCount, opts = {}) {
    const strict = opts.strict !== false;
    const parsed = parseMap(map);
    if (parsed.crates.length !== boxCount) return null;
    if (parsed.goals.size < boxCount) return null;
    const snapshot = snapshotFromParsed(parsed);
    const solution = solveSnapshot(snapshot, { maxStates: 90000 });
    if (!solution || solution.pushes < boxCount * 5) return null;
    const unique = countPushSolutions(snapshot, { maxStates: 90000, maxSolutions: 2 });
    if (unique.count !== 1 || unique.truncated) return null;
    const footprint = solutionFootprint(parsed, solution.moves);
    const spareFloor = Array.from(parsed.floor).filter((key) => !footprint.has(key)).length;
    const shape = brutalShapeScore(parsed, solution);
    if (strict) {
      if (spareFloor > 18) return null;
      if (shape.turns < 12) return null;
      if (shape.branchCells < 5) return null;
      if (shape.terrain.bends < 16) return null;
    }
    return { parsed, solution, unique, spareFloor, shape };
  }

  function tightBrutalFloor(width, height, rng) {
    const floor = new Set();
    const roomCount = 3 + Math.floor(rng() * 3);
    const roomCenters = [];
    let attempts = 0;
    const minSpacing = 3;
    while (roomCenters.length < roomCount && attempts < 360) {
      attempts += 1;
      const cx = 2 + Math.floor(rng() * (width - 4));
      const cy = 2 + Math.floor(rng() * (height - 4));
      const tooClose = roomCenters.some((c) => Math.abs(c.x - cx) + Math.abs(c.y - cy) < minSpacing);
      if (tooClose) continue;
      roomCenters.push({ x: cx, y: cy });
      const rw = 2 + Math.floor(rng() * 3);
      const rh = 2 + Math.floor(rng() * 2);
      carveRoom(floor, cx, cy, rw, rh, width, height);
    }
    if (roomCenters.length < 2) {
      // emergency: carve a corridor through the middle
      const midY = Math.floor(height / 2);
      for (let x = 1; x < width - 1; x += 1) carveCell(floor, x, midY, width, height);
      for (let y = 1; y < height - 1; y += 1) carveCell(floor, Math.floor(width / 2), y, width, height);
      return floor;
    }
    const order = shuffle(rng, roomCenters);
    for (let i = 1; i < order.length; i += 1) {
      const a = order[i - 1];
      const b = order[i];
      const hFirst = rng() < 0.5;
      if (hFirst) {
        for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x += 1) {
          carveCell(floor, x, a.y, width, height);
        }
        for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y += 1) {
          carveCell(floor, b.x, y, width, height);
        }
      } else {
        for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y += 1) {
          carveCell(floor, a.x, y, width, height);
        }
        for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x += 1) {
          carveCell(floor, x, b.y, width, height);
        }
      }
    }
    // Add extras to reach a healthy floor cell count
    const minFloor = 28 + Math.floor(rng() * 8);
    let guard = 0;
    while (floor.size < minFloor && guard < 200) {
      guard += 1;
      const cells = Array.from(floor).map(parseKey);
      if (!cells.length) break;
      const anchor = pick(rng, cells);
      const dir = pick(rng, DIR_ORDER);
      carveCell(floor, anchor.x + dir.dx, anchor.y + dir.dy, width, height);
    }
    return floor;
  }

  function quickValidateUnique(map, opts = {}) {
    const parsed = parseMap(map);
    const snapshot = snapshotFromParsed(parsed);
    const budget = opts.budget || 140000;
    const solution = solveSnapshot(snapshot, { maxStates: budget });
    if (!solution) return null;
    const unique = countPushSolutions(snapshot, { maxStates: budget, maxSolutions: 2 });
    if (unique.count !== 1 || unique.truncated) return null;
    return { parsed, solution, unique };
  }

  function buildBrutalDecoyCandidate(rng) {
    const width = 11 + Math.floor(rng() * 3);
    const height = 9 + Math.floor(rng() * 3);
    const boxCount = rng() < 0.4 ? 4 : 5;

    const floor = tightBrutalFloor(width, height, rng);
    const walls = wallsFromFloor(width, height, floor);
    if (!connectedFloor(width, height, walls)) return null;

    const floorList = floorCells(width, height, walls);
    if (floorList.length < boxCount + 14) return null;

    const safeGoals = floorList.filter((p) => !isWallCorner(p, walls));
    if (safeGoals.length < boxCount + 6) return null;

    // Spread goals with more relaxed distance constraint
    const shuffled = shuffle(rng, safeGoals);
    const goalPositions = [];
    shuffled.forEach((pos) => {
      if (goalPositions.length >= boxCount) return;
      const farEnough = goalPositions.every((g) => Math.abs(g.x - pos.x) + Math.abs(g.y - pos.y) >= 3);
      if (farEnough) goalPositions.push(pos);
    });
    while (goalPositions.length < boxCount && shuffled.length) {
      const pos = shuffled.pop();
      if (!goalPositions.some((g) => samePos(g, pos))) goalPositions.push(pos);
    }
    if (goalPositions.length < boxCount) return null;

    const goals = new Set(goalPositions.map(keyOf));
    const crates = goalPositions.map(clonePos);

    // Pick player adjacent to a crate so first pulls succeed
    const adjacent = [];
    crates.forEach((c) => {
      DIR_ORDER.forEach((dir) => {
        const stand = { x: c.x - dir.dx, y: c.y - dir.dy };
        const newPlayer = { x: stand.x - dir.dx, y: stand.y - dir.dy };
        if (!floor.has(keyOf(stand)) || !floor.has(keyOf(newPlayer))) return;
        if (goals.has(keyOf(newPlayer))) return;
        adjacent.push(newPlayer);
      });
    });
    if (!adjacent.length) return null;
    let player = pick(rng, adjacent);

    const staticMap = { width, height, walls, goals, floor: new Set(floor) };
    const trace = new Set([keyOf(player)]);
    goalPositions.forEach((p) => trace.add(keyOf(p)));

    const targetPulls = boxCount * (10 + Math.floor(rng() * 7));
    const pullCounts = Array(boxCount).fill(0);
    let lastCrate = -1;
    let lastDir = "";

    for (let step = 0; step < targetPulls; step += 1) {
      const paths = reachableWithPaths(player, crates, staticMap);
      const crateSet = new Set(crates.map(keyOf));
      const options = [];
      crates.forEach((crate, i) => {
        DIR_ORDER.forEach((dir) => {
          const stand = { x: crate.x - dir.dx, y: crate.y - dir.dy };
          const newPlayer = { x: stand.x - dir.dx, y: stand.y - dir.dy };
          if (!paths.has(keyOf(stand))) return;
          if (!staticMap.floor.has(keyOf(newPlayer)) || walls.has(keyOf(newPlayer)) || crateSet.has(keyOf(newPlayer))) return;
          const future = crates.map(clonePos);
          future[i] = stand;
          if (hasSimpleDeadlock(sortedCrateKeys(future), staticMap)) return;
          const path = paths.get(keyOf(stand));
          let weight = 1 + Math.min(8, path.length) * 0.22;
          if (i !== lastCrate) weight += 2.4;
          if (lastDir && dir.id !== lastDir) weight += 1.5;
          if (!trace.has(keyOf(stand))) weight += 1.6;
          weight += Math.max(0, 4 - pullCounts[i]) * 1.4;
          options.push({ index: i, dir, stand, newPlayer, path, weight });
        });
      });
      if (!options.length) break;
      const move = chooseWeighted(rng, options);
      walkCells(player, move.path).forEach((key) => trace.add(key));
      trace.add(keyOf(crates[move.index]));
      trace.add(keyOf(move.stand));
      trace.add(keyOf(move.newPlayer));
      crates[move.index] = move.stand;
      player = move.newPlayer;
      pullCounts[move.index] += 1;
      lastCrate = move.index;
      lastDir = move.dir.id;
    }

    // Lenient: total pulls matters more than per-box minimum
    const totalPulls = pullCounts.reduce((s, n) => s + n, 0);
    if (totalPulls < boxCount * 4) return null;
    if (pullCounts.some((c) => c < 2)) return null;

    const baseMap = trimMap(buildMap(width, height, walls, goals, crates, player));

    const crateKeys = new Set(crates.map(keyOf));
    const decoyPool = shuffle(rng, Array.from(trace)
      .filter((k) => !goals.has(k) && !crateKeys.has(k) && k !== keyOf(player))
      .map(parseKey)
      .filter((p) => floor.has(keyOf(p)) && !isWallCorner(p, walls)));

    return {
      map: baseMap,
      boxCount,
      width,
      height,
      walls,
      goals,
      crates,
      player,
      decoyPool,
    };
  }

  function attachUniqueDecoys(candidate, rng) {
    const baseValid = quickValidateUnique(candidate.map, { budget: 160000 });
    if (!baseValid) return null;

    const goals = new Set(candidate.goals);
    const desired = 1 + Math.floor(rng() * 2);
    let placed = 0;
    let bestSolution = baseValid.solution;

    for (let i = 0; i < candidate.decoyPool.length && placed < desired; i += 1) {
      const decoy = candidate.decoyPool[i];
      const decoyKey = keyOf(decoy);
      if (goals.has(decoyKey)) continue;
      goals.add(decoyKey);
      const trialMap = trimMap(buildMap(candidate.width, candidate.height, candidate.walls, goals, candidate.crates, candidate.player));
      const trial = quickValidateUnique(trialMap, { budget: 160000 });
      if (trial) {
        placed += 1;
        bestSolution = trial.solution;
      } else {
        goals.delete(decoyKey);
      }
    }

    const finalMap = trimMap(buildMap(candidate.width, candidate.height, candidate.walls, goals, candidate.crates, candidate.player));
    return { map: finalMap, decoyCount: placed, solution: bestSolution };
  }

  function validateBrutalDecoyMap(map, opts = {}) {
    const strict = opts.strict !== false;
    const parsed = parseMap(map);
    const boxCount = parsed.crates.length;
    if (boxCount < 4) return null;
    if (parsed.goals.size < boxCount) return null;
    const snapshot = snapshotFromParsed(parsed);
    const solveBudget = strict ? 100000 : 200000;
    const uniqueBudget = strict ? 160000 : 280000;
    const solution = solveSnapshot(snapshot, { maxStates: solveBudget });
    if (!solution) return null;
    if (solution.pushes < boxCount * 4) return null;
    const unique = countPushSolutions(snapshot, { maxStates: uniqueBudget, maxSolutions: 2 });
    if (unique.count !== 1 || unique.truncated) return null;
    const footprint = solutionFootprint(parsed, solution.moves);
    const spareFloor = Array.from(parsed.floor).filter((key) => !footprint.has(key)).length;
    const shape = brutalShapeScore(parsed, solution);
    const decoyCount = parsed.goals.size - boxCount;
    if (strict) {
      if (spareFloor > 24) return null;
      if (shape.turns < 10) return null;
    }
    return { parsed, solution, unique, spareFloor, shape, boxCount, decoyCount };
  }

  function buildBrutalLevelName(boxCount, decoyCount) {
    const decoyTag = decoyCount > 0 ? " · " + decoyCount + " 个干扰陷阱" : "";
    return "地狱唯一解 · " + boxCount + " 箱" + decoyTag;
  }

  function pickBrutalFromLibrary() {
    if (!BRUTAL_LIBRARY.length) return null;
    const entry = BRUTAL_LIBRARY[Math.floor(Math.random() * BRUTAL_LIBRARY.length)];
    let map = entry.map;
    // Random reflection to vary the look while preserving uniqueness
    if (Math.random() < 0.5) map = mirrorMap(map, "x");
    if (Math.random() < 0.5) map = mirrorMap(map, "y");
    return {
      map,
      boxCount: entry.boxCount,
      decoyCount: entry.decoyCount,
      pushes: entry.pushes,
    };
  }

  function generateBrutalLevel(opts = {}) {
    // Primary path: pick from the precomputed library — instant, guaranteed
    // unique-solution with decoys.
    if (!opts.skipLibrary) {
      const fromLib = pickBrutalFromLibrary();
      if (fromLib) {
        return {
          id: randomId("brutal"),
          name: buildBrutalLevelName(fromLib.boxCount, fromLib.decoyCount),
          difficulty: 10,
          map: fromLib.map,
          mode: "random",
          solution: { moves: "", pushes: fromLib.pushes, states: 0 },
          uniqueSolutions: 1,
          spareFloor: 0,
          decoyCount: fromLib.decoyCount,
          fromLibrary: true,
        };
      }
    }

    // Fallback path: live generation (slow, may take several seconds).
    const deadline = Date.now() + (opts.timeBudgetMs || 6000);
    let best = null;

    for (let seedRound = 0; seedRound < 4 && !best; seedRound += 1) {
      const rng = mulberry32(randomSeed());
      for (let attempt = 0; attempt < 30 && !best; attempt += 1) {
        if (Date.now() > deadline) break;
        const candidate = buildBrutalDecoyCandidate(rng);
        if (!candidate) continue;
        const attached = attachUniqueDecoys(candidate, rng);
        if (!attached) continue;
        const validated = validateBrutalDecoyMap(attached.map, { strict: false });
        if (validated) {
          best = {
            map: attached.map,
            boxCount: validated.boxCount,
            decoyCount: validated.decoyCount,
            validated,
          };
        }
      }
      if (Date.now() > deadline) break;
    }

    if (!best) {
      const rng = mulberry32(randomSeed());
      for (let attempt = 0; attempt < 60 && !best; attempt += 1) {
        const map = buildBrutalMessMap(rng);
        if (!map) continue;
        const boxCount = parseMap(map).crates.length;
        const validated = validateBrutalMap(map, boxCount, { strict: false });
        if (validated) {
          best = { map, boxCount, decoyCount: 0, validated };
        }
      }
    }

    if (!best) {
      throw new Error("Brutal generator failed to build a unique tangle level");
    }

    return {
      id: randomId("brutal"),
      name: buildBrutalLevelName(best.boxCount, best.decoyCount),
      difficulty: 10,
      map: best.map,
      mode: "random",
      solution: best.validated.solution,
      uniqueSolutions: best.validated.unique.count,
      spareFloor: best.validated.spareFloor,
      decoyCount: best.decoyCount,
    };
  }

  function generateRandomLevel(targetDifficulty) {
    const difficulty = clamp(targetDifficulty, 1, 10);
    const rng = mulberry32(randomSeed());
    const attempts = difficulty <= 4 ? 22 : 12;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const level = generateCandidate(difficulty, rng);
      if (level) return level;
    }
    for (let attempt = 0; attempt < 18; attempt += 1) {
      const eased = clamp(difficulty - 1 + Math.floor(rng() * 3), 1, 10);
      const level = generateCandidate(eased, rng);
      if (level) {
        return { ...level, difficulty };
      }
    }
    return generateOpenFallback(difficulty, rng);
  }

  function startRandom() {
    stopAuto();
    let difficulty = Number(els.randomDifficulty.value) || state.progressiveDifficulty || 1;
    state.randomMode = els.randomMode.value;
    if (state.randomMode === "brutal") {
      difficulty = 10;
    } else if (state.randomMode === "progressive") {
      difficulty = state.progressiveDifficulty || 1;
    } else if (state.randomMode === "mixed") {
      difficulty = 1 + Math.floor(Math.random() * 10);
    }
    difficulty = clamp(difficulty, 1, 10);
    setStatus(state.randomMode === "brutal"
      ? "正在生成深渊难 · 地狱模式：唯一解校验可能会慢一点..."
      : "正在生成并验证：" + difficultyText(difficulty) + "...");
    els.generateRandom.disabled = true;
    if (els.brutalChallenge) els.brutalChallenge.disabled = true;
    setTimeout(() => {
      try {
        const level = state.randomMode === "brutal"
          ? generateBrutalLevel()
          : generateRandomLevel(difficulty);
        loadLevel({
          ...level,
          name: state.randomMode === "brutal"
            ? level.name
            : level.name + " · " + difficultyText(difficulty),
          difficulty,
          mode: "random",
        });
      } catch (err) {
        setStatus("生成失败，请再试一次。", "err");
        toast("生成失败，请再试一次", "err");
      } finally {
        els.generateRandom.disabled = false;
        if (els.brutalChallenge) els.brutalChallenge.disabled = false;
      }
    }, 20);
  }

  function nextProgressive() {
    state.progressiveDifficulty = clamp(state.difficulty + 1, 1, 10);
    if (state.difficulty >= 10) state.progressiveDifficulty = 10;
    hideWin();
    startRandom();
  }

  function nextAfterWin() {
    if (state.mode === "fixed") {
      const index = SOKOBAN_FIXED_LEVELS.findIndex((level) => level.id === state.levelId);
      const next = SOKOBAN_FIXED_LEVELS[(index + 1) % SOKOBAN_FIXED_LEVELS.length];
      loadLevel({ ...next, mode: "fixed" });
      return;
    }
    if (isBrutalActive()) {
      state.randomMode = "brutal";
      if (els.randomMode) els.randomMode.value = "brutal";
      hideWin();
      startRandom();
      return;
    }
    if (state.randomMode === "progressive") {
      nextProgressive();
      return;
    }
    hideWin();
    startRandom();
  }

  function exitAfterWin() {
    stopAuto(false);
    host.location.href = "./index.html";
  }

  function handleKeydown(event) {
    if (!state.static || state.autoplay) return;
    const tag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
    if (["input", "select", "textarea", "button"].includes(tag)) return;
    const map = {
      ArrowUp: "U",
      ArrowRight: "R",
      ArrowDown: "D",
      ArrowLeft: "L",
      w: "U",
      W: "U",
      d: "R",
      D: "R",
      s: "D",
      S: "D",
      a: "L",
      A: "L",
    };
    const dir = map[event.key];
    if (!dir) return;
    event.preventDefault();
    executeMove(dir);
  }

  function bindUi() {
    els.hintBtn.addEventListener("click", requestHint);
    els.autoBtn.addEventListener("click", toggleAuto);
    els.resetBtn.addEventListener("click", resetLevel);
    els.winExit.addEventListener("click", exitAfterWin);
    els.winNext.addEventListener("click", nextAfterWin);
    els.generateRandom.addEventListener("click", startRandom);
    els.randomMode.addEventListener("change", () => {
      state.randomMode = els.randomMode.value;
      renderRandomControls();
    });
    els.randomDifficulty.addEventListener("change", () => {
      state.progressiveDifficulty = clamp(Number(els.randomDifficulty.value) || 1, 1, 10);
      renderRandomControls();
    });
    if (els.brutalChallenge) {
      els.brutalChallenge.addEventListener("click", () => {
        state.randomMode = "brutal";
        els.randomMode.value = "brutal";
        renderRandomControls();
        startRandom();
      });
    }
    document.addEventListener("keydown", handleKeydown);
    document.querySelectorAll("[data-move]").forEach((btn) => {
      btn.addEventListener("click", () => executeMove(btn.dataset.move));
    });
  }

  function collectElements(root) {
    els.root = root;
    els.board = root.querySelector("[data-board]");
    els.levelMode = root.querySelector("[data-level-mode]");
    els.levelName = root.querySelector("[data-level-name]");
    els.moveCount = root.querySelector("[data-move-count]");
    els.pushCount = root.querySelector("[data-push-count]");
    els.hudDifficulty = root.querySelector("[data-hud-difficulty]");
    els.activeDifficulty = root.querySelector("[data-active-difficulty]");
    els.hintBtn = root.querySelector("[data-hint]");
    els.autoBtn = root.querySelector("[data-auto]");
    els.resetBtn = root.querySelector("[data-reset]");
    els.status = root.querySelector("[data-status]");
    els.fixedLevels = root.querySelector("[data-fixed-levels]");
    els.randomMode = root.querySelector("[data-random-mode]");
    els.randomDifficulty = root.querySelector("[data-random-difficulty]");
    els.randomDifficultyField = root.querySelector("[data-random-difficulty-field]");
    els.generateRandom = root.querySelector("[data-generate-random]");
    els.brutalChallenge = root.querySelector("[data-brutal-challenge]");
    els.randomNote = root.querySelector("[data-random-note]");
    els.winPanel = root.querySelector("[data-win-panel]");
    els.winSummary = root.querySelector("[data-win-summary]");
    els.winExit = root.querySelector("[data-win-exit]");
    els.winNext = root.querySelector("[data-win-next]");
  }

  function init() {
    const root = document.querySelector("[data-sokoban-root]");
    if (!root) return;
    collectElements(root);
    bindUi();
    renderFixedLevels();
    if (!restoreSavedState()) {
      loadLevel({ ...SOKOBAN_FIXED_LEVELS[0], mode: "fixed" }, { focus: false });
    }
    state.loaded = true;
  }

  function checkFixedLevels() {
    return SOKOBAN_FIXED_LEVELS.map((level) => {
      const parsed = parseMap(level.map);
      const solution = solveSnapshot({
        static: {
          width: parsed.width,
          height: parsed.height,
          walls: parsed.walls,
          goals: parsed.goals,
          floor: parsed.floor,
        },
        player: parsed.player,
        crates: parsed.crates,
      }, { maxStates: 300000 });
      return {
        id: level.id,
        name: level.name,
        difficulty: level.difficulty,
        solved: !!solution,
        moves: solution ? solution.moves.length : 0,
        pushes: solution ? solution.pushes : 0,
        states: solution ? solution.states : 0,
      };
    });
  }

  function checkRandomLevels() {
    const results = [];
    for (let difficulty = 1; difficulty <= 10; difficulty += 1) {
      const level = generateRandomLevel(difficulty);
      const parsed = parseMap(level.map);
      const solution = solveSnapshot({
        static: {
          width: parsed.width,
          height: parsed.height,
          walls: parsed.walls,
          goals: parsed.goals,
          floor: parsed.floor,
        },
        player: parsed.player,
        crates: parsed.crates,
      }, { maxStates: 300000 });
      results.push({
        difficulty,
        id: level.id,
        solved: !!solution,
        moves: solution ? solution.moves.length : 0,
        pushes: solution ? solution.pushes : 0,
      });
    }
    return results;
  }

  function checkBrutalLevel() {
    const level = generateBrutalLevel();
    const parsed = parseMap(level.map);
    const snapshot = snapshotFromParsed(parsed);
    const solution = solveSnapshot(snapshot, { maxStates: 1000000 });
    const unique = countPushSolutions(snapshot, { maxStates: 1000000, maxSolutions: 2 });
    return {
      id: level.id,
      name: level.name,
      crates: parsed.crates.length,
      goals: parsed.goals.size,
      solved: !!solution,
      moves: solution ? solution.moves.length : 0,
      pushes: solution ? solution.pushes : 0,
      uniqueSolutions: unique.count,
      states: unique.states,
    };
  }

  host.SokobanTest = {
    fixedLevels: SOKOBAN_FIXED_LEVELS,
    parseMap,
    solveSnapshot,
    countPushSolutions,
    checkFixedLevels,
    checkRandomLevels,
    checkBrutalLevel,
    generateRandomLevel,
    generateBrutalLevel,
    buildBrutalMessMap,
    generateOpenFallback,
  };

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", init);
  }
})(typeof window !== "undefined" ? window : globalThis);
