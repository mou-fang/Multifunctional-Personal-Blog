/* Shared by the site shell and the standalone background experiment.
   Render the faint wash in one float pass. Applying CSS opacity after this
   canvas, or scaling its backing buffer, would undo the final-pixel dither. */
(() => {
  'use strict';

  const VERTEX_SHADER = `
    attribute vec2 a_position;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
  `;

  const FRAGMENT_SHADER = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform int u_palette;
    uniform float u_strength;
    uniform vec3 u_mainDrift;
    uniform vec3 u_coolDrift;
    uniform vec3 u_warmDrift;

    vec4 premultiply(vec3 rgb, float alpha) {
      return vec4(rgb / 255.0 * alpha, alpha);
    }

    vec4 over(vec4 front, vec4 back) {
      return front + back * (1.0 - front.a);
    }

    vec4 singleGradient(vec2 p, vec2 center, vec2 radius, vec4 color, float end) {
      float distance = length((p - center) / radius);
      return color * (1.0 - clamp(distance / end, 0.0, 1.0));
    }

    vec4 doubleGradient(vec2 p, vec2 center, vec2 radius,
                        vec4 first, vec4 second, float middle, float end) {
      float distance = length((p - center) / radius);
      if (distance < middle) return mix(first, second, distance / middle);
      return second * (1.0 - clamp((distance - middle) / (end - middle), 0.0, 1.0));
    }

    // A corner glow must have no finite-radius edge or cone-shaped center.
    // Dithering alone cannot hide the derivative discontinuity of a clipped ramp.
    vec4 cornerGlow(vec2 p) {
      vec2 q = (p - vec2(-0.03, -0.08)) / vec2(0.60, 0.68);
      return premultiply(vec3(248.0, 235.0, 233.0), 0.40 * exp(-3.0 * dot(q, q)));
    }

    // CSS inset:-12%, with transforms about the center of that larger layer.
    vec2 layerPoint(vec2 p, vec3 drift) {
      return (p - 0.5 - drift.xy * 1.24) / (1.24 * drift.z) + 0.5;
    }

    float circleAlpha(vec2 p, vec2 center, float end, float alpha) {
      vec2 farthestCorner = max(center, 1.0 - center) * u_resolution;
      float radius = length(farthestCorner);
      float distance = length((p - center) * u_resolution);
      float t = clamp(distance / (radius * end), 0.0, 1.0);
      // Zero first and second derivatives at both ends remove the old light ring.
      float smoothFade = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
      // Approach the untouched CSS original continuously as strength reaches 0.
      float fade = mix(t, smoothFade, min(u_strength * 5.0, 1.0));
      return alpha * (1.0 - fade);
    }

    vec3 originalBlue(vec2 p) {
      vec3 base = vec3(230.0, 239.0, 255.0) / 255.0;
      // The original ::before: white over blue, opacity .4, soft-light.
      vec4 cool = premultiply(vec3(160.0, 185.0, 230.0),
        circleAlpha(p, vec2(0.8, 0.7), 0.45, 0.35));
      vec4 white = premultiply(vec3(255.0),
        circleAlpha(p, vec2(0.2, 0.2), 0.35, 0.6));
      vec4 light = over(white, cool);
      vec3 source = light.rgb / max(light.a, 0.000001);
      vec3 darkened = base - (1.0 - 2.0 * source) * base * (1.0 - base);
      // Every base channel is above .25, so soft-light's D(base) is sqrt(base).
      vec3 lightened = base + (2.0 * source - 1.0) * (sqrt(base) - base);
      vec3 blended = mix(darkened, lightened, step(vec3(0.5), source));
      return mix(base, blended, light.a * 0.4);
    }

    void main() {
      vec2 p = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) / u_resolution;
      vec2 mainPoint = layerPoint(p, u_mainDrift);
      vec2 coolPoint = layerPoint(p, u_coolDrift);
      vec4 mainColor;
      vec4 coolColor;
      vec4 warmColor = vec4(0.0);

      if (u_palette == 1) {
        mainColor = doubleGradient(mainPoint, vec2(0.91, 0.17), vec2(0.72, 0.83),
          premultiply(vec3(181.0, 222.0, 229.0), 0.86),
          premultiply(vec3(203.0, 231.0, 244.0), 0.3), 0.45, 0.75);
        coolColor = singleGradient(coolPoint, vec2(0.08, 0.88), vec2(0.64, 0.65),
          premultiply(vec3(210.0, 210.0, 242.0), 0.58), 0.75);
      } else if (u_palette == 2) {
        mainColor = singleGradient(mainPoint, vec2(0.90, 0.16), vec2(0.60, 0.72),
          premultiply(vec3(199.0, 189.0, 235.0), 0.82), 0.78);
        coolColor = singleGradient(coolPoint, vec2(0.04, 0.83), vec2(0.65, 0.78),
          premultiply(vec3(181.0, 223.0, 230.0), 0.72), 0.76);
        warmColor = cornerGlow(layerPoint(p, u_warmDrift));
      } else {
        mainColor = doubleGradient(mainPoint, vec2(0.87, 0.20), vec2(0.68, 0.78),
          premultiply(vec3(199.0, 189.0, 235.0), 0.92),
          premultiply(vec3(214.0, 208.0, 246.0), 0.36), 0.42, 0.75);
        coolColor = singleGradient(coolPoint, vec2(0.03, 0.89), vec2(0.62, 0.65),
          premultiply(vec3(192.0, 223.0, 242.0), 0.65), 0.75);
      }

      // Preserve group-opacity semantics without an intermediate 8-bit surface.
      vec4 wash = over(mainColor, over(coolColor, warmColor)) * u_strength;
      vec3 color = wash.rgb + originalBlue(p) * (1.0 - wash.a);

      // Static triangular dither, at most one channel code value in either
      // direction. Two decorrelated samples soften residual low-strength steps.
      float noiseA = fract(52.9829189 * fract(dot(gl_FragCoord.xy,
        vec2(0.06711056, 0.00583715))));
      float noiseB = fract(52.9829189 * fract(dot(gl_FragCoord.yx + vec2(71.0, 193.0),
        vec2(0.06711056, 0.00583715))));
      float noise = noiseA + noiseB - 1.0;
      color += vec3(noise / 255.0);
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `;

  const LOOPS = [
    { duration: 32, stops: [[0, 0, 0, 1], [.35, -.08, .06, 1.04], [.70, .03, -.05, 1.07], [1, 0, 0, 1]] },
    { duration: 41, stops: [[0, 0, 0, 1], [.40, .07, -.07, 1.05], [.75, -.03, .04, 1.02], [1, 0, 0, 1]] },
    { duration: 47, stops: [[0, 0, 0, 1], [.45, .06, .05, 1.08], [.80, -.04, -.03, 1.03], [1, 0, 0, 1]] }
  ];

  // Solve CSS ease-in-out's cubic-bezier(.42, 0, .58, 1).
  function easeInOut(progress) {
    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < 12; iteration += 1) {
      const t = (low + high) / 2;
      const x = 3 * (1 - t) * (1 - t) * t * .42 + 3 * (1 - t) * t * t * .58 + t * t * t;
      if (x < progress) low = t;
      else high = t;
    }
    const t = (low + high) / 2;
    return t * t * (3 - 2 * t);
  }

  function driftAt(loop, elapsed) {
    const progress = (elapsed % loop.duration) / loop.duration;
    const index = loop.stops.findIndex((stop, i) => i > 0 && progress <= stop[0]);
    const start = loop.stops[index - 1];
    const end = loop.stops[index];
    const eased = easeInOut((progress - start[0]) / (end[0] - start[0]));
    return start.slice(1).map((value, i) => value + (end[i + 1] - value) * eased);
  }

  window.createSoftUIWash = (canvas, onReady = () => {}) => {
    let gl;
    let program;
    let buffer;
    let uniforms;
    let contextUsable = false;
    let disposed = false;
    let ready = false;
    let frame = 0;
    let lastDraw = -Infinity;
    let lastTime = performance.now();
    let sizeDirty = true;
    let bufferDpr = 0;
    let resolutionQuery;
    let maxViewport;
    const elapsed = [0, 0, 0];
    let state = { palette: 'violet', strength: .45, moving: false, visible: !document.hidden, comparing: false };

    function setReady(value) {
      if (ready === value) return;
      ready = value;
      onReady(value);
    }

    function shouldDisplay() {
      return !disposed && contextUsable && state.visible && !document.hidden && !state.comparing && state.strength > 0;
    }

    function flowing() { return shouldDisplay() && state.moving; }

    function advance(now) {
      const delta = Math.max(0, (now - lastTime) / 1000);
      if (flowing()) {
        elapsed[0] = (elapsed[0] + delta) % LOOPS[0].duration;
        elapsed[1] = (elapsed[1] + delta) % LOOPS[1].duration;
        if (state.palette === 'aurora') elapsed[2] = (elapsed[2] + delta) % LOOPS[2].duration;
      }
      lastTime = now;
    }

    function stopFrame() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }

    function releaseResources() {
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      buffer = null;
      program = null;
    }

    function compile(type, source) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Could not allocate a shader.');
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const reason = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(reason || 'Shader compilation failed.');
      }
      return shader;
    }

    function initialize() {
      const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      if (!precision || precision.precision < 16) throw new Error('High-precision fragment colors are unavailable.');
      releaseResources();
      let vertex;
      let fragment;
      try {
        vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
        fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
        program = gl.createProgram();
        if (!program) throw new Error('Could not allocate a shader program.');
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.bindAttribLocation(program, 0, 'a_position');
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          throw new Error(gl.getProgramInfoLog(program) || 'Shader linking failed.');
        }
      } finally {
        if (vertex) gl.deleteShader(vertex);
        if (fragment) gl.deleteShader(fragment);
      }

      buffer = gl.createBuffer();
      if (!buffer) throw new Error('Could not allocate the full-screen triangle.');
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      uniforms = {};
      for (const name of ['resolution', 'palette', 'strength', 'mainDrift', 'coolDrift', 'warmDrift']) {
        uniforms[name] = gl.getUniformLocation(program, `u_${name}`);
      }
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      // Use our controlled final dither rather than an implementation-dependent one.
      gl.disable(gl.DITHER);
      maxViewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
      sizeDirty = true;
      contextUsable = true;
    }

    function resizeBuffer() {
      const dpr = window.devicePixelRatio || 1;
      // clientWidth rounds away fractional CSS pixels at Windows 125% scaling.
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round((rect.width || document.documentElement.clientWidth || window.innerWidth) * dpr));
      const height = Math.max(1, Math.round((rect.height || window.innerHeight) * dpr));
      // A low-resolution fallback would blur away the one-pixel dither.
      if (width > maxViewport[0] || height > maxViewport[1]) throw new Error('Native pixel dimensions exceed the GPU viewport limit.');
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      if (gl.drawingBufferWidth !== width || gl.drawingBufferHeight !== height) {
        throw new Error('Could not allocate a native-resolution drawing buffer.');
      }
      gl.viewport(0, 0, width, height);
      bufferDpr = dpr;
      sizeDirty = false;
    }

    function fail(error) {
      contextUsable = false;
      stopFrame();
      setReady(false);
      console.warn('[Soft UI background] Using CSS fallback:', error);
    }

    function draw(now) {
      if (!shouldDisplay()) return;
      try {
        if (sizeDirty || bufferDpr !== (window.devicePixelRatio || 1)) resizeBuffer();
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
        gl.uniform1i(uniforms.palette, state.palette === 'cyan' ? 1 : state.palette === 'aurora' ? 2 : 0);
        gl.uniform1f(uniforms.strength, state.strength);
        const main = driftAt(LOOPS[0], elapsed[0]);
        const cool = driftAt(LOOPS[1], elapsed[1]);
        const warm = driftAt(LOOPS[2], elapsed[2]);
        gl.uniform3f(uniforms.mainDrift, ...main);
        gl.uniform3f(uniforms.coolDrift, ...cool);
        gl.uniform3f(uniforms.warmDrift, ...warm);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        // Inspect the first real draw, not just successful shader compilation.
        if (!ready && (gl.isContextLost() || gl.getError() !== gl.NO_ERROR)) {
          throw new Error('The first background draw failed.');
        }
        lastDraw = now;
        setReady(true);
      } catch (error) {
        fail(error);
      }
    }

    function tick(now) {
      frame = 0;
      advance(now);
      if (!flowing()) return;
      if (now - lastDraw >= 1000 / 30) draw(now);
      if (flowing()) frame = requestAnimationFrame(tick);
    }

    function refresh() {
      stopFrame();
      const now = performance.now();
      advance(now);
      draw(now);
      if (flowing()) frame = requestAnimationFrame(tick);
    }

    function handleResize() {
      sizeDirty = true;
      refresh();
    }

    function watchPixelRatio() {
      if (resolutionQuery) resolutionQuery.removeEventListener('change', handlePixelRatio);
      resolutionQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      resolutionQuery.addEventListener('change', handlePixelRatio);
    }

    function handlePixelRatio() {
      watchPixelRatio();
      handleResize();
    }

    function handleVisibility() {
      // Hidden tabs must not accumulate animation time or keep scheduling work.
      lastTime = performance.now();
      refresh();
    }

    function handleContextLost(event) {
      event.preventDefault();
      advance(performance.now());
      contextUsable = false;
      stopFrame();
      setReady(false);
    }

    function handleContextRestored() {
      if (disposed) return;
      try {
        // Old WebGL objects belong to the lost context and cannot be reused.
        program = null;
        buffer = null;
        initialize();
        lastTime = performance.now();
        refresh();
      } catch (error) {
        fail(error);
      }
    }

    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
      if (!gl) return null;
      initialize();
    } catch (error) {
      if (gl) releaseResources();
      console.warn('[Soft UI background] Using CSS fallback:', error);
      return null;
    }

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibility);
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    watchPixelRatio();

    return {
      update(next) {
        if (disposed) return;
        advance(performance.now());
        const strength = Number(next.strength);
        state = {
          palette: ['violet', 'cyan', 'aurora'].includes(next.palette) ? next.palette : 'violet',
          strength: Number.isFinite(strength) ? Math.max(0, Math.min(1, strength)) : 0,
          moving: Boolean(next.moving),
          visible: Boolean(next.visible),
          comparing: Boolean(next.comparing)
        };
        refresh();
      },
      destroy() {
        if (disposed) return;
        disposed = true;
        stopFrame();
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('visibilitychange', handleVisibility);
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
        if (resolutionQuery) resolutionQuery.removeEventListener('change', handlePixelRatio);
        releaseResources();
        setReady(false);
      }
    };
  };
})();
