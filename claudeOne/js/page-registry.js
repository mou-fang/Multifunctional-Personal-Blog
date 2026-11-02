/* ===== claudeOne :: page-registry.js =====
 * Central metadata registry for all SPA pages.
 * Used by router.js to load routes and shell.js to highlight their navSection.
 * Every route, including aliases, must declare its parent navigation section.
 */
(function (root, factory) {
  var pages = factory();
  if (typeof module === "object" && module.exports) module.exports = pages;
  if (root) root.__CLAUDEONE_PAGES = pages;
})(typeof window !== "undefined" ? window : null, function () {
return Object.freeze({
  home: {
    path: "/",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "从顶部选择工具箱、游戏或游戏发售。",
        "工具处理完成后可按各页提供的方式预览或导出。"
      ],
      "limits": [
        "部分功能依赖浏览器能力、服务器接口或用户自己的 API Key。"
      ],
      "faq": [
        [
          "内容会持续更新吗？",
          "本站会继续维护已上线功能；敬请期待的内容不代表已实现。游戏发售以每期实际发布的清单和来源为准。"
        ]
      ]
    },
    navSection: "home",
    title: "魔方工作台",
    description: "在线工具、网页小游戏与游戏发售清单，支持两套主题和连续播放的音乐播放器。",
    templateId: "page-home",
    css: ["css/cube.css?v=20261005-theme-advice"],
    js: ["js/cube.js"],
    lifecycle: "__page_home"
  },
  games: {
    path: "/games",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "选择已上线的游戏卡片，在页面内开始游戏。",
        "查看各游戏的操作说明，再进入游戏或调整设置。"
      ],
      "limits": [
        "字符城市等游戏需要桌面键鼠或 WebGL；敬请期待的卡片尚未开放。"
      ],
      "faq": [
        [
          "内容会持续更新吗？",
          "本站会继续维护已上线功能；敬请期待的内容不代表已实现。游戏发售以每期实际发布的清单和来源为准。"
        ]
      ]
    },
    navSection: "games",
    title: "游戏中心",
    description: "在线网页小游戏合集：中式八球、DOOM、推箱子、重力扫雷、贪吃蛇、Only Up、深渊协议和字符城市。",
    templateId: "page-games",
    css: ["css/games.css"],
    js: ["js/tool-cards.js?v=20261009-character-city"],
    lifecycle: "__page_games"
  },
  "game-releases": {
    path: "/game-releases",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "按平台或游戏中英文名称筛选本期清单。",
        "展开信息来源核对日期；可查看速报原图或进入往期记录。"
      ],
      "limits": [
        "日期可能延期，以来源页面公布的信息为准；倒计时不代表商店已解锁。"
      ],
      "faq": [
        [
          "内容会持续更新吗？",
          "本站会继续维护已上线功能；敬请期待的内容不代表已实现。游戏发售以每期实际发布的清单和来源为准。"
        ]
      ]
    },
    navSection: "game-releases",
    title: "游戏发售",
    description: "近期游戏发售日历：查看未来约 8 周的游戏名称、发售日期、平台和信息来源，每周二更新。",
    templateId: "page-game-releases",
    prepare: true,
    // Bump these URLs and the registry URL in index.html when release assets change.
    css: ["css/game-releases.css?v=20261025-reveal"],
    js: ["js/game-releases-core.js?v=20261025-current-list", "js/game-releases-render.js", "js/game-releases.js?v=20261025-current-list"],
    lifecycle: "__page_game_releases"
  },
  "game-releases-archive": {
    path: "/game-releases/archive",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "按日期从近到远浏览已过发售日的记录。",
        "使用搜索、平台筛选或分页查找游戏，再打开来源核对。"
      ],
      "limits": [
        "记录来自历期发布的清单，并非所有游戏的完整数据库；不同平台可能有不同日期。"
      ],
      "faq": [
        [
          "内容会持续更新吗？",
          "本站会继续维护已上线功能；敬请期待的内容不代表已实现。游戏发售以每期实际发布的清单和来源为准。"
        ]
      ]
    },
    navSection: "game-releases",
    title: "往期已发售游戏",
    description: "往期游戏发售记录：按发售日期回看历期游戏，支持平台和名称筛选、分页及来源核对。",
    templateId: "page-game-releases",
    prepare: true,
    css: ["css/game-releases.css?v=20261025-reveal"],
    js: ["js/game-releases-core.js?v=20261025-current-list", "js/game-releases-render.js", "js/game-releases.js?v=20261025-current-list"],
    lifecycle: "__page_game_releases_archive"
  },
  "city-shuttle": {
    path: "/games/city-shuttle",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "使用桌面键鼠，点击进入城市后再操作。",
        "W/S 前后、A/D 平移、Q/E 升降，鼠标或方向键转向；P/Esc 暂停，H 隐藏信息，F 全屏。"
      ],
      "limits": [
        "需要 WebAssembly、WebGL2 与桌面键鼠；触控设备显示使用提示。",
        "场景音效与全局音乐播放器分开控制，离开游戏会释放场景资源。"
      ],
      "faq": [
        [
          "手机可以直接操作吗？",
          "当前游戏需要桌面键鼠、WebAssembly 和 WebGL2；触控或小屏设备会显示使用提示。"
        ]
      ]
    },
    navSection: "games",
    title: "字符城市",
    description: "字符城市：在原创彩色 ASCII 城市中自由飞行，探索街道、地标、交通与城市生活。",
    templateId: "page-city-shuttle",
    css: ["css/city-shuttle.css?v=20261011-clarity-2"],
    js: ["js/city-shuttle-engine-url.js?v=20261011-clarity-2", "js/city-shuttle-core.js?v=20261011-clarity-2", "js/city-shuttle-geometry.js?v=20261011-clarity-2", "js/city-shuttle-streets.js?v=20261011-clarity-2", "js/city-shuttle-neighborhoods.js?v=20261011-clarity-2", "js/city-shuttle-actors.js?v=20261011-clarity-2", "js/city-shuttle-transit.js?v=20261011-clarity-2", "js/city-shuttle-city.js?v=20261011-clarity-2", "js/city-shuttle-scene.js?v=20261011-clarity-2", "js/city-shuttle-audio.js?v=20261011-clarity-2", "js/city-shuttle.js?v=20261011-clarity-2"],
    lifecycle: "__page_city_shuttle"
  },
  "anomaly-bureau": {
    aliasOf: "city-shuttle",
    indexable: false,
    navSection: "games",
    title: "字符城市",
    description: "字符城市 — 旧游戏地址兼容入口",
    templateId: "page-city-shuttle",
    css: ["css/city-shuttle.css?v=20261011-clarity-2"],
    js: ["js/city-shuttle-engine-url.js?v=20261011-clarity-2", "js/city-shuttle-core.js?v=20261011-clarity-2", "js/city-shuttle-geometry.js?v=20261011-clarity-2", "js/city-shuttle-streets.js?v=20261011-clarity-2", "js/city-shuttle-neighborhoods.js?v=20261011-clarity-2", "js/city-shuttle-actors.js?v=20261011-clarity-2", "js/city-shuttle-transit.js?v=20261011-clarity-2", "js/city-shuttle-city.js?v=20261011-clarity-2", "js/city-shuttle-scene.js?v=20261011-clarity-2", "js/city-shuttle-audio.js?v=20261011-clarity-2", "js/city-shuttle.js?v=20261011-clarity-2"],
    lifecycle: "__page_city_shuttle"
  },
  "ascii-void": {
    aliasOf: "city-shuttle",
    indexable: false,
    navSection: "games",
    title: "字符城市",
    description: "字符城市 — 字符禁区旧地址兼容入口",
    templateId: "page-city-shuttle",
    css: ["css/city-shuttle.css?v=20261011-clarity-2"],
    js: ["js/city-shuttle-engine-url.js?v=20261011-clarity-2", "js/city-shuttle-core.js?v=20261011-clarity-2", "js/city-shuttle-geometry.js?v=20261011-clarity-2", "js/city-shuttle-streets.js?v=20261011-clarity-2", "js/city-shuttle-neighborhoods.js?v=20261011-clarity-2", "js/city-shuttle-actors.js?v=20261011-clarity-2", "js/city-shuttle-transit.js?v=20261011-clarity-2", "js/city-shuttle-city.js?v=20261011-clarity-2", "js/city-shuttle-scene.js?v=20261011-clarity-2", "js/city-shuttle-audio.js?v=20261011-clarity-2", "js/city-shuttle.js?v=20261011-clarity-2"],
    lifecycle: "__page_city_shuttle"
  },
  tools: {
    path: "/tools",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "选择已上线的工具卡片，按页面提示导入内容或设置参数。",
        "查看实际处理结果，再预览、复制或下载。"
      ],
      "limits": [
        "各工具的格式、大小和浏览器要求不同，请查看对应帮助；敬请期待的卡片尚未开放。"
      ],
      "faq": [
        [
          "文件会上传吗？",
          "不同工具的处理方式不同：浏览器本地处理和依赖服务端的功能会在各工具帮助中说明。"
        ]
      ]
    },
    navSection: "tools",
    title: "工具箱",
    description: "实用在线工具箱：音乐解锁、图片压缩、二维码制作与解析、图片转拼豆、颜色工具、视频转 GIF 和 ASCII 字符画。",
    templateId: "page-tools",
    css: ["css/tools.css"],
    js: ["js/tool-cards.js?v=20261009-character-city"],
    lifecycle: "__page_tools"
  },
  colors: {
    path: "/tools/colors",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "上传或粘贴图片取色，或输入 HEX、RGB、HSL。",
        "保存色卡、导出配色；实体颜料区可按库存和目标颜色查找预测配方。"
      ],
      "limits": [
        "屏幕取色依赖支持 EyeDropper 的浏览器及 HTTPS；图片最大 20 MB、4000 万像素。",
        "色号估算与实测标定分开标注，预测色差不等于实物调色成功率。"
      ],
      "faq": [
        [
          "预测颜色和实物混色完全一致吗？",
          "不保证。实测标定和色号估算有不同适用范围；请使用页面提供的精度说明，并用独立实体试调验证。"
        ]
      ]
    },
    navSection: "tools",
    title: "颜色工具",
    description: "颜色工具：屏幕和图片取色、色卡与渐变、对比度检查，以及品牌颜料查色和实体颜料调色预测。",
    templateId: "page-colors",
    css: ["css/color-tools.css?v=20261008-paint-1", "css/paint-mixer.css?v=20261008-chief-2"],
    js: ["js/color-tools-core.js", "libs/spectral-3.0.0/spectral.js", "js/paint-mixer-core.js?v=20261008-chief-2", "js/paint-mixer.js?v=20261008-chief-2", "js/color-tools.js?v=20261008-paint-help-2"],
    lifecycle: "__page_colors"
  },
  beads: {
    path: "/tools/beads",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "导入图片并选择图纸尺寸和色卡。",
        "编辑网格、文字和图层，预览后按逐色引导制作或导出。"
      ],
      "limits": [
        "屏幕预览与实体拼豆颜色可能存在差异，实际效果受品牌、材质和照明影响。"
      ],
      "faq": [
        [
          "预览颜色与实体拼豆一致吗？",
          "预览用于制作参考。品牌、批次、材质和照明会改变实物观感，应先核对实际色卡。"
        ]
      ]
    },
    navSection: "tools",
    title: "拼豆工坊",
    description: "拼豆图纸制作工具：图片转拼豆图纸、色卡映射、逐格精修、文字形状、材质预览与逐色制作引导。",
    templateId: "page-beads",
    css: ["css/bead-studio.css"],
    js: ["js/bead-studio-core.js", "js/bead-studio.js"],
    lifecycle: "__page_beads"
  },
  scramble: {
    path: "/tools/scramble",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "导入图片并设置混淆参数，预览后导出 PNG。",
        "还原时导入原始导出的混淆文件，按页面提示操作。"
      ],
      "limits": [
        "这是视觉混淆，不应作为敏感资料的安全加密。",
        "重编码、截图或平台压缩可能丢失还原所需的信息。"
      ],
      "faq": [
        [
          "截图或转成 JPG 后还可以还原吗？",
          "不能保证。请保存工具原始导出的 PNG，截图、重新压缩和转码可能丢失还原信息。"
        ]
      ]
    },
    navSection: "tools",
    title: "图片加密（混淆）",
    description: "图片加密混淆工具 PixelFlux：可逆打散图片像素与颜色，导出混淆 PNG 并支持还原。",
    templateId: "page-scramble",
    css: ["css/image-scramble.css"],
    js: ["js/image-scramble-core.js", "js/image-scramble.js"],
    lifecycle: "__page_scramble"
  },
  game: {
    path: "/games/roulette",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "添加玩家并设置弹巢与游戏规则。",
        "开始后按页面按钮轮流操作，结束后可重新开始。"
      ],
      "limits": [
        "这是网页随机娱乐游戏；随机结果不代表现实预测。"
      ],
      "faq": [
        [
          "可以自行调整规则吗？",
          "可以，开始前可配置玩家、弹巢和结束规则；以界面提供的设置为准。"
        ]
      ]
    },
    navSection: "games",
    title: "俄罗斯转盘",
    description: "俄罗斯转盘聚会小游戏：自定义玩家、弹巢和结束规则，通过随机结果进行互动。",
    templateId: "page-game",
    css: [],
    js: ["js/roulette.js"],
    lifecycle: "__page_game"
  },
  sokoban: {
    path: "/games/sokoban",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "选择关卡或随机关卡，查看目标位置。",
        "使用方向键移动角色，把所有箱子推到目标格；卡住时可撤销或重开。"
      ],
      "limits": [
        "箱子只能推不能拉，需要给角色保留移动空间。"
      ],
      "faq": [
        [
          "箱子推到角落怎么办？",
          "如果已经无法移出，可使用撤销或重开；先规划角色通路，避免把箱子推到非目标死角。"
        ]
      ]
    },
    navSection: "games",
    title: "推箱子",
    description: "在线推箱子益智游戏：推动箱子到目标位置，包含固定关卡与随机生成的可解关卡。",
    templateId: "page-sokoban",
    css: ["css/sokoban.css"],
    js: ["js/sokoban.js"],
    lifecycle: "__page_sokoban"
  },
  minesweeper: {
    path: "/games/minesweeper",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "选择难度并开始，按页面提示翻格或标记。",
        "同时观察数字与下落变化，逐步判断安全位置。"
      ],
      "limits": [
        "下落后数字会变化，应以当前棋盘为准；触雷会结束本局。"
      ],
      "faq": [
        [
          "方块下落后还能按原数字推理吗？",
          "应以当前棋盘为准。下落改变邻居关系后，数字平台会重新计算。"
        ]
      ]
    },
    navSection: "games",
    title: "重力扫雷",
    description: "重力扫雷：结合经典数字推理与方块下落机制，翻开空格后数字平台随邻居变化重新计算。",
    templateId: "page-minesweeper",
    css: ["css/minesweeper.css"],
    js: ["js/minesweeper.js"],
    lifecycle: "__page_minesweeper"
  },
  snake: {
    path: "/games/snake",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "使用方向键或 W/A/S/D 控制方向，按照界面提示开始游戏。",
        "进入竞技场后收集食物和道具，躲避对手及障碍。"
      ],
      "limits": [
        "对手由程序控制；本页不是网络多人匹配服务。"
      ],
      "faq": [
        [
          "对手是真人联网玩家吗？",
          "本页对手由 AI 控制，不提供联网匹配。"
        ]
      ]
    },
    navSection: "games",
    title: "贪吃蛇竞技场",
    description: "贪吃蛇竞技场：与 AI 对手争夺食物，利用能力道具、障碍和大地图进行生存竞技。",
    templateId: "page-snake",
    css: ["css/snake.css"],
    js: ["js/snake.js"],
    lifecycle: "__page_snake"
  },
  billiards: {
    path: "/games/billiards",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "选择练习或人机模式，按页面提示瞄准和控制力度。",
        "根据所选模式完成击球，可在规则说明中学习中式八球规则。"
      ],
      "limits": [
        "网页物理模拟用于娱乐练习，不能替代真实球台训练。"
      ],
      "faq": [
        [
          "有哪些游戏模式？",
          "支持单人练习和 AI 对战，也提供中式八球规则说明。"
        ]
      ]
    },
    navSection: "games",
    title: "中式八球",
    description: "中式八球台球小游戏：支持单人练习、AI 对战和规则学习，调整击球方向与力度。",
    templateId: "page-billiards",
    css: ["css/billiards.css"],
    js: ["js/billiards.js"],
    lifecycle: "__page_billiards"
  },
  onlyup: {
    path: "/games/onlyup",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "方向键或 A/D 移动，空格、上方向键或 W 跳跃，R 重开，Esc 暂停。",
        "沿平台逐步攀升，观察落脚点并控制跳跃。"
      ],
      "limits": [
        "本作没有存档和安全网，坠落可能回到较低位置。"
      ],
      "faq": [
        [
          "跌落后会回到存档点吗？",
          "本作没有存档和安全网，跌落可能损失已经攀爬的高度。"
        ]
      ]
    },
    navSection: "games",
    title: "Only Up",
    description: "Only Up 网页像素攀爬游戏：跨越多个场景向高处挑战，避免失足坠落。",
    templateId: "page-onlyup",
    css: ["css/onlyup.css"],
    js: ["js/onlyup.js"],
    lifecycle: "__page_onlyup"
  },
  abyss: {
    path: "/games/abyss",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "选择角色和难度，进入战场后移动并收集经验。",
        "W/A/S/D 或方向键移动，P/Esc 暂停，R 重开；升级时点击卡片或按 1、2、3 选择能力。"
      ],
      "limits": [
        "普通、困难、噩梦和无限模式有不同结束条件；各能力以游戏内说明为准。"
      ],
      "faq": [
        [
          "普通模式和无限模式有什么区别？",
          "普通、困难与噩梦在击败最终 Boss 后结算，无限模式继续进行并增强后续敌人。"
        ]
      ]
    },
    navSection: "games",
    title: "深渊协议",
    description: "深渊协议生存小游戏：自动攻击、升级选择、武器进化、遗物和逻辑模块构筑，挑战不同难度与 Boss。",
    templateId: "page-abyss",
    css: ["css/abyss.css"],
    js: ["js/abyss-data.js", "js/abyss-sfx.js", "js/abyss.js"],
    lifecycle: "__page_abyss"
  },
  lottery: {
    path: "/tools/lottery",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "录入参与者和奖项，核对名单与数量。",
        "开始转盘抽奖，按页面显示查看结果并继续后续轮次。"
      ],
      "limits": [
        "抽奖结果用于活动互动，不提供第三方公证或审计认证。"
      ],
      "faq": [
        [
          "抽奖结果有第三方认证吗？",
          "本工具用于随机活动互动，不提供第三方公证或审计认证；开始前请核对名单与奖项。"
        ]
      ]
    },
    navSection: "tools",
    title: "幸运抽奖",
    description: "幸运抽奖工具：管理参与者与奖项，通过网页转盘完成随机抽奖和互动。",
    templateId: "page-lottery",
    css: ["css/lottery.css"],
    js: ["js/lottery.js"],
    lifecycle: "__page_lottery"
  },
  music: {
    path: "/tools/music-unlock",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "选择或拖入音乐文件，等待自动处理。",
        "成功后试听或下载；失败时查看原因，需要登录的 QQ 文件按页面帮助处理。"
      ],
      "limits": [
        "单个文件不超过 200 MB，部分 QQ 音乐文件需要账号登录信息和服务端查询密钥。",
        "保留原文件中的音频格式，不重新压缩；无法保证所有加密版本均受支持。"
      ],
      "faq": [
        [
          "解锁会重新压缩音频吗？",
          "不会重新压缩，保留文件中原有的音频格式，常见为 MP3、FLAC 或 OGG；详情见本页使用帮助。"
        ]
      ]
    },
    navSection: "tools",
    title: "音乐解锁",
    description: "音乐解锁工具：在浏览器处理 NCM、QMC、MFLAC、MGG 等支持的音乐文件，试听并下载原有音频。",
    templateId: "page-music",
    css: ["css/music.css"],
    js: ["js/ncm-decrypt.js", "js/qq-music-decrypt.js", "libs/qmcwasm/qmcwasm.js", "js/music.js"],
    lifecycle: "__page_music"
  },
  playlist: {
    path: "/tools/playlist",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "从歌单选择歌曲，或使用全局播放器导入本机支持的音频。",
        "通过全局播放器暂停、切歌、调整音量或打开歌单。"
      ],
      "limits": [
        "自动播放受浏览器限制，需要用户主动点击播放；刷新网页会重新加载。"
      ],
      "faq": [
        [
          "切换工具时音乐会停止吗？",
          "站内正常切换保留同一个播放器；主动刷新、关闭网页或设备中断播放则会重新加载或停止。"
        ]
      ]
    },
    navSection: "tools",
    title: "播放歌单",
    description: "网页音乐播放器：浏览站点歌单、选择歌曲，并在切换工具与小游戏时保持音乐连续播放。",
    templateId: "page-playlist",
    css: ["css/playlist.css"],
    js: ["js/playlist-page.js?v=20261005-startup"],
    lifecycle: "__page_playlist"
  },
  ai: {
    path: "/tools/ai",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "按页面提示配置自己的 API Key 与模型。",
        "新建话题、输入问题发送，可调整提示词或切换话题。"
      ],
      "limits": [
        "请求需要网络和相应 API 服务权限，调用费用及可用性由所用服务决定。",
        "回复可能出错；不要把密钥、隐私信息或未核实的回答作为公开内容。"
      ],
      "faq": [
        [
          "需要自己的 API Key 吗？",
          "需要。请使用有服务权限的个人 API Key；模型、费用和可用性以相应服务为准。"
        ]
      ]
    },
    navSection: "tools",
    title: "DeepSeek 聊天",
    description: "DeepSeek AI 聊天工具：流式对话、话题管理、提示词和模型设置，需要用户提供自己的 API Key。",
    templateId: "page-ai",
    css: [],
    js: ["js/ai.js"],
    lifecycle: "__page_ai"
  },
  ascii: {
    path: "/tools/ascii",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "上传图片，选择输出风格并调整转换参数。",
        "运行转换，查看实际结果后按页面提供的格式导出。"
      ],
      "limits": [
        "转换依赖服务器安装 ascii-image-converter；服务不可用时会显示错误。"
      ],
      "faq": [
        [
          "为什么转换服务不可用？",
          "该工具依赖服务器上的 ascii-image-converter。后端没有安装或暂时无法访问时，需要站点管理员检查服务。"
        ]
      ]
    },
    navSection: "tools",
    title: "ASCII 艺术",
    description: "图片转 ASCII 字符画工具：将图片转换为彩色、灰度或盲文等字符画，调整参数后预览和导出。",
    templateId: "page-ascii",
    css: ["css/ascii.css"],
    js: ["js/ascii.js"],
    lifecycle: "__page_ascii"
  },
  pixel: {
    path: "/tools/pixel",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "选择图片并调整像素尺寸与调色板。",
        "查看预览、微调效果，完成后导出 PNG。"
      ],
      "limits": [
        "像素化会减少细节，无法恢复原图中已经丢失的信息。"
      ],
      "faq": [
        [
          "像素化以后还能恢复原图细节吗？",
          "导出的像素画不能恢复已经丢失的细节，请另外保存原始图片。"
        ]
      ]
    },
    navSection: "tools",
    title: "图片像素化",
    description: "图片像素化工具：把图片转换为像素风格，调整调色板和视觉效果后导出 PNG。",
    templateId: "page-pixel",
    css: ["css/pixel.css"],
    js: ["libs/pixelit/pixelit.js", "js/pixel.js"],
    lifecycle: "__page_pixel"
  },
  compress: {
    path: "/tools/image-compress",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "添加图片，选择目标格式、尺寸和质量。",
        "处理后比较文件大小与预览，再下载单张或打包结果。"
      ],
      "limits": [
        "压缩效果取决于原图；有损格式与尺寸缩小可能减少细节，透明度也受输出格式影响。"
      ],
      "faq": [
        [
          "压缩后的文件一定更小吗？",
          "不一定。原图已经高度压缩或换用不同格式时，结果可能变大，请比较页面显示的实际大小和预览效果。"
        ]
      ]
    },
    navSection: "tools",
    title: "图片压缩",
    description: "在线图片压缩与格式转换工具：在浏览器批量处理图片、调整尺寸，支持 JPG、PNG、WebP 和打包下载。",
    templateId: "page-compress",
    css: ["css/compress.css"],
    js: ["libs/jszip/jszip.min.js", "libs/browser-image-compression/browser-image-compression.js", "js/compress.js"],
    lifecycle: "__page_compress"
  },
  "qr-reader": {
    path: "/tools/qr-reader",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "上传、拖入或粘贴一张二维码图片。",
        "查看识别内容并复制；识别出的网页链接需要手动打开。"
      ],
      "limits": [
        "支持 PNG、JPG、WebP、GIF、BMP，每张最大 20 MB；清晰度、遮挡和变形可能影响识别。"
      ],
      "faq": [
        [
          "识别后会自动打开网址吗？",
          "不会。先展示识别内容，网页链接需要你主动点击后打开。"
        ]
      ]
    },
    navSection: "tools",
    title: "二维码解析",
    description: "二维码解析工具：在浏览器本地识别图片中的链接、文本、Wi-Fi 和联系人信息，支持上传、拖入和粘贴。",
    templateId: "page-qr-reader",
    css: ["css/qr-reader.css"],
    js: ["js/qr-reader-core.js", "js/qr-reader-animation.js", "js/qr-reader.js"],
    lifecycle: "__page_qr_reader"
  },
  qr: {
    path: "/tools/qr",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "输入需要编码的内容，再调整颜色、Logo 和样式。",
        "预览并用实际设备扫码验证后，导出 PNG 或 SVG。"
      ],
      "limits": [
        "过低对比度、过大的 Logo 或复杂样式可能影响扫码成功率。"
      ],
      "faq": [
        [
          "生成后为什么扫码困难？",
          "检查内容长度、对比度、Logo 大小和样式；导出后应在目标设备上进行实际扫码验证。"
        ]
      ]
    },
    navSection: "tools",
    title: "二维码制作",
    description: "二维码制作工具：输入内容生成二维码，自定义 Logo、颜色、渐变和点阵样式，导出 PNG 或 SVG。",
    templateId: "page-qr",
    css: ["css/qr.css"],
    js: ["libs/qr-code-styling/qr-code-styling.js", "js/qr.js"],
    lifecycle: "__page_qr"
  },
  videogif: {
    path: "/tools/videogif",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "导入视频，选择起止片段和裁剪范围。",
        "设置帧率、尺寸和循环次数，生成并预览 GIF 后下载。"
      ],
      "limits": [
        "视频解码取决于浏览器支持；片段过长、尺寸或帧率过大会增加处理时间和内存。"
      ],
      "faq": [
        [
          "GIF 可以保留视频声音吗？",
          "GIF 不包含音轨。请根据需要另外保留原始视频。"
        ]
      ]
    },
    navSection: "tools",
    title: "视频转 GIF",
    description: "视频转 GIF 工具：在浏览器导入视频、裁剪画面和片段、设置帧率与尺寸，生成 GIF 动图。",
    templateId: "page-videogif",
    css: ["css/videogif.css"],
    js: ["js/videogif-core.js", "js/videogif.js"],
    lifecycle: "__page_videogif"
  },
  doom: {
    path: "/games/doom",
    indexable: true,
    updated: "2026-11-02",
    help: {
      "steps": [
        "使用桌面键鼠，在开始界面查看控制说明并进入游戏。",
        "按页面提示移动、瞄准和射击，可使用暂停或全屏。"
      ],
      "limits": [
        "首次进入需下载游戏资源，设备需支持 WebAssembly；使用的是 Freedoom 自由数据。"
      ],
      "faq": [
        [
          "需要上传游戏文件吗？",
          "本站随页面提供 Freedoom 自由数据，按页面提示下载资源后开始游戏；不会提供原版商业 WAD 下载。"
        ]
      ]
    },
    navSection: "games",
    title: "DOOM",
    description: "DOOM 网页射击游戏：使用 doomgeneric 与 Freedoom 自由数据，在浏览器运行 WebAssembly 经典 FPS。",
    templateId: "page-doom",
    css: ["css/doom.css"],
    js: ["js/doom.js"],
    lifecycle: "__page_doom"
  }
});
});
