/* ===== claudeOne :: snake.js =====
 * Snake Arena — 40×30 large-map snake game with 3 AI opponents,
 * 10 power-up types, obstacles, and full SPA lifecycle.
 */
(function (host) {
  "use strict";

  /* ------------------------------------------------------------------ */
  /*  Constants                                                         */
  /* ------------------------------------------------------------------ */

  var COLS = 40;
  var ROWS = 30;
  var BASE_TICK_MS = 150;
  var MAX_FOOD = 15;
  var MAX_POWERUPS = 3;
  var OBSTACLE_COUNT = 25;
  var INITIAL_LENGTH = 3;

  var DIR = Object.freeze({
    UP:    { x:  0, y: -1 },
    DOWN:  { x:  0, y:  1 },
    LEFT:  { x: -1, y:  0 },
    RIGHT: { x:  1, y:  0 },
  });

  var DIR_LIST = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT];

  var SNAKE_COLORS = Object.freeze({
    player: { body: "#4ade80", head: "#22c55e", outline: "#064e3b" },
    ai0:    { body: "#f87171", head: "#ef4444", outline: "#7f1d1d" },
    ai1:    { body: "#60a5fa", head: "#3b82f6", outline: "#1e3a5f" },
    ai2:    { body: "#fb923c", head: "#f97316", outline: "#7c2d12" },
  });

  var AI_PERSONALITIES = Object.freeze([
    { name: "Aggressive", foodW: 0.3, powerW: 0.2, chaseW: 0.5, openW: 0.3 },
    { name: "Greedy",     foodW: 0.7, powerW: 0.4, chaseW: 0.1, openW: 0.4 },
    { name: "Balanced",   foodW: 0.4, powerW: 0.3, chaseW: 0.3, openW: 0.4 },
  ]);

  var POWERUP_TYPES = [
    { id: "TIME_STOP",    icon: "⏱️", name: "时停",     desc: "所有 AI 蛇完全静止",                    color: "#fbbf24", duration: 5  },
    { id: "PREDATOR",     icon: "⚔️", name: "掠食者",   desc: "蛇头触碰 AI 蛇即可将其杀死，尸体变食物", color: "#ef4444", duration: 8  },
    { id: "SHIELD",       icon: "🛡️", name: "护盾",     desc: "无敌状态，穿越墙壁、障碍和所有蛇身",     color: "#3b82f6", duration: 10 },
    { id: "SPEED_BOOST",  icon: "💨", name: "加速",     desc: "自身移动速度翻倍",                        color: "#06b6d4", duration: 6  },
    { id: "SLOW_AURA",    icon: "🐌", name: "减速光环", desc: "所有 AI 蛇移动速度减半",                  color: "#a855f7", duration: 8  },
    { id: "MAGNET",       icon: "🧲", name: "磁铁",     desc: "8 格内的食物缓慢飘向玩家",                color: "#ec4899", duration: 10 },
    { id: "BOMB",         icon: "💣", name: "炸弹",     desc: "清除全图障碍物并击晕所有 AI 3 秒",        color: "#f97316", duration: 3  },
    { id: "GHOST",        icon: "👻", name: "幽灵",     desc: "穿越墙壁和障碍物（穿到对侧），身体仍会撞", color: "#e2e8f0", duration: 7  },
    { id: "DOUBLE_SCORE", icon: "✨", name: "双倍分数", desc: "吃食物 20 分 / 杀 AI 100 分",             color: "#eab308", duration: 12 },
    { id: "CONFUSION",    icon: "🌀", name: "混乱",     desc: "AI 蛇方向随机乱转，行为不可预测",          color: "#84cc16", duration: 6  },
  ];

  /* ------------------------------------------------------------------ */
  /*  DOM references (set by mount)                                     */
  /* ------------------------------------------------------------------ */

  var els = {};
  var container = null;
  var canvas = null;
  var ctx = null;
  var rafId = null;

  /* ------------------------------------------------------------------ */
  /*  Game State                                                        */
  /* ------------------------------------------------------------------ */

  var game = {};

  function defaultSnake(headX, headY, dirX, dirY) {
    var body = [];
    for (var i = 0; i < INITIAL_LENGTH; i++) {
      body.push({ x: headX - dirX * i, y: headY - dirY * i });
    }
    return {
      body: body,
      dir: { x: dirX, y: dirY },
      nextDir: { x: dirX, y: dirY },
      alive: true,
    };
  }

  function initGame() {
    game = {
      snakes: [
        /* 0 = player */ defaultSnake(4, 15, 1, 0),
        /* 1 = ai0    */ defaultSnake(35, 5, -1, 0),
        /* 2 = ai1    */ defaultSnake(35, 15, -1, 0),
        /* 3 = ai2    */ defaultSnake(35, 25, -1, 0),
      ],
      food: [],
      powerups: [],
      obstacles: [],
      score: 0,
      kills: 0,
      state: "ready",   // ready | playing | paused | over
      lastTime: 0,
      activeBuffs: {},      // { buffId: expiresAt }
      aiFrozenUntil: {},    // { aiIdx: expiresAt }
      aiConfusedUntil: {},  // { aiIdx: expiresAt }
      animationPhase: 0,
    };

    placeObstacles();
    spawnFood(MAX_FOOD);
    spawnPowerups(MAX_POWERUPS);

    updateUI();
  }

  /* ------------------------------------------------------------------ */
  /*  Utility helpers                                                   */
  /* ------------------------------------------------------------------ */

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function clamp(n, lo, hi) {
    return n < lo ? lo : n > hi ? hi : n;
  }

  function posEq(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  /* ------------------------------------------------------------------ */
  /*  Obstacles                                                        */
  /* ------------------------------------------------------------------ */

  function isOnSnakeStart(x, y) {
    // 4 start positions with a safe zone around each
    var starts = [
      { x: 4, y: 15 },
      { x: 35, y: 5 },
      { x: 35, y: 15 },
      { x: 35, y: 25 },
    ];
    for (var s = 0; s < starts.length; s++) {
      if (Math.abs(x - starts[s].x) <= 3 && Math.abs(y - starts[s].y) <= 3) return true;
    }
    return false;
  }

  function placeObstacles() {
    game.obstacles = [];
    var attempts = 0;
    while (game.obstacles.length < OBSTACLE_COUNT && attempts < 1000) {
      attempts++;
      var ox = randInt(1, COLS - 2);
      var oy = randInt(1, ROWS - 2);
      if (isOnSnakeStart(ox, oy)) continue;
      // Don't overlap existing obstacles
      var dup = false;
      for (var i = 0; i < game.obstacles.length; i++) {
        if (game.obstacles[i].x === ox && game.obstacles[i].y === oy) { dup = true; break; }
      }
      if (dup) continue;
      // Don't cluster too tightly
      var tooClose = false;
      for (var j = 0; j < game.obstacles.length; j++) {
        if (Math.abs(game.obstacles[j].x - ox) + Math.abs(game.obstacles[j].y - oy) < 2) {
          tooClose = true; break;
        }
      }
      if (tooClose) continue;
      game.obstacles.push({ x: ox, y: oy });
    }
  }

  function clearObstacles() {
    game.obstacles = [];
  }

  /* ------------------------------------------------------------------ */
  /*  Food & Power-up spawning                                          */
  /* ------------------------------------------------------------------ */

  function occupiedSet() {
    var set = {};
    for (var i = 0; i < game.obstacles.length; i++) {
      set[game.obstacles[i].x + "," + game.obstacles[i].y] = true;
    }
    for (var fi = 0; fi < game.food.length; fi++) {
      set[game.food[fi].x + "," + game.food[fi].y] = true;
    }
    for (var pi = 0; pi < game.powerups.length; pi++) {
      set[game.powerups[pi].x + "," + game.powerups[pi].y] = true;
    }
    for (var si = 0; si < game.snakes.length; si++) {
      var sn = game.snakes[si];
      if (!sn.alive) continue;
      for (var bi = 0; bi < sn.body.length; bi++) {
        set[sn.body[bi].x + "," + sn.body[bi].y] = true;
      }
    }
    return set;
  }

  function emptyCell() {
    var occ = occupiedSet();
    for (var attempts = 0; attempts < 500; attempts++) {
      var x = randInt(0, COLS - 1);
      var y = randInt(0, ROWS - 1);
      if (!occ[x + "," + y]) return { x: x, y: y };
    }
    return null;
  }

  function spawnFood(count) {
    for (var i = 0; i < count; i++) {
      var cell = emptyCell();
      if (cell) game.food.push({ x: cell.x, y: cell.y, anim: Math.random() * Math.PI * 2 });
    }
  }

  function spawnPowerups(count) {
    for (var i = 0; i < count; i++) {
      var cell = emptyCell();
      if (cell) {
        game.powerups.push({
          x: cell.x,
          y: cell.y,
          type: POWERUP_TYPES[randInt(0, POWERUP_TYPES.length - 1)],
          anim: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  function maintainFood() {
    while (game.food.length < MAX_FOOD) {
      var cell = emptyCell();
      if (cell) game.food.push({ x: cell.x, y: cell.y, anim: Math.random() * Math.PI * 2 });
      else break;
    }
  }

  function maintainPowerups() {
    while (game.powerups.length < MAX_POWERUPS) {
      var cell = emptyCell();
      if (cell) {
        game.powerups.push({
          x: cell.x,
          y: cell.y,
          type: POWERUP_TYPES[randInt(0, POWERUP_TYPES.length - 1)],
          anim: Math.random() * Math.PI * 2,
        });
      } else break;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Collision helpers                                                 */
  /* ------------------------------------------------------------------ */

  function isObstacle(x, y) {
    for (var i = 0; i < game.obstacles.length; i++) {
      if (game.obstacles[i].x === x && game.obstacles[i].y === y) return true;
    }
    return false;
  }

  function isOutOfBounds(x, y) {
    return x < 0 || x >= COLS || y < 0 || y >= ROWS;
  }

  /* ------------------------------------------------------------------ */
  /*  Snake movement                                                    */
  /* ------------------------------------------------------------------ */

  function moveSnake(snakeIdx) {
    var snake = game.snakes[snakeIdx];
    if (!snake.alive) return;

    snake.dir = snake.nextDir;
    var head = snake.body[0];
    var newHead = { x: head.x + snake.dir.x, y: head.y + snake.dir.y };

    var isPlayer = snakeIdx === 0;
    var hasGhost = isPlayer && hasBuff("GHOST");
    var hasShield = isPlayer && hasBuff("SHIELD");
    var hasPredator = isPlayer && hasBuff("PREDATOR");

    /* Ghost: wrap around walls */
    if (hasGhost) {
      if (newHead.x < 0) newHead.x = COLS - 1;
      else if (newHead.x >= COLS) newHead.x = 0;
      if (newHead.y < 0) newHead.y = ROWS - 1;
      else if (newHead.y >= ROWS) newHead.y = 0;
    }

    /* Wall / obstacle death check */
    var dead = false;

    if (!hasShield) {
      if (isOutOfBounds(newHead.x, newHead.y)) {
        if (!hasGhost) dead = true;
      } else if (isObstacle(newHead.x, newHead.y)) {
        if (!hasGhost) dead = true;
      }
    }

    /* Self collision (skip tail — it will move away unless growing) */
    if (!dead && !hasShield) {
      var checkLen = snake.body.length;
      // If we are not about to grow (i.e. tail will be removed), skip last segment
      // We approximate: always skip last segment (standard snake behavior)
      if (checkLen > 1) checkLen -= 1;
      for (var si = 0; si < checkLen; si++) {
        if (posEq(snake.body[si], newHead)) {
          dead = true;
          break;
        }
      }
    }

    /* Other snake collision */
    if (!dead) {
      for (var oi = 0; oi < game.snakes.length; oi++) {
        if (oi === snakeIdx) continue;
        var other = game.snakes[oi];
        if (!other.alive) continue;

        // Head-to-head
        if (other.body.length > 0 && posEq(other.body[0], newHead)) {
          if (hasPredator) {
            killAISnake(oi);
            continue;
          }
          if (!hasShield) {
            dead = true;
            break;
          }
        }

        // Body collision
        for (var bi = 0; bi < other.body.length; bi++) {
          if (posEq(other.body[bi], newHead)) {
            if (hasPredator && oi !== 0) {
              killAISnake(oi);
              continue;
            }
            if (!hasShield) {
              dead = true;
              break;
            }
          }
        }
        if (dead) break;
      }
    }

    if (dead) {
      if (isPlayer) {
        killPlayer();
        return;
      } else {
        killAISnake(snakeIdx);
        return;
      }
    }

    /* Move: add new head */
    snake.body.unshift(newHead);

    /* Check food */
    var ateFood = false;
    for (var fi = game.food.length - 1; fi >= 0; fi--) {
      if (posEq(game.food[fi], newHead)) {
        game.food.splice(fi, 1);
        ateFood = true;
        if (isPlayer) {
          var pts = hasBuff("DOUBLE_SCORE") ? 20 : 10;
          game.score += pts;
        }
      }
    }

    /* Check power-ups */
    for (var pi = game.powerups.length - 1; pi >= 0; pi--) {
      if (posEq(game.powerups[pi], newHead)) {
        var pu = game.powerups[pi];
        if (isPlayer) {
          activateBuff(pu.type);
        }
        // AI eating power-up just denies it to player (no effect for AI)
        game.powerups.splice(pi, 1);
      }
    }

    if (!ateFood) {
      snake.body.pop();
    }

    maintainFood();
    maintainPowerups();
  }

  function killAISnake(idx) {
    var snake = game.snakes[idx];
    if (!snake.alive) return;
    snake.alive = false;

    // When killed by predator, body segments become food
    if (hasBuff("PREDATOR")) {
      for (var i = 0; i < snake.body.length; i++) {
        game.food.push({ x: snake.body[i].x, y: snake.body[i].y, anim: Math.random() * Math.PI * 2 });
      }
    }

    game.kills++;
    var pts = hasBuff("DOUBLE_SCORE") ? 100 : 50;
    game.score += pts;

    // Respawn AI after delay
    var idxCaptured = idx;
    setTimeout(function () {
      respawnAI(idxCaptured);
    }, 4000);
  }

  function respawnAI(idx) {
    if (!game || !game.snakes || game.state === "over") return;
    var cell = emptyCell();
    if (!cell) {
      var idx2 = idx;
      setTimeout(function () { respawnAI(idx2); }, 1000);
      return;
    }
    var dir = DIR_LIST[randInt(0, 3)];
    game.snakes[idx] = defaultSnake(cell.x, cell.y, dir.x, dir.y);
    game.snakes[idx].alive = true;
  }

  function killPlayer() {
    game.snakes[0].alive = false;
    game.state = "over";
    updateUI();
  }

  /* ------------------------------------------------------------------ */
  /*  Buff System                                                       */
  /* ------------------------------------------------------------------ */

  function hasBuff(buffId) {
    var exp = game.activeBuffs[buffId];
    if (!exp) return false;
    return Date.now() < exp;
  }

  function activateBuff(type) {
    var now = Date.now();
    game.activeBuffs[type.id] = now + type.duration * 1000;

    /* Bomb: clear obstacles, freeze AI */
    if (type.id === "BOMB") {
      clearObstacles();
      var freezeUntil = now + 3000;
      for (var i = 1; i <= 3; i++) {
        game.aiFrozenUntil[i] = freezeUntil;
      }
    }

    /* Confusion: random AI direction reversal */
    if (type.id === "CONFUSION") {
      var confuseUntil = now + type.duration * 1000;
      for (var j = 1; j <= 3; j++) {
        game.aiConfusedUntil[j] = confuseUntil;
      }
    }

    /* Time stop: freeze all AI */
    if (type.id === "TIME_STOP") {
      var stopUntil = now + type.duration * 1000;
      for (var k = 1; k <= 3; k++) {
        game.aiFrozenUntil[k] = stopUntil;
      }
    }

    updateBuffsUI();
  }

  function getActiveBuffs() {
    var now = Date.now();
    var active = [];
    var keys = Object.keys(game.activeBuffs);
    for (var i = 0; i < keys.length; i++) {
      if (game.activeBuffs[keys[i]] > now) {
        var remaining = Math.ceil((game.activeBuffs[keys[i]] - now) / 1000);
        for (var t = 0; t < POWERUP_TYPES.length; t++) {
          if (POWERUP_TYPES[t].id === keys[i]) {
            active.push({
              icon: POWERUP_TYPES[t].icon,
              name: POWERUP_TYPES[t].name,
              desc: POWERUP_TYPES[t].desc,
              remaining: remaining,
              color: POWERUP_TYPES[t].color,
            });
            break;
          }
        }
      }
    }
    active.sort(function (a, b) { return a.remaining - b.remaining; });
    return active;
  }

  function updateBuffsUI() {
    var buffsEl = els.buffs;
    if (!buffsEl) return;
    var active = getActiveBuffs();
    var html = "";
    for (var i = 0; i < active.length; i++) {
      var b = active[i];
      html += '<span class="buff-pill" style="background:' + b.color + '22;color:' + b.color +
              ';border-color:' + b.color + '44;">' +
              b.icon + ' ' + b.name + ' ' + b.remaining + 's' +
              '<span class="buff-tooltip" style="color:' + b.color + '">' +
              '<strong>' + b.icon + ' ' + b.name + '</strong>' +
              '<small>' + b.desc + '</small></span></span>';
    }
    buffsEl.innerHTML = html;
  }

  /* ------------------------------------------------------------------ */
  /*  AI Decision Making                                                */
  /* ------------------------------------------------------------------ */

  function isCellSafe(x, y, aiIdx) {
    if (isOutOfBounds(x, y)) return false;
    if (isObstacle(x, y)) return false;

    // Check all snake bodies
    for (var si = 0; si < game.snakes.length; si++) {
      var sn = game.snakes[si];
      if (!sn.alive) continue;
      if (si === aiIdx) {
        // Skip own head (it will move) but check rest
        for (var bi = 1; bi < sn.body.length; bi++) {
          if (posEq(sn.body[bi], { x: x, y: y })) return false;
        }
      } else {
        for (var bj = 0; bj < sn.body.length; bj++) {
          if (posEq(sn.body[bj], { x: x, y: y })) return false;
        }
      }
    }
    return true;
  }

  function isOppositeDir(d1, d2) {
    return d1.x + d2.x === 0 && d1.y + d2.y === 0;
  }

  function aiDecide(aiIdx) {
    var snake = game.snakes[aiIdx];
    if (!snake.alive) return;

    var now = Date.now();

    // Check frozen
    if (game.aiFrozenUntil[aiIdx] && now < game.aiFrozenUntil[aiIdx]) {
      return; // don't move
    }

    var pers = AI_PERSONALITIES[aiIdx - 1]; // aiIdx 1,2,3
    var head = snake.body[0];

    // If confused, randomly pick a direction sometimes
    if (game.aiConfusedUntil[aiIdx] && now < game.aiConfusedUntil[aiIdx]) {
      if (Math.random() < 0.4) {
        snake.nextDir = DIR_LIST[randInt(0, 3)];
        return;
      }
    }

    // Find safe directions (not reversing)
    var safeDirs = [];
    for (var d = 0; d < DIR_LIST.length; d++) {
      var dir = DIR_LIST[d];
      if (isOppositeDir(dir, snake.dir)) continue;
      var nx = head.x + dir.x;
      var ny = head.y + dir.y;
      if (isCellSafe(nx, ny, aiIdx)) {
        safeDirs.push(dir);
      }
    }

    if (safeDirs.length === 0) {
      // No safe direction — pick any non-reverse (will likely die)
      for (var d2 = 0; d2 < DIR_LIST.length; d2++) {
        if (!isOppositeDir(DIR_LIST[d2], snake.dir)) {
          snake.nextDir = DIR_LIST[d2];
          return;
        }
      }
      snake.nextDir = DIR_LIST[0];
      return;
    }

    // Score each safe direction
    var playerHead = (game.snakes[0].alive && game.snakes[0].body.length > 0)
      ? game.snakes[0].body[0] : null;

    var bestDir = safeDirs[0];
    var bestScore = -Infinity;

    for (var sd = 0; sd < safeDirs.length; sd++) {
      var d = safeDirs[sd];
      var nx = head.x + d.x;
      var ny = head.y + d.y;
      var score = 0;

      // Distance to nearest food
      var nearestFoodDist = Infinity;
      for (var fi = 0; fi < game.food.length; fi++) {
        var dist = Math.abs(game.food[fi].x - nx) + Math.abs(game.food[fi].y - ny);
        if (dist < nearestFoodDist) nearestFoodDist = dist;
      }
      if (nearestFoodDist < Infinity) {
        score += pers.foodW * (30 - Math.min(nearestFoodDist, 30));
      }

      // Distance to nearest power-up
      var nearestPowerDist = Infinity;
      for (var pi = 0; pi < game.powerups.length; pi++) {
        var pdist = Math.abs(game.powerups[pi].x - nx) + Math.abs(game.powerups[pi].y - ny);
        if (pdist < nearestPowerDist) nearestPowerDist = pdist;
      }
      if (nearestPowerDist < Infinity) {
        score += pers.powerW * (30 - Math.min(nearestPowerDist, 30));
      }

      // Distance to player (chase factor)
      if (playerHead && game.snakes[0].alive) {
        var playerDist = Math.abs(playerHead.x - nx) + Math.abs(playerHead.y - ny);
        score += pers.chaseW * (40 - Math.min(playerDist, 40));
      }

      // Open space heuristic: count reachable cells ahead
      var openCount = 0;
      for (var step = 1; step <= 5; step++) {
        var cx = nx + d.x * step;
        var cy = ny + d.y * step;
        if (isCellSafe(cx, cy, aiIdx)) openCount++;
      }
      score += pers.openW * openCount * 2;

      // Random factor
      score += Math.random() * 5;

      if (score > bestScore) {
        bestScore = score;
        bestDir = d;
      }
    }

    snake.nextDir = bestDir;
  }

  /* ------------------------------------------------------------------ */
  /*  Magnet effect: drift food toward player                           */
  /* ------------------------------------------------------------------ */

  function applyMagnet() {
    if (!hasBuff("MAGNET")) return;
    if (!game.snakes[0].alive || game.snakes[0].body.length === 0) return;
    var pHead = game.snakes[0].body[0];

    for (var fi = 0; fi < game.food.length; fi++) {
      var f = game.food[fi];
      var dx = pHead.x - f.x;
      var dy = pHead.y - f.y;
      var dist = Math.abs(dx) + Math.abs(dy);
      if (dist <= 8 && dist > 0 && Math.random() < 0.08) {
        // Drift one cell toward player
        var mx = f.x + (dx > 0 ? 1 : dx < 0 ? -1 : 0);
        var my = f.y + (dy > 0 ? 1 : dy < 0 ? -1 : 0);
        if (isOutOfBounds(mx, my)) continue;
        if (isObstacle(mx, my)) continue;
        // Check not occupied by snake or other items
        var blocked = false;
        for (var si = 0; si < game.snakes.length; si++) {
          var sn = game.snakes[si];
          if (!sn.alive) continue;
          for (var bi = 0; bi < sn.body.length; bi++) {
            if (sn.body[bi].x === mx && sn.body[bi].y === my) { blocked = true; break; }
          }
          if (blocked) break;
        }
        if (blocked) continue;
        for (var pi = 0; pi < game.powerups.length; pi++) {
          if (game.powerups[pi].x === mx && game.powerups[pi].y === my) { blocked = true; break; }
        }
        if (blocked) continue;
        for (var fj = 0; fj < game.food.length; fj++) {
          if (fj !== fi && game.food[fj].x === mx && game.food[fj].y === my) { blocked = true; break; }
        }
        if (!blocked) {
          f.x = mx;
          f.y = my;
        }
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Rendering                                                         */
  /* ------------------------------------------------------------------ */

  function computeCellSize() {
    if (!canvas) return 20;
    var rect = canvas.parentElement.getBoundingClientRect();
    var availW = rect.width - 8;
    var availH = Math.min(window.innerHeight * 0.65, 680);
    var cellFromW = Math.floor(availW / COLS);
    var cellFromH = Math.floor(availH / ROWS);
    return Math.max(14, Math.min(cellFromW, cellFromH, 24));
  }

  function resizeCanvas() {
    if (!canvas) return;
    var cs = computeCellSize();
    var w = cs * COLS;
    var h = cs * ROWS;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function cellToPixel(cx, cy, cs) {
    return { x: cx * cs, y: cy * cs, s: cs };
  }

  function drawRoundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawStar(cx, cy, innerR, outerR, points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (var i = 0; i < points * 2; i++) {
      var r = i % 2 === 0 ? outerR : innerR;
      var angle = (i * Math.PI) / points - Math.PI / 2;
      var x = cx + Math.cos(angle) * r;
      var y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function render() {
    if (!ctx || !canvas) return;

    var cs = computeCellSize();
    var w = cs * COLS;
    var h = cs * ROWS;
    var phase = game.animationPhase || 0;

    /* Background */
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);

    /* Grid lines */
    ctx.strokeStyle = "rgba(30, 41, 59, 0.8)";
    ctx.lineWidth = 0.5;
    for (var gx = 0; gx <= COLS; gx++) {
      ctx.beginPath();
      ctx.moveTo(gx * cs, 0);
      ctx.lineTo(gx * cs, h);
      ctx.stroke();
    }
    for (var gy = 0; gy <= ROWS; gy++) {
      ctx.beginPath();
      ctx.moveTo(0, gy * cs);
      ctx.lineTo(w, gy * cs);
      ctx.stroke();
    }

    /* Obstacles */
    for (var oi = 0; oi < game.obstacles.length; oi++) {
      var o = game.obstacles[oi];
      var op = cellToPixel(o.x, o.y, cs);
      var pad = cs * 0.05;
      ctx.fillStyle = "#334155";
      drawRoundedRect(op.x + pad, op.y + pad, cs - pad * 2, cs - pad * 2, cs * 0.15);
      ctx.fill();
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    /* Food */
    for (var fi = 0; fi < game.food.length; fi++) {
      var f = game.food[fi];
      var fp = cellToPixel(f.x, f.y, cs);
      var fcx = fp.x + cs / 2;
      var fcy = fp.y + cs / 2;
      var fr = cs * 0.28;
      var glow = Math.sin(phase * 0.1 + f.anim) * 0.15 + 0.35;

      /* Glow */
      var grad = ctx.createRadialGradient(fcx, fcy, fr * 0.3, fcx, fcy, fr + 3);
      grad.addColorStop(0, "rgba(250, 204, 21, " + (glow + 0.2) + ")");
      grad.addColorStop(1, "rgba(250, 204, 21, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(fcx, fcy, fr + 3, 0, Math.PI * 2);
      ctx.fill();

      /* Core */
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.arc(fcx, fcy, fr, 0, Math.PI * 2);
      ctx.fill();

      /* Highlight */
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.beginPath();
      ctx.arc(fcx - fr * 0.25, fcy - fr * 0.25, fr * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Power-ups */
    for (var pi = 0; pi < game.powerups.length; pi++) {
      var pu = game.powerups[pi];
      var pp = cellToPixel(pu.x, pu.y, cs);
      var pcx = pp.x + cs / 2;
      var pcy = pp.y + cs / 2;
      var pr = cs * 0.38;
      var pulse = Math.sin(phase * 0.08 + pu.anim) * 0.2 + 0.8;

      /* Outer glow */
      var pugrad = ctx.createRadialGradient(pcx, pcy, pr * 0.3, pcx, pcy, pr * pulse * 2.5);
      pugrad.addColorStop(0, pu.type.color + "88");
      pugrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = pugrad;
      ctx.beginPath();
      ctx.arc(pcx, pcy, pr * pulse * 2.5, 0, Math.PI * 2);
      ctx.fill();

      /* Star shape */
      drawStar(pcx, pcy, pr * 0.5 * pulse, pr * pulse, 5, pu.type.color);

      /* Icon text */
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold " + Math.floor(cs * 0.4) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pu.type.icon, pcx, pcy);
    }

    /* Draw all snakes */
    for (var sidx = 0; sidx < game.snakes.length; sidx++) {
      var snake = game.snakes[sidx];
      if (!snake.alive) continue;
      var isPlayer = sidx === 0;
      var colors = isPlayer ? SNAKE_COLORS.player :
                   sidx === 1 ? SNAKE_COLORS.ai0 :
                   sidx === 2 ? SNAKE_COLORS.ai1 :
                               SNAKE_COLORS.ai2;

      var hasGhost = isPlayer && hasBuff("GHOST");
      var hasShield = isPlayer && hasBuff("SHIELD");
      var hasPredator = isPlayer && hasBuff("PREDATOR");

      for (var segi = snake.body.length - 1; segi >= 0; segi--) {
        var seg = snake.body[segi];
        var sp = cellToPixel(seg.x, seg.y, cs);
        var pad = cs * 0.06;
        var sx = sp.x + pad;
        var sy = sp.y + pad;
        var ss = cs - pad * 2;
        var radius = cs * 0.25;

        /* Ghost transparency */
        var alpha = hasGhost ? 0.45 : 1;

        ctx.save();
        ctx.globalAlpha = alpha;

        /* Shield outline */
        if (hasShield) {
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 2.5;
          ctx.shadowColor = "#3b82f6";
          ctx.shadowBlur = 6;
          drawRoundedRect(sx - 2, sy - 2, ss + 4, ss + 4, radius + 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        /* Predator glow on head */
        if (segi === 0 && hasPredator) {
          ctx.shadowColor = "#ef4444";
          ctx.shadowBlur = 12;
          ctx.fillStyle = colors.head;
          drawRoundedRect(sx, sy, ss, ss, radius);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = segi === 0 ? colors.head : colors.body;
          drawRoundedRect(sx, sy, ss, ss, radius);
          ctx.fill();
        }

        /* Segment outline */
        ctx.strokeStyle = colors.outline;
        ctx.lineWidth = 1;
        drawRoundedRect(sx, sy, ss, ss, radius);
        ctx.stroke();

        ctx.restore();

        /* Eyes on head */
        if (segi === 0) {
          drawEyes(sp, cs, snake.dir, isPlayer, alpha);
        }
      }
    }

    /* Paused overlay */
    if (game.state === "paused") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold " + Math.floor(cs * 1.2) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("PAUSED", w / 2, h / 2);
    }
  }

  function drawEyes(sp, cs, dir, isPlayer, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;

    var eyeR = cs * 0.1;
    var cx = sp.x + cs / 2;
    var cy = sp.y + cs / 2;
    var off = cs * 0.22;
    var e1x, e1y, e2x, e2y;

    if (dir.x === 1) { // RIGHT
      e1x = cx + off; e1y = cy - off;
      e2x = cx + off; e2y = cy + off;
    } else if (dir.x === -1) { // LEFT
      e1x = cx - off; e1y = cy - off;
      e2x = cx - off; e2y = cy + off;
    } else if (dir.y === -1) { // UP
      e1x = cx - off; e1y = cy - off;
      e2x = cx + off; e2y = cy - off;
    } else { // DOWN
      e1x = cx - off; e1y = cy + off;
      e2x = cx + off; e2y = cy + off;
    }

    if (isPlayer) {
      // Friendly eyes: white with dark pupils
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(e1x, e1y, eyeR, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e2x, e2y, eyeR, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = "#1e293b";
      ctx.beginPath(); ctx.arc(e1x + dir.x * 1, e1y + dir.y * 1, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(e2x + dir.x * 1, e2y + dir.y * 1, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
    } else {
      // Hostile eyes: X marks
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      [e1x, e2x].forEach(function (ex, idx) {
        var ey = idx === 0 ? e1y : e2y;
        ctx.beginPath();
        ctx.moveTo(ex - eyeR * 0.7, ey - eyeR * 0.7);
        ctx.lineTo(ex + eyeR * 0.7, ey + eyeR * 0.7);
        ctx.moveTo(ex + eyeR * 0.7, ey - eyeR * 0.7);
        ctx.lineTo(ex - eyeR * 0.7, ey + eyeR * 0.7);
        ctx.stroke();
      });
    }

    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /*  Game loop                                                         */
  /* ------------------------------------------------------------------ */

  var playerAccumulator = 0;
  var aiAccumulator = 0;
  var speedMultiplier = 1.0;   // 0.5, 0.75, 1.0, 1.25, 1.5

  function setSpeed(mult) {
    speedMultiplier = mult;
    // Reset accumulators so the new rate takes effect immediately
    playerAccumulator = 0;
    aiAccumulator = 0;
  }

  function gameLoop(timestamp) {
    if (!game || !game.lastTime) game.lastTime = timestamp;
    var dt = Math.min(timestamp - game.lastTime, 500);
    game.lastTime = timestamp;

    game.animationPhase = (game.animationPhase + dt * 0.06) % (Math.PI * 200);

    if (game.state === "playing") {
      var now = Date.now();

      // Clean expired buffs
      var keys = Object.keys(game.activeBuffs);
      for (var k = 0; k < keys.length; k++) {
        if (game.activeBuffs[keys[k]] <= now) {
          delete game.activeBuffs[keys[k]];
        }
      }

      var playerRate = (hasBuff("SPEED_BOOST") ? BASE_TICK_MS / 2 : BASE_TICK_MS) / speedMultiplier;
      var aiRate = (hasBuff("SLOW_AURA") ? BASE_TICK_MS * 2 : BASE_TICK_MS) / speedMultiplier;

      playerAccumulator += dt;
      aiAccumulator += dt;

      /* Player ticks */
      while (playerAccumulator >= playerRate) {
        playerAccumulator -= playerRate;
        moveSnake(0);
        applyMagnet();
        if (game.state === "over") break;
      }

      /* AI ticks */
      if (game.state !== "over") {
        while (aiAccumulator >= aiRate) {
          aiAccumulator -= aiRate;

          // AI decisions first
          for (var i = 1; i <= 3; i++) {
            aiDecide(i);
          }
          // Then AI moves
          for (var j = 1; j <= 3; j++) {
            moveSnake(j);
            if (game.state === "over") break;
          }
          applyMagnet();
          if (game.state === "over") break;
        }
      }

      updateUI();
      updateBuffsUI();
    }

    render();

    rafId = requestAnimationFrame(gameLoop);
  }

  /* ------------------------------------------------------------------ */
  /*  UI Updates                                                        */
  /* ------------------------------------------------------------------ */

  function updateUI() {
    if (els.score) els.score.textContent = game.score;
    if (els.lengthEl) els.lengthEl.textContent = game.snakes[0].alive ? game.snakes[0].body.length : 0;
    if (els.kills) els.kills.textContent = game.kills;

    var aiAlive = 0;
    for (var i = 1; i <= 3; i++) {
      if (game.snakes[i].alive) aiAlive++;
    }
    if (els.aiAlive) els.aiAlive.textContent = aiAlive;
    if (els.foodCount) els.foodCount.textContent = game.food.length;

    if (els.stateEl) {
      if (game.state === "ready") {
        els.stateEl.textContent = "按方向键开始";
      } else if (game.state === "playing") {
        els.stateEl.textContent = "游戏中...";
      } else if (game.state === "paused") {
        els.stateEl.textContent = "已暂停";
      } else if (game.state === "over") {
        els.stateEl.textContent = "游戏结束";
      }
    }

    /* Overlay */
    if (els.overlay) {
      if (game.state === "over") {
        els.overlay.removeAttribute("hidden");
        if (els.overlayKicker) els.overlayKicker.textContent = "Game Over";
        if (els.overlayTitle) els.overlayTitle.textContent = "游戏结束";
        if (els.overlayText) {
          els.overlayText.textContent =
            "最终得分: " + game.score +
            " | 蛇长: " + game.snakes[0].body.length +
            " | 击杀: " + game.kills;
        }
      } else {
        els.overlay.setAttribute("hidden", "");
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Input Handling                                                    */
  /* ------------------------------------------------------------------ */

  function handleKey(e) {
    var newDir = null;

    switch (e.key) {
      case "ArrowUp":    case "w": case "W": newDir = DIR.UP;    break;
      case "ArrowDown":  case "s": case "S": newDir = DIR.DOWN;  break;
      case "ArrowLeft":  case "a": case "A": newDir = DIR.LEFT;  break;
      case "ArrowRight": case "d": case "D": newDir = DIR.RIGHT; break;
      case " ":
        e.preventDefault();
        togglePause();
        return;
      default:
        return;
    }

    e.preventDefault();

    if (game.state === "over") return;

    // Start game on first direction input
    if (game.state === "ready") {
      game.state = "playing";
      game.lastTime = 0;
      playerAccumulator = 0;
      aiAccumulator = 0;
      updateUI();
    }

    if (game.state !== "playing") return;

    var snake = game.snakes[0];
    if (!snake.alive) return;

    // Prevent reversing
    if (snake.body.length > 1) {
      if (isOppositeDir(newDir, snake.dir)) return;
    }

    snake.nextDir = newDir;
  }

  function togglePause() {
    if (game.state === "playing") {
      game.state = "paused";
    } else if (game.state === "paused") {
      game.state = "playing";
      game.lastTime = 0;
      playerAccumulator = 0;
      aiAccumulator = 0;
    }
    updateUI();
  }

  /* ------------------------------------------------------------------ */
  /*  Button Handlers                                                   */
  /* ------------------------------------------------------------------ */

  function restartGame() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    initGame();
    game.state = "playing";
    game.lastTime = 0;
    playerAccumulator = 0;
    aiAccumulator = 0;
    updateUI();
    updateBuffsUI();
    if (els.overlay) els.overlay.setAttribute("hidden", "");
    rafId = requestAnimationFrame(gameLoop);
    if (canvas) canvas.focus();
  }

  function newGame() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    initGame();
    game.state = "ready";
    game.lastTime = 0;
    playerAccumulator = 0;
    aiAccumulator = 0;
    updateUI();
    updateBuffsUI();
    if (els.overlay) els.overlay.setAttribute("hidden", "");
    rafId = requestAnimationFrame(gameLoop);
    if (canvas) canvas.focus();
  }

  /* ------------------------------------------------------------------ */
  /*  Touch controls for mobile                                         */
  /* ------------------------------------------------------------------ */

  var touchStartX = 0;
  var touchStartY = 0;

  function handleTouchStart(e) {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }

  function handleTouchEnd(e) {
    if (game.state === "over") return;
    var endX = e.changedTouches.length > 0 ? e.changedTouches[0].clientX : touchStartX;
    var endY = e.changedTouches.length > 0 ? e.changedTouches[0].clientY : touchStartY;
    var dx = endX - touchStartX;
    var dy = endY - touchStartY;
    var absDx = Math.abs(dx);
    var absDy = Math.abs(dy);

    if (absDx < 20 && absDy < 20) return; // too small, ignore

    if (game.state === "ready") {
      game.state = "playing";
      game.lastTime = 0;
      playerAccumulator = 0;
      aiAccumulator = 0;
      updateUI();
    }

    if (game.state !== "playing") return;

    var newDir;
    if (absDx > absDy) {
      newDir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
    } else {
      newDir = dy > 0 ? DIR.DOWN : DIR.UP;
    }

    var snake = game.snakes[0];
    if (snake.body.length > 1 && isOppositeDir(newDir, snake.dir)) return;
    snake.nextDir = newDir;
  }

  /* ------------------------------------------------------------------ */
  /*  Resize observer                                                   */
  /* ------------------------------------------------------------------ */

  var resizeObserver = null;

  /* ------------------------------------------------------------------ */
  /*  Lifecycle: mount / unmount                                        */
  /* ------------------------------------------------------------------ */

  function mount(el) {
    container = el;

    /* Cache DOM elements */
    var selectorMap = {
      "data-snake-score":        "score",
      "data-snake-length":       "lengthEl",
      "data-snake-kills":        "kills",
      "data-snake-ai-alive":     "aiAlive",
      "data-snake-food-count":   "foodCount",
      "data-snake-state":        "stateEl",
      "data-snake-overlay":      "overlay",
      "data-snake-overlay-text": "overlayText",
      "data-snake-overlay-kicker": "overlayKicker",
      "data-snake-overlay-title": "overlayTitle",
      "data-snake-buffs":        "buffs",
      "data-snake-canvas":       "canvas",
      "data-snake-restart":      "restartBtn",
      "data-snake-new":          "newBtn",
      "data-snake-pause":        "pauseBtn",
      "data-snake-status":       "status",
    };

    var selKeys = Object.keys(selectorMap);
    for (var i = 0; i < selKeys.length; i++) {
      var sel = selKeys[i];
      var found = container.querySelector("[" + sel + "]");
      if (found) els[selectorMap[sel]] = found;
    }

    /* Canvas */
    canvas = els.canvas;
    if (!canvas) {
      console.warn("[snake] Canvas not found in template");
      return;
    }

    resizeCanvas();

    /* Resize observer */
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(function () {
        resizeCanvas();
        render();
      });
      resizeObserver.observe(canvas.parentElement);
    }

    /* Init game */
    initGame();
    updateUI();
    updateBuffsUI();

    /* Keyboard */
    canvas.setAttribute("tabindex", "0");
    canvas.focus();
    document.addEventListener("keydown", handleKey);

    /* Touch */
    canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: true });

    /* Buttons */
    if (els.restartBtn) els.restartBtn.addEventListener("click", restartGame);
    if (els.newBtn) els.newBtn.addEventListener("click", newGame);
    if (els.pauseBtn) els.pauseBtn.addEventListener("click", togglePause);

    /* Speed selector */
    var speedBtns = container.querySelectorAll("[data-speed]");
    for (var si = 0; si < speedBtns.length; si++) {
      speedBtns[si].addEventListener("click", function (e) {
        var mult = parseFloat(e.currentTarget.getAttribute("data-speed"));
        if (isNaN(mult)) return;
        setSpeed(mult);
        // Update active state
        var allBtns = container.querySelectorAll("[data-speed]");
        for (var ai = 0; ai < allBtns.length; ai++) {
          allBtns[ai].classList.remove("snake-speed__btn--active");
        }
        e.currentTarget.classList.add("snake-speed__btn--active");
        if (els.status) {
          var prev = els.status.textContent;
          els.status.textContent = "倍速已切换至 " + mult.toFixed(2) + "×";
          setTimeout(function () {
            if (els.status && els.status.textContent.indexOf("倍速已切换") === 0) {
              els.status.textContent = prev;
            }
          }, 1500);
        }
      });
    }

    /* Start render loop */
    game.lastTime = 0;
    playerAccumulator = 0;
    aiAccumulator = 0;
    rafId = requestAnimationFrame(gameLoop);
  }

  function unmount() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    document.removeEventListener("keydown", handleKey);

    if (canvas) {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchend", handleTouchEnd);
    }

    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    if (els.restartBtn) els.restartBtn.removeEventListener("click", restartGame);
    if (els.newBtn) els.newBtn.removeEventListener("click", newGame);
    if (els.pauseBtn) els.pauseBtn.removeEventListener("click", togglePause);

    game = {};
    els = {};
    container = null;
    canvas = null;
    ctx = null;
  }

  /* ------------------------------------------------------------------ */
  /*  Export                                                            */
  /* ------------------------------------------------------------------ */

  host.__page_snake = { mount: mount, unmount: unmount };

})(window);
