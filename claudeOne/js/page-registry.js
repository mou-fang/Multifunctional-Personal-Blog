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
  "city-shuttle": {
    title: "claudeOne · 无界穿梭：天际城",
    description: "无界穿梭：天际城 — 驾驶穿梭机高速飞越无限生成的彩色 ASCII 近未来城市",
    templateId: "page-city-shuttle",
    css: ["css/city-shuttle.css"],
    js: ["js/city-shuttle-core.js", "js/city-shuttle.js"],
    lifecycle: "__page_city_shuttle"
  },
  "anomaly-bureau": {
    title: "claudeOne · 无界穿梭：天际城",
    description: "无界穿梭：天际城 — 旧游戏地址兼容入口",
    templateId: "page-city-shuttle",
    css: ["css/city-shuttle.css"],
    js: ["js/city-shuttle-core.js", "js/city-shuttle.js"],
    lifecycle: "__page_city_shuttle"
  },
  "ascii-void": {
    title: "claudeOne · 无界穿梭：天际城",
    description: "无界穿梭：天际城 — 字符禁区旧地址兼容入口",
    templateId: "page-city-shuttle",
    css: ["css/city-shuttle.css"],
    js: ["js/city-shuttle-core.js", "js/city-shuttle.js"],
    lifecycle: "__page_city_shuttle"
  },
  tools: {
    title: "claudeOne · 工具箱",
    description: "claudeOne 工具箱 — 实用在线工具合集",
    templateId: "page-tools",
    css: ["css/tools.css"],
    js: ["js/tool-cards.js"],
    lifecycle: "__page_tools"
  },
  beads: {
    title: "claudeOne · 拼豆工坊",
    description: "claudeOne 拼豆工坊 — 图片转拼豆图纸、逐格精修、材质预览与摆豆引导",
    templateId: "page-beads",
    css: ["css/bead-studio.css"],
    js: ["js/bead-studio-core.js", "js/bead-studio.js"],
    lifecycle: "__page_beads"
  },
  scramble: {
    title: "claudeOne · 图片加密（混淆）",
    description: "claudeOne PixelFlux — 可逆图片像素混淆与还原工具",
    templateId: "page-scramble",
    css: ["css/image-scramble.css"],
    js: ["js/image-scramble-core.js", "js/image-scramble.js"],
    lifecycle: "__page_scramble"
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
  minesweeper: {
    title: "claudeOne · 重力扫雷",
    description: "claudeOne 重力扫雷 — 翻开 0 格让上方下落、数字平台实时重算的扫雷重制",
    templateId: "page-minesweeper",
    css: ["css/minesweeper.css"],
    js: ["js/minesweeper.js"],
    lifecycle: "__page_minesweeper"
  },
  snake: {
    title: "claudeOne · 贪吃蛇竞技场",
    description: "claudeOne 贪吃蛇 — 大战场多人混战，10种能力道具，AI对手抢食围堵",
    templateId: "page-snake",
    css: ["css/snake.css"],
    js: ["js/snake.js"],
    lifecycle: "__page_snake"
  },
  billiards: {
    title: "claudeOne · 中式八球",
    description: "claudeOne 中式八球 — 单人练习与AI对战，含完整规则讲解",
    templateId: "page-billiards",
    css: ["css/billiards.css"],
    js: ["js/billiards.js"],
    lifecycle: "__page_billiards"
  },
  onlyup: {
    title: "claudeOne · Only Up",
    description: "claudeOne Only Up — 像素风垂直攀爬地狱，8 个奇幻场景，无存档无安全网",
    templateId: "page-onlyup",
    css: ["css/onlyup.css"],
    js: ["js/onlyup.js"],
    lifecycle: "__page_onlyup"
  },
  abyss: {
    title: "claudeOne · 深渊协议",
    description: "claudeOne 深渊协议 — 类吸血鬼幸存者，自动攻击、升级三选一、武器进化、遗物、逻辑模块编程流",
    templateId: "page-abyss",
    css: ["css/abyss.css"],
    js: ["js/abyss-data.js", "js/abyss-sfx.js", "js/abyss.js"],
    lifecycle: "__page_abyss"
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
  playlist: {
    title: "claudeOne - 播放歌单",
    description: "claudeOne 播放歌单",
    templateId: "page-playlist",
    css: ["css/playlist.css"],
    js: ["js/playlist-page.js"],
    lifecycle: "__page_playlist"
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
  },
  videogif: {
    title: "claudeOne · 视频转 GIF",
    description: "claudeOne 视频转 GIF — 本地裁剪、选段、调帧率与画质，浏览器内生成 GIF",
    templateId: "page-videogif",
    css: ["css/videogif.css"],
    js: ["js/videogif.js"],
    lifecycle: "__page_videogif"
  },
  doom: {
    title: "claudeOne · DOOM",
    description: "claudeOne DOOM — 1993 经典 FPS，doomgeneric 引擎 WebAssembly 浏览器版，Freedoom 自由数据",
    templateId: "page-doom",
    css: ["css/doom.css"],
    js: ["js/doom.js"],
    lifecycle: "__page_doom"
  }
});
