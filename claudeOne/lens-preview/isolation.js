/* Keep this page's state separate while retaining the existing shell and UI. */
(function () {
  'use strict';
  const config = window.CLAUDE_ONE_CONFIG;
  const scoped = value => typeof value === 'string' && value.startsWith('claudeOne:') ? value.replace('claudeOne:', 'claudeOne:lens-preview:') : value;
  const deepseek = Object.fromEntries(Object.entries(config.deepseek).map(([key, value]) => [key, scoped(value)]));
  window.CLAUDE_ONE_CONFIG = Object.freeze({...config,
    theme: Object.freeze({...config.theme, default: 'liquid-glass', storageKey: scoped(config.theme.storageKey)}),
    deepseek: Object.freeze(deepseek),
  });
  // A single homepage is mounted here; other navigation opens the real site.
  const originalHome = window.__CLAUDEONE_PAGES.home;
  window.__CLAUDEONE_PAGES = Object.freeze({home: {...originalHome,
    css: originalHome.css.map(url => '../' + url), js: originalHome.js.map(url => '../' + url),
  }});
  if (location.hash !== '#/home') history.replaceState(null, '', location.pathname + location.search + '#/home');
  const openPage = page => window.open(new URL(`../index.html#/${page}`, location.href).href, '_blank', 'noopener');
  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-nav-link]');
    const page = link?.getAttribute('href')?.match(/^#\/([^?]+)/)?.[1];
    if (page && page !== 'home') {event.preventDefault(); event.stopImmediatePropagation(); openPage(page);}
  }, {capture: true});
  window.addEventListener('claudeone:router-ready', () => {
    const router = window.__ClaudeOneRouter;
    if (router && !router.__lensIsolated) {
      const go = router.go; router.go = function (page, options) {return page === 'home' ? go(page, options) : openPage(page);};
      router.__lensIsolated = true;
    }
  });
})();
