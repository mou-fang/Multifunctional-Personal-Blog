import {PlayerMorph} from './player-motion-core.js';
import {setOpticalState, clearOpticalState} from '../libs/lens-1.1.0-showcase.1-20261017/internal/optics.js';

const selectors = {cover: '.global-player__cover-wrap', info: '.global-player__center', prev: '[data-gp-prev]', play: '[data-gp-play]',
  next: '[data-gp-next]', mode: '[data-gp-mode]', playlist: '[data-gp-playlist]', volume: '.global-player__volume-group', expand: '[data-gp-expand]'};
const rootProperties = ['x', 'y', 'w', 'h', 'r0', 'r1', 'r2', 'r3', 'opacity', 'title-font', 'title-line', 'meta-font', 'cover-font'];
const slotProperties = ['x', 'y', 'w', 'h', 'opacity', 'font', 'radius', 'display', 'pointer'];

/** Own only presentation. The original player still owns state, controls and audio. */
export function createPlayerMotion(root, {noMotion = false, reduce, onFrame = () => {}} = {}) {
  if (!root) return {destroy() {}};
  const doc = root.ownerDocument, win = doc.defaultView;
  const controller = new win.AbortController(), signal = controller.signal;
  const nodes = Object.fromEntries(Object.entries(selectors).map(([key, selector]) => [key, root.querySelector(selector)]));
  const inertBefore = new Map();
  const media = reduce || win.matchMedia('(prefers-reduced-motion: reduce)');
  let minimized = root.hasAttribute('data-minimized'), model = null, prior = null;
  let frame = 0, cacheFrame = 0, last = 0, began = 0, active = false, destroyed = false;
  let border = {x:0,y:0}, first = false;
  const skin = () => root.querySelector(':scope > [data-lens-skin]');
  const style = element => win.getComputedStyle(element);
  const number = (value, fallback = 0) => Number.parseFloat(value) || fallback;
  const set = (element, prefix, key, value) => element.style.setProperty(prefix + key, String(value));
  function resetScroll() {if (root.scrollTop || root.scrollLeft) {root.scrollTop=0; root.scrollLeft=0;}}

  function snapshot() {
    const r = root.getBoundingClientRect(), s = style(root);
    const box = {x: r.x, y: r.y, w: r.width, h: r.height, opacity: number(s.opacity, 1)};
    ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].forEach((corner, i) => {box['r' + i] = number(s['border' + corner + 'Radius']);});
    const slots = {};
    for (const [key, node] of Object.entries(nodes)) {
      if (!node) continue;
      const rect = node.getBoundingClientRect(), cs = style(node), opacity = number(cs.opacity, 0);
      slots[key] = {x: rect.x, y: rect.y, w: rect.width, h: rect.height, opacity, display: cs.display,
        visible: cs.display !== 'none' && rect.width > 1 && rect.height > 1 && opacity > .001,
        font: number(cs.fontSize, 16), radius: number(cs.borderTopLeftRadius)};
    }
    const title = root.querySelector('[data-gp-title]'), meta = root.querySelector('[data-gp-meta]'), cover = root.querySelector('[data-gp-cover-placeholder]');
    return {box, slots, border:{x:number(s.borderLeftWidth),y:number(s.borderTopWidth)}, type: {title: title ? style(title).fontSize : '16px', line: title ? style(title).lineHeight : '1.3',
      meta: meta ? style(meta).fontSize : '12px', cover: cover ? number(style(cover).fontSize, 26) : 26}};
  }

  function cache() {
    if (destroyed || active || root.hidden) return;
    prior = snapshot();
  }
  function scheduleCache() {
    if (!cacheFrame && !active && !destroyed) cacheFrame = win.requestAnimationFrame(() => {cacheFrame = 0; cache();});
  }
  function removeOverrides() {
    root.removeAttribute('data-lens-player-morph');
    for (const property of rootProperties) root.style.removeProperty('--lens-player-' + property);
    for (const node of Object.values(nodes)) if (node) {
      node.removeAttribute('data-lens-player-slot');
      for (const property of slotProperties) node.style.removeProperty('--lens-slot-' + property);
      if (inertBefore.has(node)) node.toggleAttribute('inert', inertBefore.get(node));
    }
    inertBefore.clear();
  }
  function finish() {
    win.cancelAnimationFrame(frame); frame = 0; active = false; model = null; last = 0;
    root.setAttribute('data-lens-player-measure', '');
    removeOverrides();
    resetScroll();
    const surface = skin(); if (surface) clearOpticalState(surface);
    prior = snapshot(); // Flush the native endpoint with transitions disabled.
    root.removeAttribute('data-lens-player-measure');
    root.dataset.lensPlayerMotion = 'idle'; onFrame({active:false});
  }
  function apply(result) {
    for (const [key, value] of Object.entries(result.box)) set(root, '--lens-player-', key, value + (key === 'opacity' ? '' : 'px'));
    set(root, '--lens-player-', 'cover-font', result.coverFont + 'px');
    for (const [key, pose] of Object.entries(result.slots)) {
      const node = nodes[key]; if (!node) continue;
      for (const [property, value] of Object.entries(pose)) {
        const local = property === 'x' ? value - result.box.x - border.x : property === 'y' ? value - result.box.y - border.y : value;
        set(node, '--lens-slot-', property, local + (property === 'opacity' ? '' : 'px'));
      }
    }
    for (const [key, node] of Object.entries(nodes)) if (node && !result.slots[key]) set(node, '--lens-slot-', 'opacity', 0);
    const surface = skin();
    if (surface && doc.body.dataset.theme === 'liquid-glass') setOpticalState(surface, {deformation: result.deformation}, {animate: true, duration: 0});
    onFrame({active:true, first, box:result.box}); first=false;
  }
  function tick(now) {
    frame = 0;
    if (destroyed || !active) return;
    if (doc.hidden || media.matches || noMotion || !root.isConnected) {finish(); return;}
    const dt = last ? Math.min((now - last) / 1000, .08) : 1 / 60; last = now;
    apply(model.step(dt, {w: win.innerWidth, h: win.innerHeight}));
    if (model.moving && now - began < 1500) frame = win.requestAnimationFrame(tick);
    else finish();
  }
  function change(event) {
    if (event.detail?.reason !== 'viewchange') {scheduleCache(); return;}
    const next = root.hasAttribute('data-minimized');
    if (next === minimized) return;
    minimized = next;
    const from = active ? snapshot() : prior;
    root.setAttribute('data-lens-player-measure', '');
    root.removeAttribute('data-lens-player-morph');
    const target = snapshot();
    border=target.border; first=true;
    if (!from || from.box.w < 1 || root.hidden || doc.hidden || media.matches || noMotion) {finish(); return;}
    if (model) model.redirect(from, target);
    else model = new PlayerMorph(from, target, {soft: doc.body.dataset.theme === 'neumorphism'});
    const type = next ? from.type : target.type;
    set(root, '--lens-player-', 'title-font', type.title); set(root, '--lens-player-', 'title-line', type.line); set(root, '--lens-player-', 'meta-font', type.meta);
    set(root, '--lens-player-', 'cover-font', type.cover + 'px');
    for (const [key, node] of Object.entries(nodes)) if (node) {
      node.dataset.lensPlayerSlot = key;
      const a = from.slots[key], b = target.slots[key];
      set(node, '--lens-slot-', 'display', (b?.visible ? b.display : a?.display !== 'none' ? a?.display : 'flex') || 'flex');
      set(node, '--lens-slot-', 'pointer', b?.visible ? 'auto' : 'none');
      if (!inertBefore.has(node)) inertBefore.set(node, node.hasAttribute('inert'));
      node.toggleAttribute('inert', !b?.visible || inertBefore.get(node));
    }
    active = true; began = win.performance.now(); last = 0;
    root.setAttribute('data-lens-player-morph', '');
    root.dataset.lensPlayerMotion = next ? 'collapsing' : 'expanding';
    const surface = skin();
    if (surface && doc.body.dataset.theme === 'liquid-glass') setOpticalState(surface, {selected: .12, color: [.56, .91, .98]}, {animate: true, pulse: true});
    apply(model.step(0, {w: win.innerWidth, h: win.innerHeight}));
    root.removeAttribute('data-lens-player-measure');
    win.cancelAnimationFrame(frame); frame = win.requestAnimationFrame(tick);
  }
  function preference() {
    root.toggleAttribute('data-lens-player-still', noMotion || media.matches);
    if (active) finish(); else scheduleCache();
  }

  root.addEventListener('pointerdown', cache, {capture: true, signal});
  root.addEventListener('click', cache, {capture: true, signal});
  root.addEventListener('keydown', cache, {capture: true, signal});
  win.addEventListener('claudeone:playerchange', change, {signal});
  win.addEventListener('resize', () => {if (active) finish(); scheduleCache();}, {passive: true, signal});
  doc.addEventListener('visibilitychange', () => {if (doc.hidden && active) finish();}, {signal});
  media.addEventListener('change', preference, {signal});
  const themeObserver = new win.MutationObserver(() => {if (active) finish(); scheduleCache();});
  themeObserver.observe(doc.body, {attributes: true, attributeFilter: ['data-theme']});
  const sizeObserver = new win.ResizeObserver(scheduleCache); sizeObserver.observe(root);
  root.dataset.lensPlayerMotion = 'idle'; preference(); scheduleCache();
  resetScroll();

  return {destroy() {
    if (destroyed) return;
    destroyed = true; controller.abort(); themeObserver.disconnect(); sizeObserver.disconnect();
    win.cancelAnimationFrame(cacheFrame); finish();
    root.removeAttribute('data-lens-player-motion'); root.removeAttribute('data-lens-player-still');
  }};
}
