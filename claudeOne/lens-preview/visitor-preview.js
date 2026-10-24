/* Read the same counters without recording preview interactions as site visits. */
(function () {
  'use strict';
  const abort = new AbortController();
  let verified = false;
  async function read() {
    try {
      const response = await fetch('/api/visitors', {cache: 'no-store', signal: abort.signal});
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      for (const [field, key] of [['total', 'totalVisitors'], ['online', 'onlineVisitors']]) {
        document.querySelectorAll(`[data-visitor-${field}]`).forEach(el => {el.textContent = Number.isFinite(data[key]) ? new Intl.NumberFormat('zh-CN').format(data[key]) : '—';});
      }
      document.querySelectorAll('[data-visitor-status]').forEach(el => {el.textContent = verified ? '真人访问已验证' : '等待真人互动后计入';});
    } catch {
      document.querySelectorAll('[data-visitor-status]').forEach(el => {el.textContent = '统计服务暂不可用';});
    }
  }
  window.addEventListener('claudeone:router-ready', read, {signal: abort.signal});
  for (const type of ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll']) window.addEventListener(type, event => {
    if (!verified && event.isTrusted && document.visibilityState === 'visible' && navigator.webdriver !== true) {
      verified = true;
      document.querySelectorAll('[data-visitor-status]').forEach(el => {el.textContent = '真人访问已验证';});
    }
  }, {capture: true, passive: true, signal: abort.signal});
  window.addEventListener('pagehide', event => {if (!event.persisted) abort.abort();});
})();
