const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dataSource = fs.readFileSync(path.join(__dirname, "../js/abyss-data.js"), "utf8");
const gameSource = fs.readFileSync(path.join(__dirname, "../js/abyss.js"), "utf8");
const exportMarker = "  host.__page_abyss = { mount: mount, unmount: unmount };";

// Expose the actual closure only inside the VM. The shipped page has no test API.
function harness(options = {}, upgrades = {}) {
  let random = () => 0.99;
  const math = Object.create(Math);
  math.random = () => random();
  const storage = new Map();
  const window = {
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    confirm: () => true
  };
  const context = vm.createContext({ window, Math: math });
  vm.runInContext(dataSource, context);
  assert.ok(gameSource.includes(exportMarker));
  vm.runInContext(gameSource.replace(exportMarker, `
    host.__abyssTest = {
      create: function (opts, upgrades) {
        meta = defaultMeta(); meta.upgrades = upgrades;
        settings = Object.assign({}, settings, opts);
        state = newState(); state.mode = "playing"; return state;
      },
      meta: function () { return meta; },
      elements: function (value) { els = value; },
      options: function () { return pendingOptions; },
      addWeapon, addPassive, addRelic, addLogicModule, applyWeaponLevel,
      fireBeam, fireProjectile, fireEnemyShot, fireLobbedShot, tickAura,
      sProjectiles, sEnemies, sEnemyShots, sBossTimeline, sMapMechanic,
      makeEnemy, spawnBoss, dealDamage, killEnemy, damagePlayer, healPlayer,
      addBuff, stepSim, recalcStats, onLevelUp, randomizeStat, chooseOption,
      finishRun, openCrate, onKeyDown, onKeyUp, readMoveVec, restartRun, quitToMenu
    };
` + exportMarker), context);
  const api = window.__abyssTest;
  const data = window.__ABYSS_DATA__;
  const state = api.create(options, upgrades);
  const enemy = (dx, dy = 0, props = {}) => {
    const e = api.makeEnemy({ ...data.ENEMIES.infected, hp: 100, speed: 0, ...props },
      state.player.x + dx, state.player.y + dy);
    state.enemies.push(e);
    return e;
  };
  const weapon = id => {
    api.addWeapon(state, id);
    return state.weapons.find(w => w.def.id === id);
  };
  return { api, data, state, enemy, weapon, random: fn => { random = fn; } };
}

function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }

test("railgun aims at its target, pierces aligned enemies, and hits each only once per beam", () => {
  const h = harness({ startWeapon: "railgun" });
  const first = h.enemy(400), second = h.enemy(800), offAxis = h.enemy(450, 40);
  const behind = h.enemy(-900), beyond = h.enemy(1600);
  h.api.fireBeam(h.state.weapons[0]);
  h.api.sProjectiles(1 / 60);
  assert.equal(first.hp, 70);
  assert.equal(second.hp, 70);
  for (const e of [offAxis, behind, beyond]) assert.equal(e.hp, 100);
  for (let i = 0; i < 35; i++) h.api.sProjectiles(1 / 60);
  assert.equal(first.hp, 70);
  assert.equal(second.hp, 70);
  assert.equal(h.state.projectiles.length, 0);
  h.api.fireBeam(h.state.weapons[0]);
  h.api.sProjectiles(1 / 60);
  assert.equal(first.hp, 40);
});

test("laser hits resolve shields, critical damage, kills and XP through the normal damage path", () => {
  const h = harness({ startWeapon: "railgun" });
  const shielded = h.enemy(100), doomed = h.enemy(200, 0, { hp: 18 });
  shielded.shieldHp = 10;
  h.state.stats.crit = 1;
  h.api.fireBeam(h.state.weapons[0]);
  h.api.sProjectiles(1 / 60);
  near(shielded.hp, 56);
  assert.equal(shielded.shieldHp, 0);
  assert.equal(doomed.dead, true);
  assert.equal(h.state.player.kills, 1);
  assert.ok(h.state.pickups.some(p => p.kind === "xp"));
});

test("beam radius and maximum length follow the rendered beam, including range bonuses", () => {
  const h = harness({ startWeapon: "railgun" });
  h.enemy(50); // Keep aiming horizontal.
  const edge = h.enemy(500, 8), miss = h.enemy(500, 10), far = h.enemy(1700);
  h.state.stats.range = 1.5;
  h.api.fireBeam(h.state.weapons[0]);
  assert.equal(h.state.projectiles[0].len, h.data.CONFIG.W * 1.5 * 1.5);
  h.api.sProjectiles(1 / 60);
  assert.equal(edge.hp, 70);
  assert.equal(miss.hp, 100);
  assert.equal(far.hp, 70);
});

