/* ===== claudeOne :: tool-cards.js =====
 * Card data for games.html and tools.html.
 * Renders cards into any element with [data-card-grid] attribute.
 * SPA lifecycle: window.__page_games / window.__page_tools
 */

(function () {
  "use strict";

  var GAME_CARDS = [
    {
      icon: "\u{1F3AF}",
      title: "俄罗斯转盘",
      desc: "适合聚会整活的随机转盘小游戏，可设置玩家、弹巢和结束规则。",
      tags: ["娱乐", "聚会", "随机"],
      href: "#/game",
    },
    {
      icon: "\u{1F4E6}",
      title: "推箱子",
      desc: "经典推箱子益智游戏，包含固定关卡和随机可解模式。",
      tags: ["益智", "关卡", "单人"],
      href: "#/sokoban",
    },
    {
      icon: "\u{1F3B2}",
      title: "扫雷",
      desc: "经典扫雷游戏，支持多种难度和自定义棋盘大小。",
      tags: ["益智", "经典", "单人"],
    },
    {
      icon: "\u{1F0CF}",
      title: "扑克牌",
      desc: "在线扑克牌对战，支持多种玩法和多人模式。",
      tags: ["棋牌", "多人", "休闲"],
    },
    {
      icon: "\u{265F}",
      title: "五子棋",
      desc: "经典五子棋对弈，支持人机对战和双人对战。",
      tags: ["棋类", "对战", "益智"],
    },
    {
      icon: "\u{1F3AE}",
      title: "贪吃蛇",
      desc: "经典贪吃蛇游戏，挑战自己的极限得分。",
      tags: ["经典", "街机", "单人"],
    },
    {
      icon: "\u{1F3B3}",
      title: "台球",
      desc: "在线台球游戏，拟真物理引擎带来真实体验。",
      tags: ["体育", "休闲", "对战"],
    },
    {
      icon: "\u{1F3C6}",
      title: "数独",
      desc: "经典数独填字游戏，多种难度锻炼逻辑推理。",
      tags: ["益智", "数字", "单人"],
    },
  ];

  var TOOL_CARDS = [
    {
      icon: "\u{1F3B0}",
      title: "幸运抽奖",
      desc: "管理参与者和奖项，用大转盘完成随机抽奖。",
      tags: ["抽奖", "随机", "群活动"],
      href: "#/lottery",
    },
    {
      icon: "\u{1F3B5}",
      title: "音乐解锁",
      desc: "本地处理音乐文件格式，支持常见加密音乐格式处理。",
      tags: ["音频", "文件", "本地处理"],
      href: "#/music",
    },
    {
      icon: "\u{1F3A8}",
      title: "ASCII 艺术",
      desc: "上传图片并转换成 ASCII 字符画，支持多种输出风格。",
      tags: ["图片", "字符画", "艺术"],
      href: "#/ascii",
    },
    {
      icon: "\u{1F5BC}",
      title: "图片像素化",
      desc: "把图片转换成复古像素风、8-bit 风或自定义调色板风格。",
      tags: ["图片", "像素", "设计"],
      href: "#/pixel",
    },
    {
      icon: "\u{1F4E6}",
      title: "图片压缩",
      desc: "在浏览器本地压缩图片，并支持 JPG、PNG、WebP 格式转换。",
      tags: ["图片", "压缩", "格式转换"],
      href: "#/compress",
    },
    {
      icon: "\u{1F4F1}",
      title: "二维码美化",
      desc: "生成带 Logo、渐变色、圆点样式和自定义角标的二维码。",
      tags: ["二维码", "设计", "导出"],
      href: "#/qr",
    },
    {
      icon: "\u{1F916}",
      title: "DeepSeek",
      desc: "本地保存 API Key 的 AI 聊天工具，支持流式回复。",
      tags: ["AI", "聊天", "API"],
      href: "#/ai",
    },
    {
      icon: "\u{1F4DD}",
      title: "便签记事",
      desc: "随手记录灵感和待办事项，支持 Markdown 格式。",
      tags: ["笔记", "效率", "Markdown"],
    },
    {
      icon: "\u{1F4CA}",
      title: "图表生成",
      desc: "在线生成数据图表，支持柱状图、折线图、饼图。",
      tags: ["数据", "可视化", "图表"],
    },
    {
      icon: "\u{1F5A8}",
      title: "颜色工具",
      desc: "颜色拾取、调色板生成、渐变色预设和色盲模拟。",
      tags: ["设计", "颜色", "CSS"],
    },
    {
      icon: "\u{1F50D}",
      title: "文本比对",
      desc: "对比两段文本的差异，支持行级和字符级对比。",
      tags: ["文本", "比对", "差异"],
    },
    {
      icon: "\u{23F0}",
      title: "番茄钟",
      desc: "简洁的番茄工作法计时器，支持自定义工作和休息时长。",
      tags: ["效率", "计时", "专注"],
    },
    {
      icon: "\u{1F4F0}",
      title: "JSON 格式化",
      desc: "JSON 数据格式化和验证工具，支持树形视图。",
      tags: ["开发", "JSON", "格式化"],
    },
    {
      icon: "\u{1F4E3}",
      title: "文字转语音",
      desc: "在线文字朗读工具，支持多种语音和语速调节。",
      tags: ["文本", "语音", "TTS"],
    },
  ];

  function renderCardGrid(grid, cards) {
    var html = "";
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var tagsHtml = "";
      if (c.tags && c.tags.length) {
        tagsHtml = '<div class="card-tags">';
        for (var t = 0; t < c.tags.length; t++) {
          tagsHtml += '<span class="card-tag">' + c.tags[t] + "</span>";
        }
        tagsHtml += "</div>";
      }
      if (c.href) {
        html +=
          '<a class="card card-link page-chunk" data-reveal-order="3" href="' +
          c.href +
          '" data-nav-link>' +
          '<span class="card-icon">' +
          c.icon +
          "</span>" +
          '<h3 class="card-title">' +
          c.title +
          "</h3>" +
          '<p class="card-desc">' +
          c.desc +
          "</p>" +
          tagsHtml +
          '<span class="card-arrow">打开 →</span>' +
          "</a>";
      } else {
        html +=
          '<div class="card card--soon page-chunk" data-reveal-order="3">' +
          '<span class="card-icon">' +
          c.icon +
          "</span>" +
          '<h3 class="card-title">' +
          c.title +
          "</h3>" +
          '<p class="card-desc">' +
          c.desc +
          "</p>" +
          tagsHtml +
          '<span class="card-arrow">敬请期待</span>' +
          "</div>";
      }
    }
    grid.innerHTML = html;
  }

  /* Build a mount function for a given card source name ("games" or "tools"). */
  function makeMount(source) {
    var cards = source === "games" ? GAME_CARDS : TOOL_CARDS;
    return function (el) {
      var grids = el.querySelectorAll("[data-card-grid]");
      for (var i = 0; i < grids.length; i++) {
        var grid = grids[i];
        var gridSource = grid.getAttribute("data-card-grid");
        if (gridSource !== source) continue;
        renderCardGrid(grid, cards);
      }
      // Re-observe dynamically added .page-chunk elements for scroll reveal
      if (window.ClaudeOne && typeof window.ClaudeOne.refreshReveal === "function") {
        window.ClaudeOne.refreshReveal();
      }
    };
  }

  function noop() {}

  window.__page_games = { mount: makeMount("games"), unmount: noop };
  window.__page_tools = { mount: makeMount("tools"), unmount: noop };
})();
