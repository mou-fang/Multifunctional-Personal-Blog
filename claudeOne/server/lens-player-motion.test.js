const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const preview = path.join(__dirname, '../lens-preview');
const load = name => import(pathToFileURL(path.join(preview, name)).href);

function fixture(w = 1440, h = 1000) {
  const make = (x, y, bw, bh, radius, opacity = 1) => ({x, y, w: bw, h: bh, opacity, r0: radius, r1: radius, r2: radius, r3: radius});
  const miniBox = make(w - 108, h - 208, 100, 190, 24, .94);
  const fullBox = make(0, h - (w <= 700 ? 100 : 120), w, w <= 700 ? 100 : 120, 20);
  fullBox.r2 = fullBox.r3 = 0;
  const slot = (box, x, y, sw, sh, visible = true, font = 18) => ({x: box.x + x, y: box.y + y, w: sw, h: sh, visible, opacity: visible ? 1 : 0, font, radius: 12, display: visible ? 'flex' : 'none'});
  const mini = {box: miniBox, slots: {cover: slot(miniBox, 14, 12, 72, 72), play: slot(miniBox, 29, 27, 42, 42),
    next: slot(miniBox, 31, 94, 38, 38), expand: slot(miniBox, 31, 140, 38, 38), info: slot(miniBox, 0, 0, 0, 0, false),
    volume: slot(miniBox, 0, 0, 0, 0, false)}, type: {cover: 26.4}};
  const full = {box: fullBox, slots: {cover: slot(fullBox, 16, 10, 100, 100), play: slot(fullBox, w - 370, 38, 44, 44),
    next: slot(fullBox, w - 320, 42, 36, 36), expand: slot(fullBox, w - 66, 45, 30, 30), info: slot(fullBox, 132, 16, Math.max(40, w - 570), 88, true, 16),
    volume: slot(fullBox, w - 180, 42, 100, 36)}, type: {cover: 40}};
  return {mini, full, viewport: {w, h}};
}

function settle(model, viewport, limit = 240) {
  const frames = [];
  for (let i = 0; i < limit && model.moving; i++) frames.push(model.step(1 / 60, viewport));
  assert.equal(model.moving, false, 'the springs must finish, not leave a permanent animation loop');
  return frames;
}

function near(actual, expected, message) {assert.ok(Math.abs(actual - expected) < .02, `${message}: ${actual} != ${expected}`);}

test('player morph reaches the original endpoints and preserves every visible slot', async () => {
  const {PlayerMorph} = await load('player-motion-core.js');
  for (const size of [[1440, 1000], [390, 844], [320, 740]]) {
    const {mini, full, viewport} = fixture(...size);
    for (const [from, to] of [[mini, full], [full, mini]]) {
      const model = new PlayerMorph(from, to), first = model.step(0, viewport);
      for (const k of ['x', 'y', 'w', 'h']) near(first.box[k], from.box[k], 'continuous first frame ' + k);
      near(first.coverFont, from.type.cover, 'cover lettering does not pop to its final size');
      const frames = settle(model, viewport), last = frames.at(-1);
      for (const k of ['x', 'y', 'w', 'h', 'r0', 'r1', 'r2', 'r3']) near(last.box[k], to.box[k], 'native endpoint ' + k);
      for (const [key, target] of Object.entries(to.slots)) if (target.visible) {
        for (const k of ['x', 'y', 'w', 'h', 'opacity']) near(last.slots[key][k], target[k], `${key}.${k}`);
      }
      for (const f of frames) {
        assert.ok(f.box.x >= 0 && f.box.y >= 0 && f.box.x + f.box.w <= viewport.w + .001 && f.box.y + f.box.h <= viewport.h + .001, 'surface remains in the viewport');
        assert.ok(Object.values(f.box).every(Number.isFinite));
      }
    }
  }
});