test("enemies entering a live beam are hit and expired beams cannot deal damage", () => {
  const h = harness({ startWeapon: "railgun" });
  h.enemy(100);
  const entering = h.enemy(400, 50);
  h.api.fireBeam(h.state.weapons[0]);
  h.api.sProjectiles(0.1);
  entering.y = h.state.player.y;
  h.api.sProjectiles(0.1);
  assert.equal(entering.hp, 70);
  const late = h.enemy(600);
  h.api.sProjectiles(0.4);
  assert.equal(late.hp, 100);
});

test("dual railgun and evolved star ray both damage enemies", () => {
  for (const id of ["railgun", "star_ray"]) {
    const h = harness({ startWeapon: id });
    const w = h.state.weapons[0];
    w.level = 5; h.api.applyWeaponLevel(w);
    const e = h.enemy(300, 0, { hp: 1000 });
    h.api.fireBeam(w); h.api.sProjectiles(1 / 60);
    assert.ok(e.hp < 1000, id);
    if (id === "railgun") assert.equal(h.state.projectiles.length, 2);
    else { const hp = e.hp; h.api.fireBeam(w); assert.ok(e.hp < hp); }
  }
});

test("fast projectiles hit enemies crossed between simulation positions", () => {
  const h = harness();
  const e = h.enemy(20);
  h.state.projectiles.push({ x: h.state.player.x, y: h.state.player.y, vx: 3000, vy: 0,
    life: 1, dmg: 12, r: 2, _hit: {} });
  h.api.sProjectiles(1 / 60);
  assert.equal(e.hp, 88);
});

test("all starting weapons and evolved forms deal damage in the complete simulation", () => {
  const ids = harness().data.WEAPONS.map(w => w.id);
  for (const id of ids) {
    const h = harness({ startWeapon: id });
    const w = h.state.weapons[0];
    h.state.spawnTimer = 1000;
    const distance = w.def.kind === "orbit" ? w.runtime.radius * w.runtime.range : 40;
    const e = h.enemy(distance, 0, { hp: 10000 });
    for (let frame = 0; frame < 180; frame++) h.api.stepSim(1 / 60);
    assert.ok(e.hp < 10000, id);
  }
});

test("burn, knockback, frozen fields and orbit attraction affect enemies", () => {
  for (const id of ["flamer", "fusion_jet", "forcefield", "permafrost", "black_saw"]) {
    const h = harness({ startWeapon: id });
    const w = h.state.weapons[0];
    const e = h.enemy(30);
    if (id === "black_saw") { w._angle = 0; h.api.sProjectiles(0.1); assert.ok(e.x < h.state.player.x + 30); }
    else {
      h.api.tickAura(w);
      if (id === "forcefield") assert.ok(e.x > h.state.player.x + 30);
      else if (id === "permafrost") assert.ok(e.frozen > 0);
      else {
        assert.ok(e.burn > 0);
        const hp = e.hp; h.api.sEnemies(0.1); assert.ok(e.hp < hp);
      }
    }
  }
});

test("temporary buffs apply immediately and expire without restoring consumed shields", () => {
  const h = harness({ charId: "medic" });
  assert.equal(h.state.player.shield, 1);
  h.api.damagePlayer(10, "shot");
  assert.equal(h.state.player.shield, 0);
  h.api.addBuff({ atkspd: 1, dur: 0.05 });
  near(h.state.stats.atkspd, 2);
  h.state.weapons = []; h.state.spawnTimer = 100;
  for (let i = 0; i < 4; i++) h.api.stepSim(1 / 60);
  near(h.state.stats.atkspd, 1);
  assert.equal(h.state.player.shield, 0);
  h.api.addPassive(h.state, "shield_gen");
  assert.equal(h.state.player.shield, 2);
});

test("shield regeneration starts its delay on impact and restores one charge at a time", () => {
  const h = harness({ charId: "heavy" });
  h.state.player.shieldTimer = 20;
  h.api.damagePlayer(10, "shot");
  assert.equal(h.state.player.shield, 1);
  assert.equal(h.state.player.shieldTimer, 0);
  h.state.weapons = []; h.state.spawnTimer = 100;
  h.api.stepSim(0.1);
  assert.equal(h.state.player.shield, 1);
  h.state.player.shieldTimer = 6;
  h.api.stepSim(0.1);
  assert.equal(h.state.player.shield, 2);
});

