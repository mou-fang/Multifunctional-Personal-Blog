/* ===== claudeOne :: minesweeper.js ===== */
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

  const NUMBER_COLORS = ["", "1", "2", "3", "4", "5", "6", "7", "8"];

  const els = {};
  const state = {
    preset: "beginner",
    cols: 9,
    rows: 9,
    bombs: 10,
    cells: [],
    generated: false,
    startedAt: 0,
    elapsed: 0,
    status: "ready",
    opened: 0,
    flags: 0,
    hintStage: 0,
    hintTarget: null,
    lastHintKey: "",
  };

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function indexOf(x, y) {
    return y * state.cols + x;
  }

  function posOf(index) {
    return { x: index % state.cols, y: Math.floor(index / state.cols) };
  }

  function inBounds(x, y) {
    return x >= 0 && x < state.cols && y >= 0 && y < state.rows;
  }

  function neighbors(index) {
    const p = posOf(index);
    const out = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const x = p.x + dx;
        const y = p.y + dy;
        if (inBounds(x, y)) out.push(indexOf(x, y));
      }
    }
    return out;
  }

  function cellLabel(index) {
    const p = posOf(index);
    return "第 " + (p.y + 1) + " 行，第 " + (p.x + 1) + " 列";
  }

  function makeCells() {
    state.cells = Array.from({ length: state.cols * state.rows }, (_, index) => ({
      index,
      bomb: false,
      adjacent: 0,
      revealed: false,
      flagged: false,
      hit: false,
    }));
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
    renderAll();
    setStatus("左键翻开格子，右键或长按标旗。第一下不会踩雷。");
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

  function safeZone(firstIndex) {
    return new Set([firstIndex].concat(neighbors(firstIndex)));
  }

  function generate(firstIndex) {
    const protectedCells = safeZone(firstIndex);
    const pool = state.cells
      .map((cell) => cell.index)
      .filter((index) => !protectedCells.has(index));

    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }

    pool.slice(0, state.bombs).forEach((index) => {
      state.cells[index].bomb = true;
    });

    state.cells.forEach((cell) => {
      cell.adjacent = neighbors(cell.index).filter((n) => state.cells[n].bomb).length;
    });

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

  function reveal(index) {
    const cell = state.cells[index];
    if (!cell || cell.revealed || cell.flagged) return false;
    cell.revealed = true;
    state.opened += 1;
    if (cell.adjacent !== 0 || cell.bomb) return true;

    const queue = neighbors(index);
    const seen = new Set(queue);
    while (queue.length) {
      const next = queue.shift();
      const ncell = state.cells[next];
      if (!ncell || ncell.revealed || ncell.flagged || ncell.bomb) continue;
      ncell.revealed = true;
      state.opened += 1;
      if (ncell.adjacent === 0) {
        neighbors(next).forEach((candidate) => {
          if (!seen.has(candidate)) {
            seen.add(candidate);
            queue.push(candidate);
          }
        });
      }
    }
    return true;
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

  function handleReveal(index) {
    if (state.status === "won" || state.status === "lost") return;
    const cell = state.cells[index];
    if (!cell || cell.flagged || cell.revealed) return;

    if (!state.generated) generate(index);
    if (state.status === "ready") {
      state.status = "playing";
      startTimer();
    }

    clearHint();
    if (cell.bomb) {
      cell.revealed = true;
      cell.hit = true;
      loseGame(index);
      return;
    }

    reveal(index);
    checkWin();
    renderAll();
  }

  function toggleFlag(index) {
    if (state.status === "won" || state.status === "lost") return;
    const cell = state.cells[index];
    if (!cell || cell.revealed) return;
    clearHint();
    cell.flagged = !cell.flagged;
    state.flags += cell.flagged ? 1 : -1;
    if (state.generated && state.status === "ready") {
      state.status = "playing";
      startTimer();
    }
    renderAll();
  }

  function loseGame(hitIndex) {
    state.status = "lost";
    stopTimer();
    state.cells.forEach((cell) => {
      if (cell.bomb) cell.revealed = true;
    });
    renderAll();
    showResult("Boom", "踩到炸弹", cellLabel(hitIndex) + " 是炸弹。本局用时 " + formatTime(state.elapsed) + "。", "err");
    setStatus("踩雷了。可以继续看棋盘，也可以新开一局。", "err");
  }

  function checkWin() {
    const safeCount = state.cells.length - state.bombs;
    if (state.opened < safeCount) return;
    state.status = "won";
    stopTimer();
    state.cells.forEach((cell) => {
      if (cell.bomb && !cell.flagged) {
        cell.flagged = true;
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

  function renderBoard() {
    if (!els.board) return;
    els.board.style.setProperty("--mine-cols", state.cols);
    els.board.style.setProperty("--mine-rows", state.rows);
    els.board.innerHTML = state.cells.map((cell) => {
      let text = "";
      if (cell.flagged && !cell.revealed) text = "⚑";
      else if (cell.revealed && cell.bomb) text = "✹";
      else if (cell.revealed && cell.adjacent > 0) text = String(cell.adjacent);
      const number = cell.revealed && cell.adjacent > 0 ? NUMBER_COLORS[cell.adjacent] : "";
      return '<button class="mine-cell" type="button"' +
        ' data-index="' + cell.index + '"' +
        ' data-revealed="' + (cell.revealed ? "true" : "false") + '"' +
        ' data-flagged="' + (cell.flagged ? "true" : "false") + '"' +
        ' data-mine="' + (cell.bomb ? "true" : "false") + '"' +
        ' data-hit="' + (cell.hit ? "true" : "false") + '"' +
        ' data-number="' + number + '"' +
        ' data-hint="' + (state.hintTarget && state.hintTarget.index === cell.index ? "true" : "false") + '"' +
        ' aria-label="' + cellLabel(cell.index) + '"' +
        '>' + text + '</button>';
    }).join("");
  }

  function renderAll() {
    renderHeader();
    renderTimer();
    renderBoard();
  }

  function hiddenNeighbors(index) {
    return neighbors(index).filter((n) => {
      const cell = state.cells[n];
      return cell && !cell.revealed && !cell.flagged;
    });
  }

  function flaggedNeighbors(index) {
    return neighbors(index).filter((n) => state.cells[n] && state.cells[n].flagged);
  }

  function deterministicHints() {
    const hints = [];
    state.cells.forEach((cell) => {
      if (!cell.revealed || cell.adjacent <= 0) return;
      const hidden = hiddenNeighbors(cell.index);
      const flagged = flaggedNeighbors(cell.index);
      const need = cell.adjacent - flagged.length;
      if (!hidden.length) return;
      if (need === 0) {
        hidden.forEach((index) => hints.push({
          type: "safe",
          index,
          source: cell.index,
          text: "可以安全翻开",
        }));
      } else if (need === hidden.length) {
        hidden.forEach((index) => hints.push({
          type: "flag",
          index,
          source: cell.index,
          text: "应该标旗",
        }));
      }
    });
    return hints;
  }

  function fallbackHint() {
    const safe = state.cells.find((cell) => !cell.revealed && !cell.flagged && !cell.bomb);
    if (safe) return { type: "safe", index: safe.index, source: safe.index, text: "可以安全翻开" };
    const bomb = state.cells.find((cell) => !cell.revealed && !cell.flagged && cell.bomb);
    if (bomb) return { type: "flag", index: bomb.index, source: bomb.index, text: "应该标旗" };
    return null;
  }

  function chooseHint() {
    if (!state.generated) {
      const center = indexOf(Math.floor(state.cols / 2), Math.floor(state.rows / 2));
      return { type: "safe", index: center, source: center, text: "第一下安全，建议从中间开局" };
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
    const key = hint.type + ":" + hint.index + ":" + hint.source;
    if (state.lastHintKey !== key) {
      state.hintStage = 0;
      state.lastHintKey = key;
    }
    state.hintStage = forceAnswer ? 4 : clamp(state.hintStage + 1, 1, 4);
    state.hintTarget = state.hintStage >= 3 ? hint : { index: hint.source };

    const sourceText = cellLabel(hint.source);
    const targetText = cellLabel(hint.index);
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
        const btn = event.target.closest("[data-index]");
        if (!btn) return;
        handleReveal(Number(btn.dataset.index));
      }, sig);
      els.board.addEventListener("contextmenu", (event) => {
        const btn = event.target.closest("[data-index]");
        if (!btn) return;
        event.preventDefault();
        toggleFlag(Number(btn.dataset.index));
      }, sig);
      let longPress = null;
      els.board.addEventListener("pointerdown", (event) => {
        const btn = event.target.closest("[data-index]");
        if (!btn || event.pointerType === "mouse") return;
        longPress = setTimeout(() => {
          toggleFlag(Number(btn.dataset.index));
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

  function getState() {
    return {
      page: "扫雷",
      preset: state.preset,
      cols: state.cols,
      rows: state.rows,
      bombs: state.bombs,
      flags: state.flags,
      remainingBombs: Math.max(0, state.bombs - state.flags),
      opened: state.opened,
      status: state.status,
      time: formatTime(state.elapsed),
      hintStage: state.hintStage,
      lastHint: els.hintText ? els.hintText.textContent : "",
    };
  }

  function clickCell(row, col, flag) {
    const y = clamp(Number(row) || 1, 1, state.rows) - 1;
    const x = clamp(Number(col) || 1, 1, state.cols) - 1;
    const index = indexOf(x, y);
    if (flag) toggleFlag(index);
    else handleReveal(index);
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
