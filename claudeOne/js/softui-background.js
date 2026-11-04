/* Site-wide Soft UI background. Owns one renderer outside the route lifecycle;
   theme/page visibility changes pause it without resetting the drift. */
(() => {
  'use strict';
  const root = document.querySelector('[data-softui-background]');
  const canvas = root?.querySelector('[data-softui-canvas]');
  if (!canvas || root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';
  root.dataset.palette = 'aurora';
  root.dataset.strength = '45';
  document.body.setAttribute('data-softui-background-ready', '');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const compact = window.matchMedia('(max-width: 760px), (hover: none) and (pointer: coarse)');
  let renderer = null;
  let attempted = false;
  let suspended = false;

  function sync() {
    const enabled = document.body.dataset.theme === 'neumorphism';
    const visible = enabled && !document.hidden && !suspended;
    const moving = !reducedMotion.matches && !compact.matches;
    root.dataset.flowing = String(visible && moving);

    // A native-DPR full-screen shader competes with touch scrolling on phones.
    // Reuse the same aurora palette as a static CSS wash without a GPU context.
    if (compact.matches) {
      renderer?.destroy();
      renderer = null;
      attempted = false;
      if (canvas.width !== 1) canvas.width = 1;
      if (canvas.height !== 1) canvas.height = 1;
      root.dataset.renderer = 'css';
      return;
    }

    // A saved Liquid Glass theme never allocates a hidden GPU context on load.
    if (visible && !attempted) {
      attempted = true;
      try {
        renderer = window.createSoftUIWash?.(canvas, ready => {
          root.dataset.renderer = ready ? 'webgl' : 'css';
        }) ?? null;
      } catch {
        renderer = null;
      }
      if (!renderer) root.dataset.renderer = 'css';
    }
    renderer?.update({ palette: 'aurora', strength: .45, moving, visible, comparing: false });
  }

  const themeObserver = new MutationObserver(sync);
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
  reducedMotion.addEventListener('change', sync);
  compact.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);

  window.addEventListener('pagehide', event => {
    suspended = true;
    sync();
    if (!event.persisted) {
      themeObserver.disconnect();
      reducedMotion.removeEventListener('change', sync);
      compact.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      renderer?.destroy();
      renderer = null;
    }
  });
  window.addEventListener('pageshow', () => {
    suspended = false;
    sync();
  });
  sync();
})();