test("Zero's level bonus survives choosing an upgrade and later stat recalculations", () => {
  const h = harness();
  h.state.player.level = 5;
  h.api.onLevelUp();
  h.api.chooseOption(0);
  h.api.recalcStats(h.state);
  const passiveCrit = h.state.passives.reduce((n, p) => n + (p.def.stat.crit || 0), 0);
  near(h.state.stats.crit, 0.25 + passiveCrit);
});

test("gambler level rolls survive stat recalculation", () => {
  for (const [index, key] of [[0, "atk"], [1, "atkspd"], [2, "crit"], [3, "speed"], [4, "range"]]) {
    const h = harness({ charId: "gambler" });
    const values = [(index + 0.1) / 5, 0.75];
    h.random(() => values.shift() ?? 0.99);
    const original = h.state.stats[key];
    h.api.randomizeStat(h.state, 0.15);
    h.api.recalcStats(h.state);
    near(h.state.stats[key], key === "crit" ? original + 0.075 : original * 1.075);
  }
});

test("abyss heart follows current health after damage and healing", () => {
  const h = harness();
  h.api.addRelic(h.state, "abyss_heart");
  h.api.damagePlayer(25, "shot");
  near(h.state.stats.atk, 1.25);
  h.api.healPlayer(h.state, 25, false);
  near(h.state.stats.atk, 1);
});

test("difficulty and elite multipliers apply to contact, laser and lobbed damage", () => {
  const h = harness({ diffId: "nightmare" });
  const e = h.enemy(0, 0, { dmg: 10 });
  e.affix = h.data.ELITE_AFFIXES.find(a => a.id === "berserk");
  e.dmg *= e.affix.mod.dmg;
  h.api.sEnemies(0.1);
  near(h.state.player.hp, 100 - 10 * 1.5 * 1.5 * 0.2);
  h.api.fireEnemyShot(e, 0, true);
  near(h.state.enemyShots[0].dmg, 6 * 1.5 * 1.5);
  h.api.fireLobbedShot(e);
  near(h.state.enemyShots[1].dmg, 9 * 1.5 * 1.5);
});

test("enemy healers cannot increase targets above their maximum health", () => {
  const h = harness();
  const target = h.enemy(30);
  h.enemy(50, 0, h.data.ENEMIES.healer);
  h.api.sEnemies(1);
  assert.equal(target.hp, target.maxHp);
});

test("time rift slows enemy movement", () => {
  const h = harness();
  h.api.addRelic(h.state, "time_rift");
  const e = h.enemy(100, 0, { speed: 1 });
  h.api.sEnemies(0.1);
  near(e.x, h.state.player.x + 100 - 50 * 0.85 * 0.1);
});

test("the enemy cap never removes the active boss", () => {
  const h = harness();
  h.api.spawnBoss(h.data.BOSSES[0]);
  const boss = h.state.activeBoss;
  for (let i = 0; i < h.data.CONFIG.MAX_ENEMIES + 10; i++) h.enemy(600);
  h.api.sEnemies(1 / 60);
  assert.equal(h.state.enemies.length, h.data.CONFIG.MAX_ENEMIES);
  assert.ok(h.state.enemies.includes(boss));
});

test("final boss is counted in rewards and result before a normal run finishes", () => {
  const h = harness();
  const resultStats = {}, resultFrag = {};
  h.api.elements({ resultStats, resultFrag });
  h.state.bossIndex = 3; h.state.time = 1200;
  h.api.spawnBoss(h.data.BOSSES[3]);
  h.api.killEnemy(h.state.activeBoss, "beam");
  assert.equal(h.state.mode, "cleared");
  assert.equal(h.state.bossIndex, 4);
  assert.match(resultStats.innerHTML, /击败 Boss <b>4<\/b>/);
  assert.equal(resultFrag.textContent, 122);
  assert.equal(h.api.meta().stats.runs, 1);
});

test("unlimited runs continue after the final boss and strengthen new enemies", () => {
  const h = harness({ diffId: "endless" });
  h.state.bossIndex = 3; h.state.time = 1200;
  h.api.spawnBoss(h.data.BOSSES[3]);
  h.api.killEnemy(h.state.activeBoss, "beam");
  assert.equal(h.state.mode, "playing");
  assert.equal(h.state.bossIndex, 4);
  assert.equal(h.api.meta().stats.runs, 0);
  h.api.sBossTimeline(10);
  near(h.state.endlessScale, 1.2);
  const e = h.enemy(100);
  near(e.maxHp, 100 * 1.5 * 1.2);
  near(e.dmg, 8 * 1.3 * 1.2);
});

