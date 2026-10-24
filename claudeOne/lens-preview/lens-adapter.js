/* Lens material/gesture adapter for the unchanged original homepage DOM. */
import {createGlassSystem} from '../libs/lens-1.1.0-showcase.1-20261017/index.js';
import {setOpticalState, opticalSelection, clearOpticalState} from '../libs/lens-1.1.0-showcase.1-20261017/internal/optics.js';
import {createPlayerMotion} from './player-motion.js';
import {optimizeRenderer} from './renderer-performance.js';
import {orderGlassSurfaces} from './glass-composition.js';

const query = new URLSearchParams(location.search);
const baseline = query.has('baseline');
const cssOnly = query.get('render') === 'css';
const noMotion = query.get('motion') === 'off';
// The pale site grid needs a clear, thick lens rather than the demo's 24% haze.
const material = ['clear', 'soft', 'thick'].includes(query.get('material')) ? query.get('material') : {refraction: 1, blur: .025, dispersion: .75};
const signalController = new AbortController(), signal = signalController.signal;
const systems = new Map(), marked = new Set();
let world = null, observer = null, frame = 0, destroyed = false, nav = null, indicator = null, navBody = null;
let volumeThumb = null, volumeBody = null;
let toggleClickUntil = 0;
let playerMotion = null;
let lastPlaying = null;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

const selector = [
  '.brand-mark', '.site-nav', '.github-link', '.theme-toggle', '.btn', '.cube-turn-btn', '.pill', '.cube-controls',
  '.visitor-pulse', '.visitor-pulse__metrics', '.visitor-pulse__privacy', '.modal-card', '.input', '.textarea',
  '.global-player__btn', '.global-player__progress-wrap', '.global-player__progress-thumb',
  '.assistant-iconbtn', '.assistant-menu-button', '.assistant-menu-popover', '.assistant-menu-option',
  '.assistant-conv-main', '.assistant-conv-icon', '.assistant-tool-toggle', '.assistant-think', '.assistant-send', '.assistant-stop', '.assistant-bubble', '.assistant-input-wrap',
].join(',');
const interactive = '.btn,.cube-turn-btn,.github-link,.global-player__btn,.assistant-iconbtn,.assistant-menu-button,.assistant-menu-option,.assistant-conv-main,.assistant-conv-icon,.assistant-tool-toggle,.assistant-think,.assistant-send,.assistant-stop';
const overlayFor = element => element.closest('[data-lens-overlay]');
const ownerFor = element => overlayFor(element) || world;
const mainLinks = () => [...(nav?.querySelectorAll('a[data-nav-link]') || [])];

function paintGrid(stage) {
  return (ctx, {width, height, dpr}) => {
    const rect = stage === world ? {left: 0, top: 0} : stage.getBoundingClientRect();
    const style = getComputedStyle(document.body), background = style.getPropertyValue('--bg').trim() || '#f3f3f3';
    const grid = '#c6cdd6';
    ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
    const size = 55 * dpr;
    ctx.strokeStyle = grid; ctx.lineWidth = .9 * dpr;
    const offsetX = ((rect.left % 55) + 55) % 55 * dpr;
    const offsetY = ((rect.top % 55) + 55) % 55 * dpr;
    for (let x = -offsetX + size * .255; x < width + size; x += size / 2) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = -offsetY + size * .255; y < height + size; y += size / 2) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
  };
}

function clipToViewport(element, stage) {
  const box = stage.getBoundingClientRect(), dpr = systems.get(stage)?.renderer?.dpr || 1;
  let left = Math.max(0, box.left), right = Math.min(innerWidth, box.right);
  let top = Math.max(0, box.top), bottom = Math.min(innerHeight, box.bottom);
  for (let parent = element.parentElement; parent && parent !== stage && parent !== document.body && parent !== document.documentElement; parent = parent.parentElement) {
    const style = getComputedStyle(parent), rect = parent.getBoundingClientRect();
    if (/^(auto|scroll|hidden|clip)$/.test(style.overflowX)) {left = Math.max(left, rect.left + parent.clientLeft); right = Math.min(right, rect.left + parent.clientLeft + parent.clientWidth);}
    if (/^(auto|scroll|hidden|clip)$/.test(style.overflowY)) {top = Math.max(top, rect.top + parent.clientTop); bottom = Math.min(bottom, rect.top + parent.clientTop + parent.clientHeight);}
  }
  return {left: (left - box.left) * dpr, right: (right - box.left) * dpr, bottom: (box.bottom - bottom) * dpr, top: (box.bottom - top) * dpr};
}