test('player morph gives the glass a velocity-driven bend and stages incoming content', async () => {
  const {PlayerMorph} = await load('player-motion-core.js');
  const {mini, full, viewport} = fixture(), model = new PlayerMorph(mini, full);
  const first = model.step(1 / 120, viewport);
  assert.equal(first.slots.info.opacity, 0, 'metadata waits for space in the expanding glass');
  const frames = [first, ...settle(model, viewport)];
  assert.ok(frames.some(f => Math.abs(f.deformation.bend[0]) > 1 && f.deformation.pressure > .05), 'the shader receives real spring motion');
  assert.ok(frames.some(f => f.box.r0 > 27), 'corners round during the liquid transition');
  assert.ok(frames.some(f => f.box.h < full.box.h - .2), 'Lens settling includes controlled overshoot');
  assert.equal(frames.at(-1).slots.info.opacity, 1);
});

test('reversing a player morph keeps its current geometry and velocity', async () => {
  const {PlayerMorph} = await load('player-motion-core.js');
  const {mini, full, viewport} = fixture(), model = new PlayerMorph(mini, full);
  let current;
  for (let i = 0; i < 8; i++) current = model.step(1 / 60, viewport);
  const velocity = model.box.w.velocity;
  const live = {box: current.box, slots: Object.fromEntries(Object.entries(current.slots).map(([key, pose]) => [key, {...pose, visible: pose.opacity > .001, display: 'flex'}])), type: {cover: current.coverFont}};
  model.redirect(live, mini);
  assert.equal(model.box.w.velocity, velocity, 'a reversal must not restart the spring from rest');
  const same = model.step(0, viewport);
  for (const k of ['x', 'y', 'w', 'h']) near(same.box[k], live.box[k], 'reversal starts at the observed geometry');
  for (const [key, pose] of Object.entries(live.slots)) if (pose.visible) near(same.slots[key].x, pose.x, 'control stays continuous ' + key);
  const last = settle(model, viewport).at(-1);
  near(last.box.w, mini.box.w, 'returns to the compact player');
  assert.ok(!last.slots.info || last.slots.info.opacity < .001);
});

test('rapid empty-content reversals do not resurrect invisible controls', async () => {
  const {PlayerMorph} = await load('player-motion-core.js');
  const {mini, full, viewport} = fixture(), model = new PlayerMorph(mini, full);
  const f = model.step(1 / 1000, viewport);
  const live = {box: f.box, slots: Object.fromEntries(Object.entries(f.slots).map(([k, s]) => [k, {...s, visible: s.opacity > .001}])), type: {cover: f.coverFont}};
  model.redirect(live, mini);
  const frames = settle(model, viewport);
  assert.ok(frames.every(frame => !frame.slots.info || frame.slots.info.opacity < .001));
});

test('Soft UI uses the same continuous layout with less overshoot', async () => {
  const {PlayerMorph} = await load('player-motion-core.js');
  const {mini, full, viewport} = fixture();
  const glass = settle(new PlayerMorph(mini, full), viewport);
  const soft = settle(new PlayerMorph(mini, full, {soft: true}), viewport);
  assert.ok(Math.min(...soft.map(f => f.box.h)) > Math.min(...glass.map(f => f.box.h)), 'Soft UI has a more restrained rebound');
  near(soft.at(-1).box.w, full.box.w, 'same endpoint');
});

test('lower frame rates and a long frame do not destabilize or strand the player', async () => {
  const {PlayerMorph} = await load('player-motion-core.js');
  const {mini, full, viewport} = fixture();
  for (const hz of [15, 30, 60, 120]) {
    const model = new PlayerMorph(mini, full);
    let elapsed = 0, frame;
    while (model.moving && elapsed < 1.5) {frame = model.step(1 / hz, viewport); elapsed += 1 / hz;}
    assert.equal(model.moving, false, hz + ' Hz settles before the native handoff');
    near(frame.box.w, full.box.w, hz + ' Hz endpoint');
  }
  const interrupted = new PlayerMorph(mini, full).step(3, viewport);
  assert.ok(Object.values(interrupted.box).every(Number.isFinite));
  assert.ok(interrupted.box.x >= 0 && interrupted.box.x + interrupted.box.w <= viewport.w);
});