test("death stops the current simulation before XP upgrades and pays rewards only once", () => {
  const h = harness();
  const result = { hidden: true }, levelup = { hidden: true };
  h.api.elements({ result, levelup });
  h.state.weapons = []; h.state.player.hp = 1;
  h.state.player.xp = 1000;
  h.state.enemyShots.push({ x: h.state.player.x, y: h.state.player.y, vx: 0, vy: 0, dmg: 10, life: 1, r: 2 });
  h.api.stepSim(1 / 60);
  assert.equal(h.state.mode, "dead");
  assert.equal(h.state.player.level, 1);
  assert.equal(result.hidden, false);
  assert.equal(levelup.hidden, true);
  const frag = h.api.meta().frag;
  h.api.damagePlayer(10, "shot"); h.api.finishRun(false); h.api.stepSim(1 / 60);
  assert.equal(h.api.meta().stats.runs, 1);
  assert.equal(h.api.meta().frag, frag);
});

test("a kill causing lethal reflected damage is counted before the result is frozen", () => {
  const h = harness();
  const resultStats = {};
  h.api.elements({ resultStats });
  h.state.player.hp = 1;
  const e = h.enemy(100, 0, { hp: 10 });
  e.affix = h.data.ELITE_AFFIXES.find(a => a.id === "thorns");
  h.api.dealDamage(e, 12, "proj");
  assert.equal(h.state.mode, "dead");
  assert.equal(e.dead, true);
  assert.equal(h.state.player.kills, 1);
  assert.match(resultStats.innerHTML, /击杀数 <b>1<\/b>/);
  assert.equal(h.api.meta().stats.runs, 1);
});

test("heat damage is recorded so a damaged run cannot unlock flawless", () => {
  const h = harness({ mapId: "lava" });
  h.state.player.moveTime = 1;
  h.api.sMapMechanic(0.1);
  near(h.state.runStats.damageTaken, 0.1);
  h.state.bossIndex = 1;
  h.api.finishRun(false);
  assert.equal(h.api.meta().achievements.flawless, undefined);
});

test("crate totals and lucky coin rewards match the gold actually awarded", () => {
  const h = harness();
  h.random(() => 0.99);
  h.api.openCrate({ x: 0, y: 0 });
  assert.equal(h.state.player.gold, 15);
  assert.equal(h.state.runStats.goldTotal, 15);
  h.api.addRelic(h.state, "lucky_coin");
  const e = h.enemy(100);
  h.random(() => 0.1);
  h.api.killEnemy(e, "beam");
  assert.equal(h.state.pickups.find(p => p.kind === "gold").val, 2);
});

test("initial drone upgrade supplements the selected weapon and does not duplicate itself", () => {
  for (const startWeapon of ["railgun", "laser_drone"]) {
    const h = harness({ startWeapon }, { start_drones: 1 });
    const ids = Array.from(h.state.weapons, w => w.def.id);
    assert.ok(ids.includes(startWeapon));
    assert.equal(ids.filter(id => id === "laser_drone").length, 1);
    assert.equal(h.state.weapons.find(w => w.def.id === "laser_drone").level, 1);
  }
});

test("magnet passive increases pickup range independently of weapon range", () => {
  const h = harness();
  h.api.addPassive(h.state, "magnet");
  near(h.state.stats.pickupRange, 0.2);
  near(h.state.stats.range, 1.2);
});

test("typing and key repeats do not toggle the game; restarting clears held movement", () => {
  const h = harness();
  const event = (code, extra = {}) => ({ code, preventDefault() {}, ...extra });
  h.api.onKeyDown(event("KeyP", { target: { tagName: "TEXTAREA" } }));
  assert.equal(h.state.mode, "playing");
  h.api.onKeyDown(event("KeyP"));
  assert.equal(h.state.mode, "paused");
  h.api.onKeyDown(event("KeyP", { repeat: true }));
  assert.equal(h.state.mode, "paused");
  h.api.onKeyDown(event("KeyD"));
  assert.equal(h.api.readMoveVec().moving, true);
  h.api.restartRun();
  assert.equal(h.api.readMoveVec().moving, false);
  let prevented = false;
  h.api.onKeyDown({ code: "Space", target: { tagName: "BUTTON" }, preventDefault() { prevented = true; } });
  assert.equal(prevented, false);
});