function createSystem(stage) {
  const existing = systems.get(stage);
  if (existing && (!existing.renderer || existing.renderer.canvas.isConnected)) return existing;
  existing?.destroy(); systems.delete(stage);
  const system = createGlassSystem(stage, {scene: 'grid', artwork: paintGrid(stage), material, motion: false, elasticity: noMotion ? 0 : .7, audio: {enabled: false, volume: .15, storage: null}});
  system.jelly.reduced = noMotion || reduce.matches;
  systems.set(stage, system);
  const renderer = system.renderer;
  if (renderer) {
    renderer.reducedMotion = noMotion || reduce.matches;
    optimizeRenderer(renderer, {player: stage.matches('[data-global-player]')});
    const readGeometry = renderer.readGeometry.bind(renderer);
    renderer.readGeometry = () => {
      readGeometry();
      const offsetY = renderer.height - renderer.stageRect.height * renderer.dpr;
      renderer.geometry = orderGlassSurfaces(renderer.geometry.filter(g => ownerFor(g.el) === stage && g.opacity > .001 && g.w > .5 && g.h > .5).map(g => {
        const clip = clipToViewport(g.el, stage);
        return {...g, y:g.y+offsetY, kind:['panel','button','chip'].includes(g.kind)?'optical-lens':g.kind,
          clip:{...clip,top:clip.top+offsetY,bottom:clip.bottom+offsetY}};
      }));
    };
    renderer.settings.brightness = 1;
    renderer.onState = () => {
      if (stage === world) document.body.toggleAttribute('data-lens-ready', stage.classList.contains('webgl-ready'));
    };
    if (cssOnly) {renderer.destroy(); system.jelly.renderer = null; stage.classList.add('fallback'); stage.classList.remove('webgl-ready');}
  }
  return system;
}

function mark(element) {
  if (marked.has(element)) return;
  const originalStyle = getComputedStyle(element);
  const originalColor = originalStyle.backgroundColor, originalImage = originalStyle.backgroundImage;
  const color = originalStyle.color.match(/[\d.]+/g)?.map(Number) || [];
  const background = originalColor.match(/[\d.]+/g)?.map(Number) || [];
  if (!element.matches('.assistant-think,.assistant-tool-toggle') && color.length >= 3 && Math.min(...color.slice(0, 3)) > 190 && ((background.length >= 3 && Math.max(...background.slice(0, 3)) < 130 && (background[3] ?? 1) > .15) || originalImage !== 'none')) {
    element.style.setProperty('--lens-original-tint', originalImage === 'none' ? originalColor : `${originalImage}, ${originalColor}`);
    element.dataset.lensTint = '';
  }
  marked.add(element); element.dataset.lensOptic = '';
  const progress = element.matches('.global-player__progress-wrap');
  element.dataset.glass = progress ? 'optical-progress' : element.matches('.site-nav') ? 'dock' : element.matches('.pill') ? 'chip' : element.matches('.assistant-menu-popover') ? 'menu' : element.matches('.input,.textarea') ? 'search' : element.matches(interactive) ? 'button' : 'panel';
  if (element.matches(interactive)) {
    element.dataset.lensMotion = ''; element.dataset.lgDrag = 'press';
  }
  if (progress) updateProgress();
  if (element.matches('.assistant-bubble')) setOpticalState(element, {selected: .2, color: [.32, .73, .51]}, {animate: !noMotion, pulse: !noMotion});
  if (element.matches('[aria-pressed],[aria-selected],.assistant-menu-option,.assistant-conv-main')) updateSelection(element, false);
}

