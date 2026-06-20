/* ===== claudeOne :: doom.js =====
 * DOOM (doomgeneric + Freedoom, WebAssembly) loader & page lifecycle.
 *
 * 引擎由 doomgeneric 源码经 Emscripten 编译为 wasm，游戏数据使用
 * BSD 许可、可自由分发的 Freedoom Phase 1 (freedoom1.wad)。
 *
 * 设计要点：
 *  - 按需加载：进入 DOOM 页签才动态加载 doomgeneric.js（约 177K），
 *    其 .wasm (1.4M) 与 .data (28M, 含 WAD) 由 emscripten 自动 fetch。
 *    不影响其它页面首屏。
 *  - 不污染全局：Module 仅在本页生命周期内存活；离开页面时销毁实例、
 *    移除监听、释放 canvas。
 *  - 键盘：DOOM 需要捕获方向键/CTRL/空格等，进入页面后聚焦 canvas 并
 *    阻止这些按键的默认浏览器行为（滚动）。离开时还原。
 */

(function () {
  "use strict";

  var DOOM_LIB = "libs/doom/doomgeneric.js";
  // 引擎实际渲染的 framebuffer 分辨率。经运行时诊断确认(doomgeneric 启动日志:
  //   I_InitGraphics: framebuffer: x_res: 640, y_res: 400 ... DOOM screen size: 320 x 200
  //   Auto-scaling factor: 2)
  // DOOM 逻辑分辨率是 320×200,但引擎在 EGL/WebGL 路径下以 2x 即 640×400 创建
  // framebuffer 并整帧 blit 到 canvas 的 WebGL drawing buffer。canvas 缓冲区必须
  // 与之匹配:若小于 640×400(如默认 300×150 或被锁成 320×200),整帧会被裁切,
  // 只剩左上一小块,再被 CSS 拉满容器,观感就是“画面被局部放大”或黑屏。
  var RES_X = 640; // 引擎 framebuffer x_res(2x 缩放后)
  var RES_Y = 400; // 引擎 framebuffer y_res(2x 缩放后)

  var state = {
    module: null,        // emscripten Module 实例
    canvas: null,
    wrap: null,
    statusEl: null,
    barEl: null,
    started: false,
    loadingScript: false,
    listeners: [],      // [{target, type, fn, opts}]
  };

  /* ---- 加载 doomgeneric.js（仅一次） ---- */
  function loadEngineScript() {
    if (window.createDoomModule) return Promise.resolve();
    if (state.loadingScript) {
      // 已在加载中，轮询等待
      return new Promise(function (resolve) {
        var t = setInterval(function () {
          if (window.createDoomModule) { clearInterval(t); resolve(); }
        }, 80);
      });
    }
    state.loadingScript = true;
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = DOOM_LIB;
      s.onload = function () { resolve(); };
      s.onerror = function () {
        reject(new Error("DOOM 引擎脚本加载失败"));
      };
      document.body.appendChild(s);
    });
  }

  /* ---- 监听器登记与统一清理 ---- */
  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    state.listeners.push({ target: target, type: type, fn: fn, opts: opts });
  }
  function clearListeners() {
    state.listeners.forEach(function (l) {
      try { l.target.removeEventListener(l.type, l.fn, l.opts); } catch (e) {}
    });
    state.listeners = [];
  }

  /* ---- 启动 DOOM ---- */
  function startDoom() {
    if (state.started) return;
    showLoading();
    setStatus("正在加载游戏资源（约 30MB，首次需数秒）…", 5);

    // 如果之前进入过 DOOM 页面、已有 Module 实例,只是被 pauseMainLoop 暂停了,
    // 那就 resume 而不是再 instantiate 一个(emscripten Module 不能 instantiate 两次)
    if (window.Module && window.Module.SDL2 && typeof window.Module.resumeMainLoop === "function") {
      try {
        var canvas = state.canvas;
        // router 重进页面会 clone 模板,生成全新 canvas(缓冲区默认 300×150)。
        // 必须把缓冲区锁回引擎 framebuffer 640×400 并重新挂上尺寸守卫,
        // 否则 resume 后 blit 又裁切,出现黑屏/局部放大。
        function lockCanvasResume() {
          if (canvas.width !== RES_X) canvas.width = RES_X;
          if (canvas.height !== RES_Y) canvas.height = RES_Y;
        }
        lockCanvasResume();
        state.sizeObs = new MutationObserver(lockCanvasResume);
        state.sizeObs.observe(canvas, { attributes: true, attributeFilter: ["width", "height"] });

        // 重新绑定 canvas 给 SDL2
        window.Module.canvas = canvas;
        window.Module.SDL2.ctxCanvas = null;
        window.Module.SDL2.ctx = null;
        window.Module.resumeMainLoop();
        state.module = window.Module;
        state.started = true;
        hideLoading();
        canvas.focus();
        return;
      } catch (e) {
        console.warn("[DOOM] resume 失败,走完整重启流程:", e);
      }
    }

    loadEngineScript().then(function () {
      setStatus("正在初始化引擎…", 20);
      var canvas = state.canvas;

      // emscripten/SDL2 在 EGL/WebGL 路径下不会主动把 canvas 缓冲区设成引擎
      // framebuffer 尺寸(实测启动后 canvas 仍是默认 300×150),而引擎每帧把
      // 640×400 的 framebuffer 整帧 blit 进来。若不锁尺寸,blit 会被裁切、画面
      // 黑屏或局部放大。用 MutationObserver 把缓冲区锁回引擎 framebuffer 640×400。
      // (640×400 = 8:5,与 CSS 容器比例一致,等比拉伸不变形。)
      function lockCanvas() {
        if (canvas.width !== RES_X) canvas.width = RES_X;
        if (canvas.height !== RES_Y) canvas.height = RES_Y;
      }
      lockCanvas();
      state.sizeObs = new MutationObserver(lockCanvas);
      state.sizeObs.observe(canvas, {
        attributes: true,
        attributeFilter: ["width", "height"],
      });

      // 让 emscripten SDL2 画到我们提供的 canvas
      var Module = {
        canvas: canvas,
        // 关闭 dpr 缩放,严格按 CSS 像素
        forcedAspectRatio: -1,
        // locateFile：wasm/data 与脚本同目录，默认即可，显式指明更稳妥
        locateFile: function (path) {
          return "libs/doom/" + path;
        },
        print: function (text) {
          if (window.console) console.log("[DOOM]", text);
        },
        printErr: function (text) {
          if (window.console) console.warn("[DOOM]", text);
        },
        preRun: [],
        onRuntimeInitialized: function () {
          setStatus("引擎就绪，启动中…", 90);
        },
        // 监听 emscripten 的资源加载进度
        setStatus: function (text) {
          // emscripten 自身的 status 回调
        },
      };

      // 暴露到全局,供 unmount 时调用 pauseMainLoop
      window.Module = Module;

      // emscripten 监听整体下载进度（wasm + data）
      if (typeof ProgressTracker !== "undefined") { /* placeholder */ }

      try {
        window.createDoomModule(Module).then(function (mod) {
          state.module = mod;
          state.started = true;
          hideLoading();
          canvas.focus();
          // callMain 启动 DOOM（doomgeneric main 内部已设 emscripten 主循环）
          try { mod.callMain([]); } catch (e) {
            console.warn("[DOOM] callMain:", e);
          }
        }).catch(function (e) {
          setStatus("DOOM 启动失败：" + (e && e.message ? e.message : e), 0, true);
          console.error(e);
        });
      } catch (e) {
        setStatus("DOOM 启动失败：" + (e && e.message ? e.message : e), 0, true);
        console.error(e);
      }
    }).catch(function (e) {
      setStatus("引擎脚本加载失败，请检查网络后刷新页面", 0, true);
      console.error(e);
    });

    // 进度条动画（资源真实进度由 emscripten 提供，这里做平滑过渡提示）
    var p = 20;
    var timer = setInterval(function () {
      if (!state.started) {
        p = Math.min(p + Math.random() * 7, 85);
        setBar(Math.floor(p));
      } else {
        clearInterval(timer);
      }
    }, 250);
  }

  /* ---- UI 辅助 ---- */
  function setStatus(text, pct, isError) {
    if (state.statusEl) state.statusEl.textContent = text;
    if (typeof pct === "number") setBar(pct);
    if (isError && state.statusEl) state.statusEl.style.color = "var(--err, #e5484d)";
  }
  function setBar(pct) {
    if (state.barEl) state.barEl.style.width = Math.max(0, Math.min(100, pct)) + "%";
  }
  function showLoading() {
    if (state.loadingEl) state.loadingEl.setAttribute("data-active", "");
  }
  function hideLoading() {
    if (state.loadingEl) state.loadingEl.removeAttribute("data-active");
  }

  /* ---- 键盘：阻止 DOOM 占用键的浏览器默认行为 ---- */
  var DOOM_KEYS = [
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    " ", "Control", "Shift", "Alt",
  ];
  function onKeydown(e) {
    if (DOOM_KEYS.indexOf(e.key) !== -1) {
      e.preventDefault();
    }
  }

  /* ---- 生命周期 ---- */
  function mount(el) {
    state.canvas = el.querySelector("[data-doom-canvas]");
    state.wrap = el.querySelector("[data-doom-stage]");
    state.statusEl = el.querySelector("[data-doom-status]");
    state.barEl = el.querySelector("[data-doom-bar]");
    state.loadingEl = el.querySelector("[data-doom-loading]");
    state.started = false;
    state.module = null;

    if (!state.canvas) {
      console.warn("[DOOM] 找不到 canvas 元素");
      return;
    }

    // canvas 内部像素 buffer：固定为引擎 framebuffer 640×400(2x 缩放后的实际渲染分辨率)。
    // CSS 把这个 buffer 等比拉伸到容器(640×400 = 8:5)。pixelated 渲染保留像素艺术风格。
    state.canvas.width = RES_X;
    state.canvas.height = RES_Y;

    on(state.canvas, "keydown", onKeydown);
    on(state.canvas, "mousedown", function () { state.canvas.focus(); });

    // 启动按钮（用户点击后才加载，符合浏览器自动播放策略 & 节省流量）
    var startBtn = el.querySelector("[data-doom-start]");
    if (startBtn) {
      on(startBtn, "click", function () {
        startBtn.style.display = "none";
        var overlay = el.querySelector("[data-doom-overlay]");
        if (overlay) overlay.style.display = "none";
        startDoom();
      });
    }
  }

  function unmount() {
    clearListeners();
    // 断开尺寸守卫
    if (state.sizeObs) {
      try { state.sizeObs.disconnect(); } catch (e) {}
      state.sizeObs = null;
    }
    // 暂停 emscripten 主循环：DOOM 用 emscripten_set_main_loop 注册回调，
    // pauseMainLoop 是 emscripten 提供的官方暂停 API，离开页面时调它就
    // 能停止 DG_DrawFrame 不再被调度。
    if (state.module || window.Module) {
      var mod = state.module || window.Module;
      try {
        if (typeof mod.pauseMainLoop === "function") {
          mod.pauseMainLoop();
        }
      } catch (e) { /* 忽略 */ }
    }
    // 断开 canvas 与 SDL2 的关联(ctxCanvas 是 SDL2 缓存的 canvas 引用)
    if (window.Module && window.Module.SDL2) {
      try { window.Module.SDL2.ctxCanvas = null; } catch (e) {}
      try { window.Module.SDL2.ctx = null; } catch (e) {}
    }
    state.module = null;
    state.started = false;
    state.loadingScript = false;
    state.canvas = null;
    state.wrap = null;
    state.statusEl = null;
    state.barEl = null;
    state.loadingEl = null;
  }

  window.__page_doom = { mount: mount, unmount: unmount };
})();
