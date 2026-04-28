/* ===== claudeOne :: cube.js =====
 * Fully playable 3x3 Rubik's cube. Each cubelet tracks:
 *   - pos:    [x, y, z] integer triple in {-1, 0, 1}^3 — current logical slot
 *   - orient: 3x3 rotation matrix (integer entries since we only do 90°)
 *
 * Convention (CSS coords): +X right, +Y down, +Z towards viewer.
 *   y = -1  →  top of cube (because Y is inverted in CSS)
 *   y = +1  →  bottom
 *
 * Face turn (CW as viewed from outside) = math-positive rotation around the
 * face's outward-normal axis. Using right-hand rule:
 *   U: layer y=-1, +90° around +Y
 *   D: layer y=+1, -90° around +Y
 *   L: layer x=-1, -90° around +X
 *   R: layer x=+1, +90° around +X
 *   F: layer z=+1, +90° around +Z
 *   B: layer z=-1, -90° around +Z
 *
 * Animation: wrap the slice cubelets in a temporary <div class="cube-slice">
 * with transform-origin at the cube center, animate its rotation, then bake
 * the rotation into each cubelet's pos+orient and put them back under .cube.
 */

(function buildCube() {
  const stage = document.querySelector("[data-cube-stage]");
  if (!stage) return;

  const css = getComputedStyle(stage);
  const CUBELET = parseFloat(css.getPropertyValue("--cubelet")) || 64;
  const GAP = parseFloat(css.getPropertyValue("--gap")) || 4;
  const STEP = CUBELET + GAP;
  const TURN_MS = 260;

  // ---------------------------------------------------------------- math util
  const identity = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

  function matMul(a, b) {
    const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        for (let k = 0; k < 3; k++) r[i][j] += a[i][k] * b[k][j];
    // Snap to integers — only 90° rotations, all entries should be -1/0/1.
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) r[i][j] = Math.round(r[i][j]);
    return r;
  }

  // sign = +1 → +90°, sign = -1 → -90°. cos(±90°)=0, sin(±90°)=±1.
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

  // 3x3 rotation + (tx,ty,tz) translation → CSS matrix3d (column-major).
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

  // -------------------------------------------------------------------- build
  const cube = document.createElement("div");
  cube.className = "cube";
  stage.appendChild(cube);

  const cubelets = [];

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue; // hidden inner core
        const el = document.createElement("div");
        el.className = "cubelet";

        // Colored stickers only on the outward-facing sides (relative to the
        // cubelet's original world position).
        if (y === -1) addSticker(el, "up");
        if (y === 1) addSticker(el, "down");
        if (z === 1) addSticker(el, "front");
        if (z === -1) addSticker(el, "back");
        if (x === 1) addSticker(el, "right");
        if (x === -1) addSticker(el, "left");

        // Dark plastic filler on all 6 sides so internal seams stay opaque
        // when the cube spins.
        ["up", "down", "front", "back", "right", "left"].forEach((f) =>
          addFiller(el, f)
        );

        cube.appendChild(el);
        const c = { el, pos: [x, y, z], orient: identity() };
        cubelets.push(c);
        renderCubelet(c);
      }
    }
  }
  cubelets.forEach((c) => (c.startPos = c.pos.slice()));

  function addSticker(parent, face) {
    const sticker = document.createElement("div");
    sticker.className = "sticker sticker--" + face;
    const inner = document.createElement("div");
    inner.className = "inner";
    sticker.appendChild(inner);
    parent.appendChild(sticker);
  }

  function addFiller(parent, face) {
    const fill = document.createElement("div");
    fill.className = "sticker-face";
    const half = CUBELET / 2 - 0.5;
    if (face === "up")
      fill.style.transform = `rotateX(90deg) translateZ(${half}px)`;
    if (face === "down")
      fill.style.transform = `rotateX(-90deg) translateZ(${half}px)`;
    if (face === "front") fill.style.transform = `translateZ(${half}px)`;
    if (face === "back")
      fill.style.transform = `rotateY(180deg) translateZ(${half}px)`;
    if (face === "right")
      fill.style.transform = `rotateY(90deg) translateZ(${half}px)`;
    if (face === "left")
      fill.style.transform = `rotateY(-90deg) translateZ(${half}px)`;
    parent.appendChild(fill);
  }

  function renderCubelet(c) {
    const tx = c.pos[0] * STEP;
    const ty = c.pos[1] * STEP;
    const tz = c.pos[2] * STEP;
    c.el.style.transform = matrix3dCss(c.orient, tx, ty, tz);
  }

  // ---------------------------------------------------------------- turns
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

  const queue = [];
  const history = [];     // names of turns actually applied to state, in order
  let turning = false;
  let resetting = false;  // true while step-by-step reset playback is running

  function inverseTurn(name) {
    return name.endsWith("'") ? name.slice(0, -1) : name + "'";
  }

  function enqueueTurn(name, fast, recordHistory = true) {
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
      // Wrap slice in a temporary group so we rotate it as a unit. Group sits
      // at inset:0 of .cube, so its center coincides with the cube center —
      // the rotation pivot we want.
      const sliceDiv = document.createElement("div");
      sliceDiv.className = "cube-slice";
      cube.appendChild(sliceDiv);
      slice.forEach((c) => sliceDiv.appendChild(c.el));

      // Force the slice's starting transform; reflow; then animate to target.
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
        // Bake the rotation into each cubelet's logical state, then re-parent.
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
      // Safety: if transitionend never fires, finish anyway slightly after.
      setTimeout(finish, durationMs + 80);
    });
  }

  // ---------------------------------------------------------------- scramble & reset
  function scramble(n) {
    if (queue.length > 0 || turning) return;
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

    // Drop pending forward turns (e.g. mid-scramble), but resolve their
    // promises so any awaiter doesn't hang.
    while (queue.length > 0) {
      const dropped = queue.shift();
      dropped.resolve && dropped.resolve();
    }

    // Wait for the in-flight turn (if any) to land in history.
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

  // ---------------------------------------------------------------- controls
  document.querySelectorAll("[data-cube-turn]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (resetting) return;
      enqueueTurn(btn.getAttribute("data-cube-turn"), false);
    });
  });
  const scrambleBtn = document.querySelector("[data-cube-scramble]");
  if (scrambleBtn) scrambleBtn.addEventListener("click", () => scramble(22));
  const resetBtn = document.querySelector("[data-cube-reset]");
  if (resetBtn) resetBtn.addEventListener("click", reset);

  // Keyboard shortcuts: U/D/L/R/F/B; SHIFT for prime; Space scramble; Esc reset.
  window.addEventListener("keydown", (e) => {
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
  });

  // ---------------------------------------------------------------- whole-cube view rotation
  let rotX = -28;
  let rotY = -38;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let vx = 0;
  let vy = 0;
  let idleTimer = 0;
  let idleSpinActive = false;
  let parallaxX = 0;
  let parallaxY = 0;

  function renderCube() {
    const ptx = parallaxX * 3;
    const pty = parallaxY * 3;
    cube.style.transform = `rotateX(${rotX + pty}deg) rotateY(${rotY + ptx}deg)`;
  }

  function tick() {
    if (!dragging) {
      if (Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01) {
        rotY += vx;
        rotX += vy;
        rotX = Math.max(-80, Math.min(80, rotX));
        vx *= 0.94;
        vy *= 0.94;
      } else if (idleSpinActive && !turning && queue.length === 0) {
        rotY += 0.18;
        rotX += Math.sin(performance.now() / 2800) * 0.02;
      }
    }
    renderCube();
    requestAnimationFrame(tick);
  }

  function resetIdleTimer() {
    idleSpinActive = false;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleSpinActive = true;
    }, 2200);
  }

  stage.addEventListener("pointerdown", (e) => {
    // Don't start a drag if the press hits a control button.
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
    try { stage.setPointerCapture && stage.setPointerCapture(e.pointerId); } catch {}
    resetIdleTimer();
  });

  stage.addEventListener("pointermove", (e) => {
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
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    stage.removeAttribute("data-dragging");
    try { stage.releasePointerCapture && stage.releasePointerCapture(e.pointerId); } catch {}
    resetIdleTimer();
  }
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("pointerleave", endDrag);

  window.addEventListener("pointermove", (e) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    parallaxX = (e.clientX - cx) / cx;
    parallaxY = (e.clientY - cy) / cy;
  });

  resetIdleTimer();
  tick();
})();