function updateSelection(element, animate = true) {
  const selected = element.getAttribute('aria-pressed') === 'true' || element.getAttribute('aria-selected') === 'true' || element.dataset.active === 'true';
  opticalSelection(element, selected, 'green', animate && !noMotion);
}

function prepareOverlay(root) {
  root.dataset.lensOverlay = '';
  let skin = root.querySelector(':scope > [data-lens-skin]');
  if (!skin) {
    skin = document.createElement('span'); skin.dataset.lensSkin = ''; skin.dataset.glass = 'panel'; skin.setAttribute('aria-hidden', 'true'); root.prepend(skin);
  }
  return root;
}

function scan() {
  frame = 0;
  if (destroyed || baseline || document.body.dataset.theme !== 'liquid-glass') return;
  document.body.setAttribute('data-lens-active', '');
  for (const [stage, system] of systems) if (stage !== world && !stage.isConnected) {system.destroy(); systems.delete(stage);}
  document.querySelectorAll('[data-global-player],[data-site-assistant],.modal-card').forEach(prepareOverlay);
  document.querySelectorAll(selector).forEach(mark);
  for (const element of [...marked]) if (!element.isConnected) {
    for (const system of systems.values()) system.jelly.bodies.delete(element);
    clearOpticalState(element); marked.delete(element);
  }
  for (const root of document.querySelectorAll('[data-lens-overlay]')) {
    const system = createSystem(root);
    root.querySelectorAll('[data-lens-optic]').forEach(element => {if (ownerFor(element) === root) system.mount(element);});
    system.renderer?.invalidate(750);
  }
  const system = createSystem(world);
  for (const element of marked) if (ownerFor(element) === world) system.mount(element);
  setupNav(); setupThemeThumb(); setupVolume(); updateProgress();
  system.renderer?.invalidate(1000);
}

function scheduleScan() {if (!frame && !destroyed) frame = requestAnimationFrame(scan);}

