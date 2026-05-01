/* ===== claudeOne :: tool-cards.js =====
 * Card data for games.html and tools.html.
 * Renders cards into any element with [data-card-grid] attribute.
 * Depends on: shell.js (for refreshReveal).
 */

(function () {
  "use strict";

  var GAME_CARDS = [
    {
      icon: "🎯",
      title: "俄罗斯转盘",
      desc: "适合聚会整活的随机转盘小游戏，可设置玩家、弹巢和结束规则。",
      tags: ["娱乐", "聚会", "随机"],
      href: "./game.html",
    },
    {
      icon: "📦",
      title: "推箱子",
      desc: "经典推箱子益智游戏，包含固定关卡和随机可解模式。",
      tags: ["益智", "关卡", "单人"],
      href: "./sokoban.html",
    },
  ];

  var TOOL_CARDS = [
    {
      icon: "🎰",
      title: "幸运抽奖",
      desc: "管理参与者和奖项，用大转盘完成随机抽奖。",
      tags: ["抽奖", "随机", "群活动"],
      href: "./lottery.html",
    },
    {
      icon: "🎵",
      title: "音乐解锁",
      desc: "本地处理音乐文件格式，支持常见加密音乐格式处理。",
      tags: ["音频", "文件", "本地处理"],
      href: "./music.html",
    },
    {
      icon: "🎨",
      title: "ASCII 艺术",
      desc: "上传图片并转换成 ASCII 字符画，支持多种输出风格。",
      tags: ["图片", "字符画", "艺术"],
      href: "./ascii.html",
    },
    {
      icon: "🖼️",
      title: "图片像素化",
      desc: "把图片转换成复古像素风、8-bit 风或自定义调色板风格。",
      tags: ["图片", "像素", "设计"],
      href: "./pixel.html",
    },
    {
      icon: "📦",
      title: "图片压缩",
      desc: "在浏览器本地压缩图片，并支持 JPG、PNG、WebP 格式转换。",
      tags: ["图片", "压缩", "格式转换"],
      href: "./compress.html",
    },
    {
      icon: "📱",
      title: "二维码美化",
      desc: "生成带 Logo、渐变色、圆点样式和自定义角标的二维码。",
      tags: ["二维码", "设计", "导出"],
      href: "./qr.html",
    },
    {
      icon: "🤖",
      title: "DeepSeek",
      desc: "本地保存 API Key 的 AI 聊天工具，支持流式回复。",
      tags: ["AI", "聊天", "API"],
      href: "./ai.html",
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
    }
    grid.innerHTML = html;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var grids = document.querySelectorAll("[data-card-grid]");
    for (var i = 0; i < grids.length; i++) {
      var grid = grids[i];
      var source = grid.getAttribute("data-card-grid");
      var cards = source === "games" ? GAME_CARDS : source === "tools" ? TOOL_CARDS : null;
      if (!cards) continue;
      renderCardGrid(grid, cards);
    }
    // Re-observe dynamically added .page-chunk elements for scroll reveal
    if (window.ClaudeOne && typeof window.ClaudeOne.refreshReveal === "function") {
      window.ClaudeOne.refreshReveal();
    }
  });
})();