test('player motion layout overrides are all transient, preserving the original resting CSS', () => {
  const css = fs.readFileSync(path.join(preview, 'player-motion.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of css.matchAll(/([^{}]+)\{/g)) for (const selector of match[1].split(',')) {
    assert.match(selector, /\.lens-preview(?:\[data-theme="liquid-glass"\])? \.global-player\[data-lens-player-(?:morph|measure|still)\]/, selector);
  }
});

// A DOM fixture exercises the real controller/event lifecycle without a browser.
// The original CSS endpoint boxes are supplied; it does not emulate WebGL or claim visual QA.
function domFixture() {
  const {mini, full, viewport} = fixture();
  class Element extends EventTarget {
    constructor(key) {super(); this.key = key; this.attrs = new Map(); this.vars = new Map(); this.hidden = false; this.isConnected = true;
      const attribute = key => 'data-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
      this.dataset = new Proxy({}, {get: (_, k) => this.attrs.get(attribute(k)), set: (_, k, v) => {this.attrs.set(attribute(k), String(v)); return true;}});
      this.style = {setProperty: (k, v) => this.vars.set(k, v), removeProperty: k => this.vars.delete(k)};}
    hasAttribute(k) {return this.attrs.has(k);}
    setAttribute(k, v = '') {this.attrs.set(k, v);}
    removeAttribute(k) {this.attrs.delete(k);}
    toggleAttribute(k, value) {const on = value === undefined ? !this.hasAttribute(k) : value; if (on) this.setAttribute(k); else this.removeAttribute(k); return on;}
    getBoundingClientRect() {
      const p = this.key === 'root' ? (root.hasAttribute('data-minimized') ? mini.box : full.box) : (root.hasAttribute('data-minimized') ? mini.slots[this.key] : full.slots[this.key]);
      const pose = p || {x: 0, y: 0, w: 0, h: 0};
      if (root.hasAttribute('data-lens-player-morph')) {
        const prefix = this.key === 'root' ? '--lens-player-' : '--lens-slot-';
        const n = key => parseFloat(this.vars.get(prefix + key)) || 0;
        const parent = this.key === 'root' ? {x: 0, y: 0} : root.getBoundingClientRect();
        return {x: n('x') + parent.x, y: n('y') + parent.y, width: n('w'), height: n('h')};
      }
      return {x: pose.x, y: pose.y, width: pose.w, height: pose.h};
    }
    querySelector(selector) {return nodes[selector] || null;}
  }
  const root = new Element('root'); root.setAttribute('data-minimized');
  const byKey = Object.fromEntries(['cover', 'info', 'play', 'next', 'expand', 'volume'].map(key => [key, new Element(key)]));
  const nodes = {'.global-player__cover-wrap': byKey.cover, '.global-player__center': byKey.info, '[data-gp-play]': byKey.play,
    '[data-gp-next]': byKey.next, '[data-gp-expand]': byKey.expand, '.global-player__volume-group': byKey.volume};
  const title = new Element('title'), meta = new Element('meta'), coverText = new Element('coverText');
  nodes['[data-gp-title]'] = title; nodes['[data-gp-meta]'] = meta; nodes['[data-gp-cover-placeholder]'] = coverText;
  const win = new EventTarget(), doc = new EventTarget(), media = new EventTarget();
  const scheduled = new Map(), observers = []; let now = 0, nextId = 1;
  Object.assign(win, {innerWidth: viewport.w, innerHeight: viewport.h, AbortController,
    MutationObserver: class {constructor(callback) {this.callback = callback; observers.push(this);} observe() {} disconnect() {this.callback = null;}}, ResizeObserver: class {observe() {} disconnect() {}},
    performance: {now: () => now}, requestAnimationFrame: cb => {const id = nextId++; scheduled.set(id, cb); return id;}, cancelAnimationFrame: id => scheduled.delete(id),
    getComputedStyle: element => {
      const pose = element === root ? (root.hasAttribute('data-minimized') ? mini.box : full.box) : (root.hasAttribute('data-minimized') ? mini.slots[element.key] : full.slots[element.key]);
      const morph = root.hasAttribute('data-lens-player-morph');
      const vars = element.vars;
      const opacity = morph ? vars.get(element === root ? '--lens-player-opacity' : '--lens-slot-opacity') : pose?.opacity;
      return {display: morph ? vars.get('--lens-slot-display') || 'flex' : pose?.display || 'block', opacity: String(opacity ?? 1),
        fontSize: element === coverText ? (root.hasAttribute('data-minimized') ? '26.4px' : '40px') : '16px', lineHeight: '20.8px',
        borderTopLeftRadius: (pose?.r0 || pose?.radius || 12) + 'px', borderTopRightRadius: (pose?.r1 || 0) + 'px',
        borderBottomRightRadius: (pose?.r2 || 0) + 'px', borderBottomLeftRadius: (pose?.r3 || 0) + 'px', borderLeftWidth: '0px', borderTopWidth: '0px'};
    }});
  doc.defaultView = win; doc.hidden = false; doc.body = {dataset: {theme: 'liquid-glass'}}; media.matches = false;
  for (const e of [root, ...Object.values(byKey), title, meta, coverText]) e.ownerDocument = doc;
  return {root, win, doc, media, byKey, scheduled,
    frame() {now += 1000 / 60; const callbacks = [...scheduled.values()]; scheduled.clear(); callbacks.forEach(cb => cb(now));},
    change(min) {root.dispatchEvent(new Event('click')); root.toggleAttribute('data-minimized', min); const event = new Event('claudeone:playerchange'); event.detail = {reason: 'viewchange'}; win.dispatchEvent(event);},
    theme(value) {doc.body.dataset.theme = value; observers.forEach(observer => observer.callback?.());},
    finishFrames() {for (let i = 0; i < 180 && scheduled.size; i++) this.frame(); assert.equal(scheduled.size, 0, 'no leftover frame loop');}};
}

test('real player controller handles reversals and hands the unchanged layout back to native CSS', async () => {
  const {createPlayerMotion} = await load('player-motion.js');
  const dom = domFixture(); let painted = 0;
  const motion = createPlayerMotion(dom.root, {reduce: dom.media, onFrame: () => painted++});
  dom.frame(); dom.change(false);
  assert.ok(dom.root.hasAttribute('data-lens-player-morph'));
  assert.equal(dom.root.dataset.lensPlayerMotion, 'expanding');
  for (let i = 0; i < 8; i++) dom.frame();
  dom.root.scrollTop=34; dom.root.scrollLeft=150;
  const width = dom.root.getBoundingClientRect().width;
  assert.ok(width > 100 && width < 1440);
  dom.change(true);
  near(dom.root.getBoundingClientRect().width, width, 'no restart jump when toggled halfway');
  assert.equal(dom.byKey.info.hasAttribute('inert'), true, 'outgoing hidden controls cannot gain focus');
  dom.finishFrames();
  assert.equal(dom.root.hasAttribute('data-lens-player-morph'), false);
  assert.equal(dom.root.vars.size, 0, 'no resting size/typography overrides');
  assert.equal(dom.root.scrollTop,0,'focus scrolling cannot leave the controls vertically displaced');
  assert.equal(dom.root.scrollLeft,0,'focus scrolling cannot leave the controls horizontally displaced');
  for (const node of Object.values(dom.byKey)) {assert.equal(node.vars.size, 0); assert.equal(node.hasAttribute('inert'), false);}
  assert.ok(painted > 10);
  motion.destroy(); assert.equal(dom.root.hasAttribute('data-lens-player-motion'), false);
  const paintsAfterDestroy = painted; dom.change(false); dom.finishFrames();
  assert.equal(painted, paintsAfterDestroy, 'destroyed listeners cannot restart the presentation controller');
});

test('reduced motion, backgrounding, resizing and destroy leave no animation or pinned controls', async () => {
  const {createPlayerMotion} = await load('player-motion.js');
  for (const action of ['reduced', 'off', 'hidden', 'resize', 'theme', 'destroy']) {
    const dom = domFixture();
    const motion = createPlayerMotion(dom.root, {reduce: dom.media, noMotion: action === 'off'});
    dom.frame(); dom.change(false);
    if (action === 'reduced') {dom.media.matches = true; dom.media.dispatchEvent(new Event('change'));}
    if (action === 'hidden') {dom.doc.hidden = true; dom.doc.dispatchEvent(new Event('visibilitychange'));}
    if (action === 'resize') dom.win.dispatchEvent(new Event('resize'));
    if (action === 'theme') dom.theme('neumorphism');
    if (action === 'destroy') motion.destroy();
    dom.finishFrames();
    assert.equal(dom.root.hasAttribute('data-lens-player-morph'), false, action);
    assert.equal(dom.root.vars.size, 0, action);
    motion.destroy(); assert.equal(dom.scheduled.size, 0, action + ' cleanup');
  }
});