function setupNav() {
  const current = document.querySelector('.site-nav');
  if (!current) return;
  if (nav !== current || !indicator?.isConnected) {
    nav = current; navBody = null;
    indicator = document.createElement('span'); indicator.className = 'lens-nav-indicator'; indicator.dataset.glass = 'selected'; indicator.dataset.lensMotion = ''; indicator.setAttribute('aria-hidden', 'true'); nav.prepend(indicator);
  }
  const system = systems.get(world), selected = nav.querySelector('[aria-current="page"]') || mainLinks()[0];
  if (!system || !selected) return;
  if (!navBody || !system.jelly.bodies.has(indicator)) {
    navBody = system.jelly.register(indicator, {source: nav, mode: 'segment', segments: mainLinks, onCommit: link => {
      system.jelly.target(indicator, link.offsetLeft, 0);
      // Use the router directly: Lens correctly suppresses the trailing drag click.
      const page = link.getAttribute('href')?.match(/^#\/([^?]+)/)?.[1];
      if (page) window.__ClaudeOneRouter.go(page);
      const timer = setTimeout(() => {if (!destroyed && selected.isConnected) system.jelly.target(indicator, selected.offsetLeft, 0);}, 1000);
      timers.add(timer);
    }});
    indicator.dataset.lensMotion = '';
  }
  const style = getComputedStyle(selected);
  indicator.style.top = `${selected.offsetTop}px`; indicator.style.left = '0';
  indicator.style.width = `${selected.offsetWidth}px`; indicator.style.height = `${selected.offsetHeight}px`; indicator.style.borderRadius = style.borderRadius;
  system.jelly.target(indicator, selected.offsetLeft, 0, {snap: !navBody.held && !navBody.x.moving});
}

function setupThemeThumb() {
  const label = document.querySelector('.theme-toggle'), input = label?.querySelector('input'), thumb = label?.querySelector('.theme-toggle__thumb'), track = label?.querySelector('.theme-toggle__track');
  const system = systems.get(world); if (!input || !thumb || !system) return;
  thumb.dataset.glass = 'thumb'; thumb.dataset.lensMotion = '';
  if (!system.jelly.bodies.has(thumb)) system.jelly.register(thumb, {source: track, mode: 'toggle', onCommit: value => {
    if (input.checked !== value) {input.checked = value; input.dispatchEvent(new Event('change', {bubbles: true}));}
  }});
  system.jelly.target(thumb, input.checked ? system.jelly.toggleTravel(track) : 0, 0, {snap: !document.body.hasAttribute('data-lens-ready')});
}

function setupVolume() {
  const input = document.querySelector('[data-gp-volume]'), group = input?.parentElement, system = systems.get(group?.closest('[data-lens-overlay]'));
  if (!input || !group || !system) return;
  if (!volumeThumb?.isConnected) {
    volumeThumb = document.createElement('span'); volumeThumb.dataset.lensVolumeThumb = ''; volumeThumb.dataset.glass = 'slider-thumb'; volumeThumb.setAttribute('aria-hidden', 'true'); group.append(volumeThumb);
  }
  if (!system.jelly.bodies.has(volumeThumb)) volumeBody = system.jelly.register(volumeThumb, {source: input, mode: 'range'});
  const rect = input.getBoundingClientRect(), parent = group.getBoundingClientRect(), size = 14;
  volumeThumb.style.width = size + 'px'; volumeThumb.style.height = size + 'px'; volumeThumb.style.left = rect.left - parent.left + 'px'; volumeThumb.style.top = rect.top - parent.top + (rect.height - size) / 2 + 'px';
  volumeThumb.style.visibility = rect.width ? 'visible' : 'hidden';
  const target = Math.max(0, rect.width - size) * Number(input.value) / 100;
  if (volumeBody && (Math.abs(volumeBody.x.target-target)>.01 || (!volumeBody.held && Math.abs(volumeBody.x.value-target)>.01))) system.jelly.target(volumeThumb, target, 0, {snap: !volumeBody.held});
}

function updateProgress() {
  const audio = document.querySelector('[data-gp-audio]'), track = document.querySelector('[data-gp-progress-wrap]');
  if (!audio || !track || baseline) return;
  const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
  const fill = duration ? Math.max(0, Math.min(1, audio.currentTime / duration)) : 0;
  const playing = !audio.paused && !audio.ended;
  const visible = !track.closest('[data-global-player]')?.hasAttribute('data-minimized');
  setOpticalState(track, {kind: 1, fill, complete: audio.ended ? 1 : 0, color: [.32, .73, .51], wave: visible && playing && !noMotion, forceMotion: false}, {animate: visible && !noMotion, pulse: visible && audio.ended});
  const playButton = document.querySelector('[data-gp-play]');
  if (playButton && lastPlaying !== playing) {opticalSelection(playButton, playing, 'green', !noMotion); lastPlaying = playing;}
}

const timers = new Set();
function start() {
  if (baseline || destroyed || world) return;
  world = document.createElement('div'); world.className = 'lens-world'; world.setAttribute('aria-hidden', 'true');
  // A real viewport-sized host keeps the existing document flow completely intact.
  // Its query facade gives Lens the original page geometry, excluding foreground hosts.
  world.querySelectorAll = selector => [...document.body.querySelectorAll(selector)].filter(el => !world.contains(el) && !overlayFor(el));
  document.body.prepend(world);
  scan();
  const player = document.querySelector('[data-global-player]');
  playerMotion = createPlayerMotion(player, {noMotion, reduce, onFrame: state => {
    const renderer = systems.get(player)?.renderer;
    if (state?.first || !state?.active) setupVolume();
    if (renderer && !cssOnly) {
      if (state?.active) renderer.drawNow();
      else renderer.invalidate();
    }
  }});
  observer = new MutationObserver(records => {
    if (document.body.dataset.theme !== 'liquid-glass') {stopSystems(); return;}
    for (const record of records) if (record.type === 'attributes' && record.target.matches?.('[data-lens-optic]')) updateSelection(record.target);
    scheduleScan();
  });
  observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['data-theme', 'hidden', 'data-open', 'data-minimized', 'aria-pressed', 'aria-selected', 'data-active', 'aria-expanded', 'data-playing']});
  document.addEventListener('pointermove', event => {
    const renderer = systems.get(world)?.renderer;
    const element = event.target.closest('[data-lens-optic],.theme-toggle,.site-nav');
    if (renderer && !cssOnly && element && ownerFor(element) === world) {renderer.pointer.x = event.clientX * renderer.dpr; renderer.pointer.y = (world.getBoundingClientRect().height - event.clientY) * renderer.dpr; renderer.invalidate(reduce.matches ? 0 : 220, false);}
  }, {passive: true, signal});
  document.addEventListener('pointerdown', event => {
    const element = event.target.closest('[data-lens-motion]');
    const system = systems.get(ownerFor(element || event.target));
    if (element) system?.renderer?.invalidate(700);
  }, {signal});
  document.addEventListener('lg:optics', event => systems.get(ownerFor(event.target))?.renderer?.invalidate(event.detail.duration, false), {signal});
  // A theme change destroys Lens before the browser dispatches its trailing click.
  // Keep this guard outside the theme's systems so a drag cannot toggle twice.
  document.addEventListener('lg:gesture', event => {
    if (event.detail.mode === 'toggle' && event.detail.moved && event.target.closest('.theme-toggle')) toggleClickUntil = performance.now() + 400;
  }, {signal});
  document.addEventListener('click', event => {
    if (event.detail > 0 && performance.now() < toggleClickUntil && event.target.closest('.theme-toggle')) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, {capture: true, signal});
  document.addEventListener('input', event => {if (event.target.matches('[data-gp-volume]')) setupVolume();}, {signal});
  document.addEventListener('change', event => {if (event.target.matches('[data-theme-toggle]')) scheduleScan();}, {signal});
  document.addEventListener('scroll', () => {
    systems.get(world)?.renderer?.invalidate();
  }, {capture: true, passive: true, signal});
  const audio = document.querySelector('[data-gp-audio]');
  for (const type of ['timeupdate', 'play', 'pause', 'ended', 'loadedmetadata']) audio?.addEventListener(type, updateProgress, {signal});
  window.addEventListener('resize', scheduleScan, {passive: true, signal});
  window.addEventListener('focus', () => {setupNav();}, {signal});
  reduce.addEventListener('change', () => {
    for (const system of systems.values()) {
      system.jelly.reduced = noMotion || reduce.matches;
      if (system.renderer) system.renderer.reducedMotion = noMotion || reduce.matches;
    }
    updateProgress(); scheduleScan();
  }, {signal});
  document.fonts?.ready.then(() => {if (!destroyed) scheduleScan();});
}

