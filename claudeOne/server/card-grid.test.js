const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../js/tool-cards.js"), "utf8");

function renderCards(section, script = source) {
  const grid = { innerHTML: "", getAttribute: () => section };
  const context = vm.createContext({ window: {} });
  vm.runInContext(script, context);
  context.window["__page_" + section].mount({ querySelectorAll: () => [grid] });
  const boundary = grid.innerHTML.indexOf('<div class="feature-grid">');
  const cards = Array.from(grid.innerHTML.matchAll(/<(a|div) class="card [^"]+"[^>]*>[\s\S]*?<h3 class="card-title">([^<]+)<\/h3>/g), match => ({
    title: match[2],
    available: match[1] === "a",
    featured: match.index < boundary,
  }));
  return cards;
}

for (const [section, firstRow] of [
  ["games", ["台球", "DOOM"]],
  ["tools", ["音乐解锁", "图片加密（混淆）"]],
]) {
  test(section + " keeps its two featured cards first and all available cards before placeholders", () => {
    const cards = renderCards(section);
    assert.deepEqual(cards.filter(card => card.featured).map(card => card.title), firstRow);
    const firstPlaceholder = cards.findIndex(card => !card.available);
    assert.ok(firstPlaceholder > 2);
    assert.ok(cards.slice(firstPlaceholder).every(card => !card.available));
    assert.equal(cards.length, section === "games" ? 11 : 18);
    if (section === "tools") {
      assert.ok(cards.some(card => card.title === "二维码制作" && card.available));
      assert.ok(cards.findIndex(card => card.title === "颜色工具") < firstPlaceholder);
    }
  });
}

test("a newly available placeholder automatically moves ahead of remaining placeholders", () => {
  const updatedSource = source.replace('title: "图表生成",', 'title: "图表生成", href: "#/charts",');
  const cards = renderCards("tools", updatedSource);
  const charts = cards.findIndex(card => card.title === "图表生成");
  const notes = cards.findIndex(card => card.title === "便签记事");
  assert.ok(cards[charts].available);
  assert.ok(charts < notes);
  assert.deepEqual(cards.slice(0, 2).map(card => card.title), ["音乐解锁", "图片加密（混淆）"]);
});
