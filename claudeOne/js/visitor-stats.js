/* ===== claudeOne :: visitor-stats.js =====
 * Anonymous human visitor counter and live presence heartbeat.
 * A visit is only submitted after a trusted user interaction; automated
 * browsers and hidden pages never emit a counting heartbeat.
 */

(function bootstrapVisitorStats() {
  "use strict";

  var STORAGE_KEY = "claudeOne:anonymousVisitorId";
  var HEARTBEAT_MS = 25000;
  var INTERACTION_EVENTS = ["pointermove", "pointerdown", "touchstart", "keydown", "wheel", "scroll"];
  var latest = { totalVisitors: null, onlineVisitors: null };
  var verified = false;
  var heartbeatTimer = null;
  var requestInFlight = false;

  function formatCount(value) {
    return Number.isFinite(value) ? new Intl.NumberFormat("zh-CN").format(value) : "—";
  }

  function render(statusText) {
    document.querySelectorAll("[data-visitor-total]").forEach(function (el) {
      var text = formatCount(latest.totalVisitors);
      if (el.textContent !== text) el.textContent = text;
    });
    document.querySelectorAll("[data-visitor-online]").forEach(function (el) {
      var text = formatCount(latest.onlineVisitors);
      if (el.textContent !== text) el.textContent = text;
    });
    if (statusText) {
      document.querySelectorAll("[data-visitor-status]").forEach(function (el) {
        if (el.textContent !== statusText) el.textContent = statusText;
      });
    }
  }

  function updateFromResponse(data, statusText) {
    if (data && Number.isFinite(Number(data.totalVisitors))) {
      latest.totalVisitors = Number(data.totalVisitors);
    }
    if (data && Number.isFinite(Number(data.onlineVisitors))) {
      latest.onlineVisitors = Number(data.onlineVisitors);
    }
    render(statusText);
  }

  function createVisitorId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    var hex = Array.from(bytes, function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" +
      hex.slice(16, 20) + "-" + hex.slice(20);
  }

  function getVisitorId() {
    var storage = window.ClaudeOne && window.ClaudeOne.storage;
    var saved = storage ? storage.get(STORAGE_KEY) : null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved || "")) {
      return saved;
    }
    var id = createVisitorId();
    if (storage) storage.set(STORAGE_KEY, id);
    return id;
  }

  function humanSignals() {
    return {
      interaction: true,
      visibility: document.visibilityState,
      webdriver: navigator.webdriver === true,
      languages: Array.isArray(navigator.languages) ? navigator.languages.length : (navigator.language ? 1 : 0),
      screen: {
        width: window.screen ? window.screen.width : 0,
        height: window.screen ? window.screen.height : 0,
      },
    };
  }

  async function fetchSnapshot() {
    try {
      var response = await fetch("/api/visitors", {
        method: "GET",
        headers: { "Accept": "application/json" },
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("visitor stats unavailable");
      updateFromResponse(await response.json(), verified ? "真人访问已验证" : "等待真人互动后计入");
    } catch (_error) {
      render("统计服务暂不可用");
    }
  }

  async function sendHeartbeat() {
    if (!verified || requestInFlight || document.visibilityState !== "visible") return;
    requestInFlight = true;
    try {
      var response = await fetch("/api/visitors/heartbeat", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({
          visitorId: getVisitorId(),
          signals: humanSignals(),
        }),
      });
      if (!response.ok) throw new Error("heartbeat rejected");
      var data = await response.json();
      updateFromResponse(data, data.counted ? "真人访问已验证" : "本次访问未计入");
    } catch (_error) {
      render("统计服务暂不可用");
    } finally {
      requestInFlight = false;
    }
  }

  function startHeartbeat() {
    if (heartbeatTimer) return;
    sendHeartbeat();
    heartbeatTimer = window.setInterval(sendHeartbeat, HEARTBEAT_MS);
  }

  function removeInteractionListeners() {
    INTERACTION_EVENTS.forEach(function (eventName) {
      window.removeEventListener(eventName, verifyHumanInteraction, true);
    });
  }

  function verifyHumanInteraction(event) {
    if (!event.isTrusted || document.visibilityState !== "visible" || navigator.webdriver === true) return;
    verified = true;
    removeInteractionListeners();
    startHeartbeat();
  }

  function setup() {
    fetchSnapshot();
    if (navigator.webdriver !== true) {
      INTERACTION_EVENTS.forEach(function (eventName) {
        window.addEventListener(eventName, verifyHumanInteraction, { capture: true, passive: true });
      });
    }
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        if (verified) sendHeartbeat();
        else fetchSnapshot();
      }
    });
    window.addEventListener("claudeone:router-ready", function () {
      render(verified ? "真人访问已验证" : "等待真人互动后计入");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }
})();
