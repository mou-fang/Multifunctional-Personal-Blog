/* Shared small-screen policy and route-owned desktop recommendations. */
(function () {
  "use strict";
  var compactQuery = window.matchMedia("(max-width: 760px), (hover: none) and (pointer: coarse)");
  var handheldQuery = window.matchMedia("(max-width: 600px), (hover: none) and (pointer: coarse)");

  function isCompact() { return compactQuery.matches; }
  function canvasPixelRatio(value) { return isCompact() ? Math.min(value || 1, 1.5) : value || 1; }
  function support(meta) {
    return handheldQuery.matches && meta && meta.mobile ? meta.mobile : null;
  }

  function guard(main, meta, onContinue) {
    var policy = support(meta);
    if (!policy) return null;
    var controller = new AbortController();
    var disposed = false;
    var panel = document.createElement("section");
    panel.className = "mobile-desktop-note card";
    panel.innerHTML = '<span class="section-kicker">设备提示</span><h1></h1><p data-device-reason></p>' +
      '<p>建议在电脑端打开这个' + (meta.navSection === "games" ? "游戏" : "工具") + '。</p>' +
      '<div class="mobile-desktop-actions"><a class="btn btn-primary" data-nav-link></a>' +
      (policy.required ? '' : '<button class="btn" type="button" data-device-continue>仍在手机上使用</button>') + '</div>';
    panel.querySelector("h1").textContent = meta.title;
    panel.querySelector("[data-device-reason]").textContent = policy.reason;
    var link = panel.querySelector("a");
    link.href = window.SitePages.href(meta.navSection);
    link.textContent = meta.navSection === "games" ? "返回游戏中心" : "返回工具箱";
    main.setAttribute("data-mobile-blocked", "");
    main.prepend(panel);

    var dialog = document.createElement("dialog");
    dialog.className = "mobile-desktop-dialog";
    dialog.setAttribute("aria-labelledby", "mobile-desktop-title");
    dialog.setAttribute("aria-describedby", "mobile-desktop-reason");
    dialog.innerHTML = '<h2 id="mobile-desktop-title">建议在电脑端打开</h2><p id="mobile-desktop-reason"></p>' +
      '<div class="mobile-desktop-actions"><button class="btn btn-primary" type="button" data-device-close autofocus>' +
      (policy.required ? '知道了' : '暂不打开') + '</button>' +
      (policy.required ? '' : '<button class="btn" type="button" data-device-continue>继续在手机使用</button>') + '</div>';
    dialog.querySelector("p").textContent = meta.title + "：" + policy.reason + " 建议在电脑端打开这个" +
      (meta.navSection === "games" ? "游戏" : "工具") + "。";
    document.body.appendChild(dialog);

    function close() {
      if (dialog.open) dialog.close();
      if (!disposed) link.focus({ preventScroll: true });
    }
    function destroy() {
      if (disposed) return;
      disposed = true;
      controller.abort();
      close();
      dialog.remove();
      panel.remove();
      main.removeAttribute("data-mobile-blocked");
    }
    function proceed() {
      if (disposed) return;
      destroy();
      onContinue();
    }
    var options = { signal: controller.signal };
    dialog.querySelector("[data-device-close]").addEventListener("click", close, options);
    dialog.addEventListener("cancel", function (event) { event.preventDefault(); close(); }, options);
    [panel, dialog].forEach(function (root) {
      var button = root.querySelector("[data-device-continue]");
      if (button) button.addEventListener("click", proceed, options);
    });
    // The native dialog traps keyboard focus and makes the covered shell inert.
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.remove(); // The inline notice remains usable on older browsers.
    return { destroy: destroy };
  }

  window.ClaudeOneDevice = Object.freeze({ isCompact: isCompact, canvasPixelRatio: canvasPixelRatio, support: support, guard: guard });
})();
