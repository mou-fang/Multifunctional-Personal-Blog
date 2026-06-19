/* ===== claudeOne :: minesweeper.js (Gravity Minesweeper) =====
 * 重力扫雷：翻开 0 格变为虚空，未翻开格沿列垂直下落穿过虚空，
 * 数字格与插旗格作为平台钉住，数字按当前 8 邻居实时重算。
 */
(function (host) {
  "use strict";

  var container = null;
  var ac = null;
  var timerId = null;

  const PRESETS = Object.freeze({
    beginner: Object.freeze({ label: "初级", cols: 9, rows: 9, bombs: 10 }),
    intermediate: Object.freeze({ label: "中级", cols: 16, rows: 16, bombs: 40 }),
    expert: Object.freeze({ label: "专家", cols: 30, rows: 16, bombs: 99 }),
    custom: Object.freeze({ label: "自定义", cols: 12, rows: 12, bombs: 24 }),
  });

  const els = {};
  const state = {
    preset: "beginner",
    cols: 9,
    rows: 9,
    bombs: 10,
    grid: [],            // grid[y][x] -> cell or null（虚空）
    cellById: new Map(), // id -> { cell, x, y }
    nextId: 1,
    generated: false,
    startedAt: 0,
    elapsed: 0,
    status: "ready",
    opened: 0,
    flags: 0,
    hintStage: 0,
    hintTarget: null,    // { x, y, type, source: {x,y}, text }
    lastHintKey: "",
  };

  // 用于动画：上一帧的渲染快照（cell.id -> { x, y, adjacent }）
  var lastRender = new Map();

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function inBounds(x, y) {
    return x >= 0 && x < state.cols && y >= 0 && y < state.rows;
  }

  function cellAt(x, y) {
    if (!inBounds(x, y)) return null;
    var row = state.grid[y];
    return row ? row[x] : null;
  }

  function neighborsXY(x, y) {
    const out = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (inBounds(nx, ny)) out.push({ x: nx, y: ny });
      }
    }
    return out;
  }

  // 当前 8 邻居中"存在的格子"，传 includeVoid=false（默认）
  function existingNeighbors(x, y) {
    return neighborsXY(x, y).filter((p) => cellAt(p.x, p.y));
  }

  function cellLabel(x, y) {
    return "第 " + (y + 1) + " 行，第 " + (x + 1) + " 列";
  }

  function makeCells() {
    state.grid = new Array(state.rows);
    state.cellById = new Map();
    state.nextId = 1;
    for (let y = 0; y < state.rows; y += 1) {
      const row = new Array(state.cols);
      for (let x = 0; x < state.cols; x += 1) {
        const cell = {
          id: state.nextId++,
          bomb: false,
          adjacent: 0,
          revealed: false,
          flagged: false,
          hit: false,
        };
        row[x] = cell;
        state.cellById.set(cell.id, { cell, x, y });
      }
      state.grid[y] = row;
    }
  }

  function maxBombs(cols, rows) {
    return Math.max(1, cols * rows - 9);
  }

  function normalizeSettings(cols, rows, bombs) {
    const nextCols = clamp(Number(cols) || 9, 6, 30);
    const nextRows = clamp(Number(rows) || 9, 6, 24);
    const nextBombs = clamp(Number(bombs) || 10, 1, maxBombs(nextCols, nextRows));
    return { cols: nextCols, rows: nextRows, bombs: nextBombs };
  }

  function resetGame(settings) {
    stopTimer();
    const next = normalizeSettings(settings.cols, settings.rows, settings.bombs);
    state.cols = next.cols;
    state.rows = next.rows;
    state.bombs = next.bombs;
    state.generated = false;
    state.startedAt = 0;
    state.elapsed = 0;
    state.status = "ready";
    state.opened = 0;
    state.flags = 0;
    state.hintStage = 0;
    state.hintTarget = null;
    state.lastHintKey = "";
    makeCells();
    lastRender = new Map();
    if (els.board) els.board.innerHTML = "";
    renderAll();
    setStatus("左键翻开格子，右键或长按标旗。第一下不会踩雷。翻开 0 格会让上方下落。");
  }

  function updateBombInputLimit() {
    if (!els.bombs) return;
    els.bombs.max = String(maxBombs(Number(els.cols.value), Number(els.rows.value)));
  }

  function syncInputs() {
    if (els.cols) els.cols.value = state.cols;
    if (els.rows) els.rows.value = state.rows;
    if (els.bombs) {
      els.bombs.max = String(maxBombs(state.cols, state.rows));
      els.bombs.value = state.bombs;
    }
  }

  function applyPreset(preset) {
    const cfg = PRESETS[preset] || PRESETS.beginner;
    state.preset = preset;
    resetGame(cfg);
    syncInputs();
  }

  function applyCustom() {
    state.preset = "custom";
    updateBombInputLimit();
    resetGame({
      cols: Number(els.cols.value),
      rows: Number(els.rows.value),
      bombs: Number(els.bombs.value),
    });
    syncInputs();
  }

  function safeZone(x, y) {
    const set = new Set();
    set.add(y * state.cols + x);
    neighborsXY(x, y).forEach((p) => set.add(p.y * state.cols + p.x));
    return set;
  }

  // 首点保护：把炸弹身份分配给除安全区以外的格子
  function generate(firstX, firstY) {
    const protectedKeys = safeZone(firstX, firstY);
    const pool = [];
    for (let y = 0; y < state.rows; y += 1) {
      for (let x = 0; x < state.cols; x += 1) {
        const key = y * state.cols + x;
        if (!protectedKeys.has(key)) pool.push({ x, y });
      }
    }
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    pool.slice(0, state.bombs).forEach((p) => {
      const cell = state.grid[p.y][p.x];
      if (cell) cell.bomb = true;
    });
    recomputeAllAdjacents();
    state.generated = true;
  }

  function startTimer() {
    if (timerId) return;
    if (!state.startedAt) state.startedAt = Date.now() - state.elapsed * 1000;
    timerId = setInterval(() => {
      state.elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
      renderTimer();
    }, 250);
  }

  function stopTimer() {
    if (timerId) clearInterval(timerId);
    timerId = null;
  }

  function formatTime(total) {
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return String(min).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
  }

  // 计算给定坐标"现在"的邻接雷数（基于 grid 当前状态）
  function adjacentNow(x, y) {
    let n = 0;
    const ns = neighborsXY(x, y);
    for (let i = 0; i < ns.length; i += 1) {
      const c = cellAt(ns[i].x, ns[i].y);
      if (c && c.bomb) n += 1;
    }
    return n;
  }

  function recomputeAllAdjacents() {
    state.cellById.forEach((entry) => {
      entry.cell.adjacent = adjacentNow(entry.x, entry.y);
    });
  }

  // 把一个已翻开的 0-格转为虚空：从 grid 中移出。
  // 关键：在"翻开瞬间"把首批 0-格清掉；之后由 applyGravity 的链式步骤
  // 自动把"重算后邻居 0 颗雷的平台"也消解，避免棋盘上残留没有数字的实体方块。
  function dissolveToVoid(x, y, cell) {
    state.grid[y][x] = null;
    state.cellById.delete(cell.id);
  }

  // BFS flood-fill：在当前 grid 上动态计算邻接，翻开连通 0 区及其外围。
  // 0-格在被翻开的瞬间立即变虚空（dissolveToVoid）。后续 applyGravity 链式
  // 还会把"重算后变 0"的平台再次消解，所以最终棋盘上不会留没有数字的实体方块。
  function revealRecursive(sx, sy) {
    const startCell = cellAt(sx, sy);
    if (!startCell || startCell.revealed || startCell.flagged || startCell.bomb) return;
    const queue = [{ x: sx, y: sy }];
    const seen = new Set([sy * state.cols + sx]);
    while (queue.length) {
      const p = queue.shift();
      const cell = cellAt(p.x, p.y);
      if (!cell || cell.revealed || cell.flagged || cell.bomb) continue;
      cell.revealed = true;
      state.opened += 1;
      // 用当前 grid 计算这个格子的 adjacent
      cell.adjacent = adjacentNow(p.x, p.y);
      if (cell.adjacent === 0) {
        // 立即变虚空。注意：移除非雷 0 格不会影响其他格子的 adjacentNow 结果。
        const ns = neighborsXY(p.x, p.y);
        dissolveToVoid(p.x, p.y, cell);
        for (let i = 0; i < ns.length; i += 1) {
          const k = ns[i].y * state.cols + ns[i].x;
          if (!seen.has(k)) {
            seen.add(k);
            queue.push(ns[i]);
          }
        }
      }
    }
  }

  // 单列重力沉降：以 anchor（已翻开数字格 / 插旗格）为分隔，
  // 每段内的可动格沉到段底部，相对顺序保持。已变虚空的 0-格（grid 里的 null）
  // 由 revealRecursive 阶段直接处理；这里不再做"事后消解"。
  function applyGravity() {
    for (let x = 0; x < state.cols; x += 1) {
      gravityColumn(x);
    }
    // 沉降后，所有平台数字按当前邻居重算
    recomputeAllAdjacents();
  }

  function isAnchor(cell) {
    if (!cell) return false;
    // 软平台：只要是已翻开或插旗，就钉在原位；其余（未翻开非旗）算可动。
    // 关键修改：以前要求 adjacent !== 0，导致围成的虚空闭环里没有可动格能落下去。
    // 现在放宽为"凡是 revealed 都算 anchor"，这样数字格永远在原位，
    // 而可动格沿列穿过 anchor 直接落到列底，重力效果才会真的可见。
    return cell.flagged || cell.revealed;
  }

  // 单列重力沉降（软平台模型）：
  //   1. 平台（已翻开 / 插旗）保持在原行；
  //   2. 可动格"穿过"平台与虚空，落到列里最底部的非平台空位；
  //   3. 顶部多余的位置变虚空。
  // 这样无论平台围成怎样的形状，可动格都能找到下落空间。
  function gravityColumn(col) {
    const anchors = [];
    const mobiles = []; // 自上而下的可动顺序
    for (let y = 0; y < state.rows; y += 1) {
      const cell = state.grid[y][col];
      if (!cell) continue;
      if (isAnchor(cell)) {
        anchors.push({ y: y, cell: cell });
      } else {
        mobiles.push(cell);
      }
      state.grid[y][col] = null;
    }
    // 先把平台塞回原位
    anchors.forEach(function (a) {
      state.grid[a.y][col] = a.cell;
    });
    // 再把可动格自底向上塞进剩余的非平台空位（保持相对顺序）
    let writeY = state.rows - 1;
    for (let i = mobiles.length - 1; i >= 0; i -= 1) {
      while (writeY >= 0 && state.grid[writeY][col] !== null) {
        writeY -= 1;
      }
      if (writeY < 0) break;
      const mobile = mobiles[i];
      state.grid[writeY][col] = mobile;
      state.cellById.set(mobile.id, { cell: mobile, x: col, y: writeY });
      writeY -= 1;
    }
  }

  // 单步重力：单列沉降 + 邻接重算 + 把"重算后变 0 的平台"消解为虚空。
  // 返回 true 表示本次发生了消解，需要再跑一轮（链式下落）。
  function gravityStep() {
    for (let x = 0; x < state.cols; x += 1) {
      gravityColumn(x);
    }
    recomputeAllAdjacents();
    // 找出"现在邻居 0 颗雷"的已翻开非雷非旗格（即 0-平台），消解它们
    const toDissolve = [];
    state.cellById.forEach((entry) => {
      const c = entry.cell;
      if (c.revealed && !c.bomb && !c.flagged && c.adjacent === 0) {
        toDissolve.push(entry);
      }
    });
    toDissolve.forEach((entry) => {
      state.grid[entry.y][entry.x] = null;
      state.cellById.delete(entry.cell.id);
    });
    return toDissolve.length > 0;
  }

  // 链式重力：反复执行 gravityStep 直到棋盘稳定。
  // 每轮都可能让新的平台变成 0-平台 → 再消解 → 再下落，效果连锁。
  function applyGravity() {
    let iterations = 0;
    while (gravityStep() && iterations < 64) {
      iterations += 1;
    }
  }

  function clearHint() {
    state.hintStage = 0;
    state.hintTarget = null;
    state.lastHintKey = "";
    if (els.hintText) {
      els.hintText.textContent = "需要卡关时点“提示”。同一局里越点越具体。";
      els.hintText.dataset.hintLevel = "0";
    }
  }

  function handleReveal(x, y) {
    if (state.status === "won" || state.status === "lost") return;
    const cell = cellAt(x, y);
    if (!cell || cell.flagged || cell.revealed) return;

    if (!state.generated) generate(x, y);
    if (state.status === "ready") {
      state.status = "playing";
      startTimer();
    }

    clearHint();

    if (cell.bomb) {
      cell.revealed = true;
      cell.hit = true;
      loseGame(x, y);
      return;
    }

    // 翻开（包括 0-格的 flood-fill 与即时变虚空）
    revealRecursive(x, y);

    // 重力沉降 + 邻接重算
    applyGravity();
    checkWin();
    if (state.status !== "won" && state.status !== "lost") {
      renderAll();
    }
  }

  function toggleFlag(x, y) {
    if (state.status === "won" || state.status === "lost") return;
    const cell = cellAt(x, y);
    if (!cell || cell.revealed) return;
    clearHint();
    cell.flagged = !cell.flagged;
    state.flags += cell.flagged ? 1 : -1;
    if (state.generated && state.status === "ready") {
      state.status = "playing";
      startTimer();
    }
    // 取消旗后该格变 mobile，可能立刻沉降
    if (!cell.flagged) {
      applyGravity();
    } else {
      // 插旗本身不改变 grid 占位，但邻接没变，无需重算
    }
    renderAll();
  }

  function loseGame(hitX, hitY) {
    state.status = "lost";
    stopTimer();
    // 揭示所有雷
    state.cellById.forEach((entry) => {
      if (entry.cell.bomb) entry.cell.revealed = true;
    });
    renderAll();
    showResult("Boom", "踩到炸弹", cellLabel(hitX, hitY) + " 是炸弹。本局用时 " + formatTime(state.elapsed) + "。", "err");
    setStatus("踩雷了。可以继续看棋盘，也可以新开一局。", "err");
  }

  function checkWin() {
    // 胜利条件：所有非雷格都已翻开
    let safeRemaining = 0;
    state.cellById.forEach((entry) => {
      const c = entry.cell;
      if (!c.bomb && !c.revealed) safeRemaining += 1;
    });
    if (safeRemaining > 0) return;
    state.status = "won";
    stopTimer();
    // 自动给所有未旗的雷插旗
    state.cellById.forEach((entry) => {
      const c = entry.cell;
      if (c.bomb && !c.flagged) {
        c.flagged = true;
        state.flags += 1;
      }
    });
    renderAll();
    showResult("Solved", "扫雷完成", "你翻开了所有安全格，用时 " + formatTime(state.elapsed) + "。", "ok");
    setStatus("胜利。所有非雷格都已经翻开。", "ok");
  }

  function showResult(kicker, title, text, tone) {
    if (!els.result) return;
    els.result.hidden = false;
    els.resultKicker.textContent = kicker;
    els.resultTitle.textContent = title;
    els.resultText.textContent = text;
    els.result.dataset.tone = tone || "";
  }

  function hideResult() {
    if (els.result) els.result.hidden = true;
  }

  function setStatus(text, tone) {
    if (!els.status) return;
    els.status.textContent = text;
    if (tone) els.status.dataset.tone = tone;
    else els.status.removeAttribute("data-tone");
  }

  function renderTimer() {
    if (els.time) els.time.textContent = formatTime(state.elapsed);
  }

  function renderHeader() {
    const preset = PRESETS[state.preset] || { label: "自定义" };
    if (els.mode) els.mode.textContent = preset.label;
    if (els.title) els.title.textContent = state.cols + " × " + state.rows + " / " + state.bombs + " 雷";
    if (els.left) els.left.textContent = Math.max(0, state.bombs - state.flags);
    if (els.opened) els.opened.textContent = state.opened;
    if (els.stateText) {
      const labels = { ready: "待开始", playing: "进行中", won: "已胜利", lost: "已失败" };
      els.stateText.textContent = labels[state.status] || "待开始";
    }
    if (els.presets) {
      els.presets.querySelectorAll("[data-mine-preset]").forEach((btn) => {
        btn.dataset.active = btn.dataset.minePreset === state.preset ? "true" : "false";
      });
    }
  }

  // DOM diff 渲染：每个 cell.id 对应一个 <button>，仅更新位置/属性。
  // 用 grid-column / grid-row 内联放置（CSS Grid 处理布局），
  // 用 FLIP 动画（First-Last-Invert-Play）实现位置变化的平滑下落。
  function renderBoard() {
    if (!els.board) return;
    els.board.style.setProperty("--mine-cols", state.cols);
    els.board.style.setProperty("--mine-rows", state.rows);

    const presentIds = new Set();
    const newRender = new Map();

    // First：捕捉将会移动的 cell 的旧位置
    const oldRects = new Map();
    state.cellById.forEach((entry) => {
      const cell = entry.cell;
      const prev = lastRender.get(cell.id);
      if (prev && (prev.x !== entry.x || prev.y !== entry.y)) {
        const node = els.board.querySelector('[data-cell-id="' + cell.id + '"]');
        if (node) {
          oldRects.set(cell.id, node.getBoundingClientRect());
        }
      }
    });

    // 应用 DOM 更新（grid 位置 + 属性）
    state.cellById.forEach((entry) => {
      const cell = entry.cell;
      const x = entry.x;
      const y = entry.y;
      presentIds.add(cell.id);

      let node = els.board.querySelector('[data-cell-id="' + cell.id + '"]');
      if (!node) {
        node = document.createElement("button");
        node.type = "button";
        node.className = "mine-cell";
        node.dataset.cellId = String(cell.id);
        node.style.gridColumn = String(x + 1);
        node.style.gridRow = String(y + 1);
        els.board.appendChild(node);
      } else {
        node.style.gridColumn = String(x + 1);
        node.style.gridRow = String(y + 1);
      }

      let text = "";
      if (cell.flagged && !cell.revealed) text = "⚑";
      else if (cell.revealed && cell.bomb) text = "✹";
      else if (cell.revealed && cell.adjacent > 0) text = String(cell.adjacent);
      const number = cell.revealed && cell.adjacent > 0 ? String(cell.adjacent) : "";

      node.textContent = text;
      node.dataset.revealed = cell.revealed ? "true" : "false";
      node.dataset.flagged = cell.flagged ? "true" : "false";
      node.dataset.mine = cell.bomb ? "true" : "false";
      node.dataset.hit = cell.hit ? "true" : "false";
      node.dataset.number = number;
      const isHinted = state.hintTarget &&
        state.hintTarget.x === x && state.hintTarget.y === y;
      node.dataset.hint = isHinted ? "true" : "false";
      node.setAttribute("aria-label", cellLabel(x, y));

      // 数字闪烁
      const prev = lastRender.get(cell.id);
      if (prev && cell.revealed && cell.adjacent > 0 &&
        prev.adjacent !== cell.adjacent && prev.revealed) {
        const flash = cell.adjacent > prev.adjacent ? "up" : "down";
        node.removeAttribute("data-flash");
        // eslint-disable-next-line no-unused-expressions
        void node.offsetWidth;
        node.dataset.flash = flash;
      } else {
        node.removeAttribute("data-flash");
      }

      newRender.set(cell.id, { x: x, y: y, adjacent: cell.adjacent, revealed: cell.revealed });
    });

    // Last + Invert + Play：让移动的 cell 平滑下落
    // 用 rAF 双帧分离，确保浏览器认得旧/新两个状态之间的差异。
    if (oldRects.size > 0) {
      const transforms = [];
      oldRects.forEach((oldRect, id) => {
        const node = els.board.querySelector('[data-cell-id="' + id + '"]');
        if (!node) return;
        const newRect = node.getBoundingClientRect();
        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;
        if (dx === 0 && dy === 0) return;
        node.style.transition = "none";
        node.style.transform = "translate(" + dx + "px, " + dy + "px)";
        transforms.push(node);
      });
      if (transforms.length > 0) {
        // 强制 reflow，让"瞬时回到旧位置"提交
        // eslint-disable-next-line no-unused-expressions
        void els.board.offsetHeight;
        // 下一帧清掉 transition / transform，让 CSS 规则的 transform transition 接管
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            transforms.forEach(function (node) {
              node.style.transition = "";
              node.style.transform = "";
            });
          });
        });
      }
    }

    // 移除已变虚空的 DOM
    Array.from(els.board.children).forEach((node) => {
      const id = Number(node.dataset.cellId);
      if (!presentIds.has(id)) {
        node.classList.add("mine-cell--vanish");
        setTimeout(function () {
          if (node.parentNode) node.parentNode.removeChild(node);
        }, 220);
      }
    });

    lastRender = newRender;
  }

  function renderAll() {
    renderHeader();
    renderTimer();
    renderBoard();
  }

  // —— 提示系统（沿用经典思路，但用动态邻居与坐标） ——

  function hiddenNeighborsAt(x, y) {
    return existingNeighbors(x, y).filter((p) => {
      const c = cellAt(p.x, p.y);
      return c && !c.revealed && !c.flagged;
    });
  }

  function flaggedNeighborsAt(x, y) {
    return existingNeighbors(x, y).filter((p) => {
      const c = cellAt(p.x, p.y);
      return c && c.flagged;
    });
  }

  function deterministicHints() {
    const hints = [];
    state.cellById.forEach((entry) => {
      const cell = entry.cell;
      if (!cell.revealed || cell.adjacent <= 0) return;
      const hidden = hiddenNeighborsAt(entry.x, entry.y);
      if (!hidden.length) return;
      const flagged = flaggedNeighborsAt(entry.x, entry.y);
      const need = cell.adjacent - flagged.length;
      if (need === 0) {
        hidden.forEach((p) => hints.push({
          type: "safe",
          x: p.x, y: p.y,
          source: { x: entry.x, y: entry.y },
          text: "可以安全翻开",
        }));
      } else if (need === hidden.length) {
        hidden.forEach((p) => hints.push({
          type: "flag",
          x: p.x, y: p.y,
          source: { x: entry.x, y: entry.y },
          text: "应该标旗",
        }));
      }
    });
    return hints;
  }

  function fallbackHint() {
    let safe = null;
    let bomb = null;
    state.cellById.forEach((entry) => {
      const c = entry.cell;
      if (c.revealed || c.flagged) return;
      if (!c.bomb && !safe) safe = { x: entry.x, y: entry.y };
      if (c.bomb && !bomb) bomb = { x: entry.x, y: entry.y };
    });
    if (safe) return { type: "safe", x: safe.x, y: safe.y, source: safe, text: "可以安全翻开" };
    if (bomb) return { type: "flag", x: bomb.x, y: bomb.y, source: bomb, text: "应该标旗" };
    return null;
  }

  function chooseHint() {
    if (!state.generated) {
      const cx = Math.floor(state.cols / 2);
      const cy = Math.floor(state.rows / 2);
      return { type: "safe", x: cx, y: cy, source: { x: cx, y: cy }, text: "第一下安全，建议从中间开局" };
    }
    return deterministicHints()[0] || fallbackHint();
  }

  function requestHint(forceAnswer) {
    if (state.status === "won" || state.status === "lost") {
      setStatus("这一局已经结束，新开一局后再提示。", "warn");
      return;
    }
    const hint = chooseHint();
    if (!hint) {
      setStatus("暂时没有可提示的格子。", "warn");
      return;
    }
    const key = hint.type + ":" + hint.x + "," + hint.y + ":" + hint.source.x + "," + hint.source.y;
    if (state.lastHintKey !== key) {
      state.hintStage = 0;
      state.lastHintKey = key;
    }
    state.hintStage = forceAnswer ? 4 : clamp(state.hintStage + 1, 1, 4);
    state.hintTarget = state.hintStage >= 3
      ? { x: hint.x, y: hint.y }
      : { x: hint.source.x, y: hint.source.y };

    const sourceText = cellLabel(hint.source.x, hint.source.y);
    const targetText = cellLabel(hint.x, hint.y);
    let message = "";
    if (state.hintStage === 1) {
      message = "模糊提示：棋盘上有一处确定线索，先看 " + sourceText + " 附近。";
    } else if (state.hintStage === 2) {
      message = "进一步提示：" + sourceText + " 周围能推出一个“" + (hint.type === "safe" ? "安全格" : "炸弹格") + "”。";
    } else if (state.hintStage === 3) {
      message = "明确提示：" + targetText + " " + hint.text + "。";
    } else {
      message = "直接答案：" + (hint.type === "safe" ? "左键翻开 " : "右键标旗 ") + targetText + "。";
    }
    if (els.hintText) {
      els.hintText.textContent = message;
      els.hintText.dataset.hintLevel = String(state.hintStage);
    }
    setStatus(message, state.hintStage >= 3 ? "ok" : "warn");
    renderBoard();
  }

  // —— UI 绑定 ——

  function bindUi(signal) {
    const sig = { signal };
    if (els.presets) {
      els.presets.querySelectorAll("[data-mine-preset]").forEach((btn) => {
        btn.addEventListener("click", () => applyPreset(btn.dataset.minePreset), sig);
      });
    }
    [els.cols, els.rows].forEach((input) => {
      if (input) input.addEventListener("input", updateBombInputLimit, sig);
    });
    if (els.apply) els.apply.addEventListener("click", applyCustom, sig);
    if (els.newBtn) els.newBtn.addEventListener("click", () => resetGame(state), sig);
    if (els.hintBtn) els.hintBtn.addEventListener("click", () => requestHint(false), sig);
    if (els.answerBtn) els.answerBtn.addEventListener("click", () => requestHint(true), sig);
    if (els.closeResult) els.closeResult.addEventListener("click", hideResult, sig);
    if (els.newResult) els.newResult.addEventListener("click", () => {
      hideResult();
      resetGame(state);
    }, sig);
    if (els.board) {
      let suppressClick = false;
      els.board.addEventListener("click", (event) => {
        if (suppressClick) {
          event.preventDefault();
          suppressClick = false;
          return;
        }
        const btn = event.target.closest("[data-cell-id]");
        if (!btn) return;
        const id = Number(btn.dataset.cellId);
        const entry = state.cellById.get(id);
        if (!entry) return;
        handleReveal(entry.x, entry.y);
      }, sig);
      els.board.addEventListener("contextmenu", (event) => {
        const btn = event.target.closest("[data-cell-id]");
        if (!btn) return;
        event.preventDefault();
        const id = Number(btn.dataset.cellId);
        const entry = state.cellById.get(id);
        if (!entry) return;
        toggleFlag(entry.x, entry.y);
      }, sig);
      let longPress = null;
      els.board.addEventListener("pointerdown", (event) => {
        const btn = event.target.closest("[data-cell-id]");
        if (!btn || event.pointerType === "mouse") return;
        const id = Number(btn.dataset.cellId);
        longPress = setTimeout(() => {
          const entry = state.cellById.get(id);
          if (entry) toggleFlag(entry.x, entry.y);
          suppressClick = true;
          longPress = null;
        }, 520);
      }, sig);
      ["pointerup", "pointercancel", "pointerleave"].forEach((name) => {
        els.board.addEventListener(name, () => {
          if (longPress) clearTimeout(longPress);
          longPress = null;
        }, sig);
      });
    }
  }

  function collectElements(root) {
    els.root = root;
    els.time = root.querySelector("[data-mine-time]");
    els.mode = root.querySelector("[data-mine-mode]");
    els.title = root.querySelector("[data-mine-title]");
    els.left = root.querySelector("[data-mine-left]");
    els.opened = root.querySelector("[data-mine-opened]");
    els.stateText = root.querySelector("[data-mine-state]");
    els.board = root.querySelector("[data-mine-board]");
    els.status = root.querySelector("[data-mine-status]");
    els.hintText = root.querySelector("[data-mine-hint-text]");
    els.presets = root.querySelector("[data-mine-presets]");
    els.cols = root.querySelector("[data-mine-cols]");
    els.rows = root.querySelector("[data-mine-rows]");
    els.bombs = root.querySelector("[data-mine-bombs]");
    els.apply = root.querySelector("[data-mine-apply]");
    els.newBtn = root.querySelector("[data-mine-new]");
    els.hintBtn = root.querySelector("[data-mine-hint]");
    els.answerBtn = root.querySelector("[data-mine-reveal-answer]");
    els.result = root.querySelector("[data-mine-result]");
    els.resultKicker = root.querySelector("[data-mine-result-kicker]");
    els.resultTitle = root.querySelector("[data-mine-result-title]");
    els.resultText = root.querySelector("[data-mine-result-text]");
    els.closeResult = root.querySelector("[data-mine-close-result]");
    els.newResult = root.querySelector("[data-mine-new-from-result]");
  }

  function countByKind() {
    let voidCount = 0;
    let platformCount = 0;
    let mobileCount = 0;
    for (let y = 0; y < state.rows; y += 1) {
      for (let x = 0; x < state.cols; x += 1) {
        const cell = state.grid[y] && state.grid[y][x];
        if (!cell) { voidCount += 1; continue; }
        if (cell.flagged || (cell.revealed && cell.adjacent !== 0)) platformCount += 1;
        else if (!cell.revealed) mobileCount += 1;
        else platformCount += 1; // 已踩雷展示等罕见情况
      }
    }
    return { voidCount, platformCount, mobileCount };
  }

  function getState() {
    const counts = countByKind();
    return {
      page: "重力扫雷",
      preset: state.preset,
      cols: state.cols,
      rows: state.rows,
      bombs: state.bombs,
      flags: state.flags,
      remainingBombs: Math.max(0, state.bombs - state.flags),
      opened: state.opened,
      voidCount: counts.voidCount,
      platformCount: counts.platformCount,
      mobileCount: counts.mobileCount,
      status: state.status,
      time: formatTime(state.elapsed),
      hintStage: state.hintStage,
      lastHint: els.hintText ? els.hintText.textContent : "",
    };
  }

  function clickCell(row, col, flag) {
    const y = clamp(Number(row) || 1, 1, state.rows) - 1;
    const x = clamp(Number(col) || 1, 1, state.cols) - 1;
    if (flag) toggleFlag(x, y);
    else handleReveal(x, y);
  }

  function mount(el) {
    ac = new AbortController();
    container = el;
    el.classList.add("minesweeper-page");
    collectElements(el);
    bindUi(ac.signal);
    resetGame(PRESETS.beginner);
    syncInputs();
    host.MinesweeperAPI = {
      getState,
      newGame: function (args) {
        args = args || {};
        if (args.preset && PRESETS[args.preset]) {
          applyPreset(args.preset);
        } else {
          state.preset = "custom";
          resetGame({
            cols: args.cols || args.width || state.cols,
            rows: args.rows || args.height || state.rows,
            bombs: args.bombs || state.bombs,
          });
          syncInputs();
        }
      },
      hint: function () { requestHint(false); },
      answer: function () { requestHint(true); },
      reveal: function (args) { clickCell(args && args.row, args && args.col, false); },
      flag: function (args) { clickCell(args && args.row, args && args.col, true); },
    };
  }

  function unmount() {
    stopTimer();
    if (ac) {
      ac.abort();
      ac = null;
    }
    if (container) container.classList.remove("minesweeper-page");
    container = null;
    if (host.MinesweeperAPI) delete host.MinesweeperAPI;
    Object.keys(els).forEach((key) => { els[key] = null; });
  }

  host.__page_minesweeper = { mount, unmount };
})(typeof window !== "undefined" ? window : globalThis);
