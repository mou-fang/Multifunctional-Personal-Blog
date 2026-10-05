/* Optional shell features start after the first route has painted. */
(function () {
  "use strict";
  var started = false;
  window.__CLAUDEONE_PLAYER_LOADING = true;

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = url;
      script.onload = resolve;
      script.onerror = function () { script.remove(); reject(new Error("Failed to load " + url)); };
      document.body.appendChild(script);
    });
  }

  function loadSequence(urls) {
    return urls.reduce(function (chain, url) {
      return chain.then(function () { return loadScript(url); });
    }, Promise.resolve());
  }

  function startExtras() {
    var font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&display=swap";
    document.head.appendChild(font);

    // Static-only hosting can still use the scanner's original playlist.
    loadScript("./api/music-library/playlist.js")
      .catch(function () { return loadScript("./music/playlist.js"); })
      .catch(function () { window.__MUSIC_PLAYLIST = []; })
      .then(function () { return loadScript("./js/player.js?v=20261005-startup"); })
      .catch(function (error) { console.warn("[startup]", error.message); })
      .finally(function () { window.__CLAUDEONE_PLAYER_LOADING = false; });

    loadSequence(["./js/softui-background-renderer.js", "./js/softui-background.js"])
      .catch(function (error) { console.warn("[startup]", error.message); });
    loadSequence(["./js/deepseek-client.js", "./js/assistant.js", "./js/easter-egg.js"])
      .catch(function (error) { console.warn("[startup]", error.message); });
  }

  function onReady() {
    if (started) return;
    started = true;
    window.removeEventListener("claudeone:router-ready", onReady);
    // Two frames let the route become visible before optional downloads start.
    requestAnimationFrame(function () { requestAnimationFrame(startExtras); });
  }

  window.addEventListener("claudeone:router-ready", onReady);
})();
