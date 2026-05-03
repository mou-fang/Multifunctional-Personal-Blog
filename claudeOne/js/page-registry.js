/* ===== claudeOne :: page-registry.js =====
 * Central metadata registry for all SPA pages.
 * Used by router.js to know what to load for each route.
 */
window.__CLAUDEONE_PAGES = Object.freeze({
  home: {
    title: "claudeOne · 魔方工作台",
    description: "claudeOne — quiet personal workspace",
    templateId: "page-home",
    css: ["css/cube.css"],
    js: ["js/cube.js"],
    lifecycle: "__page_home"
  },
  games: {
    title: "claudeOne · 游戏中心",
    description: "claudeOne 游戏中心 — 益智与聚会小游戏合集",
    templateId: "page-games",
    css: ["css/games.css"],
    js: ["js/tool-cards.js"],
    lifecycle: "__page_games"
  },
  tools: {
    title: "claudeOne · 工具箱",
    description: "claudeOne 工具箱 — 实用在线工具合集",
    templateId: "page-tools",
    css: ["css/tools.css"],
    js: ["js/tool-cards.js"],
    lifecycle: "__page_tools"
  },
  game: {
    title: "claudeOne · 俄罗斯转盘",
    description: "claudeOne 俄罗斯转盘 — 聚会整活随机转盘游戏",
    templateId: "page-game",
    css: [],
    js: ["js/roulette.js"],
    lifecycle: "__page_game"
  },
  sokoban: {
    title: "claudeOne · 推箱子",
    description: "claudeOne 推箱子 — 经典益智推箱子游戏",
    templateId: "page-sokoban",
    css: ["css/sokoban.css"],
    js: ["js/sokoban.js"],
    lifecycle: "__page_sokoban"
  },
  lottery: {
    title: "claudeOne · 幸运抽奖",
    description: "claudeOne 幸运抽奖 — 大屏互动抽奖工具",
    templateId: "page-lottery",
    css: ["css/lottery.css"],
    js: ["js/lottery.js"],
    lifecycle: "__page_lottery"
  },
  music: {
    title: "claudeOne · 音乐解锁",
    description: "claudeOne 音乐解锁 — 移除加密音乐文件的保护",
    templateId: "page-music",
    css: ["css/music.css"],
    js: ["js/music.js"],
    lifecycle: "__page_music"
  },
  ai: {
    title: "claudeOne · DeepSeek 聊天",
    description: "claudeOne DeepSeek — AI 智能对话助手",
    templateId: "page-ai",
    css: [],
    js: ["js/ai.js"],
    lifecycle: "__page_ai"
  },
  ascii: {
    title: "claudeOne · ASCII 艺术",
    description: "claudeOne ASCII — 图片转字符画生成器",
    templateId: "page-ascii",
    css: ["css/ascii.css"],
    js: ["js/ascii.js"],
    lifecycle: "__page_ascii"
  },
  pixel: {
    title: "claudeOne · 图片像素化",
    description: "claudeOne 像素化 — 图片像素风格处理工具",
    templateId: "page-pixel",
    css: ["css/pixel.css"],
    js: ["libs/pixelit/pixelit.js", "js/pixel.js"],
    lifecycle: "__page_pixel"
  },
  compress: {
    title: "claudeOne · 图片压缩",
    description: "claudeOne 压缩 — 图片压缩与格式转换工具",
    templateId: "page-compress",
    css: ["css/compress.css"],
    js: ["libs/jszip/jszip.min.js", "libs/browser-image-compression/browser-image-compression.js", "js/compress.js"],
    lifecycle: "__page_compress"
  },
  qr: {
    title: "claudeOne · 二维码美化",
    description: "claudeOne QR — 二维码生成与美化工具",
    templateId: "page-qr",
    css: ["css/qr.css"],
    js: ["libs/qr-code-styling/qr-code-styling.js", "js/qr.js"],
    lifecycle: "__page_qr"
  }
});