function stopSystems() {
  document.body.removeAttribute('data-lens-ready');
  document.body.removeAttribute('data-lens-active');
  for (const system of systems.values()) system.destroy(); systems.clear();
  navBody = null; volumeBody = null; lastPlaying = null;
}
function destroy() {
  if (destroyed) return; destroyed = true; signalController.abort(); observer?.disconnect(); cancelAnimationFrame(frame);
  playerMotion?.destroy();
  for (const timer of timers) clearTimeout(timer); timers.clear(); stopSystems();
  for (const element of marked) clearOpticalState(element); marked.clear(); world?.remove();
}

window.LensPreview = Object.freeze({
  snapshot() {return {baseline, cssOnly, theme: document.body.dataset.theme, layers: [...systems].map(([stage, system]) => ({host: stage.className, surfaces: system.renderer?.geometry.length || 0, bodies: system.jelly.bodies.size, drawing: Boolean(system.renderer?.frame), gpu: system.renderer?.canvas.dataset.gpuState, performance:system.renderer?.performanceStats}))};},
  destroy,
});
window.addEventListener('claudeone:router-ready', start, {once: true, signal});
if (document.body.dataset.routeState === 'idle' && window.__page_home && document.querySelector('[data-cube-stage]')) start();
window.addEventListener('pagehide', event => {if (!event.persisted) destroy();}, {signal});
