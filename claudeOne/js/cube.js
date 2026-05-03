/* ===== claudeOne :: cube.js =====
 * Fully playable 3x3 Rubik's cube. Each cubelet tracks:
 *   - pos:    [x, y, z] integer triple in {-1, 0, 1}^3 — current logical slot
 *   - orient: 3x3 rotation matrix (integer entries since we only do 90°)
 *
 * Convention (CSS coords): +X right, +Y down, +Z towards viewer.
 *
 * Scatter mode: when the mouse leaves the cube hero area, the 26 cubelets
 * float out across the viewport as ambient background particles, slowly
 * drifting and rotating. A central axis remains where the cube was. Moving
 * the mouse back over the cube gathers all blocks back for interaction.
 *
 * SPA lifecycle: window.__page_home
 */

(function () {
  "use strict";

  let container = null;
  let ac = null;
  let rafId = null;

  // --- Module-level state (persists across mount/unmount) ---
  let stage, hero, css, CUBELET, GAP, STEP, TURN_MS;
  let cube, axisEl, axisInner, scatterStage;
  let cubelets;
  let queue, history;
  let turning, resetting;
  let rotX, rotY, lockedView, dragging, lastX, lastY, vx, vy;
  let idleTimer, idleSpinActive;
  let parallaxX, parallaxY;
  let scattered, scatterMode, scatterData;
  let scatterAnimation, scatterTimer, scatterDriftStartedAt;
  let mouseOverHero;

  // ---------------------------------------------------------------- math util
  const identity = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

  function matMul(a, b) {
    const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        for (let k = 0; k < 3; k++) r[i][j] += a[i][k] * b[k][j];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) r[i][j] = Math.round(r[i][j]);
    return r;
  }

  function rotMat(axis, sign) {
    const c = 0;
    const s = sign;
    if (axis === "x") return [[1, 0, 0], [0, c, -s], [0, s, c]];
    if (axis === "y") return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
    if (axis === "z") return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
    return identity();
  }

  function rotateVec(M, v) {
    return [
      M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
      M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
      M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
    ];
  }

  function matrix3dCss(M, tx, ty, tz) {
    return (
      "matrix3d(" +
      [
        M[0][0], M[1][0], M[2][0], 0,
        M[0][1], M[1][1], M[2][1], 0,
        M[0][2], M[1][2], M[2][2], 0,
        tx, ty, tz, 1,
      ].join(",") +
      ")"
    );
  }

  // ---- 3D math helpers for scatter/gather coordinate conversion ----------
  function degToRad(d) { return d * Math.PI / 180; }
  function radToDeg(r) { return r * 180 / Math.PI; }

  function mat3RotX(aDeg) {
    const a = degToRad(aDeg), c = Math.cos(a), s = Math.sin(a);
    return [[1,0,0],[0,c,-s],[0,s,c]];
  }
  function mat3RotY(aDeg) {
    const a = degToRad(aDeg), c = Math.cos(a), s = Math.sin(a);
    return [[c,0,s],[0,1,0],[-s,0,c]];
  }
  function mat3RotZ(aDeg) {
    const a = degToRad(aDeg), c = Math.cos(a), s = Math.sin(a);
    return [[c,-s,0],[s,c,0],[0,0,1]];
  }

  function mat3Mul(A, B) {
    const r = [[0,0,0],[0,0,0],[0,0,0]];
    for (let i=0;i<3;i++)
      for (let j=0;j<3;j++)
        for (let k=0;k<3;k++) r[i][j] += A[i][k] * B[k][j];
    return r;
  }

  function mat3Transpose(M) {
    return [[M[0][0],M[1][0],M[2][0]],[M[0][1],M[1][1],M[2][1]],[M[0][2],M[1][2],M[2][2]]];
  }

  // Extract Euler angles from rotation matrix M = Rx(rx) * Ry(ry) * Rz(rz)
  function extractEulerXYZ(M) {
    const rx = Math.atan2(-M[1][2], M[2][2]);
    const ry = Math.asin(Math.max(-1, Math.min(1, M[0][2])));
    const rz = Math.atan2(-M[0][1], M[0][0]);
    return { rx: radToDeg(rx), ry: radToDeg(ry), rz: radToDeg(rz) };
  }

  // Convert a world-space viewport position to .cube-local coordinates
  function worldToLocal(wx, wy, wz, cx, cy, lockedRx, lockedRy) {
    const dx = wx - cx;
    const dy = wy - cy;
    const dz = wz || 0;
    const rxa = degToRad(-lockedRx), rya = degToRad(-lockedRy);
    const cosX = Math.cos(rxa), sinX = Math.sin(rxa);
    const cosY = Math.cos(rya), sinY = Math.sin(rya);
    const y1 = dy * cosX - dz * sinX;
    const z1 = dy * sinX + dz * cosX;
    const lx = dx * cosY + z1 * sinY;
    const ly = y1;
    const lz = -dx * sinY + z1 * cosY;
    return { x: lx, y: ly, z: lz };
  }

  function rotationToLocal(wRx, wRy, wRz, lockedRx, lockedRy) {
    const Rw = mat3Mul(mat3Mul(mat3RotX(wRx), mat3RotY(wRy)), mat3RotZ(wRz));
    const RcInv = mat3Mul(mat3RotY(-lockedRy), mat3RotX(-lockedRx));
    const Rl = mat3Mul(RcInv, Rw);
    return extractEulerXYZ(Rl);
  }

  const FACES = ["up", "down", "front", "back", "right", "left"];
  const SCATTER_FACE_VIEW = {
    front: { rx: -34, ry: 42, color: "#ff8593" },
    back: { rx: -34, ry: 222, color: "#ffb57a" },
    right: { rx: -30, ry: -52, color: "#7fd27f" },
    left: { rx: -30, ry: 132, color: "#7fc1ff" },
    up: { rx: -68, ry: 38, color: "#f1f5ff" },
    down: { rx: 58, ry: 40, color: "#ffe480" },
  };

  function scatterFaceView(x, y, z) {
    const faces = [];
    if (z === 1) faces.push("front");
    if (x === 1) faces.push("right");
    if (y === -1) faces.push("up");
    if (z === -1) faces.push("back");
    if (x === -1) faces.push("left");
    if (y === 1) faces.push("down");

    const seed = Math.abs(x * 17 + y * 11 + z * 5);
    return SCATTER_FACE_VIEW[faces[seed % faces.length]];
  }

  const TURNS = {
    U: { axis: "y", layer: -1, sign: 1 },
    "U'": { axis: "y", layer: -1, sign: -1 },
    D: { axis: "y", layer: 1, sign: -1 },
    "D'": { axis: "y", layer: 1, sign: 1 },
    L: { axis: "x", layer: -1, sign: -1 },
    "L'": { axis: "x", layer: -1, sign: 1 },
    R: { axis: "x", layer: 1, sign: 1 },
    "R'": { axis: "x", layer: 1, sign: -1 },
    F: { axis: "z", layer: 1, sign: 1 },
    "F'": { axis: "z", layer: 1, sign: -1 },
    B: { axis: "z", layer: -1, sign: -1 },
    "B'": { axis: "z", layer: -1, sign: 1 },
  };
  const TURN_NAMES = Object.keys(TURNS);
  const AXIS_IDX = { x: 0, y: 1, z: 2 };

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  // ---------------------------------------------------------------- build helpers
  function addSticker(root, parent, face) {
    root.classList.add("cubelet--" + face);
    const sticker = document.createElement("div");
    sticker.className = "sticker sticker--" + face;
    const inner = document.createElement("div");
    inner.className = "inner";
    sticker.appendChild(inner);
    parent.appendChild(sticker);
  }

  function addFiller(parent, face) {
    const fill = document.createElement("div");
    fill.className = "sticker-face sticker-face--" + face;
    parent.appendChild(fill);
  }

  function renderCubelet(c) {
    const tx = c.pos[0] * STEP;
    const ty = c.pos[1] * STEP;
    const tz = c.pos[2] * STEP;
    c.el.style.transform = `translate3d(${tx}px,${ty}px,${tz}px)`;
    c.core.style.transform = matrix3dCss(c.orient, 0, 0, 0);
  }

  // ---------------------------------------------------------------- turns
  function inverseTurn(name) {
    return name.endsWith("'") ? name.slice(0, -1) : name + "'";
  }

  function enqueueTurn(name, fast, recordHistory) {
    if (recordHistory === undefined) recordHistory = true;
    return new Promise((resolve) => {
      queue.push({ name, fast: !!fast, recordHistory, resolve });
      runQueue();
    });
  }

  async function runQueue() {
    if (turning) return;
    while (queue.length > 0) {
      const item = queue.shift();
      turning = true;
      stage.setAttribute("data-turning", "true");
      await doTurn(item.name, item.fast ? 140 : TURN_MS);
      if (item.recordHistory) history.push(item.name);
      turning = false;
      stage.removeAttribute("data-turning");
      item.resolve && item.resolve();
    }
  }

  function doTurn(name, durationMs) {
    const t = TURNS[name];
    if (!t) return Promise.resolve();
    const idx = AXIS_IDX[t.axis];
    const slice = cubelets.filter((c) => c.pos[idx] === t.layer);
    const angle = t.sign * 90;
    const rotFn = `rotate${t.axis.toUpperCase()}(${angle}deg)`;
    const R = rotMat(t.axis, t.sign);

    if (durationMs <= 0) {
      slice.forEach((c) => {
        c.pos = rotateVec(R, c.pos);
        c.orient = matMul(R, c.orient);
        renderCubelet(c);
      });
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const sliceDiv = document.createElement("div");
      sliceDiv.className = "cube-slice";
      cube.appendChild(sliceDiv);
      slice.forEach((c) => sliceDiv.appendChild(c.el));

      sliceDiv.style.transform = "rotateY(0deg)";
      // eslint-disable-next-line no-unused-expressions
      sliceDiv.offsetWidth;
      sliceDiv.style.transition =
        "transform " + durationMs + "ms cubic-bezier(0.4, 0, 0.2, 1)";
      sliceDiv.style.transform = rotFn;

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        slice.forEach((c) => {
          c.pos = rotateVec(R, c.pos);
          c.orient = matMul(R, c.orient);
          renderCubelet(c);
          cube.appendChild(c.el);
        });
        sliceDiv.remove();
        resolve();
      };
      sliceDiv.addEventListener("transitionend", finish, { once: true });
      setTimeout(finish, durationMs + 80);
    });
  }

  // ---------------------------------------------------------------- scramble & reset
  function scramble(n) {
    if (scattered || queue.length > 0 || turning) return;
    n = n || 22;
    let last = null;
    for (let i = 0; i < n; i++) {
      let pick;
      do {
        pick = TURN_NAMES[Math.floor(Math.random() * TURN_NAMES.length)];
      } while (last && pick.charAt(0) === last.charAt(0));
      enqueueTurn(pick, true);
      last = pick;
    }
  }

  async function reset() {
    if (resetting) return;
    if (history.length === 0 && queue.length === 0 && !turning) return;

    resetting = true;
    stage.setAttribute("data-resetting", "true");

    while (queue.length > 0) {
      const dropped = queue.shift();
      dropped.resolve && dropped.resolve();
    }

    while (turning) await new Promise((r) => setTimeout(r, 16));

    if (history.length === 0) {
      resetting = false;
      stage.removeAttribute("data-resetting");
      return;
    }

    const moves = history.slice().reverse().map(inverseTurn);
    history.length = 0;
    await Promise.all(moves.map((m) => enqueueTurn(m, true, false)));

    resetting = false;
    stage.removeAttribute("data-resetting");
  }

  // ---------------------------------------------------------------- whole-cube view rotation
  function renderCube() {
    if (scatterMode === "gathering") return;
    if (lockedView && scatterMode === "scattered") {
      cube.style.transform = `rotateX(${lockedView.rx}deg) rotateY(${lockedView.ry}deg)`;
      return;
    }
    const ptx = parallaxX * 3;
    const pty = parallaxY * 3;
    cube.style.transform = `rotateX(${rotX + pty}deg) rotateY(${rotY + ptx}deg)`;
  }

  // ================================================================
  // Scatter system
  // ================================================================
  function setScatterMode(mode) {
    scatterMode = mode;
    stage.dataset.cubeMode = mode;
    hero.dataset.cubeMode = mode;
    scatterStage.dataset.cubeMode = mode;
    stage.classList.toggle(
      "cube-stage--scattered",
      mode === "scattering" || mode === "scattered"
    );
    stage.classList.toggle("cube-stage--gathering", mode === "gathering");
  }

  function syncAxis() {
    if (!axisInner || scatterMode === "cube") return;
    const rx = lockedView ? lockedView.rx : (rotX + parallaxY * 3);
    const ry = lockedView ? lockedView.ry : (rotY + parallaxX * 3);
    axisInner.style.transform =
      "rotateX(" + rx + "deg) rotateY(" + ry + "deg)";
  }

  function applyScatterPose(c, pose) {
    c._scatterPose = pose;
    if (pose.opacity == null || pose.opacity >= 0.999) {
      c.el.style.opacity = "";
    } else {
      c.el.style.opacity = String(pose.opacity);
    }
    c.el.style.transform =
      "translate3d(" + pose.x + "px," + pose.y + "px," +
      (pose.z || 0) + "px) " +
      "rotateX(" + pose.rx + "deg) " +
      "rotateY(" + pose.ry + "deg) " +
      "rotateZ(" + pose.rz + "deg) " +
      "translate3d(" + (pose.slotX || 0) + "px," +
      (pose.slotY || 0) + "px," + (pose.slotZ || 0) + "px) " +
      "scale3d(" + (pose.scale == null ? 1 : pose.scale) + "," +
      (pose.scale == null ? 1 : pose.scale) + "," +
      (pose.scale == null ? 1 : pose.scale) + ")";
    c.core.style.transform = matrix3dCss(c.orient, 0, 0, 0);
  }

  function clonePose(pose) {
    return {
      x: pose.x,
      y: pose.y,
      z: pose.z || 0,
      slotX: pose.slotX || 0,
      slotY: pose.slotY || 0,
      slotZ: pose.slotZ || 0,
      rx: pose.rx,
      ry: pose.ry,
      rz: pose.rz,
      scale: pose.scale == null ? 1 : pose.scale,
      opacity: pose.opacity == null ? 1 : pose.opacity,
    };
  }

  function lerpPose(from, to, t) {
    return {
      x: lerp(from.x, to.x, t),
      y: lerp(from.y, to.y, t),
      z: lerp(from.z || 0, to.z || 0, t),
      slotX: lerp(from.slotX || 0, to.slotX || 0, t),
      slotY: lerp(from.slotY || 0, to.slotY || 0, t),
      slotZ: lerp(from.slotZ || 0, to.slotZ || 0, t),
      rx: lerp(from.rx, to.rx, t),
      ry: lerp(from.ry, to.ry, t),
      rz: lerp(from.rz, to.rz, t),
      scale: lerp(from.scale == null ? 1 : from.scale, to.scale == null ? 1 : to.scale, t),
      opacity: lerp(from.opacity == null ? 1 : from.opacity, to.opacity == null ? 1 : to.opacity, t),
    };
  }

  function canScatter() {
    return !dragging && !turning && queue.length === 0 && !resetting;
  }

  function syncScatterPerspective() {
    const stageRect = stage.getBoundingClientRect();
    const stageCss = getComputedStyle(stage);
    const perspective = stageCss.perspective && stageCss.perspective !== "none"
      ? stageCss.perspective
      : "1200px";
    scatterStage.style.perspective = perspective;
    scatterStage.style.perspectiveOrigin =
      stageRect.left + stageRect.width * 0.5 + "px " +
      (stageRect.top + stageRect.height * 0.45) + "px";
  }

  function makeScatterData() {
    const count = cubelets.length;
    const vw = Math.max(window.innerWidth, CUBELET * 7);
    const vh = Math.max(window.innerHeight, CUBELET * 6);
    const pad = clamp(Math.min(vw, vh) * 0.065, 44, 92);
    const usableW = Math.max(vw - pad * 2, CUBELET * 4);
    const usableH = Math.max(vh - pad * 2, CUBELET * 4);
    const aspect = usableW / usableH;
    const cols = Math.ceil(Math.sqrt(count * aspect));
    const rows = Math.ceil(count / cols);
    const cellW = usableW / cols;
    const cellH = usableH / rows;
    const slots = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        slots.push({ row, col });
      }
    }

    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }

    return cubelets.map((c, i) => {
      const slot = slots[i];
      const view = c.scatterView || { color: "#ff8593" };
      const jitterX = (Math.random() - 0.5) * Math.min(cellW * 0.34, 44);
      const jitterY = (Math.random() - 0.5) * Math.min(cellH * 0.34, 44);
      const x = clamp(
        pad + slot.col * cellW + cellW / 2 - CUBELET / 2 + jitterX,
        16,
        vw - CUBELET - 16
      );
      const y = clamp(
        pad + slot.row * cellH + cellH / 2 - CUBELET / 2 + jitterY,
        16,
        vh - CUBELET - 16
      );

      return {
        x,
        y,
        z: (Math.random() - 0.5) * 90,
        rx: view.rx + (Math.random() - 0.5) * 18,
        ry: view.ry + (Math.random() - 0.5) * 24,
        rz: (Math.random() - 0.5) * 44,
        color: view.color,
        scale: 0.96 + Math.random() * 0.14,
        opacity: 1,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        driftX: 10 + Math.random() * 20,
        driftY: 8 + Math.random() * 18,
        driftZ: 10 + Math.random() * 24,
        driftSpeedX: 0.18 + Math.random() * 0.18,
        driftSpeedY: 0.16 + Math.random() * 0.16,
        driftSpeedZ: 0.12 + Math.random() * 0.14,
        wobbleX: 1.4 + Math.random() * 2.2,
        wobbleY: 1.8 + Math.random() * 2.8,
        spinZ: (Math.random() > 0.5 ? 1 : -1) * (3 + Math.random() * 5),
      };
    });
  }

  function startScatterAnimation(items, duration, easing, onDone) {
    scatterAnimation = {
      startedAt: performance.now(),
      duration,
      easing,
      items,
      onDone,
    };
  }

  function runScatterAnimation(time) {
    if (!scatterAnimation) return;
    const a = scatterAnimation;
    const raw = clamp((time - a.startedAt) / a.duration, 0, 1);
    const eased = a.easing(raw);

    a.items.forEach((item) => {
      applyScatterPose(item.c, lerpPose(item.from, item.to, eased));
    });

    if (raw >= 1) {
      scatterAnimation = null;
      a.onDone && a.onDone(time);
    }
  }

  function updateScatterDrift(time) {
    if (scatterMode !== "scattered") return;
    const t = (time - scatterDriftStartedAt) * 0.001;
    cubelets.forEach((c, i) => {
      const d = scatterData[i];
      const dx =
        (Math.sin(t * d.driftSpeedX + d.phaseX) - Math.sin(d.phaseX)) *
        d.driftX;
      const dy =
        (Math.cos(t * d.driftSpeedY + d.phaseY) - Math.cos(d.phaseY)) *
        d.driftY;
      applyScatterPose(c, {
        x: d.x + dx,
        y: d.y + dy,
        z:
          d.z +
          (Math.sin(t * d.driftSpeedZ + d.phaseX + d.phaseY) -
            Math.sin(d.phaseX + d.phaseY)) *
            d.driftZ,
        rx: d.rx + Math.sin(t * 0.34 + d.phaseY) * d.wobbleX,
        ry: d.ry + Math.cos(t * 0.3 + d.phaseX) * d.wobbleY,
        rz: d.rz + t * d.spinZ,
        scale: d.scale,
        opacity: 1,
      });
    });
  }

  function scatterCubelets() {
    if (scattered || !canScatter()) return;

    clearTimeout(scatterTimer);
    scattered = true;
    lockedView = {
      rx: rotX + parallaxY * 3,
      ry: rotY + parallaxX * 3,
    };
    setScatterMode("scattering");
    syncScatterPerspective();
    syncAxis();
    scatterData = makeScatterData();

    var rxa = degToRad(lockedView.rx), rya = degToRad(lockedView.ry);
    var cosX = Math.cos(rxa), sinX = Math.sin(rxa);
    var cosY = Math.cos(rya), sinY = Math.sin(rya);

    var items = cubelets.map(function (c, i) {
      var to = clonePose(scatterData[i]);

      var slotX = c.pos[0] * STEP;
      var slotY = c.pos[1] * STEP;
      var slotZ = c.pos[2] * STEP;

      var z1 = -slotX * sinY + slotZ * cosY;
      var z2 = slotY * sinX + z1 * cosX;

      var rect = c.el.getBoundingClientRect();

      var from = {
        x: rect.left,
        y: rect.top,
        z: z2,
        rx: lockedView.rx,
        ry: lockedView.ry,
        rz: 0,
        scale: 1,
        opacity: 1,
      };

      c.el.style.transition = "none";
      scatterStage.appendChild(c.el);
      applyScatterPose(c, from);
      return { c: c, from: from, to: to };
    });

    startScatterAnimation(items, 960, easeOut, function (time) {
      if (!scattered || scatterMode !== "scattering") return;
      setScatterMode("scattered");
      scatterDriftStartedAt = time;
      updateScatterDrift(time);
    });
  }

  function gatherCubelets() {
    if (!scattered || scatterMode === "gathering") return;

    clearTimeout(scatterTimer);

    if (!lockedView) {
      lockedView = {
        rx: rotX + parallaxY * 3,
        ry: rotY + parallaxX * 3,
      };
    }
    const view = lockedView;
    setScatterMode("gathering");
    syncAxis();

    const cubeRect = cube.getBoundingClientRect();
    const cx = cubeRect.left + cubeRect.width / 2;
    const cy = cubeRect.top + cubeRect.height / 2;

    cube.style.transition = "none";
    cube.style.opacity = "1";
    cube.style.transform = "rotateX(" + view.rx + "deg) rotateY(" + view.ry + "deg)";

    const items = cubelets.map(function (c) {
      var sp = c._scatterPose;
      var rect = c.el.getBoundingClientRect();
      var worldX = rect.left + rect.width / 2;
      var worldY = rect.top + rect.height / 2;
      var worldZ = sp ? (sp.z || 0) : 0;

      var localPos = worldToLocal(worldX, worldY, worldZ, cx, cy, view.rx, view.ry);
      var localRot = rotationToLocal(
        sp ? (sp.rx || 0) : 0,
        sp ? (sp.ry || 0) : 0,
        sp ? (sp.rz || 0) : 0,
        view.rx, view.ry
      );
      var sc = sp && sp.scale != null ? sp.scale : 1;

      var from = {
        x: localPos.x, y: localPos.y, z: localPos.z,
        rx: localRot.rx, ry: localRot.ry, rz: localRot.rz,
        scale: sc, opacity: 1,
      };

      var to = {
        x: c.pos[0] * STEP,
        y: c.pos[1] * STEP,
        z: c.pos[2] * STEP,
        rx: 0, ry: 0, rz: 0,
        scale: 1, opacity: 1,
      };

      c.el.style.transition = "none";
      cube.appendChild(c.el);
      applyScatterPose(c, from);

      return { c: c, from: from, to: to };
    });

    startScatterAnimation(items, 760, easeInOut, function () {
      cubelets.forEach(function (c) {
        c.el.style.transition = "none";
        c.el.style.opacity = "";
        c.el.style.transform = "";
        c._scatterPose = null;
        renderCubelet(c);
      });
      scattered = false;
      lockedView = null;
      setScatterMode("cube");
      cube.style.transition = "";
      cube.style.opacity = "";
      resetIdleTimer();
    });
  }

  function isPointerInHero(x, y) {
    const rect = hero.getBoundingClientRect();
    const pad = 22;
    return (
      x >= rect.left - pad &&
      x <= rect.right + pad &&
      y >= rect.top - pad &&
      y <= rect.bottom + pad
    );
  }

  function scheduleScatter(delay) {
    clearTimeout(scatterTimer);
    scatterTimer = setTimeout(() => {
      if (!mouseOverHero && !scattered && canScatter()) scatterCubelets();
    }, delay);
  }

  function checkMouseInHero(e) {
    const inHero = isPointerInHero(e.clientX, e.clientY);
    if (inHero) {
      mouseOverHero = true;
      clearTimeout(scatterTimer);
      gatherCubelets();
    } else {
      if (mouseOverHero) resetIdleTimer();
      mouseOverHero = false;
      if (!scattered && canScatter()) scheduleScatter(180);
    }
  }

  function resetIdleTimer() {
    idleSpinActive = false;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleSpinActive = true;
      if (!mouseOverHero && !scattered && canScatter()) scheduleScatter(0);
    }, 1800);
  }

  // ---------------------------------------------------------------- main loop
  function tick(time) {
    if (!dragging) {
      if (scatterMode === "scattered" || scatterMode === "gathering") {
        // View is frozen during scatter/gather
      } else if (Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01) {
        rotY += vx;
        rotX += vy;
        rotX = Math.max(-80, Math.min(80, rotX));
        vx *= 0.94;
        vy *= 0.94;
      } else if (idleSpinActive && !turning && queue.length === 0 && !scattered) {
        rotY += 0.18;
        rotX += Math.sin(performance.now() / 2800) * 0.02;
      }
    }
    renderCube();
    syncAxis();
    runScatterAnimation(time);
    updateScatterDrift(time);
    rafId = requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- drag
  function stagePointerDown(e) {
    if (scattered) {
      gatherCubelets();
      return;
    }
    if (
      e.target.closest(
        "[data-cube-turn],[data-cube-scramble],[data-cube-reset]"
      )
    )
      return;
    dragging = true;
    stage.setAttribute("data-dragging", "true");
    lastX = e.clientX;
    lastY = e.clientY;
    vx = 0;
    vy = 0;
    try { stage.setPointerCapture && stage.setPointerCapture(e.pointerId); } catch (ignore) {}
    resetIdleTimer();
  }

  function stagePointerMove(e) {
    if (dragging) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      rotY += dx * 0.5;
      rotX -= dy * 0.5;
      rotX = Math.max(-80, Math.min(80, rotX));
      vx = dx * 0.5;
      vy = -dy * 0.5;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  }

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    stage.removeAttribute("data-dragging");
    try { stage.releasePointerCapture && stage.releasePointerCapture(e.pointerId); } catch (ignore) {}
    resetIdleTimer();
    if (!mouseOverHero && canScatter()) scheduleScatter(260);
  }

  function handleWindowPointerMove(e) {
    if (scatterMode === "gathering") return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    parallaxX = (e.clientX - cx) / cx;
    parallaxY = (e.clientY - cy) / cy;
  }

  function handleResize() {
    if (scatterMode === "scattered") {
      const fromPoses = cubelets.map((c) => clonePose(c._scatterPose));
      scatterData = makeScatterData();
      setScatterMode("scattering");
      const items = cubelets.map((c, i) => ({
        c,
        from: fromPoses[i],
        to: clonePose(scatterData[i]),
      }));
      startScatterAnimation(items, 420, easeInOut, (time) => {
        if (!scattered) return;
        scatterDriftStartedAt = time;
        setScatterMode("scattered");
        updateScatterDrift(time);
      });
    }
  }

  // ---------------------------------------------------------------- build
  function buildCubeDOM() {
    cube = document.createElement("div");
    cube.className = "cube";
    stage.appendChild(cube);

    axisEl = document.createElement("div");
    axisEl.className = "cube-axis";
    axisEl.innerHTML =
      '<div class="cube-axis-inner">' +
      '<div class="cube-axis-line cube-axis-line--x"></div>' +
      '<div class="cube-axis-line cube-axis-line--y"></div>' +
      '<div class="cube-axis-line cube-axis-line--z"></div>' +
      '<div class="cube-axis-dot"></div>' +
      '</div>';
    stage.appendChild(axisEl);
    axisInner = axisEl.querySelector(".cube-axis-inner");

    // Scatter container — fixed viewport, behind all page content
    scatterStage = document.createElement("div");
    scatterStage.className = "scatter-stage";
    scatterStage.style.setProperty("--cubelet", CUBELET + "px");
    const shell = document.querySelector(".site-shell");
    if (shell && shell.parentNode) {
      shell.parentNode.insertBefore(scatterStage, shell);
    } else {
      document.body.appendChild(scatterStage);
    }

    cubelets = [];

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          const el = document.createElement("div");
          el.className = "cubelet";
          const core = document.createElement("div");
          core.className = "cubelet__core";
          el.appendChild(core);

          FACES.forEach((f) => addFiller(core, f));

          if (y === -1) addSticker(el, core, "up");
          if (y === 1) addSticker(el, core, "down");
          if (z === 1) addSticker(el, core, "front");
          if (z === -1) addSticker(el, core, "back");
          if (x === 1) addSticker(el, core, "right");
          if (x === -1) addSticker(el, core, "left");

          cube.appendChild(el);
          const scatterView = scatterFaceView(x, y, z);
          el.style.setProperty("--scatter-color", scatterView.color);
          const c = {
            el,
            core,
            pos: [x, y, z],
            orient: identity(),
            scatterView,
          };
          cubelets.push(c);
          renderCubelet(c);
        }
      }
    }
    cubelets.forEach((c) => (c.startPos = c.pos.slice()));
  }

  function wireEvents(signal) {
    // Turn buttons
    container.querySelectorAll("[data-cube-turn]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (scattered) {
          gatherCubelets();
          return;
        }
        if (resetting) return;
        enqueueTurn(btn.getAttribute("data-cube-turn"), false);
      }, { signal: signal });
    });

    // Scramble button
    const scrambleBtn = container.querySelector("[data-cube-scramble]");
    if (scrambleBtn) {
      scrambleBtn.addEventListener("click", () => {
        if (scattered) {
          gatherCubelets();
          return;
        }
        scramble(22);
      }, { signal: signal });
    }

    // Reset button
    const resetBtn = container.querySelector("[data-cube-reset]");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (scattered) {
          gatherCubelets();
          return;
        }
        reset();
      }, { signal: signal });
    }

    // Keyboard
    window.addEventListener("keydown", (e) => {
      if (scattered) return;
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "Escape") {
        reset();
        return;
      }
      if (resetting) return;
      const k = e.key.toUpperCase();
      if ("UDLRFB".indexOf(k) >= 0) {
        e.preventDefault();
        enqueueTurn(k + (e.shiftKey ? "'" : ""), false);
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        scramble(22);
      }
    }, { signal: signal });

    // Hero enter/leave
    hero.addEventListener("pointerenter", () => {
      mouseOverHero = true;
      clearTimeout(scatterTimer);
      gatherCubelets();
    }, { signal: signal });

    hero.addEventListener("pointerleave", () => {
      mouseOverHero = false;
      resetIdleTimer();
      if (!scattered && canScatter()) scheduleScatter(180);
    }, { signal: signal });

    // Document pointer move (mouse tracking)
    document.addEventListener("pointermove", checkMouseInHero, { passive: true, signal: signal });

    // Stage pointer events (drag)
    stage.addEventListener("pointerdown", stagePointerDown, { signal: signal });
    stage.addEventListener("pointermove", stagePointerMove, { signal: signal });
    stage.addEventListener("pointerup", endDrag, { signal: signal });
    stage.addEventListener("pointercancel", endDrag, { signal: signal });
    stage.addEventListener("pointerleave", endDrag, { signal: signal });

    // Parallax
    window.addEventListener("pointermove", handleWindowPointerMove, { signal: signal });

    // Resize
    window.addEventListener("resize", handleResize, { signal: signal });
  }

  // ---------------------------------------------------------------- lifecycle
  function mount(el) {
    container = el;
    ac = new AbortController();
    const signal = ac.signal;

    stage = el.querySelector("[data-cube-stage]");
    if (!stage) return;

    hero = stage.closest(".cube-hero__cube") || stage.parentElement;
    css = getComputedStyle(stage);
    CUBELET = parseFloat(css.getPropertyValue("--cubelet")) || 64;
    GAP = parseFloat(css.getPropertyValue("--gap")) || 4;
    STEP = CUBELET + GAP;
    TURN_MS = 260;

    // Initialize module-level state
    queue = [];
    history = [];
    turning = false;
    resetting = false;
    rotX = -28;
    rotY = -38;
    lockedView = null;
    dragging = false;
    lastX = 0;
    lastY = 0;
    vx = 0;
    vy = 0;
    idleSpinActive = false;
    parallaxX = 0;
    parallaxY = 0;
    scattered = false;
    scatterMode = "cube";
    scatterData = [];
    scatterAnimation = null;
    scatterTimer = 0;
    scatterDriftStartedAt = 0;
    mouseOverHero = false;

    buildCubeDOM();
    wireEvents(signal);

    resetIdleTimer();
    rafId = requestAnimationFrame(tick);
  }

  function unmount() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (ac) { ac.abort(); ac = null; }
    clearTimeout(scatterTimer);
    clearTimeout(idleTimer);
    // Remove scatterStage inserted into document body
    if (scatterStage && scatterStage.parentNode) {
      scatterStage.parentNode.removeChild(scatterStage);
    }
    scatterStage = null;
    cube = null;
    axisEl = null;
    axisInner = null;
    stage = null;
    hero = null;
    container = null;
  }

  window.__page_home = { mount: mount, unmount: unmount };
})();
