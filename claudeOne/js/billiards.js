/* ===== claudeOne :: billiards.js =====
 * Chinese 8-ball pool — full game with practice mode and AI opponent.
 * Mounted into <template id="page-billiards"> by the SPA router.
 *
 * Coordinate system: world units in centimeters. The play surface is
 * TABLE_W × TABLE_H cm, with a CUSHION-cm visual rail around it. The
 * canvas is sized in CSS px from `pxPerCm`, scaled by devicePixelRatio
 * for crisp rendering.
 */

(function (host) {
  "use strict";

  /* ------------------------------------------------------------------ */
  /*  Constants                                                         */
  /* ------------------------------------------------------------------ */

  // Table & balls (cm)
  var TABLE_W = 254;
  var TABLE_H = 127;
  var CUSHION = 4;
  var BALL_R = 2.86;
  var BALL_D = BALL_R * 2;

  // Pockets
  var POCKET_R_CORNER = 5.0;
  var POCKET_R_SIDE   = 5.4;

  var POCKETS = [
    { x: 0,           y: 0,          r: POCKET_R_CORNER, kind: "corner" },
    { x: TABLE_W,     y: 0,          r: POCKET_R_CORNER, kind: "corner" },
    { x: 0,           y: TABLE_H,    r: POCKET_R_CORNER, kind: "corner" },
    { x: TABLE_W,     y: TABLE_H,    r: POCKET_R_CORNER, kind: "corner" },
    { x: TABLE_W / 2, y: 0,          r: POCKET_R_SIDE,   kind: "side"   },
    { x: TABLE_W / 2, y: TABLE_H,    r: POCKET_R_SIDE,   kind: "side"   }
  ];

  // Physics
  var FRICTION       = 0.992;   // per-substep velocity scalar
  var REST_THRESHOLD = 1.8;     // cm/s; below this, balls freeze
  var MAX_POWER      = 1300;    // cm/s initial cue-ball speed at full draw
  var DT             = 1 / 60;
  var SUBSTEPS       = 6;
  var MAX_FRAME_MS   = 100;

  // Aiming
  var DRAG_MAX_PX = 220;
  var AIM_LINE_LEN_CM = 80;
  var GHOST_GAP   = BALL_D + 0.001;

  // Rack positions
  var FOOT_SPOT = { x: TABLE_W * 0.75, y: TABLE_H / 2 };
  var HEAD_SPOT = { x: TABLE_W * 0.25, y: TABLE_H / 2 };

  // Ball palette (1-7 solid, 8 black, 9-15 stripe — same hue as 1-7 but with white band)
  var BALL_COLORS = {
    1: "#f6c84a", 2: "#3464d6", 3: "#d9462b", 4: "#7a3fb8",
    5: "#e8772b", 6: "#1f8a55", 7: "#7a2a2a", 8: "#0e0e0e",
    9: "#f6c84a", 10: "#3464d6", 11: "#d9462b", 12: "#7a3fb8",
    13: "#e8772b", 14: "#1f8a55", 15: "#7a2a2a"
  };

  // AI tuning
  var AI_THINK_MS_MIN = 650;
  var AI_THINK_MS_MAX = 1150;
  var AI_AIM_MS = 420;
  var AI_ANGLE_NOISE = 0.020;   // ~1.1° stddev
  var AI_POWER_NOISE = 0.10;
  var AI_CUT_LIMIT = 1.31;      // ~75°

  // Modes & players
  var MODE_PRACTICE = "practice";
  var MODE_AI = "ai";
  var P1 = "P1";
  var P2 = "P2";

  // Game states
  var ST_MENU      = "menu";
  var ST_IDLE      = "idle";
  var ST_AIMING    = "aiming";
  var ST_SHOOTING  = "shooting";
  var ST_RESOLVING = "resolving";
  var ST_GAMEOVER  = "gameover";

  /* ------------------------------------------------------------------ */
  /*  State                                                             */
  /* ------------------------------------------------------------------ */

  var els = {};
  var container = null;
  var canvas = null;
  var ctx = null;
  var rafId = null;
  var resizeObserver = null;
  var ac = null; // AbortController for all listeners

  var game = {};

  function defaultGame(mode) {
    return {
      mode: mode,                    // "practice" | "ai"
      state: ST_MENU,                // see ST_*
      balls: [],
      cue: null,
      currentPlayer: P1,
      groups: { P1: null, P2: null }, // null | "solid" | "stripe"
      ballInHand: false,
      ballInHandFor: null,           // "P1" | "P2"
      shotEvents: emptyEvents(),
      winner: null,
      loseReason: null,
      message: "",
      aim: {
        dx: 1, dy: 0,
        pressX: 0, pressY: 0,
        dragX: 0, dragY: 0,
        power: 0,
        active: false,
        hover: false
      },
      hoverWorld: null,              // {x,y} | null — for ball-in-hand preview
      acc: 0,
      lastTime: 0,
      pxPerCm: 3,
      cssW: 0,
      cssH: 0,
      aiThinking: false,
      aiAimingPlan: null,            // {angle, power, ballId, pocketIdx, t0}
      aiTimer: null,
      pendingAITurn: false,
      fullTable: false               // full-board view toggle
    };
  }

  function emptyEvents() {
    return {
      firstHit: null,
      pocketed: [],
      cueBallPocketed: false,
      cushionContactAfterFirstHit: false,
      anyCushionContact: false
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Geometry helpers                                                  */
  /* ------------------------------------------------------------------ */

  function dist(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function distSq(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }

  function len2(x, y) { return Math.sqrt(x * x + y * y); }

  function clamp(n, lo, hi) {
    return n < lo ? lo : (n > hi ? hi : n);
  }

  function gauss(stddev) {
    var u = 1 - Math.random();
    var v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * stddev;
  }

  // Distance from point P to segment AB
  function distPointSeg(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var ll = dx * dx + dy * dy;
    if (ll < 1e-9) return dist(px, py, ax, ay);
    var t = ((px - ax) * dx + (py - ay) * dy) / ll;
    t = clamp(t, 0, 1);
    var qx = ax + t * dx, qy = ay + t * dy;
    return dist(px, py, qx, qy);
  }

  /* ------------------------------------------------------------------ */
  /*  Ball & rack setup                                                 */
  /* ------------------------------------------------------------------ */

  function makeBall(id, x, y) {
    var group;
    if (id === 0) group = "cue";
    else if (id === 8) group = "eight";
    else if (id <= 7) group = "solid";
    else group = "stripe";

    return {
      id: id,
      number: id,
      group: group,
      color: id === 0 ? "#fdfcfa" : BALL_COLORS[id],
      x: x, y: y,
      vx: 0, vy: 0,
      inPlay: true,
      pocketedThisShot: false
    };
  }

  function rackBalls() {
    var balls = [];
    // Cue ball
    balls.push(makeBall(0, HEAD_SPOT.x, HEAD_SPOT.y));

    // Build rack — 5 rows, apex at FOOT_SPOT, extending toward foot rail
    var rowDx = Math.sqrt(3) * BALL_R;
    var slots = [];
    for (var r = 0; r < 5; r++) {
      for (var c = 0; c <= r; c++) {
        slots.push({
          x: FOOT_SPOT.x + r * rowDx,
          y: FOOT_SPOT.y + (c - r / 2) * BALL_D,
          row: r,
          col: c
        });
      }
    }
    // Standard 8-ball: apex (row0,col0) is 1; row2 col1 is 8.
    // Remaining 13 slots get balls 2..7,9..15 in randomized order, but
    // we ensure the two corners of the back row are different groups for
    // a fair break.
    var apexSlot = slots[0];
    var eightSlot = null;
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].row === 2 && slots[i].col === 1) { eightSlot = slots[i]; break; }
    }
    var otherSlots = slots.filter(function (s) { return s !== apexSlot && s !== eightSlot; });

    var pool = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
    shuffle(pool);

    // Find back-row corners and ensure they're different groups (split solid/stripe)
    var backRow = otherSlots.filter(function (s) { return s.row === 4; });
    var backCorners = [backRow[0], backRow[backRow.length - 1]];
    var backInner = backRow.filter(function (s) { return s !== backCorners[0] && s !== backCorners[1]; });

    function isSolid(n) { return n >= 1 && n <= 7; }
    var solids = pool.filter(isSolid);
    var stripes = pool.filter(function (n) { return !isSolid(n); });
    // Place one solid at one corner, one stripe at the other
    var corner1 = solids.shift();
    var corner2 = stripes.shift();
    if (Math.random() < 0.5) {
      balls.push(makeBall(corner1, backCorners[0].x, backCorners[0].y));
      balls.push(makeBall(corner2, backCorners[1].x, backCorners[1].y));
    } else {
      balls.push(makeBall(corner2, backCorners[0].x, backCorners[0].y));
      balls.push(makeBall(corner1, backCorners[1].x, backCorners[1].y));
    }

    // Apex (must be either group)
    var apexBall = (Math.random() < 0.5 ? solids : stripes).shift();
    balls.push(makeBall(apexBall, apexSlot.x, apexSlot.y));

    // 8-ball at center of row 2
    balls.push(makeBall(8, eightSlot.x, eightSlot.y));

    // Fill the remaining slots with whatever's left, shuffled
    var remaining = solids.concat(stripes);
    shuffle(remaining);
    var fillSlots = otherSlots.filter(function (s) {
      return s !== backCorners[0] && s !== backCorners[1] && s !== apexSlot;
    });
    for (var k = 0; k < fillSlots.length; k++) {
      // Guard: never create a phantom ball if the counts ever mismatch.
      if (remaining[k] === undefined) continue;
      balls.push(makeBall(remaining[k], fillSlots[k].x, fillSlots[k].y));
    }

    return balls;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function resetTable() {
    game.balls = rackBalls();
    game.cue = game.balls[0];
    game.shotEvents = emptyEvents();
    game.aim.active = false;
    game.aim.power = 0;
    game.ballInHand = false;
    game.ballInHandFor = null;
  }

  /* ------------------------------------------------------------------ */
  /*  Physics                                                           */
  /* ------------------------------------------------------------------ */

  function inPocketMouth(x, y) {
    for (var i = 0; i < POCKETS.length; i++) {
      var p = POCKETS[i];
      if (distSq(x, y, p.x, p.y) < (p.r + BALL_R) * (p.r + BALL_R)) return true;
    }
    return false;
  }

  function checkPocket(ball) {
    if (!ball.inPlay) return false;
    for (var i = 0; i < POCKETS.length; i++) {
      var p = POCKETS[i];
      if (distSq(ball.x, ball.y, p.x, p.y) < p.r * p.r) {
        ball.inPlay = false;
        ball.vx = 0; ball.vy = 0;
        ball.pocketedThisShot = true;
        game.shotEvents.pocketed.push(ball);
        if (ball.id === 0) game.shotEvents.cueBallPocketed = true;
        return true;
      }
    }
    return false;
  }

  function resolveCushion(ball) {
    if (!ball.inPlay) return;
    // Note: we do NOT skip clamping inside the pocket mouth. checkPocket()
    // runs before this in subStep() and catches any ball whose center is
    // within p.r of a pocket, so balls aimed at a pocket still drop in.
    // Skipping the cushion in the wider mouth zone (p.r+BALL_R) left an
    // annulus where a grazing ball had no wall AND wasn't pocketed, letting
    // it fly off the table. Keeping the clamp means grazing balls bounce
    // off the pocket jaw instead of escaping.
    var bounced = false;
    if (ball.x < BALL_R) {
      ball.x = BALL_R;
      if (ball.vx < 0) { ball.vx = -ball.vx * 0.92; bounced = true; }
    } else if (ball.x > TABLE_W - BALL_R) {
      ball.x = TABLE_W - BALL_R;
      if (ball.vx > 0) { ball.vx = -ball.vx * 0.92; bounced = true; }
    }
    if (ball.y < BALL_R) {
      ball.y = BALL_R;
      if (ball.vy < 0) { ball.vy = -ball.vy * 0.92; bounced = true; }
    } else if (ball.y > TABLE_H - BALL_R) {
      ball.y = TABLE_H - BALL_R;
      if (ball.vy > 0) { ball.vy = -ball.vy * 0.92; bounced = true; }
    }
    if (bounced) {
      game.shotEvents.anyCushionContact = true;
      if (game.shotEvents.firstHit !== null) {
        game.shotEvents.cushionContactAfterFirstHit = true;
      }
    }
  }

  function resolveBallCollision(a, b) {
    if (!a.inPlay || !b.inPlay) return;
    var dx = b.x - a.x, dy = b.y - a.y;
    var d2 = dx * dx + dy * dy;
    if (d2 >= BALL_D * BALL_D || d2 < 1e-9) return;
    var d = Math.sqrt(d2);
    var nx = dx / d, ny = dy / d;
    var overlap = BALL_D - d;
    a.x -= nx * overlap * 0.5;
    a.y -= ny * overlap * 0.5;
    b.x += nx * overlap * 0.5;
    b.y += ny * overlap * 0.5;
    var va = a.vx * nx + a.vy * ny;
    var vb = b.vx * nx + b.vy * ny;
    var dvAlong = vb - va;
    if (dvAlong > 0) return; // separating
    a.vx += dvAlong * nx;
    a.vy += dvAlong * ny;
    b.vx -= dvAlong * nx;
    b.vy -= dvAlong * ny;
    // record first hit (cue ball touches first object ball)
    if (game.shotEvents.firstHit === null) {
      if (a.id === 0 && b.id !== 0) game.shotEvents.firstHit = b;
      else if (b.id === 0 && a.id !== 0) game.shotEvents.firstHit = a;
    }
  }

  function subStep(h) {
    var balls = game.balls;
    // Integrate
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      if (!b.inPlay) continue;
      b.x += b.vx * h;
      b.y += b.vy * h;
    }
    // Check pockets
    for (var i2 = 0; i2 < balls.length; i2++) checkPocket(balls[i2]);
    // Cushions
    for (var i3 = 0; i3 < balls.length; i3++) resolveCushion(balls[i3]);
    // Ball-ball collisions
    for (var i4 = 0; i4 < balls.length; i4++) {
      var a = balls[i4];
      if (!a.inPlay) continue;
      for (var j = i4 + 1; j < balls.length; j++) {
        var c = balls[j];
        if (!c.inPlay) continue;
        resolveBallCollision(a, c);
      }
    }
  }

  function applyFriction() {
    var balls = game.balls;
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      if (!b.inPlay) continue;
      b.vx *= FRICTION;
      b.vy *= FRICTION;
      if (len2(b.vx, b.vy) < REST_THRESHOLD) {
        b.vx = 0; b.vy = 0;
      }
    }
  }

  function stepPhysics(dt) {
    var subDt = dt / SUBSTEPS;
    for (var s = 0; s < SUBSTEPS; s++) {
      subStep(subDt);
      applyFriction();
    }
  }

  function allStopped() {
    var balls = game.balls;
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      if (!b.inPlay) continue;
      if (b.vx !== 0 || b.vy !== 0) return false;
    }
    return true;
  }

  /* ------------------------------------------------------------------ */
  /*  Rules engine                                                      */
  /* ------------------------------------------------------------------ */

  function legalTargetGroupOf(player) {
    var g = game.groups[player];
    if (g === null) return "any";    // open table
    // If own group balls remain in play, target = own group; else target = eight
    if (countByGroup(g) > 0) return g;
    return "eight";
  }

  function countByGroup(group) {
    var n = 0;
    for (var i = 0; i < game.balls.length; i++) {
      var b = game.balls[i];
      if (b.inPlay && b.group === group) n++;
    }
    return n;
  }

  function pocketedThisTurnByGroup(group) {
    var n = 0;
    for (var i = 0; i < game.shotEvents.pocketed.length; i++) {
      if (game.shotEvents.pocketed[i].group === group) n++;
    }
    return n;
  }

  function resolveShot() {
    var ev = game.shotEvents;
    var player = game.currentPlayer;
    var opponent = (player === P1) ? P2 : P1;
    var target = legalTargetGroupOf(player);

    var foul = false;
    var foulReason = null;

    // 1) White potted
    if (ev.cueBallPocketed) {
      foul = true;
      foulReason = "白球进袋";
    }

    // 2) No first contact
    if (!ev.firstHit) {
      if (!foul) { foul = true; foulReason = "白球没有击中任何球"; }
    } else {
      // 3) Hit wrong group first
      var hitG = ev.firstHit.group;
      if (target === "eight" && hitG !== "eight") {
        if (!foul) { foul = true; foulReason = "应先击打 8 号球"; }
      } else if (target !== "any" && target !== "eight") {
        if (hitG !== target) {
          if (!foul) { foul = true; foulReason = "白球先撞到了不属于你的球"; }
        }
      }
    }

    // 4) No cushion / no pot rule (after a contact happened)
    if (!foul && ev.firstHit && ev.pocketed.length === 0 && !ev.anyCushionContact) {
      foul = true;
      foulReason = "击球后没有进球，也没有任何球碰到桌边";
    }

    // 5) Determine win/lose around the 8-ball
    var winner = null;
    var loseReason = null;
    var pottedEight = false;
    for (var i = 0; i < ev.pocketed.length; i++) {
      if (ev.pocketed[i].id === 8) { pottedEight = true; break; }
    }

    if (pottedEight) {
      var ownLeftBeforeShot = countByGroupBeforeShot(player);
      // (we use pre-shot count: countByGroup currently reflects POST-shot,
      // but pocketed-this-shot for own group adds back to the pre-count)
      if (game.groups[player] === null) {
        // potted 8 on a break / open-table — illegal in Chinese 8-ball
        loseReason = "提前打进了 8 号球";
        winner = opponent;
      } else if (ownLeftBeforeShot > 0) {
        loseReason = "自己的球还没打完就打进了 8 号";
        winner = opponent;
      } else if (ev.cueBallPocketed) {
        loseReason = "打 8 号时白球同时进袋";
        winner = opponent;
      } else {
        winner = player;
      }
    }

    // 6) Open-table assignment when a non-8 ball was legally pocketed
    var assignGroup = null;
    if (!foul && game.groups[player] === null && !pottedEight) {
      var solidPotted = pocketedThisTurnByGroup("solid");
      var stripePotted = pocketedThisTurnByGroup("stripe");
      // Assign by what was pocketed this shot (if both, prefer the firstHit's group)
      if (solidPotted > 0 && stripePotted === 0) assignGroup = "solid";
      else if (stripePotted > 0 && solidPotted === 0) assignGroup = "stripe";
      else if (solidPotted > 0 && stripePotted > 0) {
        assignGroup = ev.firstHit ? ev.firstHit.group : "solid";
        if (assignGroup === "eight" || assignGroup === "cue") assignGroup = "solid";
      }
    }

    // 7) Continue turn?
    var ownPotted = 0;
    if (game.groups[player]) {
      ownPotted = pocketedThisTurnByGroup(game.groups[player]);
    } else if (assignGroup) {
      ownPotted = pocketedThisTurnByGroup(assignGroup);
    }
    var continueTurn = !foul && !winner && (ownPotted > 0 || (target === "eight" && pottedEight && !winner));

    return {
      foul: foul,
      foulReason: foulReason,
      assignGroup: assignGroup,
      continueTurn: continueTurn,
      winner: winner,
      loseReason: loseReason,
      pottedEight: pottedEight
    };
  }

  // Count balls of a player's group that were in play BEFORE the shot
  // (= currently inPlay + pocketed this shot in that group).
  function countByGroupBeforeShot(player) {
    var g = game.groups[player];
    if (!g) return 0;
    var n = 0;
    for (var i = 0; i < game.balls.length; i++) {
      var b = game.balls[i];
      if (b.group !== g) continue;
      if (b.inPlay || b.pocketedThisShot) n++;
    }
    return n;
  }

  /* ------------------------------------------------------------------ */
  /*  Turn flow                                                         */
  /* ------------------------------------------------------------------ */

  function beginShot(angle, power) {
    if (!game.cue || !game.cue.inPlay) return;
    // Reset pocketedThisShot flags
    for (var i = 0; i < game.balls.length; i++) game.balls[i].pocketedThisShot = false;
    game.shotEvents = emptyEvents();
    var speed = power * MAX_POWER;
    game.cue.vx = Math.cos(angle) * speed;
    game.cue.vy = Math.sin(angle) * speed;
    game.state = ST_SHOOTING;
    game.aim.active = false;
    game.aim.power = 0;
    setMessage("击球！", "");
    updateUI();
  }

  function resolveTurnEnd() {
    if (game.mode === MODE_PRACTICE) {
      // Practice: just respawn cue if it was pocketed; no rules
      if (game.shotEvents.cueBallPocketed) respawnCueAtHead();
      game.state = ST_IDLE;
      setMessage('继续练习。可点击右侧"重新摆球"复位。', "");
      updateUI();
      return;
    }

    var res = resolveShot();
    var player = game.currentPlayer;
    var opponent = (player === P1) ? P2 : P1;

    // Apply group assignments
    if (res.assignGroup) {
      game.groups[player] = res.assignGroup;
      game.groups[opponent] = (res.assignGroup === "solid") ? "stripe" : "solid";
    }

    // Win / lose
    if (res.winner) {
      game.winner = res.winner;
      game.loseReason = res.loseReason;
      game.state = ST_GAMEOVER;
      var won = res.winner === P1;
      var title = won ? "你赢了！" : "本局失利";
      var kicker = won ? "Victory" : "Defeat";
      var text = res.loseReason
        ? (won ? "对手判负：" + res.loseReason + "。" : "原因：" + res.loseReason + "。")
        : (won ? "合法将 8 号球收入袋中，恭喜！" : "对手赢得本局。");
      showOverlay(kicker, title, text, [
        { label: "再来一局", primary: true, action: function () { newGame(game.mode); } },
        { label: "切换模式", primary: false, action: function () { backToMenu(); } }
      ]);
      updateUI();
      return;
    }

    // Foul → ball-in-hand for opponent; respawn cue if it was potted
    if (res.foul) {
      if (game.shotEvents.cueBallPocketed) respawnCueAtHead();
      game.ballInHand = true;
      game.ballInHandFor = opponent;
      game.currentPlayer = opponent;
      setMessage("犯规：" + res.foulReason + "。对手获得自由摆球。", "warn");
    } else if (!res.continueTurn) {
      game.currentPlayer = opponent;
      setMessage(player === P1 ? "玩家这一杆没有合法进球，换对手出杆。" : "对手这一杆没有合法进球，轮到你。", "");
    } else {
      var pottedDesc = describePocketed(res);
      setMessage(player === P1 ? "进球！继续出杆。" + pottedDesc : "对手进球，继续出杆。" + pottedDesc, "ok");
    }

    game.state = ST_IDLE;
    updateUI();

    // If next is AI, schedule its turn
    if (game.mode === MODE_AI && game.currentPlayer === P2 && game.state === ST_IDLE) {
      scheduleAITurn();
    }
  }

  function describePocketed(res) {
    var labels = [];
    var ev = game.shotEvents;
    for (var i = 0; i < ev.pocketed.length; i++) {
      var b = ev.pocketed[i];
      if (b.id === 0) continue;
      labels.push(b.number + "号");
    }
    if (!labels.length) return "";
    return "（进袋：" + labels.join("、") + "）";
  }

  function respawnCueAtHead() {
    if (!game.cue) return;
    game.cue.inPlay = true;
    game.cue.vx = 0; game.cue.vy = 0;
    // Try to place at HEAD_SPOT, otherwise nudge
    var px = HEAD_SPOT.x, py = HEAD_SPOT.y;
    if (overlapsAnyBall(px, py, game.cue)) {
      // Search a few alternates along head string
      for (var off = 6; off < 60; off += 4) {
        if (!overlapsAnyBall(px, py + off, game.cue)) { py += off; break; }
        if (!overlapsAnyBall(px, py - off, game.cue)) { py -= off; break; }
      }
    }
    game.cue.x = px;
    game.cue.y = py;
  }

  function overlapsAnyBall(x, y, except) {
    for (var i = 0; i < game.balls.length; i++) {
      var b = game.balls[i];
      if (b === except || !b.inPlay) continue;
      if (distSq(x, y, b.x, b.y) < BALL_D * BALL_D) return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------ */
  /*  AI                                                                */
  /* ------------------------------------------------------------------ */

  function aiPlanShot() {
    var cue = game.cue;
    if (!cue || !cue.inPlay) return null;
    var target = legalTargetGroupOf(P2);
    var candidates = [];
    var balls = game.balls;
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      if (!b.inPlay || b.id === 0) continue;
      if (target === "eight" && b.group !== "eight") continue;
      if ((target === "solid" || target === "stripe") && b.group !== target) continue;
      // open table: any non-8 ball
      if (target === "any" && b.group === "eight") continue;
      candidates.push(b);
    }

    var bestShot = null;
    var bestScore = -Infinity;

    for (var ci = 0; ci < candidates.length; ci++) {
      var ob = candidates[ci];
      for (var pi = 0; pi < POCKETS.length; pi++) {
        var pk = POCKETS[pi];
        // Ghost ball: position cue must drive object ball through
        var dxp = pk.x - ob.x, dyp = pk.y - ob.y;
        var lp = Math.sqrt(dxp * dxp + dyp * dyp);
        if (lp < 1e-6) continue;
        var ux = dxp / lp, uy = dyp / lp;
        var ghost = { x: ob.x - ux * GHOST_GAP, y: ob.y - uy * GHOST_GAP };

        // Cue → ghost vector
        var cgx = ghost.x - cue.x, cgy = ghost.y - cue.y;
        var lcg = Math.sqrt(cgx * cgx + cgy * cgy);
        if (lcg < 1e-6) continue;
        var dirX = cgx / lcg, dirY = cgy / lcg;

        // Cut angle: between (cue→ghost) and (ghost→pocket)
        var dot = dirX * ux + dirY * uy;
        dot = clamp(dot, -1, 1);
        var cut = Math.acos(dot);
        if (cut > AI_CUT_LIMIT) continue;

        // Geometry: cue ball must reach ghost without being blocked
        if (raycastBlocked(cue.x, cue.y, ghost.x, ghost.y, [cue.id, ob.id])) continue;
        // Object ball path to pocket must be clear (allow other own group? still skip)
        if (raycastBlocked(ob.x, ob.y, pk.x, pk.y, [cue.id, ob.id])) continue;

        // Check: pocket center beyond pocket throat — ball can fall in (already true)
        // Score: prefer small cut, short cue->ghost distance, short ghost->pocket
        var distScore = (lcg + lp);
        var score = -cut * 100 - distScore * 0.5;
        // 8-ball phase bonus to prefer 8 ball (only candidate anyway)
        if (target === "eight") score += 5;

        if (score > bestScore) {
          bestScore = score;
          // Power: scale with distances; longer distances need more power
          var rawPower = clamp(0.32 + (distScore / 380), 0.32, 0.92);
          // angle: from cue to ghost
          var ang = Math.atan2(dirY, dirX);
          bestShot = {
            ballId: ob.id,
            pocketIdx: pi,
            angle: ang,
            power: rawPower,
            cut: cut,
            ghost: ghost
          };
        }
      }
    }

    if (bestShot) {
      // Add noise
      bestShot.angle += gauss(AI_ANGLE_NOISE);
      bestShot.power *= (1 + gauss(AI_POWER_NOISE));
      bestShot.power = clamp(bestShot.power, 0.18, 1);
      return bestShot;
    }

    // Fallback: safety — hit any reachable own-group ball softly
    var safetyTarget = candidates.length ? candidates[0] : null;
    // pick whichever object ball is closest to cue and has clear line
    var bestDist = Infinity;
    for (var k = 0; k < candidates.length; k++) {
      var c = candidates[k];
      var d = dist(cue.x, cue.y, c.x, c.y);
      if (d < bestDist && !raycastBlocked(cue.x, cue.y, c.x, c.y, [cue.id, c.id])) {
        bestDist = d; safetyTarget = c;
      }
    }
    if (safetyTarget) {
      var ang2 = Math.atan2(safetyTarget.y - cue.y, safetyTarget.x - cue.x);
      ang2 += gauss(AI_ANGLE_NOISE * 1.4);
      return { ballId: safetyTarget.id, pocketIdx: -1, angle: ang2, power: 0.36, cut: 0, ghost: null };
    }

    // Last resort: random direction at low power
    return { ballId: -1, pocketIdx: -1, angle: Math.random() * Math.PI * 2, power: 0.30, cut: 0, ghost: null };
  }

  function raycastBlocked(ax, ay, bx, by, exceptIds) {
    var balls = game.balls;
    var threshold = BALL_R + BALL_R - 0.05;
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      if (!b.inPlay) continue;
      if (exceptIds && exceptIds.indexOf(b.id) !== -1) continue;
      if (distPointSeg(b.x, b.y, ax, ay, bx, by) < threshold) return true;
    }
    return false;
  }

  function scheduleAITurn() {
    if (game.aiTimer) {
      clearTimeout(game.aiTimer);
      game.aiTimer = null;
    }
    game.aiThinking = true;
    setMessage("AI 正在瞄准…", "");
    if (els.thinking) els.thinking.hidden = false;
    var delay = AI_THINK_MS_MIN + Math.floor(Math.random() * (AI_THINK_MS_MAX - AI_THINK_MS_MIN));
    game.aiTimer = setTimeout(function () {
      game.aiTimer = null;
      if (!container || !canvas) return;
      runAITurn();
    }, delay);
  }

  function runAITurn() {
    if (game.state !== ST_IDLE) return;
    // If AI has ball-in-hand, place cue at HEAD_SPOT (or nudge)
    if (game.ballInHand && game.ballInHandFor === P2) {
      respawnCueAtHead();
      game.ballInHand = false;
      game.ballInHandFor = null;
    }
    var plan = aiPlanShot();
    if (!plan) {
      game.aiThinking = false;
      if (els.thinking) els.thinking.hidden = true;
      setMessage("AI 找不到可行击球，放弃。", "warn");
      // switch to player
      game.currentPlayer = P1;
      updateUI();
      return;
    }
    game.aiAimingPlan = plan;
    game.aiAimingPlan.t0 = performance.now();
    // Wait for AI_AIM_MS to give a visible aim, then fire
    game.aiTimer = setTimeout(function () {
      game.aiTimer = null;
      game.aiThinking = false;
      if (els.thinking) els.thinking.hidden = true;
      var p = game.aiAimingPlan;
      game.aiAimingPlan = null;
      if (!p) return;
      beginShot(p.angle, p.power);
    }, AI_AIM_MS);
  }

  /* ------------------------------------------------------------------ */
  /*  Aim preview (ghost-ball trace from cue along aim direction)       */
  /* ------------------------------------------------------------------ */

  function traceAim(originX, originY, dx, dy) {
    // Returns {endX,endY, hit: ball|null, hitPoint:{x,y}|null}
    var balls = game.balls;
    var bestT = AIM_LINE_LEN_CM;
    var hitBall = null;
    var endX = originX + dx * bestT;
    var endY = originY + dy * bestT;

    // Check ball intersections
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      if (!b.inPlay || b.id === 0) continue;
      var t = raySphere(originX, originY, dx, dy, b.x, b.y, BALL_D);
      if (t !== null && t < bestT && t > 0) {
        bestT = t;
        hitBall = b;
      }
    }

    // Check cushions (only x=0, x=TABLE_W, y=0, y=TABLE_H)
    var walls = [
      { dir: "x", val: BALL_R, normal: [1, 0] },
      { dir: "x", val: TABLE_W - BALL_R, normal: [-1, 0] },
      { dir: "y", val: BALL_R, normal: [0, 1] },
      { dir: "y", val: TABLE_H - BALL_R, normal: [0, -1] }
    ];
    for (var w = 0; w < walls.length; w++) {
      var ww = walls[w];
      var tw = null;
      if (ww.dir === "x") {
        if (Math.abs(dx) < 1e-6) continue;
        tw = (ww.val - originX) / dx;
      } else {
        if (Math.abs(dy) < 1e-6) continue;
        tw = (ww.val - originY) / dy;
      }
      if (tw !== null && tw > 0 && tw < bestT) {
        var ix = originX + dx * tw;
        var iy = originY + dy * tw;
        // Treat as hit only if not in pocket mouth (so the line shows
        // entering the pocket as a "miss-into-pocket" rather than a bounce)
        if (!inPocketMouth(ix, iy)) {
          bestT = tw;
          hitBall = null;
          endX = ix; endY = iy;
        }
      }
    }

    if (hitBall) {
      endX = originX + dx * bestT;
      endY = originY + dy * bestT;
    } else if (bestT >= AIM_LINE_LEN_CM) {
      endX = originX + dx * AIM_LINE_LEN_CM;
      endY = originY + dy * AIM_LINE_LEN_CM;
    }
    return { endX: endX, endY: endY, hit: hitBall };
  }

  // Ray-sphere intersection: ray (ox,oy)+t*(dx,dy), sphere center (sx,sy) radius rr.
  // Returns smallest t > 0 or null.
  function raySphere(ox, oy, dx, dy, sx, sy, rr) {
    var ex = ox - sx, ey = oy - sy;
    var a = dx * dx + dy * dy; // ~1 if normalized
    var bb = 2 * (ex * dx + ey * dy);
    var c = ex * ex + ey * ey - rr * rr;
    var disc = bb * bb - 4 * a * c;
    if (disc < 0) return null;
    var sq = Math.sqrt(disc);
    var t1 = (-bb - sq) / (2 * a);
    var t2 = (-bb + sq) / (2 * a);
    if (t1 > 1e-4) return t1;
    if (t2 > 1e-4) return t2;
    return null;
  }

  /* ------------------------------------------------------------------ */
  /*  Input                                                             */
  /* ------------------------------------------------------------------ */

  function pixelToWorld(px, py) {
    var rect = canvas.getBoundingClientRect();
    var localX = px - rect.left;
    var localY = py - rect.top;
    var pxPerCm = game.pxPerCm;
    var wx = localX / pxPerCm - CUSHION;
    var wy = localY / pxPerCm - CUSHION;
    return { x: wx, y: wy };
  }

  function isHumanTurnReady() {
    if (game.state !== ST_IDLE) return false;
    if (game.aiThinking) return false;
    if (game.mode === MODE_AI && game.currentPlayer !== P1) return false;
    if (!game.cue || !game.cue.inPlay) return false;
    return true;
  }

  function onPointerDown(e) {
    if (!isHumanTurnReady()) return;
    if (e.target !== canvas) return;
    var w = pixelToWorld(e.clientX, e.clientY);

    if (game.ballInHand && (game.mode === MODE_PRACTICE || game.ballInHandFor === P1)) {
      // Place cue at click position if valid
      if (w.x >= BALL_R && w.x <= TABLE_W - BALL_R && w.y >= BALL_R && w.y <= TABLE_H - BALL_R
          && !overlapsAnyBall(w.x, w.y, game.cue) && !inPocketMouth(w.x, w.y)) {
        game.cue.x = w.x;
        game.cue.y = w.y;
        game.ballInHand = false;
        game.ballInHandFor = null;
        game.hoverWorld = null;
        setMessage("白球已放置。瞄准并按住拖动击球。", "");
        updateUI();
      } else {
        setMessage("不能放在这里——请选择空位。", "warn");
        updateUI();
      }
      e.preventDefault();
      return;
    }

    // Begin aim drag
    game.aim.active = true;
    game.aim.pressX = e.clientX;
    game.aim.pressY = e.clientY;
    game.aim.dragX = e.clientX;
    game.aim.dragY = e.clientY;
    // Direction = cue → press world point
    var ddx = w.x - game.cue.x;
    var ddy = w.y - game.cue.y;
    var dl = Math.sqrt(ddx * ddx + ddy * ddy);
    if (dl > 1e-3) {
      game.aim.dx = ddx / dl;
      game.aim.dy = ddy / dl;
    }
    game.aim.power = 0;
    game.state = ST_AIMING;
    if (els.powerWrap) els.powerWrap.hidden = false;
    if (canvas.setPointerCapture && e.pointerId !== undefined) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
    e.preventDefault();
  }

  function onPointerMove(e) {
    // Hover aim while idle (no buttons pressed)
    if (game.state === ST_IDLE && isHumanTurnReady() && !game.ballInHand) {
      var w0 = pixelToWorld(e.clientX, e.clientY);
      var dx0 = w0.x - game.cue.x;
      var dy0 = w0.y - game.cue.y;
      var l0 = Math.sqrt(dx0 * dx0 + dy0 * dy0);
      if (l0 > 1e-3) {
        game.aim.dx = dx0 / l0;
        game.aim.dy = dy0 / l0;
        game.aim.hover = true;
      }
      return;
    }
    if (game.ballInHand && (game.mode === MODE_PRACTICE || game.ballInHandFor === P1)) {
      game.hoverWorld = pixelToWorld(e.clientX, e.clientY);
      return;
    }
    if (game.state !== ST_AIMING) return;
    game.aim.dragX = e.clientX;
    game.aim.dragY = e.clientY;
    var dx = e.clientX - game.aim.pressX;
    var dy = e.clientY - game.aim.pressY;
    var len = Math.sqrt(dx * dx + dy * dy);
    game.aim.power = clamp(len / DRAG_MAX_PX, 0, 1);
    if (els.powerFill) els.powerFill.style.width = (game.aim.power * 100).toFixed(1) + "%";
    if (els.powerLabel) els.powerLabel.textContent = "力度 " + Math.round(game.aim.power * 100) + "%";
  }

  function onPointerUp(e) {
    if (game.state !== ST_AIMING) return;
    var p = game.aim.power;
    game.aim.active = false;
    if (els.powerWrap) els.powerWrap.hidden = true;
    if (p < 0.05) {
      // cancelled
      game.state = ST_IDLE;
      setMessage("击球已取消。再试一次。", "");
      updateUI();
      return;
    }
    var ang = Math.atan2(game.aim.dy, game.aim.dx);
    beginShot(ang, p);
  }

  function onPointerLeave() {
    game.aim.hover = false;
    game.hoverWorld = null;
  }

  function bindInput() {
    var sig = ac.signal;
    canvas.addEventListener("pointerdown", onPointerDown, { signal: sig });
    canvas.addEventListener("pointermove", onPointerMove, { signal: sig });
    canvas.addEventListener("pointerup", onPointerUp, { signal: sig });
    canvas.addEventListener("pointercancel", onPointerUp, { signal: sig });
    canvas.addEventListener("pointerleave", onPointerLeave, { signal: sig });
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); }, { signal: sig });
  }

  /* ------------------------------------------------------------------ */
  /*  Rendering                                                         */
  /* ------------------------------------------------------------------ */

  function resizeCanvas() {
    if (!canvas) return;
    var parent = canvas.parentElement;
    var rect = parent.getBoundingClientRect();
    // Read the wrap's actual padding so we never overflow it (wrap has overflow:hidden)
    var cs = window.getComputedStyle(parent);
    var padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    var padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    var availW = Math.max(280, rect.width - padX - 4);

    var full = !!game.fullTable;
    // Vertical budget — much taller in full-board mode, capped by viewport
    var maxH = full
      ? Math.max(360, window.innerHeight * 0.86 - 40)
      : Math.min(window.innerHeight * 0.78, 720);
    maxH = Math.max(240, maxH - padY);

    var pxPerCmW = availW / (TABLE_W + 2 * CUSHION);
    var pxPerCmH = maxH / (TABLE_H + 2 * CUSHION);
    // Never exceed the measured fit (cssW ≤ availW, cssH ≤ maxH) so the
    // canvas can't overflow the wrap even if the first-paint rect is stale.
    // capHi just bounds it on huge screens.
    var capHi = full ? 8.5 : 6.0;
    var pxPerCm = Math.min(pxPerCmW, pxPerCmH, capHi);

    var cssW = (TABLE_W + 2 * CUSHION) * pxPerCm;
    var cssH = (TABLE_H + 2 * CUSHION) * pxPerCm;
    var dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    game.pxPerCm = pxPerCm;
    game.cssW = cssW;
    game.cssH = cssH;
  }

  function w2pX(wx) { return (wx + CUSHION) * game.pxPerCm; }
  function w2pY(wy) { return (wy + CUSHION) * game.pxPerCm; }
  function w2pR(wr) { return wr * game.pxPerCm; }

  function render() {
    if (!ctx || !canvas) return;
    var W = game.cssW, H = game.cssH;
    ctx.clearRect(0, 0, W, H);

    drawTable();
    drawPockets();
    drawSpots();
    drawBalls();

    // Aim preview (only when human turn, not shooting)
    if (game.mode === MODE_AI && game.currentPlayer === P2 && game.aiAimingPlan) {
      drawAIAim();
    } else if (game.state === ST_AIMING || (game.state === ST_IDLE && game.aim.hover && !game.ballInHand && isHumanTurnReady())) {
      drawAimPreview();
    }

    if (game.ballInHand && (game.mode === MODE_PRACTICE || game.ballInHandFor === P1) && game.hoverWorld) {
      drawCueGhost(game.hoverWorld.x, game.hoverWorld.y);
    }
  }

  function drawTable() {
    var W = game.cssW, H = game.cssH;
    var pxPerCm = game.pxPerCm;
    // Outer rail
    ctx.fillStyle = "#3a2716";
    roundRect(0, 0, W, H, 14 * pxPerCm * 0.5);
    ctx.fill();

    // Inner rail (lighter wood)
    ctx.fillStyle = "#5a3a1f";
    var innerInset = CUSHION * 0.35 * pxPerCm;
    roundRect(innerInset, innerInset, W - 2 * innerInset, H - 2 * innerInset, 10);
    ctx.fill();

    // Felt
    ctx.fillStyle = "#1f7a4f";
    var fx = w2pX(0), fy = w2pY(0);
    var fw = TABLE_W * pxPerCm, fh = TABLE_H * pxPerCm;
    ctx.fillRect(fx, fy, fw, fh);

    // Soft shading
    var grad = ctx.createRadialGradient(fx + fw / 2, fy + fh / 2, 0, fx + fw / 2, fy + fh / 2, Math.max(fw, fh) * 0.65);
    grad.addColorStop(0, "rgba(255,255,255,0.06)");
    grad.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = grad;
    ctx.fillRect(fx, fy, fw, fh);
  }

  function drawPockets() {
    var pxPerCm = game.pxPerCm;
    for (var i = 0; i < POCKETS.length; i++) {
      var p = POCKETS[i];
      var px = w2pX(p.x), py = w2pY(p.y);
      var pr = w2pR(p.r);
      // Pocket hole
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = "#080604";
      ctx.fill();
      // Subtle ring highlight
      ctx.beginPath();
      ctx.arc(px, py, pr - 1, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawSpots() {
    // Foot spot and head string
    var pxPerCm = game.pxPerCm;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    var fs = w2pX(FOOT_SPOT.x), fy = w2pY(FOOT_SPOT.y);
    ctx.beginPath();
    ctx.arc(fs, fy, 1.6, 0, Math.PI * 2);
    ctx.fill();
    var hs = w2pX(HEAD_SPOT.x), hy = w2pY(HEAD_SPOT.y);
    ctx.beginPath();
    ctx.arc(hs, hy, 1.6, 0, Math.PI * 2);
    ctx.fill();
    // Head string (vertical)
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hs, w2pY(0));
    ctx.lineTo(hs, w2pY(TABLE_H));
    ctx.stroke();
    ctx.restore();
  }

  function drawBalls() {
    for (var i = 0; i < game.balls.length; i++) {
      var b = game.balls[i];
      if (!b.inPlay) continue;
      drawBall(b);
    }
  }

  function drawBall(b) {
    var px = w2pX(b.x), py = w2pY(b.y);
    var pr = w2pR(BALL_R);

    // shadow
    ctx.beginPath();
    ctx.ellipse(px + 1.4, py + 1.6, pr * 1.05, pr * 0.85, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    ctx.fill();

    // base color
    if (b.id === 0) {
      // white cue
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = "#fdfcfa";
      ctx.fill();
    } else if (b.group === "stripe") {
      // white sphere with colored band
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = "#fefdf6";
      ctx.fill();
      // colored band
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = b.color;
      ctx.fillRect(px - pr, py - pr * 0.55, pr * 2, pr * 1.1);
      ctx.restore();
    } else {
      // solid (or 8-ball)
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
    }

    // glossy highlight
    var hg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.45, 0, px - pr * 0.4, py - pr * 0.45, pr * 0.9);
    hg.addColorStop(0, "rgba(255,255,255,0.55)");
    hg.addColorStop(0.5, "rgba(255,255,255,0.10)");
    hg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fillStyle = hg;
    ctx.fill();

    // outline
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,0,0,0.32)";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // number circle (skip for cue)
    if (b.id !== 0) {
      var nr = pr * 0.45;
      ctx.beginPath();
      ctx.arc(px, py, nr, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.fillStyle = "#181818";
      ctx.font = "700 " + (nr * 1.15).toFixed(1) + "px Manrope, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(b.number), px, py + 0.4);
    }
  }

  function drawAimPreview() {
    if (!game.cue || !game.cue.inPlay) return;
    var dx = game.aim.dx, dy = game.aim.dy;
    var trace = traceAim(game.cue.x, game.cue.y, dx, dy);
    var startPx = w2pX(game.cue.x), startPy = w2pY(game.cue.y);
    var endPx = w2pX(trace.endX), endPy = w2pY(trace.endY);

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(startPx, startPy);
    ctx.lineTo(endPx, endPy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    if (trace.hit) {
      // ghost ball at end
      ctx.save();
      ctx.beginPath();
      ctx.arc(endPx, endPy, w2pR(BALL_R), 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Predict object ball direction line
      var ob = trace.hit;
      var dirX = ob.x - trace.endX;
      var dirY = ob.y - trace.endY;
      var ll = Math.sqrt(dirX * dirX + dirY * dirY);
      if (ll > 1e-3) {
        dirX /= ll; dirY /= ll;
        var tx = ob.x + dirX * 18;
        var ty = ob.y + dirY * 18;
        ctx.beginPath();
        ctx.moveTo(w2pX(ob.x), w2pY(ob.y));
        ctx.lineTo(w2pX(tx), w2pY(ty));
        ctx.strokeStyle = "rgba(255, 230, 120, 0.75)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Cue stick (drawn behind cue ball, length proportional to power)
    if (game.state === ST_AIMING && game.aim.power > 0) {
      var pull = (16 + game.aim.power * 80); // cm pull-back
      var stickLen = 110;
      var sx = game.cue.x - dx * (BALL_R + pull);
      var sy = game.cue.y - dy * (BALL_R + pull);
      var ex = sx - dx * stickLen;
      var ey = sy - dy * stickLen;
      ctx.save();
      ctx.lineCap = "round";
      // shaft
      ctx.strokeStyle = "#d3a26a";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(w2pX(sx), w2pY(sy));
      ctx.lineTo(w2pX(ex), w2pY(ey));
      ctx.stroke();
      // tip
      ctx.strokeStyle = "#3a3a3a";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(w2pX(sx), w2pY(sy));
      ctx.lineTo(w2pX(sx + dx * (-3)), w2pY(sy + dy * (-3)));
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawAIAim() {
    if (!game.cue || !game.aiAimingPlan) return;
    var p = game.aiAimingPlan;
    var dx = Math.cos(p.angle), dy = Math.sin(p.angle);
    var trace = traceAim(game.cue.x, game.cue.y, dx, dy);
    var startPx = w2pX(game.cue.x), startPy = w2pY(game.cue.y);
    var endPx = w2pX(trace.endX), endPy = w2pY(trace.endY);

    ctx.save();
    ctx.strokeStyle = "rgba(255, 200, 110, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(startPx, startPy);
    ctx.lineTo(endPx, endPy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // animated cue stick — pull-back grows over AI_AIM_MS
    var t = clamp((performance.now() - p.t0) / AI_AIM_MS, 0, 1);
    var pull = 16 + p.power * 80 * t;
    var stickLen = 110;
    var sx = game.cue.x - dx * (BALL_R + pull);
    var sy = game.cue.y - dy * (BALL_R + pull);
    var ex = sx - dx * stickLen;
    var ey = sy - dy * stickLen;
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "#d3a26a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w2pX(sx), w2pY(sy));
    ctx.lineTo(w2pX(ex), w2pY(ey));
    ctx.stroke();
    ctx.restore();
  }

  function drawCueGhost(wx, wy) {
    var px = w2pX(wx), py = w2pY(wy);
    var pr = w2pR(BALL_R);
    var ok = wx >= BALL_R && wx <= TABLE_W - BALL_R && wy >= BALL_R && wy <= TABLE_H - BALL_R
             && !overlapsAnyBall(wx, wy, game.cue) && !inPocketMouth(wx, wy);
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fillStyle = ok ? "rgba(255,255,255,0.55)" : "rgba(255,80,80,0.45)";
    ctx.fill();
    ctx.strokeStyle = ok ? "rgba(255,255,255,0.85)" : "rgba(255,80,80,0.85)";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
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

  /* ------------------------------------------------------------------ */
  /*  UI sync                                                           */
  /* ------------------------------------------------------------------ */

  function setMessage(text, tone) {
    game.message = text;
    if (els.message) {
      els.message.textContent = text;
      if (tone) els.message.setAttribute("data-tone", tone);
      else els.message.removeAttribute("data-tone");
    }
  }

  function updateUI() {
    var p1g = game.groups.P1;
    var p2g = game.groups.P2;
    var p1Label = groupLabel(p1g);
    var p2Label = groupLabel(p2g);
    var p1Remaining = p1g ? countByGroup(p1g) : 7;
    var p2Remaining = p2g ? countByGroup(p2g) : 7;

    if (els.p1Group) els.p1Group.textContent = p1Label;
    if (els.p2Group) els.p2Group.textContent = p2Label;
    if (els.p1Detail) els.p1Detail.textContent = p1Label + (p1g ? "（剩余 " + p1Remaining + "）" : "");
    if (els.p2Detail) els.p2Detail.textContent = p2Label + (p2g ? "（剩余 " + p2Remaining + "）" : "");
    if (els.p1Remaining) els.p1Remaining.textContent = p1Remaining;
    if (els.p2Remaining) els.p2Remaining.textContent = p2Remaining;

    var turnLabel = (game.mode === MODE_PRACTICE)
      ? "练习"
      : (game.currentPlayer === P1 ? "玩家" : "AI");
    if (els.turn) els.turn.textContent = turnLabel;
    if (els.turnDetail) els.turnDetail.textContent = turnLabel
      + (game.ballInHand ? "（自由摆球中）" : "");

    var phase = "—";
    if (game.mode === MODE_AI) {
      if (game.winner) phase = game.winner === P1 ? "胜利" : "失败";
      else if (game.groups.P1 && countByGroup(game.groups.P1) === 0) phase = "玩家打 8 号";
      else if (game.groups.P2 && countByGroup(game.groups.P2) === 0) phase = "对手打 8 号";
      else if (!game.groups.P1 && !game.groups.P2) phase = "开放台";
      else phase = (game.groups.P1 === "solid" ? "玩家全色" : "玩家花色");
    } else {
      phase = "练习";
    }
    if (els.phase) els.phase.textContent = phase;

    var modeLabelText = game.mode === MODE_PRACTICE ? "单人练习" : "人机对战";
    if (els.modeLabel) els.modeLabel.textContent = modeLabelText;
    if (els.modeDesc) {
      els.modeDesc.textContent = game.mode === MODE_PRACTICE
        ? '练习模式：不计胜负也不判犯规。可随时点"重新摆球"复位。'
        : '人机对战：玩家先手开球，规则按中式八球执行，犯规对方"自由摆球"。';
    }

    if (els.rerack) {
      var rerackDisabled = game.mode !== MODE_PRACTICE || game.state === ST_MENU;
      els.rerack.disabled = rerackDisabled;
      els.rerack.setAttribute("aria-disabled", String(rerackDisabled));
    }
    if (els.concede) {
      // Only show during an active AI game — not in the menu or after game over.
      els.concede.hidden = game.mode !== MODE_AI
        || game.state === ST_GAMEOVER
        || game.state === ST_MENU;
    }
  }

  function groupLabel(g) {
    if (g === "solid") return "全色（实心）";
    if (g === "stripe") return "花色（条纹）";
    if (g === "eight") return "8 号";
    return "未分组";
  }

  function showOverlay(kicker, title, text, actions) {
    if (!els.overlay) return;
    if (els.overlayKicker) els.overlayKicker.textContent = kicker || "";
    if (els.overlayTitle) els.overlayTitle.textContent = title || "";
    if (els.overlayText) els.overlayText.textContent = text || "";
    // Replace buttons
    var modal = els.overlay.querySelector(".modal-actions");
    if (modal) {
      modal.innerHTML = "";
      if (actions && actions.length) {
        for (var i = 0; i < actions.length; i++) {
          (function (act) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "btn " + (act.primary ? "btn-primary" : "btn-ghost");
            b.textContent = act.label;
            b.addEventListener("click", act.action, { signal: ac.signal });
            modal.appendChild(b);
          })(actions[i]);
        }
      } else {
        // default: rebuild original mode-select buttons
        rebuildModeButtons(modal);
      }
    }
    els.overlay.hidden = false;
  }

  function hideOverlay() {
    if (els.overlay) els.overlay.hidden = true;
  }

  function rebuildModeButtons(modal) {
    var b1 = document.createElement("button");
    b1.type = "button";
    b1.className = "btn btn-primary";
    b1.textContent = "单人练习";
    b1.addEventListener("click", function () { newGame(MODE_PRACTICE); }, { signal: ac.signal });
    var b2 = document.createElement("button");
    b2.type = "button";
    b2.className = "btn btn-primary";
    b2.textContent = "人机对战";
    b2.addEventListener("click", function () { newGame(MODE_AI); }, { signal: ac.signal });
    modal.appendChild(b1);
    modal.appendChild(b2);
  }

  /* ------------------------------------------------------------------ */
  /*  Game flow / actions                                               */
  /* ------------------------------------------------------------------ */

  function newGame(mode) {
    cancelAITimer();
    var keepFull = !!(game && game.fullTable);
    game = defaultGame(mode);
    game.fullTable = keepFull;
    resetTable();
    game.state = ST_IDLE;
    // defaultGame() reset pxPerCm — recompute against the current layout.
    resizeCanvas();
    if (mode === MODE_PRACTICE) {
      setMessage('练习模式：自由击球。点击"重新摆球"可复位。', "");
    } else {
      setMessage("人机对战开始。你先开球——按住白球反方向拖动，松开击球。", "");
    }
    hideOverlay();
    updateUI();
  }

  function rerackPractice() {
    if (game.mode !== MODE_PRACTICE) return;
    cancelAITimer();
    resetTable();
    game.state = ST_IDLE;
    setMessage("已重新摆球。", "");
    updateUI();
  }

  function backToMenu() {
    cancelAITimer();
    game.state = ST_MENU;
    showOverlay("选择模式", "开始游戏", "选择一个模式开始。规则不熟悉？右侧有详细讲解。", null);
  }

  function concede() {
    if (game.mode !== MODE_AI || game.state === ST_GAMEOVER) return;
    cancelAITimer();
    game.winner = P2;
    game.loseReason = "玩家认输";
    game.state = ST_GAMEOVER;
    showOverlay("Defeat", "本局结束", "你已认输。", [
      { label: "再来一局", primary: true, action: function () { newGame(MODE_AI); } },
      { label: "切换模式", primary: false, action: backToMenu }
    ]);
    updateUI();
  }

  function cancelAITimer() {
    if (game.aiTimer) {
      clearTimeout(game.aiTimer);
      game.aiTimer = null;
    }
    game.aiThinking = false;
    game.aiAimingPlan = null;
    if (els.thinking) els.thinking.hidden = true;
  }

  function toggleFullTable() {
    game.fullTable = !game.fullTable;
    applyFullTableUI();
    deferResize();
  }

  // Re-measure after the browser has laid out / reflowed the wrap. Used on
  // mount (first paint rect is often stale) and after layout-affecting
  // toggles. Two rAFs handle the common "measure-then-settle" gap.
  function deferResize() {
    if (!canvas) return;
    requestAnimationFrame(function () {
      resizeCanvas();
      render();
      requestAnimationFrame(function () {
        resizeCanvas();
        render();
      });
    });
  }

  function applyFullTableUI() {
    var on = !!game.fullTable;
    if (els.layout) els.layout.classList.toggle("billiards-layout--full", on);
    if (els.fullboard) {
      var label = els.fullboard.querySelector(".billiards-action__label");
      var sub = els.fullboard.querySelector(".billiards-action__sub");
      if (label) label.textContent = on ? "退出全屏" : "全屏台桌";
      if (sub) sub.textContent = on ? "恢复侧栏" : "隐藏右侧";
      els.fullboard.setAttribute("aria-pressed", String(on));
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Main loop                                                         */
  /* ------------------------------------------------------------------ */

  function gameLoop(timestamp) {
    if (!canvas) return;
    if (!game.lastTime) game.lastTime = timestamp;
    var elapsed = Math.min(timestamp - game.lastTime, MAX_FRAME_MS);
    game.lastTime = timestamp;

    if (game.state === ST_SHOOTING) {
      game.acc += elapsed / 1000;
      while (game.acc >= DT) {
        stepPhysics(DT);
        game.acc -= DT;
      }
      if (allStopped()) {
        game.state = ST_RESOLVING;
        resolveTurnEnd();
      }
    } else {
      game.acc = 0;
    }

    render();
    rafId = requestAnimationFrame(gameLoop);
  }

  /* ------------------------------------------------------------------ */
  /*  Lifecycle                                                         */
  /* ------------------------------------------------------------------ */

  function mount(el) {
    container = el;
    ac = new AbortController();

    // Cache DOM
    var selectorMap = {
      "data-billiards-canvas":         "canvas",
      "data-billiards-status":         "status",
      "data-billiards-mode-label":     "modeLabel",
      "data-billiards-mode-desc":      "modeDesc",
      "data-billiards-phase":          "phase",
      "data-billiards-p1-group":       "p1Group",
      "data-billiards-p2-group":       "p2Group",
      "data-billiards-p1-remaining":   "p1Remaining",
      "data-billiards-p2-remaining":   "p2Remaining",
      "data-billiards-p1-detail":      "p1Detail",
      "data-billiards-p2-detail":      "p2Detail",
      "data-billiards-turn":           "turn",
      "data-billiards-turn-detail":    "turnDetail",
      "data-billiards-message":        "message",
      "data-billiards-power-wrap":     "powerWrap",
      "data-billiards-power-fill":     "powerFill",
      "data-billiards-power-label":    "powerLabel",
      "data-billiards-thinking":       "thinking",
      "data-billiards-overlay":        "overlay",
      "data-billiards-overlay-kicker": "overlayKicker",
      "data-billiards-overlay-title":  "overlayTitle",
      "data-billiards-overlay-text":   "overlayText",
      "data-billiards-mode-practice":  "modePractice",
      "data-billiards-mode-ai":        "modeAI",
      "data-billiards-new":            "newBtn",
      "data-billiards-rerack":         "rerack",
      "data-billiards-switch-mode":    "switchMode",
      "data-billiards-concede":        "concede",
      "data-billiards-fullboard":      "fullboard"
    };
    var keys = Object.keys(selectorMap);
    for (var i = 0; i < keys.length; i++) {
      var node = container.querySelector("[" + keys[i] + "]");
      if (node) els[selectorMap[keys[i]]] = node;
    }
    els.layout = container.querySelector(".billiards-layout");

    canvas = els.canvas;
    if (!canvas) {
      console.warn("[billiards] Canvas not found in template");
      return;
    }

    // Initialize game (menu state, with rack visible underneath)
    game = defaultGame(MODE_PRACTICE);
    resetTable();
    game.state = ST_MENU;

    resizeCanvas();
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(function () {
        resizeCanvas();
      });
      resizeObserver.observe(canvas.parentElement);
    }

    bindInput();

    // Action buttons
    if (els.modePractice) els.modePractice.addEventListener("click", function () { newGame(MODE_PRACTICE); }, { signal: ac.signal });
    if (els.modeAI)       els.modeAI.addEventListener("click", function () { newGame(MODE_AI); }, { signal: ac.signal });
    if (els.newBtn)       els.newBtn.addEventListener("click", function () { newGame(game.mode || MODE_PRACTICE); }, { signal: ac.signal });
    if (els.rerack)       els.rerack.addEventListener("click", rerackPractice, { signal: ac.signal });
    if (els.switchMode)   els.switchMode.addEventListener("click", backToMenu, { signal: ac.signal });
    if (els.concede)      els.concede.addEventListener("click", concede, { signal: ac.signal });
    if (els.fullboard)    els.fullboard.addEventListener("click", toggleFullTable, { signal: ac.signal });

    applyFullTableUI();

    setMessage("选择一个模式开始。", "");
    updateUI();

    rafId = requestAnimationFrame(gameLoop);
    // First-paint rect can be stale before layout settles — re-measure.
    deferResize();
  }

  function unmount() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (game && game.aiTimer) {
      clearTimeout(game.aiTimer);
      game.aiTimer = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (ac) {
      ac.abort();
      ac = null;
    }
    game = {};
    els = {};
    container = null;
    canvas = null;
    ctx = null;
  }

  /* ------------------------------------------------------------------ */
  /*  Export                                                            */
  /* ------------------------------------------------------------------ */

  host.__page_billiards = { mount: mount, unmount: unmount };
})(window);
