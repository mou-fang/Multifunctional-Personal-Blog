/* This page owns its own preview state; it never writes the site's theme setting. */
(() => {
  'use strict';
  const body = document.body;
  const palettes = { violet: '蓝里微紫', cyan: '蓝里雾青', aurora: '紫青柔光' };
  const radios = [...document.querySelectorAll('input[name="palette"]')];
  const intensity = document.querySelector('#intensity');
  const output = document.querySelector('#intensity-value');
  const compare = document.querySelector('#compare');
  const backgroundOnly = document.querySelector('#background-only');
  const motion = document.querySelector('#motion');
  const motionHint = document.querySelector('#motion-hint');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const status = document.querySelector('#lab-status');
  let comparing = false;
  let onlyBackground = false;
  // A manual choice takes precedence over the system default for this preview.
  let motionChoice = null;
  let washRenderer = null;
  let washState = null;

  function render() {
    const amount = Math.max(0, Math.min(100, Number(intensity.value)));
    const palette = radios.find(radio => radio.checked).value;
    const moving = motionChoice ?? !reducedMotion.matches;
    body.dataset.palette = palette;
    body.dataset.comparing = String(comparing);
    body.dataset.backgroundOnly = String(onlyBackground);
    body.dataset.motion = String(moving);
    body.dataset.zeroMix = String(amount === 0);
    body.dataset.pageVisible = String(!document.hidden);
    body.style.setProperty('--mix-opacity', String(amount / 100));
    output.value = `${amount}%`;
    compare.setAttribute('aria-pressed', String(comparing));
    backgroundOnly.setAttribute('aria-pressed', String(onlyBackground));
    motion.checked = moving;
    motionHint.textContent = moving
      ? '像云一样，缓慢游移'
      : motionChoice === null && reducedMotion.matches ? '已跟随系统减少动态' : '定格当前的色彩';
    document.querySelector('[data-compare-label]').textContent = comparing ? '返回混色' : '对比原版';
    document.querySelector('[data-background-label]').textContent = onlyBackground ? '显示界面' : '只看背景';
    status.textContent = comparing || amount === 0
      ? '正在看原版 · #E6EFFF'
      : `${palettes[palette]} · ${amount}% · ${moving ? '缓慢流动' : '静止混色'}`;
    washState = { palette, strength: amount / 100, moving, visible: !document.hidden, comparing };
    washRenderer?.update(washState);
  }

  radios.forEach(radio => radio.addEventListener('change', () => { comparing = false; render(); }));
  intensity.addEventListener('input', () => { comparing = false; render(); });
  compare.addEventListener('click', () => { comparing = !comparing; render(); });
  backgroundOnly.addEventListener('click', () => { onlyBackground = !onlyBackground; render(); });
  motion.addEventListener('change', () => { motionChoice = motion.checked; render(); });
  reducedMotion.addEventListener('change', render);
  document.addEventListener('visibilitychange', () => {
    body.dataset.pageVisible = String(!document.hidden);
    if (washState) {
      washState.visible = !document.hidden;
      washRenderer?.update(washState);
    }
  });
  document.querySelector('#reset').addEventListener('click', () => {
    radios.forEach(radio => { radio.checked = radio.value === 'violet'; });
    intensity.value = '45';
    comparing = false;
    onlyBackground = false;
    motionChoice = null;
    render();
  });
  try {
    washRenderer = window.createSoftUIWash?.(document.querySelector('#wash-canvas'), ready => {
      body.dataset.washRenderer = ready ? 'webgl' : 'css';
    }) ?? null;
  } catch {
    body.dataset.washRenderer = 'css';
  }
  render();
})();
