const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function shell() {
  const nav = { innerHTML: "" };
  const attrs = { "data-page": "home" };
  const context = vm.createContext({
    console,
    document: {
      body: { getAttribute: key => attrs[key], setAttribute: (key, value) => { attrs[key] = value; } },
      querySelector: selector => selector === ".site-nav" ? nav : null,
      addEventListener() {},
    },
    window: {
      CLAUDE_ONE_CONFIG: { theme: { storageKey: "theme", values: ["neumorphism", "liquid-glass"], default: "neumorphism" } },
      location: { hash: "" },
      addEventListener() {},
    },
  });
  for (const file of ["page-registry.js", "shell.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../js", file), "utf8"), context);
  }
  return { context, nav, attrs };
}

test("every registered page has exactly one active parent navigation item", () => {
  const { context, nav, attrs } = shell();
  for (const [route, page] of Object.entries(context.window.__CLAUDEONE_PAGES)) {
    assert.ok(["home", "games", "tools"].includes(page.navSection), `${route} needs a valid navSection`);
    for (const suffix of ["", "?seed=123"]) {
      context.window.location.hash = "#/" + route + suffix;
      context.window.ClaudeOne.renderNav();
      assert.equal((nav.innerHTML.match(/aria-current="page"/g) || []).length, 1, route);
      assert.ok(nav.innerHTML.includes(`href="#/${page.navSection}" data-nav-link aria-current="page"`), route);
    }
    context.window.location.hash = "";
    attrs["data-page"] = route;
    context.window.ClaudeOne.renderNav();
    assert.ok(nav.innerHTML.includes(`href="#/${page.navSection}" data-nav-link aria-current="page"`), route + " body fallback");
  }
});

test("game and tool cards agree with route ownership; aliases inherit their page section", () => {
  const { context } = shell();
  const pages = context.window.__CLAUDEONE_PAGES;
  const cards = fs.readFileSync(path.join(__dirname, "../js/tool-cards.js"), "utf8");
  const boundary = cards.indexOf("var TOOL_CARDS");
  for (const [source, expected] of [[cards.slice(0, boundary), "games"], [cards.slice(boundary), "tools"]]) {
    for (const match of source.matchAll(/href: "#\/([^"]+)"/g)) {
      assert.equal(pages[match[1]]?.navSection, expected, match[1]);
    }
  }
  for (const page of Object.values(pages)) {
    for (const other of Object.values(pages)) {
      if (page.templateId === other.templateId) assert.equal(page.navSection, other.navSection);
    }
  }
  assert.equal(pages.home.navSection, "home");
  assert.equal(pages.playlist.navSection, "tools");
});
