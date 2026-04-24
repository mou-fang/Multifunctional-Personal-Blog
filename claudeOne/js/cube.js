/* ===== claudeOne :: cube.js =====
 * Builds a 3×3 visual Rubik's cube inside [data-cube-stage]. Not playable —
 * purely a hero visual. Interactions:
 *   - pointerdown + drag → rotate cube (rotX clamped, rotY free).
 *   - release → inertia decay via requestAnimationFrame.
 *   - idle 2s → slow sine drift on rotY.
 *   - cursor move (even without drag) → subtle parallax tilt ±3°.
 */

(function buildCube() {
  const stage = document.querySelector("[data-cube-stage]");
  if (!stage) return;

  const CUBELET = parseFloat(getComputedStyle(stage).getPropertyValue("--cubelet")) || 64;
  const GAP = parseFloat(getComputedStyle(stage).getPropertyValue("--gap")) || 4;
  const STEP = CUBELET + GAP;

  // Build a wrapper + 27 cubelets
  const cube = document.createElement("div");
  cube.className = "cube";
  stage.appendChild(cube);

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const cubelet = document.createElement("div");
        cubelet.className = "cubelet";
        const tx = (x + 1) * STEP;
        const ty = (y + 1) * STEP;
        const tz = z * STEP;
        // Base position inside the cube's coord system (translate the cubelet
        // so the outer trio sits exactly at cube extents)
        cubelet.style.transform = `translate3d(${tx - STEP}px, ${ty - STEP}px, ${tz}px)`;

        // Six faces — only add the sticker colors on outward-facing ones
        if (y === -1) addFace(cubelet, "up");
        if (y === 1) addFace(cubelet, "down");
        if (z === 1) addFace(cubelet, "front");
        if (z === -1) addFace(cubelet, "back");
        if (x === 1) addFace(cubelet, "right");
        if (x === -1) addFace(cubelet, "left");

        // Internal filler faces (dark plastic body) for all six, so interior
        // seams stay black instead of transparent when cube rotates.
        ["up", "down", "front", "back", "right", "left"].forEach((f) => {
          const fill = document.createElement("div");
          fill.className = "sticker-face";
          switch (f) {
            case "up": fill.style.transform = `rotateX(90deg) translateZ(${CUBELET / 2 - 0.5}px)`; break;
            case "down": fill.style.transform = `rotateX(-90deg) translateZ(${CUBELET / 2 - 0.5}px)`; break;
            case "front": fill.style.transform = `translateZ(${CUBELET / 2 - 0.5}px)`; break;
            case "back": fill.style.transform = `rotateY(180deg) translateZ(${CUBELET / 2 - 0.5}px)`; break;
            case "right": fill.style.transform = `rotateY(90deg) translateZ(${CUBELET / 2 - 0.5}px)`; break;
            case "left": fill.style.transform = `rotateY(-90deg) translateZ(${CUBELET / 2 - 0.5}px)`; break;
          }
          cubelet.appendChild(fill);
        });

        cube.appendChild(cubelet);
      }
    }
  }

  function addFace(parent, face) {
    const sticker = document.createElement("div");
    sticker.className = `sticker sticker--${face}`;
    const inner = document.createElement("div");
    inner.className = "inner";
    sticker.appendChild(inner);
    parent.appendChild(sticker);
  }

  // --- Interaction --------------------------------------------------------
  // Current rotation angles
  let rotX = -28;
  let rotY = -38;
  // Drag state
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  // Velocity (for inertia)
  let vx = 0;
  let vy = 0;
  // Idle
  let idleTimer = 0;
  let idleSpinActive = false;
  // Parallax (cursor-on-page offset)
  let parallaxX = 0;
  let parallaxY = 0;

  function render() {
    const ptx = parallaxX * 3;
    const pty = parallaxY * 3;
    cube.style.transform = `rotateX(${rotX + pty}deg) rotateY(${rotY + ptx}deg)`;
  }

  function animate() {
    // Inertia decay when not dragging
    if (!dragging) {
      if (Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01) {
        rotY += vx;
        rotX += vy;
        rotX = Math.max(-80, Math.min(80, rotX));
        vx *= 0.94;
        vy *= 0.94;
      } else if (idleSpinActive) {
        rotY += 0.18;
        rotX += Math.sin(performance.now() / 2800) * 0.02;
      }
    }
    render();
    requestAnimationFrame(animate);
  }

  function resetIdleTimer() {
    idleSpinActive = false;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleSpinActive = true;
    }, 2000);
  }

  stage.addEventListener("pointerdown", (e) => {
    dragging = true;
    stage.setAttribute("data-dragging", "true");
    lastX = e.clientX;
    lastY = e.clientY;
    vx = 0;
    vy = 0;
    stage.setPointerCapture?.(e.pointerId);
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
    try { stage.releasePointerCapture?.(e.pointerId); } catch { /* no-op */ }
    resetIdleTimer();
  }

  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("pointerleave", endDrag);

  // Cursor-parallax (subtle tilt based on cursor position relative to viewport)
  window.addEventListener("pointermove", (e) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    parallaxX = (e.clientX - cx) / cx; // -1..1
    parallaxY = (e.clientY - cy) / cy;
  });

  resetIdleTimer();
  animate();
})();
