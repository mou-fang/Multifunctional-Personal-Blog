/* ===== claudeOne :: onlyup.js =====
 * Only Up — 像素风垂直攀爬地狱
 * 8 个主题区域，从贫民窟卧室爬向宇宙顶点。
 * 无存档、无安全网，一脚踩空可能直接坠回起点。
 */
(function (host) {
  "use strict";

  /* ================================================================ */
  /*  CONSTANTS                                                        */
  /* ================================================================ */

  var W = 360;
  var H = 540;
  var FIXED_DT = 1000 / 60;
  var GRAVITY = 0.55;
  var JUMP_VEL = -11.5;
  var VAR_JUMP_RELEASE = 0.48;
  var MOVE_SPEED = 3.6;
  var AIR_ACCEL = 0.38;
  var GROUND_FRICTION = 0.80;
  var MAX_FALL = 14;
  var COYOTE_FRAMES = 5;
  var JUMP_BUFFER_FRAMES = 5;
  var WORLD_HEIGHT = 8000;
  var DEATH_Y = 8200;
var START_X = 180;
var START_Y = 7938;    // feet sit at platform y=7960
var CAMERA_SMOOTH = 0.09;
  var PLAYER_W = 14;
  var PLAYER_H = 22;

  var COLORS = {
    sky: { r: 10, g: 14, b: 30 },
    playerHood: "#4a90d9",
    playerSkin: "#f4c59a",
    playerPants: "#3a3a4a",
    playerShoe: "#2a2a2a",
    playerOutline: "#1a1a2e",
    platNormal: "#5a5a6e",
    platMoving: "#e8a840",
    platCrumbly: "#c44a3a",
    platIce: "#a0d8ef",
    platSpring: "#e8c840",
    platCloud: "#e8e8f0",
    platTemple: "#d4c4a0",
    platLava: "#4a1a1a",
    platSpace: "#6a6a8a",
    grass: "#4a8a3a",
    dirt: "#6a4a2a",
  };

  /* ================================================================ */
  /*  ZONE DEFINITIONS                                                 */
  /* ================================================================ */

  var ZONES = [
    /* ---- Zone 0: 贫民窟卧室 ---- */
    {
      name: "贫民窟卧室",
      emoji: "\u{1F6CF}",
      yStart: 8000, yEnd: 7000,
      gravity: 1, friction: 1, wind: 0,
      platStyle: "furniture",
      bgDraw: drawBgSlums,
      stepCount: 22,
      spreadX: 110,
      platforms: [
        { x: 180, y: 7960, w: 100, type: "normal" }, // start bed
        { x: 40, y: 7880, w: 50, type: "normal" },
        { x: 260, y: 7860, w: 55, type: "normal" },
        { x: 120, y: 7790, w: 60, type: "normal" },
        { x: 40, y: 7720, w: 50, type: "normal" },
        { x: 270, y: 7700, w: 55, type: "normal" },
        { x: 90, y: 7630, w: 60, type: "normal" },
        { x: 250, y: 7610, w: 55, type: "normal" },
        { x: 60, y: 7540, w: 50, type: "normal" },
        { x: 280, y: 7520, w: 55, type: "normal" },
        { x: 140, y: 7450, w: 65, type: "normal" },
        { x: 40, y: 7430, w: 50, type: "normal" },
        { x: 260, y: 7360, w: 55, type: "normal" },
        { x: 100, y: 7340, w: 60, type: "normal" },
        { x: 40, y: 7270, w: 50, type: "normal" },
        { x: 270, y: 7250, w: 55, type: "normal" },
        { x: 80, y: 7180, w: 60, type: "normal" },
        { x: 250, y: 7160, w: 55, type: "normal" },
        { x: 60, y: 7090, w: 50, type: "normal" },
        { x: 280, y: 7070, w: 55, type: "normal" },
        { x: 170, y: 7000, w: 70, type: "normal" },
      ],
    },
    /* ---- Zone 1: 都市楼宇 ---- */
    {
      name: "都市楼宇",
      emoji: "\u{1F3D9}",
      yStart: 7000, yEnd: 6000,
      gravity: 1, friction: 1, wind: 0,
      platStyle: "urban",
      bgDraw: drawBgCity,
      stepCount: 20,
      spreadX: 120,
      platforms: [
        { x: 60, y: 6930, w: 55, type: "normal" },
        { x: 260, y: 6900, w: 55, type: "moving", range: 70, speed: 0.025 },
        { x: 120, y: 6830, w: 60, type: "normal" },
        { x: 40, y: 6810, w: 50, type: "normal" },
        { x: 270, y: 6740, w: 55, type: "moving", range: 60, speed: 0.03 },
        { x: 80, y: 6720, w: 60, type: "normal" },
        { x: 250, y: 6650, w: 55, type: "normal" },
        { x: 60, y: 6630, w: 50, type: "normal" },
        { x: 280, y: 6560, w: 55, type: "moving", range: 80, speed: 0.022 },
        { x: 140, y: 6540, w: 65, type: "normal" },
        { x: 40, y: 6470, w: 50, type: "normal" },
        { x: 260, y: 6450, w: 55, type: "normal" },
        { x: 100, y: 6380, w: 60, type: "normal" },
        { x: 40, y: 6360, w: 50, type: "normal" },
        { x: 270, y: 6290, w: 55, type: "moving", range: 65, speed: 0.028 },
        { x: 80, y: 6270, w: 60, type: "normal" },
        { x: 250, y: 6200, w: 55, type: "normal" },
        { x: 60, y: 6180, w: 50, type: "normal" },
        { x: 280, y: 6110, w: 55, type: "normal" },
        { x: 160, y: 6090, w: 65, type: "normal" },
        { x: 40, y: 6020, w: 70, type: "normal" },
        { x: 200, y: 6000, w: 80, type: "normal" },
      ],
    },
    /* ---- Zone 2: 云端塔楼 ---- */
    {
      name: "云端塔楼",
      emoji: "\u{2601}",
      yStart: 6000, yEnd: 5000,
      gravity: 1, friction: 1, wind: 0.8,
      platStyle: "sky",
      bgDraw: drawBgClouds,
      stepCount: 22,
      spreadX: 130,
      platforms: [
        { x: 100, y: 5930, w: 60, type: "cloud" },
        { x: 270, y: 5900, w: 55, type: "cloud" },
        { x: 60, y: 5830, w: 55, type: "cloud" },
        { x: 250, y: 5810, w: 55, type: "moving", range: 60, speed: 0.025 },
        { x: 140, y: 5740, w: 65, type: "cloud" },
        { x: 40, y: 5720, w: 50, type: "cloud" },
        { x: 280, y: 5650, w: 55, type: "cloud" },
        { x: 80, y: 5630, w: 60, type: "cloud" },
        { x: 260, y: 5560, w: 55, type: "moving", range: 70, speed: 0.022 },
        { x: 60, y: 5540, w: 50, type: "cloud" },
        { x: 270, y: 5470, w: 55, type: "cloud" },
        { x: 120, y: 5450, w: 65, type: "cloud" },
        { x: 40, y: 5380, w: 50, type: "cloud" },
        { x: 260, y: 5360, w: 55, type: "cloud" },
        { x: 100, y: 5290, w: 60, type: "cloud" },
        { x: 40, y: 5270, w: 50, type: "cloud" },
        { x: 280, y: 5200, w: 55, type: "moving", range: 75, speed: 0.028 },
        { x: 80, y: 5180, w: 60, type: "cloud" },
        { x: 250, y: 5110, w: 55, type: "cloud" },
        { x: 60, y: 5090, w: 50, type: "cloud" },
        { x: 270, y: 5020, w: 55, type: "cloud" },
        { x: 170, y: 5000, w: 70, type: "cloud" },
      ],
    },
    /* ---- Zone 3: 火山熔岩 ---- */
    {
      name: "火山熔岩",
      emoji: "\u{1F30B}",
      yStart: 5000, yEnd: 4000,
      gravity: 1, friction: 1, wind: 0,
      platStyle: "rock",
      bgDraw: drawBgVolcano,
      stepCount: 20,
      spreadX: 110,
      platforms: [
        { x: 80, y: 4930, w: 60, type: "crumbly" },
        { x: 260, y: 4900, w: 55, type: "normal" },
        { x: 60, y: 4830, w: 55, type: "crumbly" },
        { x: 250, y: 4810, w: 55, type: "normal" },
        { x: 140, y: 4740, w: 65, type: "crumbly" },
        { x: 40, y: 4720, w: 50, type: "normal" },
        { x: 280, y: 4650, w: 55, type: "crumbly" },
        { x: 80, y: 4630, w: 60, type: "normal" },
        { x: 260, y: 4560, w: 55, type: "crumbly" },
        { x: 60, y: 4540, w: 50, type: "normal" },
        { x: 270, y: 4470, w: 55, type: "normal" },
        { x: 120, y: 4450, w: 65, type: "crumbly" },
        { x: 40, y: 4380, w: 50, type: "normal" },
        { x: 260, y: 4360, w: 55, type: "normal" },
        { x: 100, y: 4290, w: 60, type: "crumbly" },
        { x: 40, y: 4270, w: 50, type: "normal" },
        { x: 280, y: 4200, w: 55, type: "normal" },
        { x: 80, y: 4180, w: 60, type: "crumbly" },
        { x: 250, y: 4110, w: 55, type: "normal" },
        { x: 60, y: 4090, w: 50, type: "normal" },
        { x: 270, y: 4020, w: 55, type: "normal" },
        { x: 160, y: 4000, w: 70, type: "normal" },
      ],
    },
    /* ---- Zone 4: 冰川峰顶 ---- */
    {
      name: "冰川峰顶",
      emoji: "\u{2744}",
      yStart: 4000, yEnd: 3000,
      gravity: 1, friction: 0.35, wind: 0,
      platStyle: "glacier",
      bgDraw: drawBgIce,
      stepCount: 22,
      spreadX: 120,
      platforms: [
        { x: 100, y: 3930, w: 60, type: "ice" },
        { x: 270, y: 3900, w: 55, type: "ice" },
        { x: 60, y: 3830, w: 55, type: "ice" },
        { x: 250, y: 3810, w: 55, type: "ice" },
        { x: 140, y: 3740, w: 65, type: "ice" },
        { x: 40, y: 3720, w: 50, type: "ice" },
        { x: 280, y: 3650, w: 55, type: "ice" },
        { x: 80, y: 3630, w: 60, type: "ice" },
        { x: 260, y: 3560, w: 55, type: "ice" },
        { x: 60, y: 3540, w: 50, type: "ice" },
        { x: 270, y: 3470, w: 55, type: "ice" },
        { x: 120, y: 3450, w: 65, type: "ice" },
        { x: 40, y: 3380, w: 50, type: "ice" },
        { x: 260, y: 3360, w: 55, type: "ice" },
        { x: 100, y: 3290, w: 60, type: "ice" },
        { x: 40, y: 3270, w: 50, type: "ice" },
        { x: 280, y: 3200, w: 55, type: "ice" },
        { x: 80, y: 3180, w: 60, type: "ice" },
        { x: 250, y: 3110, w: 55, type: "ice" },
        { x: 60, y: 3090, w: 50, type: "ice" },
        { x: 270, y: 3020, w: 55, type: "ice" },
        { x: 170, y: 3000, w: 70, type: "ice" },
      ],
    },
    /* ---- Zone 5: 古希腊神庙 ---- */
    {
      name: "古希腊神庙",
      emoji: "\u{1F3DB}",
      yStart: 3000, yEnd: 2000,
      gravity: 1, friction: 1, wind: 0,
      platStyle: "marble",
      bgDraw: drawBgTemple,
      stepCount: 20,
      spreadX: 120,
      platforms: [
        { x: 80, y: 2930, w: 60, type: "normal" },
        { x: 260, y: 2900, w: 55, type: "spring" },
        { x: 60, y: 2830, w: 55, type: "normal" },
        { x: 250, y: 2810, w: 55, type: "normal" },
        { x: 140, y: 2740, w: 65, type: "spring" },
        { x: 40, y: 2720, w: 50, type: "normal" },
        { x: 280, y: 2650, w: 55, type: "normal" },
        { x: 80, y: 2630, w: 60, type: "spring" },
        { x: 260, y: 2560, w: 55, type: "normal" },
        { x: 60, y: 2540, w: 50, type: "normal" },
        { x: 270, y: 2470, w: 55, type: "spring" },
        { x: 120, y: 2450, w: 65, type: "normal" },
        { x: 40, y: 2380, w: 50, type: "normal" },
        { x: 260, y: 2360, w: 55, type: "spring" },
        { x: 100, y: 2290, w: 60, type: "normal" },
        { x: 40, y: 2270, w: 50, type: "normal" },
        { x: 280, y: 2200, w: 55, type: "spring" },
        { x: 80, y: 2180, w: 60, type: "normal" },
        { x: 250, y: 2110, w: 55, type: "normal" },
        { x: 60, y: 2090, w: 50, type: "normal" },
        { x: 270, y: 2020, w: 55, type: "normal" },
        { x: 160, y: 2000, w: 70, type: "normal" },
      ],
    },
    /* ---- Zone 6: 宇宙太空 ---- */
    {
      name: "宇宙太空",
      emoji: "\u{1F30C}",
      yStart: 2000, yEnd: 1000,
      gravity: 0.28, friction: 1, wind: 0,
      platStyle: "cosmic",
      bgDraw: drawBgSpace,
      stepCount: 18,
      spreadX: 140,
      platforms: [
        { x: 100, y: 1930, w: 60, type: "normal" },
        { x: 270, y: 1900, w: 55, type: "moving", range: 60, speed: 0.02 },
        { x: 60, y: 1830, w: 55, type: "normal" },
        { x: 250, y: 1810, w: 55, type: "normal" },
        { x: 140, y: 1740, w: 65, type: "moving", range: 80, speed: 0.018 },
        { x: 40, y: 1720, w: 50, type: "normal" },
        { x: 280, y: 1650, w: 55, type: "normal" },
        { x: 80, y: 1630, w: 60, type: "normal" },
        { x: 260, y: 1560, w: 55, type: "moving", range: 70, speed: 0.022 },
        { x: 60, y: 1540, w: 50, type: "normal" },
        { x: 270, y: 1470, w: 55, type: "normal" },
        { x: 120, y: 1450, w: 65, type: "normal" },
        { x: 40, y: 1380, w: 50, type: "normal" },
        { x: 260, y: 1360, w: 55, type: "normal" },
        { x: 100, y: 1290, w: 60, type: "normal" },
        { x: 40, y: 1270, w: 50, type: "normal" },
        { x: 280, y: 1200, w: 55, type: "normal" },
        { x: 80, y: 1180, w: 60, type: "normal" },
        { x: 250, y: 1110, w: 55, type: "normal" },
        { x: 60, y: 1090, w: 50, type: "normal" },
        { x: 270, y: 1020, w: 55, type: "normal" },
        { x: 170, y: 1000, w: 70, type: "normal" },
      ],
    },
    /* ---- Zone 7: 顶点 ---- */
    {
      name: "顶点",
      emoji: "\u{1F3C6}",
      yStart: 1000, yEnd: 0,
      gravity: 1, friction: 1, wind: 0,
      platStyle: "divine",
      bgDraw: drawBgSummit,
      stepCount: 14,
      spreadX: 100,
      platforms: [
        { x: 80, y: 930, w: 60, type: "normal" },
        { x: 260, y: 900, w: 55, type: "spring" },
        { x: 60, y: 830, w: 55, type: "normal" },
        { x: 250, y: 810, w: 55, type: "normal" },
        { x: 140, y: 740, w: 65, type: "spring" },
        { x: 40, y: 720, w: 50, type: "normal" },
        { x: 280, y: 650, w: 55, type: "normal" },
        { x: 80, y: 630, w: 60, type: "spring" },
        { x: 260, y: 560, w: 55, type: "normal" },
        { x: 60, y: 540, w: 50, type: "normal" },
        { x: 270, y: 470, w: 55, type: "normal" },
        { x: 120, y: 450, w: 65, type: "normal" },
        { x: 40, y: 380, w: 50, type: "normal" },
        { x: 260, y: 360, w: 55, type: "normal" },
        { x: 100, y: 290, w: 60, type: "normal" },
        { x: 40, y: 270, w: 50, type: "normal" },
        { x: 280, y: 200, w: 55, type: "normal" },
        { x: 80, y: 180, w: 60, type: "normal" },
        { x: 250, y: 110, w: 55, type: "normal" },
        { x: 60, y: 90, w: 50, type: "normal" },
        // Victory platform
        { x: 130, y: 20, w: 100, type: "victory", flag: true },
      ],
    },
  ];

  /* ================================================================ */
  /*  STATE                                                            */
  /* ================================================================ */

  var els = {};
  var container = null;
  var canvas = null;
  var ctx = null;
  var rafId = null;
  var resizeObs = null;
  var keys = {};
  var scoreInterval = null;

  var state = {
    mode: "ready",       // ready | playing | paused | falling | cleared
    player: {
      x: START_X, y: START_Y, vx: 0, vy: 0,
      onGround: false, facing: 1,
      coyoteTimer: 0, jumpBuffer: 0,
      jumpRequested: false, jumpHeld: false,
      animFrame: 0, animTimer: 0,
    },
    camera: { y: START_Y - 300, targetY: START_Y - 300 },
    time: 0,              // elapsed time in ms
    falls: 0,
    bestTime: null,       // best finish time in ms
    bestHeight: 0,        // proportion 0-1
    maxHeightY: START_Y,  // highest Y reached (lowest value)
    particles: [],
    crumbling: [],        // indices of crumbling platforms & their timers
    fadeAlpha: 0,
    fadeDir: 0,           // 0=none, 1=out, -1=in
    deathTimer: 0,
    respawning: false,
    lastTime: 0,
    accumulator: 0,
    zoneIndex: 0,
    stars: [],            // space zone stars
    snowflakes: [],       // ice zone snowflakes
    embers: [],           // volcano embers
    confetti: [],         // victory confetti
    timeText: "00:00",
    fallText: "0",
    heightText: "0%",
    zoneText: "",
    touchLeft: false,
    touchRight: false,
    touchJump: false,
  };

  /* ================================================================ */
  /*  HELPERS                                                          */
  /* ================================================================ */

  function rand(min, max) { return min + Math.random() * (max - min); }
  function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function getZoneIndex(y) {
    if (y <= 0) return ZONES.length - 1;
    for (var i = ZONES.length - 1; i >= 0; i--) {
      if (y <= ZONES[i].yStart && y > ZONES[i].yEnd) return i;
    }
    return y > ZONES[0].yStart ? 0 : ZONES.length - 1;
  }

  function getActivePlatforms() {
    var zi = state.zoneIndex;
    var all = [];
    for (var i = Math.max(0, zi - 1); i <= Math.min(ZONES.length - 1, zi + 1); i++) {
      if (ZONES[i].platforms) {
        for (var j = 0; j < ZONES[i].platforms.length; j++) {
          all.push(ZONES[i].platforms[j]);
        }
      }
    }
    return all;
  }

  function fmtTime(ms) {
    var totalSec = Math.floor(ms / 1000);
    var min = Math.floor(totalSec / 60);
    var sec = totalSec % 60;
    return (min < 10 ? "0" : "") + min + ":" + (sec < 10 ? "0" : "") + sec;
  }

  /* ================================================================ */
  /*  SPRITE / RENDERING HELPERS                                       */
  /* ================================================================ */

  function drawPlayerSprite(px, py, facing) {
    // Flipped horizontally if facing left
    var fx = facing < 0 ? -1 : 1;
    var ox = facing < 0 ? PLAYER_W : 0;
    ctx.save();
    ctx.translate(Math.floor(px + (facing < 0 ? PLAYER_W : 0)), Math.floor(py));
    if (facing < 0) ctx.scale(-1, 1);

    // Hood (head covering)
    ctx.fillStyle = COLORS.playerHood;
    ctx.fillRect(2, 0, 10, 7);
    ctx.fillRect(1, 2, 12, 5);
    // Face
    ctx.fillStyle = COLORS.playerSkin;
    ctx.fillRect(3, 3, 8, 4);
    // Eyes
    ctx.fillStyle = "#000";
    ctx.fillRect(5, 4, 2, 2);
    ctx.fillRect(8, 4, 2, 2);
    // Eye shine
    ctx.fillStyle = "#fff";
    ctx.fillRect(6, 4, 1, 1);
    ctx.fillRect(9, 4, 1, 1);

    // Body
    ctx.fillStyle = COLORS.playerHood;
    ctx.fillRect(2, 7, 10, 7);
    // Arms
    ctx.fillRect(0, 8, 3, 5);
    ctx.fillRect(11, 8, 3, 5);
    // Hands
    ctx.fillStyle = COLORS.playerSkin;
    ctx.fillRect(0, 12, 2, 2);
    ctx.fillRect(12, 12, 2, 2);

    // Legs
    ctx.fillStyle = COLORS.playerPants;
    ctx.fillRect(3, 14, 3, 5);
    ctx.fillRect(8, 14, 3, 5);
    // Shoes
    ctx.fillStyle = COLORS.playerShoe;
    ctx.fillRect(2, 19, 4, 3);
    ctx.fillRect(8, 19, 4, 3);

    ctx.restore();
  }

  function drawPlatform(p, camY) {
    var realX = p.x;
    if (p.type === "moving" && p._orgX !== undefined) {
      var mt = state.time * 0.001 * (p.speed * 60 || 1.5);
      realX = p._orgX + Math.sin(mt) * (p.range || 60);
    }
    var sx = Math.floor(realX);
    var sy = Math.floor(p.y - camY);
    var sw = Math.floor(p.w);
    var sh = p.h || 10;

    // Skip if off screen
    if (sy + sh < -20 || sy > H + 20) return;

    // Special types override the zone style
    if (p.type === "moving") {
      drawTileMoving(sx, sy, sw, sh);
    } else if (p.type === "crumbly") {
      drawTileCrumbly(sx, sy, sw, sh, p);
    } else if (p.type === "ice") {
      drawTileIce(sx, sy, sw, sh, p);
    } else if (p.type === "spring") {
      drawTileSpring(sx, sy, sw, sh);
    } else if (p.type === "cloud") {
      drawTileCloud(sx, sy, sw, sh);
    } else if (p.type === "victory") {
      drawTileVictory(sx, sy, sw, sh);
    } else {
      // Normal platform — style by zone
      var zone = ZONES[state.zoneIndex] || ZONES[0];
      var style = zone.platStyle || "stone";
      switch (style) {
        case "furniture": drawTileFurniture(sx, sy, sw, sh, p); break;
        case "urban":     drawTileUrban(sx, sy, sw, sh, p); break;
        case "sky":       drawTileCloud(sx, sy, sw, sh); break;
        case "rock":      drawTileRock(sx, sy, sw, sh); break;
        case "glacier":   drawTileGlacier(sx, sy, sw, sh, p); break;
        case "marble":    drawTileMarble(sx, sy, sw, sh); break;
        case "cosmic":    drawTileCosmic(sx, sy, sw, sh); break;
        case "divine":    drawTileDivine(sx, sy, sw, sh); break;
        default:          drawTileStone(sx, sy, sw, sh); break;
      }
    }

    // Victory flag
    if (p.type === "victory" && p.flag) {
      ctx.fillStyle = "#8B4513";
      ctx.fillRect(sx + sw / 2 - 1, sy - 30, 2, 30);
      ctx.fillStyle = "#ff4444";
      ctx.fillRect(sx + sw / 2 + 1, sy - 28, 14, 10);
      ctx.fillStyle = "#ffcc00";
      ctx.fillRect(sx + sw / 2 + 5, sy - 25, 6, 4);
      // Sparkle
      var sp = (Math.sin(state.time * 0.005) + 1) * 0.5;
      ctx.fillStyle = "rgba(255,255,200," + (0.5 + sp * 0.5) + ")";
      ctx.fillRect(sx + sw / 2 + 16, sy - 32, 2, 2);
      ctx.fillRect(sx - 4, sy - 24, 2, 2);
    }
  }

  /* ================================================================ */
  /*  PLATFORM TILE VARIATIONS (one per zone style + per type)         */
  /* ================================================================ */

  // ---- Generic helpers -------------------------------------------
  function pixelNoise(seed, x, y) {
    var n = Math.sin(seed * 12.9898 + x * 78.233 + y * 37.719) * 43758.5453;
    return n - Math.floor(n);
  }

  // ---- Zone 0: Furniture (mattresses, dressers, shelves) ----------
  function drawTileFurniture(sx, sy, sw, sh, p) {
    // Cushion / mattress look — stitched fabric
    var stripe = (Math.floor(p.x / 7) + Math.floor(p.y / 13)) % 3;
    var palette = [
      { body: "#c87a52", line: "#a05030", top: "#e8a070" }, // brown wood
      { body: "#5a7a8a", line: "#3a5a6a", top: "#7a9aaa" }, // teal mattress
      { body: "#8a4a6a", line: "#5a2a4a", top: "#aa6a8a" }, // dusty pink quilt
    ];
    var c = palette[stripe];
    // Body
    ctx.fillStyle = c.body;
    ctx.fillRect(sx, sy, sw, sh);
    // Top highlight
    ctx.fillStyle = c.top;
    ctx.fillRect(sx, sy, sw, 2);
    // Bottom shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(sx, sy + sh - 2, sw, 2);
    // Stitching dots (for mattress) or wood grain
    if (stripe === 0) {
      // wood grain horizontal lines
      ctx.fillStyle = c.line;
      ctx.fillRect(sx, sy + Math.floor(sh / 2), sw, 1);
    } else {
      // stitch dots
      ctx.fillStyle = c.line;
      for (var i = 4; i < sw - 2; i += 8) {
        ctx.fillRect(sx + i, sy + 3, 2, 1);
        ctx.fillRect(sx + i, sy + sh - 5, 2, 1);
      }
    }
    // Tiny legs / corner accents
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(sx + 1, sy + sh, 2, 3);
    ctx.fillRect(sx + sw - 3, sy + sh, 2, 3);
  }

  // ---- Zone 1: Urban (AC units, billboards, balcony railings) -----
  function drawTileUrban(sx, sy, sw, sh, p) {
    var variant = (Math.floor(p.x / 5) + Math.floor(p.y / 11)) % 3;
    if (variant === 0) {
      // AC unit
      ctx.fillStyle = "#9ca4b0";
      ctx.fillRect(sx, sy, sw, sh);
      ctx.fillStyle = "#cfd6dd";
      ctx.fillRect(sx, sy, sw, 2);
      ctx.fillStyle = "#5a6470";
      ctx.fillRect(sx, sy + sh - 2, sw, 2);
      // vents
      for (var i = 3; i < sw - 2; i += 3) {
        ctx.fillStyle = "#3a4250";
        ctx.fillRect(sx + i, sy + 3, 1, sh - 6);
      }
      // bolt corners
      ctx.fillStyle = "#2a2a30";
      ctx.fillRect(sx + 1, sy + 1, 1, 1);
      ctx.fillRect(sx + sw - 2, sy + 1, 1, 1);
    } else if (variant === 1) {
      // Neon sign
      ctx.fillStyle = "#1a1a26";
      ctx.fillRect(sx, sy, sw, sh);
      ctx.fillStyle = "#2a2a38";
      ctx.fillRect(sx, sy, sw, 2);
      // Glow neon strip
      var hue = (Math.floor(p.x) * 23) % 360;
      ctx.fillStyle = "hsl(" + hue + ",90%,60%)";
      ctx.fillRect(sx + 2, sy + 3, sw - 4, 2);
      // glow halo
      ctx.fillStyle = "hsla(" + hue + ",90%,60%,0.3)";
      ctx.fillRect(sx + 2, sy + 2, sw - 4, 4);
      // bottom shadow
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(sx, sy + sh - 2, sw, 2);
    } else {
      // Balcony railing
      ctx.fillStyle = "#6a6a78";
      ctx.fillRect(sx, sy, sw, sh);
      ctx.fillStyle = "#9a9aa8";
      ctx.fillRect(sx, sy, sw, 2);
      // vertical bars
      ctx.fillStyle = "#3a3a48";
      for (var b = 2; b < sw - 1; b += 4) {
        ctx.fillRect(sx + b, sy + 3, 1, sh - 5);
      }
      // bottom shadow
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(sx, sy + sh - 2, sw, 2);
    }
  }

  // ---- Zone 2: Sky / Cloud platforms (used as default for cloud zone)
  function drawTileCloud(sx, sy, sw, sh) {
    // Fluffy white cloud with rim
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.moveTo(sx + 4, sy + sh);
    ctx.lineTo(sx + sw - 4, sy + sh);
    ctx.quadraticCurveTo(sx + sw, sy + sh / 2, sx + sw - 6, sy + 2);
    ctx.quadraticCurveTo(sx + sw / 2, sy - 4, sx + 6, sy + 2);
    ctx.quadraticCurveTo(sx, sy + sh / 2, sx + 4, sy + sh);
    ctx.fill();
    // Top highlight
    ctx.fillStyle = "rgba(255,255,255,1)";
    ctx.fillRect(sx + 6, sy + 1, sw - 12, 2);
    // Bottom shadow tint
    ctx.fillStyle = "rgba(120,140,180,0.45)";
    ctx.fillRect(sx + 4, sy + sh - 2, sw - 8, 2);
    // Speckle puffs
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.arc(sx + 6, sy + sh - 1, 3, 0, Math.PI * 2);
    ctx.arc(sx + sw - 6, sy + sh - 1, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Zone 3: Rock / Obsidian (volcano) -------------------------
  function drawTileRock(sx, sy, sw, sh) {
    // Volcanic rock with glowing cracks
    ctx.fillStyle = "#2a1818";
    ctx.fillRect(sx, sy, sw, sh);
    // Surface
    ctx.fillStyle = "#4a2a28";
    ctx.fillRect(sx, sy, sw, 3);
    // Bottom darker
    ctx.fillStyle = "#1a0808";
    ctx.fillRect(sx, sy + sh - 2, sw, 2);
    // Lava cracks glowing
    var t = state.time * 0.002;
    var glow = 0.5 + Math.sin(t) * 0.3;
    ctx.fillStyle = "rgba(255,120,40," + glow + ")";
    for (var i = 6; i < sw - 4; i += 9) {
      ctx.fillRect(sx + i, sy + 4, 1, sh - 7);
    }
    ctx.fillStyle = "rgba(255,200,80," + glow + ")";
    for (var j = 9; j < sw - 4; j += 13) {
      ctx.fillRect(sx + j, sy + 5, 1, 1);
    }
    // Jagged top edge
    ctx.fillStyle = "#1a0d0d";
    for (var k = 2; k < sw - 1; k += 5) {
      ctx.fillRect(sx + k, sy - 1, 1, 1);
    }
  }

  // ---- Zone 4: Glacier / Snow capped ice ------------------------
  function drawTileGlacier(sx, sy, sw, sh, p) {
    // Pale blue ice block with snow on top
    ctx.fillStyle = "#7ec4dc";
    ctx.fillRect(sx, sy, sw, sh);
    // Top snow
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(sx, sy - 1, sw, 4);
    // Snow drift bumps
    ctx.fillStyle = "#f0f8ff";
    ctx.fillRect(sx + 2, sy - 3, 4, 3);
    ctx.fillRect(sx + sw - 8, sy - 2, 5, 2);
    // Ice strata
    ctx.fillStyle = "#a8dcec";
    ctx.fillRect(sx, sy + 4, sw, 1);
    ctx.fillStyle = "#5aa0bc";
    ctx.fillRect(sx, sy + sh - 2, sw, 2);
    // Icicles hanging
    ctx.fillStyle = "#cce8f4";
    for (var i = 4; i < sw - 2; i += 7) {
      var iceLen = 3 + ((Math.floor(p.x) + i) % 5);
      ctx.beginPath();
      ctx.moveTo(sx + i, sy + sh);
      ctx.lineTo(sx + i + 1, sy + sh);
      ctx.lineTo(sx + i + 0.5, sy + sh + iceLen);
      ctx.fill();
    }
    // shimmer
    var sh1 = (Math.sin(state.time * 0.003 + p.x * 0.1) * 0.5 + 0.5) * sw * 0.4;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(sx + sw * 0.2, sy + 2, sh1, 1);
  }

  // ---- Zone 5: Marble (Greek temple) ----------------------------
  function drawTileMarble(sx, sy, sw, sh) {
    // White marble brick with gold trim
    ctx.fillStyle = "#ede4cc";
    ctx.fillRect(sx, sy, sw, sh);
    // Top highlight
    ctx.fillStyle = "#fff8e8";
    ctx.fillRect(sx, sy, sw, 2);
    // Bottom shadow
    ctx.fillStyle = "#a89c80";
    ctx.fillRect(sx, sy + sh - 2, sw, 2);
    // Gold accent strip
    ctx.fillStyle = "#d4a040";
    ctx.fillRect(sx + 1, sy + 3, sw - 2, 1);
    ctx.fillStyle = "#f8d860";
    ctx.fillRect(sx + 1, sy + 3, sw - 2, 1);
    ctx.fillStyle = "#d4a040";
    ctx.fillRect(sx + 1, sy + sh - 4, sw - 2, 1);
    // Marble veins (subtle diagonal lines)
    ctx.fillStyle = "rgba(180,160,120,0.45)";
    for (var i = 0; i < sw; i += 9) {
      ctx.fillRect(sx + i + 2, sy + 5, 3, 1);
    }
    // Brick mortar lines
    ctx.fillStyle = "rgba(100,80,40,0.3)";
    if (sw > 30) ctx.fillRect(sx + Math.floor(sw / 2), sy, 1, sh);
  }

  // ---- Zone 6: Cosmic crystal (space) ---------------------------
  function drawTileCosmic(sx, sy, sw, sh) {
    // Glowing crystal slab
    ctx.fillStyle = "#3a2a6e";
    ctx.fillRect(sx, sy, sw, sh);
    // Top crystal facet
    ctx.fillStyle = "#7a5ad8";
    ctx.fillRect(sx, sy, sw, 3);
    // Highlight
    ctx.fillStyle = "#c8b0ff";
    ctx.fillRect(sx + 2, sy, sw - 4, 1);
    // Bottom dark
    ctx.fillStyle = "#1a0d3a";
    ctx.fillRect(sx, sy + sh - 2, sw, 2);
    // Pulsing core lights
    var pulse = 0.5 + Math.sin(state.time * 0.004 + sx * 0.05) * 0.5;
    ctx.fillStyle = "rgba(160,255,220," + (0.4 + pulse * 0.5) + ")";
    for (var i = 5; i < sw - 3; i += 11) {
      ctx.fillRect(sx + i, sy + 4, 2, 2);
    }
    // Diagonal sparkle
    ctx.fillStyle = "rgba(255,255,255," + (0.3 + pulse * 0.4) + ")";
    var sparkX = sx + ((state.time * 0.05) % sw);
    ctx.fillRect(sparkX, sy + 1, 1, 1);
  }

  // ---- Zone 7: Divine / Summit golden -------------------------
  function drawTileDivine(sx, sy, sw, sh) {
    // Golden glowing platform
    var grad = ctx.createLinearGradient(0, sy, 0, sy + sh);
    grad.addColorStop(0, "#fff8c0");
    grad.addColorStop(0.5, "#f0c840");
    grad.addColorStop(1, "#a87020");
    ctx.fillStyle = grad;
    ctx.fillRect(sx, sy, sw, sh);
    // Top sheen
    ctx.fillStyle = "#ffffe8";
    ctx.fillRect(sx, sy, sw, 1);
    // Decorative dots
    ctx.fillStyle = "#704010";
    for (var i = 4; i < sw - 2; i += 6) {
      ctx.fillRect(sx + i, sy + sh - 3, 1, 1);
    }
    // Aura glow
    var aura = 0.4 + Math.sin(state.time * 0.003) * 0.2;
    ctx.fillStyle = "rgba(255,240,160," + aura + ")";
    ctx.fillRect(sx - 2, sy - 1, sw + 4, 1);
    ctx.fillRect(sx - 1, sy + sh, sw + 2, 1);
  }

  // ---- Generic stone (fallback) ---------------------------------
  function drawTileStone(sx, sy, sw, sh) {
    ctx.fillStyle = "#5a5a6e";
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = "#7a7a8e";
    ctx.fillRect(sx, sy, sw, 2);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(sx, sy + sh - 2, sw, 2);
  }

  // ---- Special: Moving (orange conveyor) ----------------------
  function drawTileMoving(sx, sy, sw, sh) {
    ctx.fillStyle = "#a05a18";
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = "#e8a840";
    ctx.fillRect(sx, sy, sw, 2);
    ctx.fillStyle = "#5a2a08";
    ctx.fillRect(sx, sy + sh - 2, sw, 2);
    // Moving stripe pattern
    var offset = (state.time * 0.04) % 8;
    ctx.fillStyle = "#f0c060";
    for (var i = -8 + offset; i < sw; i += 8) {
      ctx.beginPath();
      ctx.moveTo(sx + i, sy + 2);
      ctx.lineTo(sx + i + 4, sy + 2);
      ctx.lineTo(sx + i + 2, sy + sh - 2);
      ctx.lineTo(sx + i - 2, sy + sh - 2);
      ctx.fill();
    }
    // Arrows
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(sx + sw / 2 - 1, sy + 3, 3, 1);
    ctx.fillRect(sx + sw / 2 - 2, sy + 4, 5, 1);
  }

  // ---- Special: Crumbly (cracked red) -------------------------
  function drawTileCrumbly(sx, sy, sw, sh, p) {
    var shake = p._crumbling ? Math.sin(state.time * 0.05) * 2 : 0;
    ctx.save();
    ctx.translate(shake, 0);
    ctx.fillStyle = "#8a3a30";
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = "#c44a3a";
    ctx.fillRect(sx, sy, sw, 2);
    ctx.fillStyle = "#4a1a18";
    ctx.fillRect(sx, sy + sh - 2, sw, 2);
    // Cracks
    ctx.fillStyle = "#2a0808";
    for (var i = 3; i < sw - 2; i += 7) {
      ctx.fillRect(sx + i, sy + 3, 1, sh - 5);
    }
    // Glow if crumbling
    if (p._crumbling) {
      var fade = p._crumbling / 36;
      ctx.fillStyle = "rgba(255,220,80," + (1 - fade) * 0.6 + ")";
      ctx.fillRect(sx, sy, sw, sh);
    }
    ctx.restore();
  }

  // ---- Special: Ice (zone-agnostic icy block) ----------------
  function drawTileIce(sx, sy, sw, sh, p) {
    ctx.fillStyle = "#a0d8ef";
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = "#e0f4ff";
    ctx.fillRect(sx, sy, sw, 2);
    ctx.fillStyle = "#5a90b0";
    ctx.fillRect(sx, sy + sh - 2, sw, 2);
    // Cracks
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    var shimmer = (Math.sin(state.time * 0.003 + p.x * 0.1) * 0.5 + 0.5) * sw * 0.6;
    ctx.fillRect(sx + sw * 0.2, sy + 2, shimmer, 1);
    // Sub-strata
    ctx.fillStyle = "#88c4dc";
    ctx.fillRect(sx, sy + Math.floor(sh / 2), sw, 1);
  }

  // ---- Special: Spring (golden bouncy) -----------------------
  function drawTileSpring(sx, sy, sw, sh) {
    ctx.fillStyle = "#a07020";
    ctx.fillRect(sx, sy + 4, sw, sh - 4);
    ctx.fillStyle = "#e8c840";
    ctx.fillRect(sx, sy, sw, 4);
    ctx.fillStyle = "#fff8a0";
    ctx.fillRect(sx, sy, sw, 1);
    // Coil indicator
    ctx.fillStyle = "#704010";
    for (var i = 2; i < sw - 1; i += 4) {
      ctx.fillRect(sx + i, sy + 2, 2, 1);
    }
    // Arrow up
    ctx.fillStyle = "#ff4040";
    var ax = sx + sw / 2;
    ctx.fillRect(ax - 1, sy - 4, 2, 4);
    ctx.fillRect(ax - 3, sy - 2, 6, 1);
    ctx.fillRect(ax - 2, sy - 3, 4, 1);
  }

  // ---- Special: Victory (gold pedestal) ----------------------
  function drawTileVictory(sx, sy, sw, sh) {
    drawTileDivine(sx, sy, sw, sh);
    // Extra rim glow
    var aura = 0.5 + Math.sin(state.time * 0.005) * 0.3;
    ctx.fillStyle = "rgba(255,250,180," + aura + ")";
    ctx.fillRect(sx - 4, sy - 2, sw + 8, 1);
    ctx.fillRect(sx - 3, sy + sh + 1, sw + 6, 1);
  }

  /* ================================================================ */
  /*  BACKGROUND DRAWING — 8 zones, multi-layer parallax + motifs      */
  /* ================================================================ */

  // ---- helper: deterministic per-pixel hash for stable bg sprinkles
  function bgRand(seed) {
    var n = Math.sin(seed * 9.13) * 43758.5;
    return n - Math.floor(n);
  }

  // ---- Zone 0: 贫民窟卧室 -----------------------------------------
  function drawBgSlums(camY) {
    // Wallpaper gradient (purple/brown, moody dim room)
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#1a0e1f");
    grad.addColorStop(0.6, "#3a1f2c");
    grad.addColorStop(1, "#2a141d");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Wallpaper repeating pattern (diamond motif, very faint)
    ctx.fillStyle = "rgba(255,200,150,0.04)";
    var pOff = -camY * 0.08;
    for (var py = -20 + (pOff % 32); py < H + 20; py += 32) {
      for (var px = 0; px < W; px += 32) {
        ctx.fillRect(px + 14, py + 4, 4, 4);
        ctx.fillRect(px + 12, py + 6, 8, 1);
        ctx.fillRect(px + 13, py + 8, 6, 1);
      }
    }

    // Far layer: window with moonlight (parallax 0.3)
    var winY = 60 - camY * 0.3;
    if (winY < H && winY > -200) {
      // moonlight glow
      var moon = ctx.createRadialGradient(280, winY + 50, 5, 280, winY + 50, 120);
      moon.addColorStop(0, "rgba(160,200,255,0.5)");
      moon.addColorStop(1, "rgba(160,200,255,0)");
      ctx.fillStyle = moon;
      ctx.fillRect(160, winY - 40, 200, 200);

      // window frame
      ctx.fillStyle = "#2a1a25";
      ctx.fillRect(238, winY, 84, 110);
      ctx.fillStyle = "#1a2840";
      ctx.fillRect(244, winY + 6, 72, 98);
      // Moon
      ctx.fillStyle = "#f0e8b8";
      ctx.beginPath();
      ctx.arc(282, winY + 38, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a2840";
      ctx.beginPath();
      ctx.arc(288, winY + 34, 12, 0, Math.PI * 2);
      ctx.fill();
      // Stars in window
      ctx.fillStyle = "#fff";
      ctx.fillRect(252, winY + 18, 1, 1);
      ctx.fillRect(260, winY + 28, 1, 1);
      ctx.fillRect(310, winY + 60, 1, 1);
      // Window cross
      ctx.fillStyle = "#2a1a25";
      ctx.fillRect(278, winY + 6, 4, 98);
      ctx.fillRect(244, winY + 50, 72, 4);
    }

    // Mid layer: poster on wall (parallax 0.4)
    var postY = 200 - camY * 0.4;
    if (postY < H && postY > -100) {
      ctx.fillStyle = "#3a2a20";
      ctx.fillRect(40, postY, 56, 72);
      ctx.fillStyle = "#7a4030";
      ctx.fillRect(44, postY + 4, 48, 64);
      // poster art
      ctx.fillStyle = "#e8b040";
      ctx.fillRect(56, postY + 16, 24, 8);
      ctx.fillStyle = "#e84040";
      ctx.fillRect(50, postY + 30, 36, 4);
      ctx.fillStyle = "#202";
      ctx.fillRect(54, postY + 50, 28, 10);
    }

    // Mid layer: clock (parallax 0.5)
    var clockY = 350 - camY * 0.5;
    if (clockY < H && clockY > -80) {
      ctx.fillStyle = "#1a1010";
      ctx.beginPath(); ctx.arc(120, clockY, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#d8c898";
      ctx.beginPath(); ctx.arc(120, clockY, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#202";
      // clock hands
      ctx.fillRect(119, clockY - 10, 2, 11);
      ctx.fillRect(119, clockY, 8, 2);
      // tick marks
      ctx.fillStyle = "#403020";
      ctx.fillRect(119, clockY - 14, 2, 2);
      ctx.fillRect(119, clockY + 12, 2, 2);
      ctx.fillRect(105, clockY - 1, 2, 2);
      ctx.fillRect(133, clockY - 1, 2, 2);
    }

    // Near layer: dust motes drifting (parallax 0.7)
    ctx.fillStyle = "rgba(220,200,160,0.4)";
    for (var d = 0; d < 12; d++) {
      var dxp = (d * 73 + state.time * 0.01) % W;
      var dyp = (d * 137 - camY * 0.7) % (H + 80);
      if (dyp < 0) dyp += H + 80;
      ctx.fillRect(dxp, dyp, 1, 1);
    }

    // Floor / wallboard at bottom of starting zone
    var floorY = 7995 - camY;
    if (floorY < H + 50 && floorY > -50) {
      ctx.fillStyle = "#1a0808";
      ctx.fillRect(0, floorY, W, H - floorY + 50);
      ctx.fillStyle = "#3a201a";
      ctx.fillRect(0, floorY, W, 3);
      // Wood planks
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      for (var f = 0; f < W; f += 22) {
        ctx.fillRect(f, floorY + 3, 1, H - floorY);
      }
    }
  }

  // ---- Zone 1: 都市楼宇 ----------------------------------------
  function drawBgCity(camY) {
    // Sky gradient with sunset bleed
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0d0d24");
    grad.addColorStop(0.4, "#1a1a3e");
    grad.addColorStop(0.7, "#3a2860");
    grad.addColorStop(1, "#a85060");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Far stars
    for (var i = 0; i < 50; i++) {
      var sx = (i * 47 + 13) % W;
      var sy = ((i * 31 + 7) % 240) - camY * 0.04;
      while (sy < 0) sy += 240;
      if (sy > H) continue;
      var twinkle = 0.4 + 0.6 * Math.abs(Math.sin(state.time * 0.001 + i));
      ctx.fillStyle = "rgba(255,255,255," + twinkle + ")";
      ctx.fillRect(sx, sy, 1 + (i % 2), 1);
    }

    // Distant skyline (parallax 0.2)
    var farBuildings = [
      { x: 0, w: 38, h: 120 }, { x: 42, w: 28, h: 180 }, { x: 75, w: 50, h: 95 },
      { x: 130, w: 32, h: 220 }, { x: 168, w: 44, h: 140 }, { x: 218, w: 36, h: 190 },
      { x: 260, w: 42, h: 110 }, { x: 308, w: 52, h: 165 },
    ];
    var farBase = H + camY * 0.2;
    ctx.fillStyle = "#1a1a3a";
    for (var fb = 0; fb < farBuildings.length; fb++) {
      var b1 = farBuildings[fb];
      ctx.fillRect(b1.x, farBase - b1.h, b1.w, b1.h);
    }
    // Far windows (smaller, dimmer)
    ctx.fillStyle = "#7a8080";
    for (var fw = 0; fw < 40; fw++) {
      var fwx = (fw * 51 + 11) % W;
      var fwy = farBase - 30 - (fw * 39) % 180;
      if (fwy > 0 && fwy < H) ctx.fillRect(fwx, fwy, 2, 2);
    }

    // Mid skyline (parallax 0.4)
    var midBuildings = [
      { x: -10, w: 55, h: 280 }, { x: 50, w: 40, h: 360 }, { x: 95, w: 65, h: 220 },
      { x: 165, w: 45, h: 420 }, { x: 215, w: 60, h: 300 }, { x: 280, w: 50, h: 380 },
      { x: 335, w: 55, h: 250 },
    ];
    var midBase = H + camY * 0.4;
    ctx.fillStyle = "#0e0e1c";
    for (var mb = 0; mb < midBuildings.length; mb++) {
      var b2 = midBuildings[mb];
      ctx.fillRect(b2.x, midBase - b2.h, b2.w, b2.h);
      // Antenna on tallest
      if (b2.h > 350) {
        ctx.fillStyle = "#0e0e1c";
        ctx.fillRect(b2.x + b2.w / 2, midBase - b2.h - 20, 1, 20);
        var blink = (Math.floor(state.time / 600) % 2);
        if (blink) {
          ctx.fillStyle = "#ff4040";
          ctx.fillRect(b2.x + b2.w / 2 - 1, midBase - b2.h - 22, 3, 3);
        }
        ctx.fillStyle = "#0e0e1c";
      }
    }
    // Window grids
    ctx.fillStyle = "#ffe080";
    for (var mw = 0; mw < 80; mw++) {
      var mwx = (mw * 31 + 17) % W;
      var mwy = midBase - 50 - ((mw * 41) % 350);
      if (mwy > 0 && mwy < H && (mw % 3)) {
        ctx.fillRect(mwx, mwy, 2, 2);
      }
    }

    // Floating drones / planes (slow drift)
    var planeT = (state.time * 0.02) % (W + 80);
    var planeY = 80 - camY * 0.15;
    if (planeY > 0 && planeY < H) {
      ctx.fillStyle = "#404060";
      ctx.fillRect(planeT - 40, planeY, 16, 3);
      ctx.fillRect(planeT - 36, planeY - 2, 8, 2);
      // blinking red light
      if (Math.floor(state.time / 300) % 2) {
        ctx.fillStyle = "#ff4040";
        ctx.fillRect(planeT - 40, planeY + 1, 1, 1);
      }
    }
  }

  // ---- Zone 2: 云端塔楼 ----------------------------------------
  function drawBgClouds(camY) {
    // Daytime gradient sky
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#3a70b8");
    grad.addColorStop(0.4, "#6aa8d8");
    grad.addColorStop(0.85, "#a8d0e8");
    grad.addColorStop(1, "#d8e8f0");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Sun
    var sunY = 80 - camY * 0.05;
    if (sunY < H + 80 && sunY > -80) {
      var sunGlow = ctx.createRadialGradient(80, sunY, 5, 80, sunY, 60);
      sunGlow.addColorStop(0, "rgba(255,240,180,0.6)");
      sunGlow.addColorStop(1, "rgba(255,240,180,0)");
      ctx.fillStyle = sunGlow;
      ctx.fillRect(20, sunY - 60, 120, 120);
      ctx.fillStyle = "#fff8d0";
      ctx.beginPath();
      ctx.arc(80, sunY, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fffaf0";
      ctx.beginPath();
      ctx.arc(76, sunY - 3, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    // Far clouds (parallax 0.1)
    drawCloudLayer(camY * 0.1, 0.4, 30, 60, 6);
    // Mid clouds (parallax 0.25)
    drawCloudLayer(camY * 0.25, 0.7, 40, 80, 8);
    // Near wispy
    drawCloudLayer(camY * 0.45, 0.3, 20, 40, 10);

    // Hot air balloons drifting
    var balloonT = (state.time * 0.008) % (W + 100);
    var balY = 150 - camY * 0.2;
    if (balY > -60 && balY < H) {
      ctx.fillStyle = "#e85050";
      ctx.beginPath();
      ctx.arc(balloonT - 50, balY, 14, Math.PI * 0.1, Math.PI * 0.9, true);
      ctx.fill();
      ctx.fillStyle = "#fff8d0";
      ctx.fillRect(balloonT - 53, balY - 3, 6, 4);
      ctx.fillStyle = "#404040";
      ctx.fillRect(balloonT - 51, balY + 14, 2, 4);
      ctx.fillRect(balloonT - 49, balY + 14, 2, 4);
      ctx.fillStyle = "#8b4513";
      ctx.fillRect(balloonT - 53, balY + 18, 6, 4);
    }

    // Bird flock V (parallax 0.55)
    var birdT = ((state.time * 0.025) % (W + 60));
    var birdY = 240 - camY * 0.55;
    if (birdY > -10 && birdY < H) {
      ctx.fillStyle = "#1a1a1a";
      var wing = Math.sin(state.time * 0.012) > 0 ? 1 : -1;
      for (var bv = 0; bv < 5; bv++) {
        var bx = birdT - bv * 10;
        var by = birdY + Math.abs(bv - 2) * 3;
        ctx.fillRect(bx - 2, by, 2, 1);
        ctx.fillRect(bx, by - wing, 1, 1);
        ctx.fillRect(bx + 2, by, 2, 1);
      }
    }
  }

  function drawCloudLayer(camOffset, alpha, minW, maxW, count) {
    ctx.fillStyle = "rgba(255,255,255," + alpha + ")";
    for (var i = 0; i < count; i++) {
      var cx = ((i * 137 + 53 + state.time * 0.005) % (W + 120)) - 60;
      var cy = ((i * 89 + 31) % 900) - camOffset;
      while (cy < -60) cy += 900;
      var cw = minW + (i * 19) % (maxW - minW);
      drawCloud(cx, cy, cw);
    }
  }

  function drawCloud(cx, cy, w) {
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.4, 0, Math.PI * 2);
    ctx.arc(cx - w * 0.3, cy + 4, w * 0.3, 0, Math.PI * 2);
    ctx.arc(cx + w * 0.3, cy + 2, w * 0.35, 0, Math.PI * 2);
    ctx.arc(cx + w * 0.55, cy - 1, w * 0.22, 0, Math.PI * 2);
    ctx.arc(cx - w * 0.55, cy + 1, w * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Zone 3: 火山熔岩 ----------------------------------------
  function drawBgVolcano(camY) {
    // Smoky red-black gradient
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#1a0a0a");
    grad.addColorStop(0.4, "#2a1010");
    grad.addColorStop(0.8, "#601a18");
    grad.addColorStop(1, "#a02a18");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Smoke clouds (parallax 0.15)
    ctx.fillStyle = "rgba(50,30,30,0.5)";
    for (var s = 0; s < 8; s++) {
      var smx = ((s * 91 + 33 + state.time * 0.01) % (W + 80)) - 40;
      var smy = (s * 73 - camY * 0.15) % 700;
      while (smy < -40) smy += 700;
      var smw = 50 + (s * 13) % 30;
      drawCloud(smx, smy, smw);
    }

    // Distant volcano peaks (parallax 0.25)
    var peakY = H - 100 + camY * 0.25;
    ctx.fillStyle = "#2a0a08";
    ctx.beginPath();
    ctx.moveTo(0, peakY);
    ctx.lineTo(50, peakY - 80);
    ctx.lineTo(80, peakY - 60);
    ctx.lineTo(130, peakY - 110);
    ctx.lineTo(170, peakY - 70);
    ctx.lineTo(220, peakY - 90);
    ctx.lineTo(280, peakY - 55);
    ctx.lineTo(330, peakY - 95);
    ctx.lineTo(W, peakY - 50);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // Glowing lava lake (parallax 0.05, near bottom of zone)
    var lavaY = H + camY * 0.05 - 40;
    if (lavaY < H + 100 && lavaY > -50) {
      var lavaGlow = ctx.createLinearGradient(0, lavaY - 60, 0, lavaY + 80);
      lavaGlow.addColorStop(0, "rgba(255,80,20,0)");
      lavaGlow.addColorStop(0.5, "rgba(255,120,30,0.4)");
      lavaGlow.addColorStop(1, "rgba(255,200,60,0.7)");
      ctx.fillStyle = lavaGlow;
      ctx.fillRect(0, lavaY - 60, W, 140);
    }

    // Flame jets (parallax 0.4)
    for (var fl = 0; fl < 4; fl++) {
      var flx = fl * 90 + 30;
      var fly = H - 30 + camY * 0.4 - Math.abs(Math.sin(state.time * 0.005 + fl * 1.7)) * 30;
      if (fly < H + 60 && fly > -20) {
        ctx.fillStyle = "rgba(255,180,40,0.6)";
        ctx.beginPath();
        ctx.moveTo(flx, fly + 30);
        ctx.lineTo(flx + 8, fly);
        ctx.lineTo(flx + 16, fly + 30);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,80,20,0.6)";
        ctx.beginPath();
        ctx.moveTo(flx + 3, fly + 30);
        ctx.lineTo(flx + 8, fly + 10);
        ctx.lineTo(flx + 13, fly + 30);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Embers (particles)
    for (var i = 0; i < state.embers.length; i++) {
      var e = state.embers[i];
      var ey = e.y - camY * 0.3;
      ctx.fillStyle = "rgba(255," + Math.floor(100 + e.bright) + ",20," + e.alpha + ")";
      ctx.fillRect(e.x, ey, 2, 2);
    }

    // Heat haze ripple (top overlay)
    ctx.fillStyle = "rgba(255,80,20,0.04)";
    ctx.fillRect(0, 0, W, H);
  }

  // ---- Zone 4: 冰川峰顶 ---------------------------------------
  function drawBgIce(camY) {
    // Bright icy sky with aurora
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#1a3a5a");
    grad.addColorStop(0.4, "#5a90c0");
    grad.addColorStop(0.7, "#a0d4e8");
    grad.addColorStop(1, "#e0f0f8");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Aurora ribbons (parallax 0.08)
    var auroraY = 80 - camY * 0.08;
    if (auroraY < H + 100) {
      for (var a = 0; a < 3; a++) {
        var auColor = ["rgba(100,255,180,0.25)", "rgba(150,100,255,0.2)", "rgba(80,200,255,0.22)"][a];
        ctx.fillStyle = auColor;
        ctx.beginPath();
        ctx.moveTo(0, auroraY + a * 12);
        for (var x = 0; x <= W; x += 8) {
          var wave = Math.sin(state.time * 0.0008 + x * 0.02 + a) * 25;
          ctx.lineTo(x, auroraY + a * 12 + wave);
        }
        for (var x2 = W; x2 >= 0; x2 -= 8) {
          var wave2 = Math.sin(state.time * 0.0008 + x2 * 0.02 + a) * 25 + 25;
          ctx.lineTo(x2, auroraY + a * 12 + wave2);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    // Distant mountain range (parallax 0.2)
    var mtnY = H - 80 + camY * 0.2;
    ctx.fillStyle = "#7a90b0";
    ctx.beginPath();
    ctx.moveTo(0, mtnY);
    var pts = [[0, 0], [40, -60], [80, -30], [130, -90], [180, -50], [230, -100], [280, -60], [330, -85], [360, -40]];
    for (var p = 0; p < pts.length; p++) ctx.lineTo(pts[p][0], mtnY + pts[p][1]);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    // Mountain snow caps
    ctx.fillStyle = "#ffffff";
    for (var sp = 0; sp < pts.length - 1; sp += 2) {
      if (pts[sp][1] < -50) {
        ctx.beginPath();
        ctx.moveTo(pts[sp][0] - 8, mtnY + pts[sp][1] + 18);
        ctx.lineTo(pts[sp][0], mtnY + pts[sp][1]);
        ctx.lineTo(pts[sp][0] + 8, mtnY + pts[sp][1] + 18);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Closer ice cliffs (parallax 0.4)
    var cliffY = H - 30 + camY * 0.4;
    ctx.fillStyle = "#b8dce8";
    ctx.beginPath();
    ctx.moveTo(0, cliffY);
    ctx.lineTo(60, cliffY - 40);
    ctx.lineTo(120, cliffY - 25);
    ctx.lineTo(180, cliffY - 50);
    ctx.lineTo(240, cliffY - 30);
    ctx.lineTo(300, cliffY - 55);
    ctx.lineTo(W, cliffY - 35);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // Snowflakes (particles)
    ctx.fillStyle = "#ffffff";
    for (var i = 0; i < state.snowflakes.length; i++) {
      var s = state.snowflakes[i];
      var sy = s.y - camY * 0.25;
      ctx.globalAlpha = s.alpha;
      ctx.fillRect(s.x, sy, s.size, s.size);
      ctx.fillRect(s.x + s.size * 2, sy, s.size, s.size);
      ctx.fillRect(s.x + s.size, sy - s.size * 2, s.size, s.size);
      ctx.fillRect(s.x + s.size, sy + s.size * 2, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  // ---- Zone 5: 古希腊神庙 -----------------------------------------
  function drawBgTemple(camY) {
    // Golden hour sky behind temple
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#5070b0");
    grad.addColorStop(0.5, "#d4a878");
    grad.addColorStop(0.8, "#e8c890");
    grad.addColorStop(1, "#d4b478");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Sun disk
    var sunY = 100 - camY * 0.08;
    if (sunY > -60 && sunY < H + 60) {
      var sunGlow = ctx.createRadialGradient(W / 2, sunY, 5, W / 2, sunY, 90);
      sunGlow.addColorStop(0, "rgba(255,240,180,0.5)");
      sunGlow.addColorStop(1, "rgba(255,240,180,0)");
      ctx.fillStyle = sunGlow;
      ctx.fillRect(W / 2 - 90, sunY - 90, 180, 180);
      ctx.fillStyle = "#fff5c8";
      ctx.beginPath();
      ctx.arc(W / 2, sunY, 26, 0, Math.PI * 2);
      ctx.fill();
    }

    // Distant mountains (parallax 0.15)
    var mtnY = H - 60 + camY * 0.15;
    ctx.fillStyle = "#8a6a40";
    ctx.beginPath();
    ctx.moveTo(0, mtnY);
    ctx.lineTo(60, mtnY - 70);
    ctx.lineTo(120, mtnY - 40);
    ctx.lineTo(180, mtnY - 80);
    ctx.lineTo(240, mtnY - 50);
    ctx.lineTo(300, mtnY - 75);
    ctx.lineTo(W, mtnY - 35);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // Marble columns row (parallax 0.4, between platforms)
    ctx.fillStyle = "rgba(248,232,200,0.35)";
    var colOff = camY * 0.4;
    for (var c = 0; c < 5; c++) {
      var cx = c * 75 + 25;
      var cy = (200 - colOff % 400);
      while (cy < -300) cy += 400;
      // shaft
      ctx.fillRect(cx, cy, 12, 200);
      // fluting lines
      ctx.fillStyle = "rgba(140,120,80,0.3)";
      ctx.fillRect(cx + 2, cy, 1, 200);
      ctx.fillRect(cx + 6, cy, 1, 200);
      ctx.fillRect(cx + 10, cy, 1, 200);
      // capital & base
      ctx.fillStyle = "rgba(248,232,200,0.4)";
      ctx.fillRect(cx - 3, cy, 18, 6);
      ctx.fillRect(cx - 3, cy + 194, 18, 6);
    }

    // Floating laurel leaves
    ctx.fillStyle = "rgba(60,120,40,0.6)";
    for (var lf = 0; lf < 6; lf++) {
      var lfx = ((lf * 117 + state.time * 0.02) % (W + 30)) - 15;
      var lfy = (lf * 89 - camY * 0.5) % 800;
      while (lfy < -20) lfy += 800;
      ctx.beginPath();
      ctx.ellipse(lfx, lfy, 4, 2, lf, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- Zone 6: 宇宙太空 ------------------------------------------
  function drawBgSpace(camY) {
    // Deep space
    ctx.fillStyle = "#04040f";
    ctx.fillRect(0, 0, W, H);

    // Stars (already in state.stars)
    for (var i = 0; i < state.stars.length; i++) {
      var s = state.stars[i];
      var sy = s.y - camY * 0.08;
      var tw = 0.5 + 0.5 * Math.sin(s.twinkle);
      ctx.fillStyle = "rgba(255,255,255," + s.alpha * tw + ")";
      ctx.fillRect(s.x, sy, s.size, s.size);
      // bigger stars get cross flare
      if (s.size >= 2 && tw > 0.8) {
        ctx.fillStyle = "rgba(255,255,255," + 0.4 * tw + ")";
        ctx.fillRect(s.x - 1, sy + 0.5, 4, 1);
        ctx.fillRect(s.x + 0.5, sy - 1, 1, 4);
      }
    }

    // Far galaxy
    var galX = 90, galY = 200 - camY * 0.05;
    if (galY > -100 && galY < H + 100) {
      var galGrad = ctx.createRadialGradient(galX, galY, 0, galX, galY, 80);
      galGrad.addColorStop(0, "rgba(200,160,240,0.4)");
      galGrad.addColorStop(0.5, "rgba(120,80,200,0.2)");
      galGrad.addColorStop(1, "rgba(120,80,200,0)");
      ctx.fillStyle = galGrad;
      ctx.fillRect(galX - 80, galY - 80, 160, 160);
      // bright core
      ctx.fillStyle = "rgba(255,240,220,0.9)";
      ctx.fillRect(galX - 1, galY - 1, 3, 3);
    }

    // Distant planet
    var planetY = 400 - camY * 0.12;
    if (planetY > -60 && planetY < H + 60) {
      // ring
      ctx.fillStyle = "rgba(200,180,140,0.5)";
      ctx.beginPath();
      ctx.ellipse(280, planetY, 38, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // planet body
      var pGrad = ctx.createRadialGradient(275, planetY - 5, 4, 280, planetY, 24);
      pGrad.addColorStop(0, "#e8c890");
      pGrad.addColorStop(1, "#604030");
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.arc(280, planetY, 22, 0, Math.PI * 2);
      ctx.fill();
      // ring front
      ctx.fillStyle = "rgba(220,200,160,0.6)";
      ctx.beginPath();
      ctx.ellipse(280, planetY + 2, 38, 8, 0, 0, Math.PI);
      ctx.fill();
    }

    // Drifting asteroid (parallax 0.25)
    var astT = ((state.time * 0.04) % (W + 50));
    var astY = 600 - camY * 0.25;
    if (astY > -30 && astY < H + 30) {
      ctx.fillStyle = "#6a5a4a";
      ctx.beginPath();
      ctx.arc(astT - 25, astY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#403028";
      ctx.fillRect(astT - 26, astY - 2, 2, 2);
      ctx.fillRect(astT - 22, astY + 1, 2, 2);
    }

    // Shooting star
    var ssT = (state.time * 0.001) % 8;
    if (ssT < 1.5) {
      var ssX = ssT * W;
      var ssY = 100 + ssT * 50 - camY * 0.4;
      if (ssY > 0 && ssY < H) {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillRect(ssX, ssY, 3, 1);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillRect(ssX - 10, ssY, 10, 1);
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(ssX - 20, ssY, 10, 1);
      }
    }

    // Nebula clouds
    var nebY1 = 300 - camY * 0.05;
    if (nebY1 > -200 && nebY1 < H + 200) {
      var nebGrad = ctx.createRadialGradient(80, nebY1, 0, 80, nebY1, 130);
      nebGrad.addColorStop(0, "rgba(100,60,200,0.18)");
      nebGrad.addColorStop(1, "rgba(100,60,200,0)");
      ctx.fillStyle = nebGrad;
      ctx.fillRect(-50, nebY1 - 130, 260, 260);
    }
    var nebY2 = 500 - camY * 0.05;
    if (nebY2 > -200 && nebY2 < H + 200) {
      var nebGrad2 = ctx.createRadialGradient(290, nebY2, 0, 290, nebY2, 110);
      nebGrad2.addColorStop(0, "rgba(40,120,200,0.15)");
      nebGrad2.addColorStop(1, "rgba(40,120,200,0)");
      ctx.fillStyle = nebGrad2;
      ctx.fillRect(180, nebY2 - 110, 220, 220);
    }
  }

  // ---- Zone 7: 顶点 ---------------------------------------------
  function drawBgSummit(camY) {
    // Heavenly gradient
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#fff8e0");
    grad.addColorStop(0.3, "#f0d890");
    grad.addColorStop(0.7, "#e0a850");
    grad.addColorStop(1, "#a06030");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Heavenly light rays from top
    for (var i = 0; i < 14; i++) {
      var angle = (i / 14) * Math.PI;
      var lx = W / 2 + Math.cos(angle) * 30;
      var ly = -20;
      var len = 350 + Math.sin(state.time * 0.001 + i) * 80;
      var rayGrad = ctx.createLinearGradient(lx, ly, lx + Math.cos(angle) * len, ly + Math.sin(angle) * len);
      rayGrad.addColorStop(0, "rgba(255,250,200,0.15)");
      rayGrad.addColorStop(1, "rgba(255,250,200,0)");
      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(lx - 4, ly);
      ctx.lineTo(lx + Math.cos(angle) * len - 20, ly + Math.sin(angle) * len);
      ctx.lineTo(lx + Math.cos(angle) * len + 20, ly + Math.sin(angle) * len);
      ctx.lineTo(lx + 4, ly);
      ctx.closePath();
      ctx.fill();
    }

    // Cloud sea at bottom (parallax 0.2)
    var cloudSeaY = H - 60 + camY * 0.2;
    for (var c = 0; c < 12; c++) {
      var ccx = (c * 38 + 20);
      var ccy = cloudSeaY + (c % 3) * 12;
      ctx.fillStyle = "rgba(255,240,200,0.6)";
      drawCloud(ccx, ccy, 40 + (c * 7) % 25);
    }

    // Glowing orbs floating up
    for (var o = 0; o < 10; o++) {
      var orbX = (o * 37 + 13) % W;
      var orbY = ((o * 137 + state.time * 0.03) % 800) - 100;
      var orbScreenY = orbY - camY * 0.3;
      if (orbScreenY > -10 && orbScreenY < H + 10) {
        var orbGrad = ctx.createRadialGradient(orbX, orbScreenY, 0, orbX, orbScreenY, 8);
        orbGrad.addColorStop(0, "rgba(255,255,200,0.8)");
        orbGrad.addColorStop(1, "rgba(255,255,200,0)");
        ctx.fillStyle = orbGrad;
        ctx.fillRect(orbX - 8, orbScreenY - 8, 16, 16);
        ctx.fillStyle = "#fff8c0";
        ctx.fillRect(orbX, orbScreenY, 2, 2);
      }
    }

    // Floating golden particles (parallax 0.5)
    ctx.fillStyle = "#fff8d0";
    for (var d = 0; d < 30; d++) {
      var dxp = (d * 53 + state.time * 0.01) % W;
      var dyp = ((d * 113 - camY * 0.5) % 700);
      while (dyp < 0) dyp += 700;
      var dsize = 1 + (d % 2);
      ctx.fillRect(dxp, dyp, dsize, dsize);
    }
  }

  /* ================================================================ */
  /*  PARTICLES                                                        */
  /* ================================================================ */

  function spawnParticles(x, y, color, count) {
    for (var i = 0; i < count; i++) {
      state.particles.push({
        x: x, y: y,
        vx: rand(-2, 2),
        vy: rand(-3, -1),
        life: rand(15, 30),
        color: color,
        size: rand(1, 3),
      });
    }
  }

  function updateParticles() {
    for (var i = state.particles.length - 1; i >= 0; i--) {
      var p = state.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life--;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  function drawParticles(camY) {
    for (var i = 0; i < state.particles.length; i++) {
      var p = state.particles[i];
      var alpha = p.life / 30;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y - camY), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  /* ================================================================ */
  /*  HUD RENDERING                                                    */
  /* ================================================================ */

  function drawHUD() {
    // Semi-transparent top bar
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, W, 32);

    // Time (top left)
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
    ctx.textAlign = "left";
    ctx.fillText(state.timeText, 8, 22);

    // Zone name (top center)
    var zone = ZONES[state.zoneIndex] || ZONES[0];
    var zoneLabel = zone.emoji + " " + zone.name;
    ctx.textAlign = "center";
    ctx.fillText(zoneLabel, W / 2, 22);

    // Falls (top right)
    ctx.textAlign = "right";
    ctx.fillStyle = "#ff8888";
    ctx.fillText("💀 " + state.falls, W - 8, 22);

    // Height progress bar (right side)
    var progress = Math.max(0, Math.min(1, (WORLD_HEIGHT - state.player.y) / WORLD_HEIGHT));
    var barX = W - 10;
    var barY = 40;
    var barH = H - 80;
    var barW = 6;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = "#4ade80";
    var fillH = barH * progress;
    ctx.fillRect(barX, barY + barH - fillH, barW, fillH);

    // Zone separators on progress bar
    for (var i = 0; i < ZONES.length; i++) {
      var zy = (WORLD_HEIGHT - ZONES[i].yStart) / WORLD_HEIGHT;
      var zpy = barY + barH * (1 - zy);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(barX - 2, zpy, barW + 4, 1);
    }

    // Best time
    if (state.bestTime !== null) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, H - 24, 120, 24);
      ctx.fillStyle = "#ffd700";
      ctx.textAlign = "left";
      ctx.fillText("🏆 Best " + fmtTime(state.bestTime), 8, H - 8);
    }
  }

  /* ================================================================ */
  /*  PHYSICS & COLLISION UPDATE                                       */
  /* ================================================================ */

  function updatePlayer() {
    var p = state.player;
    var zone = ZONES[state.zoneIndex] || ZONES[0];
    var grav = GRAVITY * (zone.gravity || 1);
    var friction = (zone.friction || 1);

    // Input
    var moveDir = 0;
    if (keys["ArrowLeft"] || keys["KeyA"] || state.touchLeft) moveDir = -1;
    if (keys["ArrowRight"] || keys["KeyD"] || state.touchRight) moveDir = 1;
    if (moveDir !== 0) p.facing = moveDir;

    // Jump input
    var jumpPressed = keys["Space"] || keys["ArrowUp"] || keys["KeyW"] || state.touchJump;
    if (jumpPressed && !p._prevJump) {
      p.jumpRequested = true;
      p.jumpBuffer = JUMP_BUFFER_FRAMES;
    }
    p._prevJump = jumpPressed;

    if (jumpPressed && p.jumpHeld && p.vy < 0) {
      // Hold jump for higher jump
    } else if (!jumpPressed && p.jumpHeld && p.vy < JUMP_VEL * VAR_JUMP_RELEASE) {
      p.vy = JUMP_VEL * VAR_JUMP_RELEASE;
      p.jumpHeld = false;
    }

    // Horizontal movement
    var accel = p.onGround ? MOVE_SPEED * 0.45 : AIR_ACCEL;
    if (moveDir !== 0) {
      p.vx += moveDir * accel;
      if (p.onGround) {
        p.vx = Math.min(Math.abs(p.vx), MOVE_SPEED) * Math.sign(p.vx);
      }
    }
    if (p.onGround && moveDir === 0) {
      p.vx *= GROUND_FRICTION * friction;
      if (Math.abs(p.vx) < 0.08) p.vx = 0;
    }

    // Wind
    if (zone.wind) {
      p.vx += zone.wind * 0.025;
    }

    // Clamp
    p.vx = Math.max(-MAX_FALL, Math.min(MAX_FALL, p.vx));

    // Gravity
    p.vy += grav;
    p.vy = Math.min(p.vy, MAX_FALL);

    // Move
    p.x += p.vx;
    p.y += p.vy;

    // Wrap
    if (p.x < -PLAYER_W) p.x = W;
    if (p.x > W) p.x = -PLAYER_W;

    // Death check
    if (p.y > DEATH_Y) {
      respawnPlayer();
      return;
    }

    // Collision
    p.onGround = false;
    var platforms = getActivePlatforms();

    for (var i = 0; i < platforms.length; i++) {
      var plat = platforms[i];
      if (plat._dead) continue;

      var platX = plat.x;
      var platY = plat.y;

      // Moving platform position
      if (plat.type === "moving" && plat._orgX !== undefined) {
        var mt = state.time * 0.001 * (plat.speed * 60 || 1.5);
        platX = plat._orgX + Math.sin(mt) * (plat.range || 60);
      }

      // AABB
      if (p.x + PLAYER_W > platX && p.x < platX + plat.w) {
        // Landing on top
        if (p.y + PLAYER_H >= platY && p.y + PLAYER_H - p.vy <= platY + 6 && p.vy >= 0) {
          p.y = platY - PLAYER_H;
          p.vy = 0;
          p.onGround = true;
          p.coyoteTimer = COYOTE_FRAMES;
          p.jumpHeld = false;

          // Victory
          if (plat.type === "victory") {
            clearGame();
            return;
          }

          // Spring
          if (plat.type === "spring") {
            p.vy = JUMP_VEL * (plat.power || 1.6);
            p.onGround = false;
            spawnParticles(p.x + PLAYER_W / 2, p.y + PLAYER_H, "#ffe040", 10);
          }

          // Crumbly
          if (plat.type === "crumbly" && !plat._crumbling) {
            plat._crumbling = 36;
          }

          // Landing particles
          if (p.vy === 0 && Math.abs(p.vy) < 0.1) {
            // normal landing, no particles
          }
        }
        // Side collision
        else if (p.y + PLAYER_H > platY + 3 && p.y < platY + (plat.h || 8) - 3) {
          if (p.vx > 0 && p.x + PLAYER_W - p.vx <= platX + 3) {
            p.x = platX - PLAYER_W;
            p.vx = 0;
          } else if (p.vx < 0 && p.x - p.vx >= platX + plat.w - 3) {
            p.x = platX + plat.w;
            p.vx = 0;
          }
        }
      }
    }

    // Coyote time
    if (!p.onGround) {
      if (p.coyoteTimer > 0) p.coyoteTimer--;
      if (p.coyoteTimer > 0) p.onGround = true; // fake ground for jump
    }

    // Jump buffer
    if (p.jumpBuffer > 0) p.jumpBuffer--;
    if (p.jumpRequested && p.onGround) {
      p.vy = JUMP_VEL;
      p.onGround = false;
      p.coyoteTimer = 0;
      p.jumpRequested = false;
      p.jumpBuffer = 0;
      p.jumpHeld = true;
      spawnParticles(p.x + PLAYER_W / 2, p.y + PLAYER_H, "#fff", 5);
    }
    if (p.jumpBuffer <= 0) p.jumpRequested = false;

    // Update crumbling platforms
    for (var j = 0; j < platforms.length; j++) {
      var cp = platforms[j];
      if (cp._crumbling) {
        cp._crumbling--;
        if (cp._crumbling <= 0) {
          cp._dead = true;
          spawnParticles(cp.x + cp.w / 2, cp.y + 4, COLORS.platCrumbly, 12);
        }
      }
    }

    // Update max height
    if (p.y < state.maxHeightY) {
      state.maxHeightY = p.y;
    }
    var heightPercent = Math.max(0, Math.min(1, (WORLD_HEIGHT - p.y) / WORLD_HEIGHT));
    if (heightPercent > state.bestHeight) {
      state.bestHeight = heightPercent;
    }

    // Update zone
    state.zoneIndex = getZoneIndex(p.y);
  }

  function respawnPlayer() {
    if (state.respawning) return;
    state.respawning = true;
    state.falls++;
    state.fadeDir = 1;
    state.fadeAlpha = 0;

    setTimeout(function () {
      state.player.x = START_X;
      state.player.y = START_Y;
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.onGround = true;
      state.player.coyoteTimer = 0;
      state.player.jumpBuffer = 0;
      state.player.jumpRequested = false;
      state.player.jumpHeld = false;
      state.camera.y = START_Y - 300;
      state.camera.targetY = START_Y - 300;
      state.zoneIndex = 0;
      // Clear crumbling states
      for (var z = 0; z < ZONES.length; z++) {
        if (ZONES[z].platforms) {
          for (var i = 0; i < ZONES[z].platforms.length; i++) {
            var plat = ZONES[z].platforms[i];
            if (plat._dead) plat._dead = false;
            if (plat._crumbling) plat._crumbling = 0;
          }
        }
      }
      state.fadeDir = -1;
      state.respawning = false;
      state.mode = "playing";
    }, 600);
  }

  function clearGame() {
    state.mode = "cleared";
    state.fadeDir = 1;
    state.fadeAlpha = 0;

    if (state.bestTime === null || state.time < state.bestTime) {
      state.bestTime = state.time;
    }
    saveStats();

    // Spawn confetti
    for (var i = 0; i < 60; i++) {
      state.confetti.push({
        x: rand(0, W),
        y: rand(-50, H),
        vx: rand(-1.5, 1.5),
        vy: rand(0.5, 2.5),
        color: ["#ff4444", "#44ff44", "#4444ff", "#ffaa00", "#ff44ff", "#44ffff"][randInt(0, 5)],
        size: rand(2, 5),
        life: rand(60, 180),
        rot: rand(0, Math.PI * 2),
        rotV: rand(-0.1, 0.1),
      });
    }
  }

  function updateConfetti() {
    for (var i = state.confetti.length - 1; i >= 0; i--) {
      var c = state.confetti[i];
      c.x += c.vx;
      c.y += c.vy;
      c.vy += 0.02;
      c.rot += c.rotV;
      c.life--;
      if (c.life <= 0) state.confetti.splice(i, 1);
    }
  }

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  function render() {
    ctx.clearRect(0, 0, W, H);

    // Background
    var zone = ZONES[state.zoneIndex] || ZONES[0];
    if (zone.bgDraw) {
      zone.bgDraw(state.camera.y);
    } else {
      ctx.fillStyle = zone.bgColor1 || "#1a1a2e";
      ctx.fillRect(0, 0, W, H);
    }

    // Platforms
    var platforms = getActivePlatforms();
    for (var i = 0; i < platforms.length; i++) {
      if (!platforms[i]._dead) drawPlatform(platforms[i], state.camera.y);
    }

    // Player
    var px = state.player.x;
    var py = state.player.y - state.camera.y;
    drawPlayerSprite(px, py, state.player.facing);

    // Particles
    drawParticles(state.camera.y);

    // Confetti
    for (var c = 0; c < state.confetti.length; c++) {
      var cf = state.confetti[c];
      var cy = cf.y - state.camera.y;
      ctx.save();
      ctx.translate(cf.x, cy);
      ctx.rotate(cf.rot);
      ctx.fillStyle = cf.color;
      ctx.globalAlpha = Math.min(1, cf.life / 60);
      ctx.fillRect(-cf.size / 2, -cf.size / 2, cf.size, cf.size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // HUD
    drawHUD();

    // Fade overlay
    if (state.fadeDir !== 0) {
      if (state.fadeDir === 1) {
        state.fadeAlpha = Math.min(1, state.fadeAlpha + 0.04);
      } else {
        state.fadeAlpha = Math.max(0, state.fadeAlpha - 0.04);
        if (state.fadeAlpha <= 0) state.fadeDir = 0;
      }
      ctx.fillStyle = "rgba(0,0,0," + state.fadeAlpha + ")";
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ================================================================ */
  /*  GAME LOOP                                                        */
  /* ================================================================ */

  function gameLoop(timestamp) {
    if (!state.lastTime) state.lastTime = timestamp;
    var dt = Math.min(timestamp - state.lastTime, 500);
    state.lastTime = timestamp;

    if (state.mode === "playing") {
      state.accumulator += dt;
      while (state.accumulator >= FIXED_DT) {
        state.accumulator -= FIXED_DT;
        state.time += FIXED_DT;
        updatePlayer();
        updateParticles();

        // Update environment effects
        updateEmbers();
        updateSnowflakes();
        updateStars();

        if (state.mode === "cleared" || state.mode === "falling") break;
      }
      if (state.mode === "cleared") {
        updateConfetti();
      }

      // Camera
      state.camera.targetY = state.player.y - 200;
      state.camera.targetY = Math.max(-100, Math.min(WORLD_HEIGHT - H + 100, state.camera.targetY));
      state.camera.y = lerp(state.camera.y, state.camera.targetY, CAMERA_SMOOTH);

      // Update UI text
      state.timeText = fmtTime(state.time);
      state.fallText = String(state.falls);
      var hp = Math.floor(Math.max(0, Math.min(1, (WORLD_HEIGHT - state.player.y) / WORLD_HEIGHT)) * 100);
      state.heightText = hp + "%";
      state.zoneText = (ZONES[state.zoneIndex] || ZONES[0]).emoji + " " + (ZONES[state.zoneIndex] || ZONES[0]).name;
    } else if (state.mode === "cleared") {
      updateConfetti();
    }

    render();

    // Update DOM overlay
    updateOverlay();

    rafId = requestAnimationFrame(gameLoop);
  }

  /* ================================================================ */
  /*  ENVIRONMENT EFFECTS                                               */
  /* ================================================================ */

  function updateEmbers() {
    if (state.zoneIndex !== 3) return;
    if (state.embers.length < 30) {
      state.embers.push({
        x: rand(0, W),
        y: rand(H * 0.5, H) + state.camera.y,
        bright: rand(0, 155),
        alpha: rand(0.3, 0.8),
        vy: rand(-1.5, -0.3),
        vx: rand(-0.2, 0.2),
      });
    }
    for (var i = state.embers.length - 1; i >= 0; i--) {
      var e = state.embers[i];
      e.y += e.vy;
      e.x += e.vx;
      e.alpha -= 0.005;
      if (e.alpha <= 0 || e.y < state.camera.y - 100) state.embers.splice(i, 1);
    }
  }

  function updateSnowflakes() {
    if (state.zoneIndex !== 4) return;
    if (state.snowflakes.length < 40) {
      state.snowflakes.push({
        x: rand(0, W),
        y: state.camera.y - rand(0, 100),
        alpha: rand(0.3, 0.9),
        size: rand(1, 3),
        vy: rand(0.3, 1.2),
        vx: rand(-0.3, 0.3),
      });
    }
    for (var i = state.snowflakes.length - 1; i >= 0; i--) {
      var s = state.snowflakes[i];
      s.y += s.vy;
      s.x += s.vx + Math.sin(state.time * 0.001 + i) * 0.1;
      if (s.y > state.camera.y + H + 50) state.snowflakes.splice(i, 1);
    }
  }

  function updateStars() {
    if (state.zoneIndex !== 6 && state.zoneIndex !== 1) return;
    if (state.stars.length < 60) {
      state.stars.push({
        x: rand(0, W),
        y: rand(-100, H + 100) + state.camera.y,
        alpha: rand(0.3, 1),
        size: rand(1, 2),
        twinkle: rand(0, Math.PI * 2),
      });
    }
    for (var i = state.stars.length - 1; i >= 0; i--) {
      var s = state.stars[i];
      s.twinkle += 0.02;
      if (s.y > state.camera.y + H + 100 || s.y < state.camera.y - 200) {
        state.stars.splice(i, 1);
      }
    }
  }

  /* ================================================================ */
  /*  OVERLAY MANAGEMENT                                               */
  /* ================================================================ */

  function updateOverlay() {
    if (!els.overlay) return;
    if (state.mode === "ready") {
      els.overlay.removeAttribute("hidden");
      if (els.overlayTitle) els.overlayTitle.textContent = "Only Up";
      if (els.overlayKicker) els.overlayKicker.textContent = "像素攀爬地狱";
      if (els.overlayText) {
        els.overlayText.innerHTML =
          "从贫民窟卧室出发，一路向上穿越 8 个奇幻场景，<br>抵达宇宙的顶点。<br><br>" +
          "<strong style='color:var(--ink)'>⚠ 无存档、无安全网</strong><br>" +
          "一脚踩空，可能直接坠回起点。";
      }
      if (els.overlayKeys) {
        els.overlayKeys.innerHTML =
          '<kbd>← →</kbd> <kbd>Space</kbd> <kbd>R</kbd> <kbd>Esc</kbd>';
      }
      if (els.overlayAction) {
        els.overlayAction.textContent = "开始攀爬";
        els.overlayAction.style.display = "";
      }
    } else if (state.mode === "paused") {
      els.overlay.removeAttribute("hidden");
      if (els.overlayTitle) els.overlayTitle.textContent = "已暂停";
      if (els.overlayKicker) els.overlayKicker.textContent = "Paused";
      if (els.overlayText) {
        els.overlayText.innerHTML =
          "当前: " + state.zoneText + "<br>" +
          "已用时: " + state.timeText + " | 掉落: " + state.falls + " 次";
      }
      if (els.overlayKeys) els.overlayKeys.innerHTML = '<kbd>Esc</kbd> 继续';
      if (els.overlayAction) {
        els.overlayAction.textContent = "继续游戏";
        els.overlayAction.style.display = "";
      }
    } else if (state.mode === "cleared") {
      els.overlay.removeAttribute("hidden");
      if (els.overlayTitle) els.overlayTitle.textContent = "🏆 登顶成功！";
      if (els.overlayKicker) els.overlayKicker.textContent = "Victory";
      if (els.overlayText) {
        var isRecord = state.bestTime === state.time;
        els.overlayText.innerHTML =
          "通关用时: <strong>" + fmtTime(state.time) + "</strong>" +
          (isRecord ? " 🆕 新纪录！" : "") + "<br>" +
          "累计掉落: " + state.falls + " 次<br>" +
          "历史最佳: " + (state.bestTime !== null ? fmtTime(state.bestTime) : "--:--");
      }
      if (els.overlayKeys) els.overlayKeys.innerHTML = "";
      if (els.overlayAction) {
        els.overlayAction.textContent = "再来一次";
        els.overlayAction.style.display = "";
      }
    } else {
      els.overlay.setAttribute("hidden", "");
    }
  }

  function startGame() {
    resetGameState();
    state.mode = "playing";
    state.lastTime = 0;
    state.accumulator = 0;
    state.time = 0;
    if (els.overlay) els.overlay.setAttribute("hidden", "");
    if (canvas) canvas.focus();
  }

  function togglePause() {
    if (state.mode === "playing") {
      state.mode = "paused";
    } else if (state.mode === "paused") {
      state.mode = "playing";
      state.lastTime = 0;
      state.accumulator = 0;
      if (els.overlay) els.overlay.setAttribute("hidden", "");
      if (canvas) canvas.focus();
    }
  }

  function resetGameState() {
    state.player.x = START_X;
    state.player.y = START_Y;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.onGround = true;
    state.player.facing = 1;
    state.player.coyoteTimer = 0;
    state.player.jumpBuffer = 0;
    state.player.jumpRequested = false;
    state.player.jumpHeld = false;
    state.camera.y = START_Y - 300;
    state.camera.targetY = START_Y - 300;
    state.time = 0;
    state.falls = 0;
    state.maxHeightY = START_Y;
    state.particles = [];
    state.confetti = [];
    state.embers = [];
    state.snowflakes = [];
    state.stars = [];
    state.fadeAlpha = 0;
    state.fadeDir = 0;
    state.respawning = false;
    state.zoneIndex = 0;
    state.timeText = "00:00";
    state.fallText = "0";
    state.heightText = "0%";
    state.zoneText = ZONES[0].emoji + " " + ZONES[0].name;
    // Reset platform states
    for (var z = 0; z < ZONES.length; z++) {
      if (ZONES[z].platforms) {
        for (var i = 0; i < ZONES[z].platforms.length; i++) {
          var plat = ZONES[z].platforms[i];
          plat._dead = false;
          plat._crumbling = 0;
          if (plat.type === "moving") {
            plat._orgX = plat.x;
            plat._orgY = plat.y;
          }
        }
      }
    }
  }

  /* ================================================================ */
  /*  INPUT HANDLING                                                   */
  /* ================================================================ */

  function onKeyDown(e) {
    keys[e.code] = true;

    if (state.mode === "ready") {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        startGame();
        return;
      }
    }

    if (state.mode === "playing") {
      if (e.code === "Escape") {
        e.preventDefault();
        togglePause();
        return;
      }
      if (e.code === "KeyR") {
        e.preventDefault();
        if (confirm("确定要重新开始吗？当前进度会丢失。")) {
          startGame();
        }
        return;
      }
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
      }
    } else if (state.mode === "paused") {
      if (e.code === "Escape") {
        e.preventDefault();
        togglePause();
        return;
      }
    } else if (state.mode === "cleared") {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        startGame();
        return;
      }
    }
  }

  function onKeyUp(e) {
    keys[e.code] = false;
  }

  function onBlur() {
    // Clear all keys on blur
    for (var k in keys) keys[k] = false;
    state.touchLeft = false;
    state.touchRight = false;
    state.touchJump = false;
  }

  /* ================================================================ */
  /*  TOUCH CONTROLS                                                   */
  /* ================================================================ */

  function setupTouchControls() {
    if (!canvas || !container) return;
    var isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    if (!isTouch) return;

    var wrap = container.querySelector(".ou-canvas-wrap");
    if (!wrap) return;

    // Remove existing touch controls
    var existing = wrap.querySelector(".ou-touch");
    if (existing) existing.remove();

    var touchDiv = document.createElement("div");
    touchDiv.className = "ou-touch";

    // Left pad
    var leftPad = document.createElement("div");
    leftPad.className = "ou-touch__pad ou-touch__pad--left";
    var leftBtn = document.createElement("button");
    leftBtn.className = "ou-touch__btn";
    leftBtn.textContent = "◀";
    var rightBtn = document.createElement("button");
    rightBtn.className = "ou-touch__btn";
    rightBtn.textContent = "▶";
    leftPad.appendChild(leftBtn);
    leftPad.appendChild(rightBtn);

    // Right pad
    var rightPad = document.createElement("div");
    rightPad.className = "ou-touch__pad ou-touch__pad--right";
    var jumpBtn = document.createElement("button");
    jumpBtn.className = "ou-touch__btn";
    jumpBtn.textContent = "▲";
    jumpBtn.style.width = "72px";
    jumpBtn.style.height = "72px";
    jumpBtn.style.fontSize = "1.8rem";
    rightPad.appendChild(jumpBtn);

    touchDiv.appendChild(leftPad);
    touchDiv.appendChild(rightPad);
    wrap.appendChild(touchDiv);

    // Touch handlers
    function onTouchStart(e, key) {
      e.preventDefault();
      if (key === "left") state.touchLeft = true;
      if (key === "right") state.touchRight = true;
      if (key === "jump") state.touchJump = true;
      if (state.mode === "ready") startGame();
    }
    function onTouchEnd(e, key) {
      e.preventDefault();
      if (key === "left") state.touchLeft = false;
      if (key === "right") state.touchRight = false;
      if (key === "jump") state.touchJump = false;
    }

    leftBtn.addEventListener("touchstart", function (e) { onTouchStart(e, "left"); });
    leftBtn.addEventListener("touchend", function (e) { onTouchEnd(e, "left"); });
    leftBtn.addEventListener("touchcancel", function (e) { onTouchEnd(e, "left"); });
    leftBtn.addEventListener("mousedown", function (e) { onTouchStart(e, "left"); });
    leftBtn.addEventListener("mouseup", function (e) { onTouchEnd(e, "left"); });

    rightBtn.addEventListener("touchstart", function (e) { onTouchStart(e, "right"); });
    rightBtn.addEventListener("touchend", function (e) { onTouchEnd(e, "right"); });
    rightBtn.addEventListener("touchcancel", function (e) { onTouchEnd(e, "right"); });
    rightBtn.addEventListener("mousedown", function (e) { onTouchStart(e, "right"); });
    rightBtn.addEventListener("mouseup", function (e) { onTouchEnd(e, "right"); });

    jumpBtn.addEventListener("touchstart", function (e) { onTouchStart(e, "jump"); });
    jumpBtn.addEventListener("touchend", function (e) { onTouchEnd(e, "jump"); });
    jumpBtn.addEventListener("touchcancel", function (e) { onTouchEnd(e, "jump"); });
    jumpBtn.addEventListener("mousedown", function (e) { onTouchStart(e, "jump"); });
    jumpBtn.addEventListener("mouseup", function (e) { onTouchEnd(e, "jump"); });
  }

  /* ================================================================ */
  /*  RESIZE                                                           */
  /* ================================================================ */

  function resizeCanvas() {
    if (!canvas) return;
    var parent = canvas.parentElement;
    if (!parent) return;
    var rect = parent.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  /* ================================================================ */
  /*  STORAGE                                                          */
  /* ================================================================ */

  function loadStats() {
    try {
      var raw = window.localStorage.getItem("claudeOne_onlyup_stats");
      if (raw) {
        var data = JSON.parse(raw);
        state.bestTime = data.bestTime || null;
        state.bestHeight = data.bestHeight || 0;
      }
    } catch (e) { /* ignore */ }
  }

  function saveStats() {
    try {
      var data = {
        bestTime: state.bestTime,
        bestHeight: state.bestHeight,
      };
      window.localStorage.setItem("claudeOne_onlyup_stats", JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  /* ================================================================ */
  /*  MOUNT / UNMOUNT                                                  */
  /* ================================================================ */

  function mount(el) {
    container = el;
    els = {};

    // Cache DOM
    var selectorMap = {
      "[data-ou-canvas]": "canvas",
      "[data-ou-overlay]": "overlay",
      "[data-ou-overlay-kicker]": "overlayKicker",
      "[data-ou-overlay-title]": "overlayTitle",
      "[data-ou-overlay-text]": "overlayText",
      "[data-ou-overlay-keys]": "overlayKeys",
      "[data-ou-overlay-action]": "overlayAction",
      "[data-ou-status]": "status",
      "[data-ou-pause]": "pauseBtn",
      "[data-ou-new]": "newBtn",
      "[data-ou-score-time]": "scoreTime",
      "[data-ou-score-falls]": "scoreFalls",
      "[data-ou-score-best]": "scoreBest",
    };

    for (var sel in selectorMap) {
      var elm = container.querySelector(sel);
      if (elm) els[selectorMap[sel]] = elm;
    }

    canvas = els.canvas;
    if (canvas) {
      ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      resizeCanvas();
    }

    // Resize observer
    if (canvas && canvas.parentElement) {
      resizeObs = new ResizeObserver(function () {
        resizeCanvas();
      });
      resizeObs.observe(canvas.parentElement);
    }

    // Load stats
    loadStats();

    // Reset game state
    resetGameState();
    state.mode = "ready";

    // Init platform origins
    for (var z = 0; z < ZONES.length; z++) {
      if (!ZONES[z].platforms) continue;
      for (var i = 0; i < ZONES[z].platforms.length; i++) {
        var plat = ZONES[z].platforms[i];
        plat._dead = false;
        plat._crumbling = 0;
        if (plat.type === "moving") {
          plat._orgX = plat.x;
          plat._orgY = plat.y;
        }
      }
    }

    // Input
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    // Button handlers
    if (els.overlayAction) {
      els.overlayAction.addEventListener("click", function () {
        if (state.mode === "ready" || state.mode === "cleared") {
          startGame();
        } else if (state.mode === "paused") {
          togglePause();
        }
      });
    }
    if (els.pauseBtn) {
      els.pauseBtn.addEventListener("click", togglePause);
    }
    if (els.newBtn) {
      els.newBtn.addEventListener("click", function () {
        if (state.mode === "ready" || state.mode === "cleared" || confirm("确定要重新开始吗？")) {
          startGame();
        }
      });
    }

    // Touch controls
    setupTouchControls();

    // Canvas click to start
    if (canvas) {
      canvas.addEventListener("click", function () {
        if (state.mode === "ready") startGame();
      });
    }

    // Start loop
    state.lastTime = 0;
    rafId = requestAnimationFrame(gameLoop);

    // Update scoreboard
    updateScoreboard();
    scoreInterval = setInterval(updateScoreboard, 500);

    // Listen for restart event from overlay
    if (els.overlay) {
      els.overlay.addEventListener("click", function (e) {
        if (state.mode === "paused" && e.target === els.overlay) {
          togglePause();
        }
      });
    }
  }

  function unmount() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    if (scoreInterval) {
      clearInterval(scoreInterval);
      scoreInterval = null;
    }

    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);

    if (resizeObs) {
      resizeObs.disconnect();
      resizeObs = null;
    }

    if (els.overlayAction) {
      els.overlayAction.replaceWith(els.overlayAction.cloneNode(true));
    }
    if (els.pauseBtn) {
      els.pauseBtn.replaceWith(els.pauseBtn.cloneNode(true));
    }
    if (els.newBtn) {
      els.newBtn.replaceWith(els.newBtn.cloneNode(true));
    }

    // Save stats
    saveStats();

    // Clean up touch controls
    if (canvas && canvas.parentElement) {
      var touchEl = canvas.parentElement.querySelector(".ou-touch");
      if (touchEl) touchEl.remove();
    }

    // Reset state
    state.particles = [];
    state.confetti = [];
    state.embers = [];
    state.snowflakes = [];
    state.stars = [];
    els = {};
    container = null;
    canvas = null;
    ctx = null;
  }

  function updateScoreboard() {
    if (els.scoreTime) els.scoreTime.textContent = state.timeText;
    if (els.scoreFalls) els.scoreFalls.textContent = state.falls;
    if (els.scoreBest) {
      els.scoreBest.textContent = state.bestTime !== null ? fmtTime(state.bestTime) : "--:--";
    }
  }

  /* ================================================================ */
  /*  EXPORT                                                           */
  /* ================================================================ */

  host.__page_onlyup = { mount: mount, unmount: unmount };
})(typeof window !== "undefined" ? window : globalThis);