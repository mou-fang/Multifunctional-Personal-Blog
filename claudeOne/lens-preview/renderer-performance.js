/* First-party integration for the pinned MIT Lens renderer (see UPSTREAM.json).
 * The Lens optical effects and spring physics stay unchanged.
 * Adapt background drawing, buffer reuse, regional copies and subpixel sampling.
 */
import {lensFragment} from './lens-shader.js';
const vertex = `#version 300 es
in vec2 aPosition;
uniform vec2 uResolution;
uniform vec4 uQuad;
out vec2 vPixel;
void main(){
  vPixel = uQuad.xy + (aPosition * .5 + .5) * uQuad.zw;
  gl_Position = vec4(vPixel / uResolution * 2. - 1., 0., 1.);
}`;
const grid = `#version 300 es
precision highp float;
in vec2 vPixel;
out vec4 outColor;
uniform vec2 uResolution;
uniform vec2 uOrigin;
uniform float uScale;
uniform vec3 uBackground;
void main(){
  vec2 world = vec2(vPixel.x, uResolution.y-vPixel.y)/uScale + uOrigin;
  vec2 distance = abs(mod(world-vec2(14.025)+13.75, 27.5)-13.75);
  float line = 1.-smoothstep(.05, .45+.5/uScale, min(distance.x,distance.y));
  outColor = vec4(mix(uBackground, vec3(198.,205.,214.)/255.,line*.82),1.);
}`;

function compileProgram(gl, fragment) {
  const compile = (kind, source) => {
    const shader = gl.createShader(kind); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {const error = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(error);}
    return shader;
  };
  const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment), p = gl.createProgram();
  gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p); gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {const error = gl.getProgramInfoLog(p); gl.deleteProgram(p); throw new Error(error);}
  const uniforms={};
  for (let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++) {
    const name=gl.getActiveUniform(p,i).name; uniforms[name]=gl.getUniformLocation(p,name);
  }
  return {p,uniforms};
}
function gridProgram(gl) {
  const result=compileProgram(gl,grid), uniforms=result.uniforms;
  // The native render loop also sets these; null is the WebGL no-op location.
  for (const name of ['uArtwork','uTime','uAnimate','uGrid','uBrightness']) uniforms[name] = null;
  return result;
}

export function bufferPlan(rect, viewport, {player = false, previous, pixelRatio = 1} = {}) {
  const area = Math.max(1, viewport.w * viewport.h);
  const dpr = Math.min(pixelRatio, 1, Math.sqrt(1600000 / area));
  // Reserve the complete player trajectory once. Its backing store stays fixed
  // while the original semantic buttons move inside the clipped surface.
  let width = Math.ceil((player ? Math.max(rect.width,viewport.w) : rect.width) * dpr);
  let height = Math.ceil((player ? Math.max(rect.height,224) : rect.height) * dpr);
  if (!player) {width = Math.ceil(width/64)*64; height = Math.ceil(height/64)*64;}
  if (previous?.dpr === dpr && previous.viewportW === viewport.w && previous.viewportH === viewport.h) {
    width = Math.max(width,previous.width); height = Math.max(height,previous.height);
  }
  return {width:Math.max(1,width), height:Math.max(1,height), dpr, viewportW:viewport.w, viewportH:viewport.h};
}

/** Both targets differ only in the most recently drawn lens. Copy that region
 * before the next lens. The first copy still seeds the whole destination.
 * Overlapping/nested lenses therefore retain the exact original composition. */
export function installRegionCopies(renderer) {
  const gl = renderer.gl, original = gl.blitFramebuffer.bind(gl);
  let changed = null;
  const stats = {copies:0, pixels:0, fullCopies:0};
  gl.blitFramebuffer = (...args) => {
    const region = changed || [0,0,renderer.width,renderer.height];
    const x=Math.max(0,Math.floor(region[0])), y=Math.max(0,Math.floor(region[1]));
    const w=Math.min(renderer.width,Math.ceil(region[0]+region[2]))-x;
    const h=Math.min(renderer.height,Math.ceil(region[1]+region[3]))-y;
    stats.copies++; stats.pixels += w*h; if (!changed) stats.fullCopies++;
    return original(x,y,x+w,y+h,x,y,x+w,y+h,...args.slice(8));
  };
  return {stats, begin() {changed=null; stats.copies=stats.pixels=stats.fullCopies=0;},
    lens(quad) {changed=quad;}, destroy() {gl.blitFramebuffer=original;}};
}

export function optimizeRenderer(renderer, {player = false} = {}) {
  const nativeInit = renderer.initGL.bind(renderer), nativeRender = renderer.render.bind(renderer);
  const nativeStart = renderer.startGPU.bind(renderer), nativeDestroy = renderer.destroy.bind(renderer);
  const attributes = new WeakMap();
  let copies, allocation = null, rect = null, background = [.953,.953,.953], dirtySize = true;
  let lastReport = 0;
  const stats = {frames:0, allocations:0, cpuMs:0, copiedPixels:0, fullCopies:0};

  renderer.initGL = () => {
    nativeInit();
    const gl = renderer.gl, replacement = gridProgram(gl);
    gl.deleteProgram(renderer.programs.background.p); renderer.programs.background = replacement;
    const lens=compileProgram(gl,lensFragment);
    gl.deleteProgram(renderer.programs.lens.p); renderer.programs.lens=lens;
    copies?.destroy(); copies = installRegionCopies(renderer); allocation=null; dirtySize=true;
    const value = getComputedStyle(document.body).getPropertyValue('--bg').trim();
    const color = /^rgba?\(/.test(value) ? value.match(/[\d.]+/g) : null;
    if (color?.length >= 3) background=color.slice(0,3).map(Number).map(n=>n/255);
    else {
      const hex = value.match(/^#([\da-f]{6})$/i)?.[1];
      if (hex) background=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255);
    }
  };
  renderer.setScene = name => {renderer.settings.scene=name; renderer.invalidate();};
  // ResizeObserver only requests work. Allocation and painting happen together
  // in render(), so a cleared opaque canvas is never composited between them.
  renderer.resize = () => {dirtySize=true; renderer.invalidate(0);};
  const flushSize = () => {
    rect = renderer.stage.getBoundingClientRect(); renderer.stageRect=rect;
    const next = bufferPlan(rect,{w:innerWidth,h:innerHeight},{player,previous:allocation,pixelRatio:devicePixelRatio||1});
    renderer.dpr=next.dpr;
    if (!allocation || next.width!==allocation.width || next.height!==allocation.height || next.dpr!==allocation.dpr) {
      renderer.width=next.width; renderer.height=next.height;
      renderer.canvas.width=next.width; renderer.canvas.height=next.height;
      renderer.canvas.style.width=next.width/next.dpr+'px'; renderer.canvas.style.height=next.height/next.dpr+'px';
      const gl=renderer.gl;
      for (const target of renderer.targets) {
        gl.bindTexture(gl.TEXTURE_2D,target.texture);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,next.width,next.height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw new Error('Incomplete Lens buffer');
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,null); stats.allocations++; renderer.rectDirty=true;
    }
    // The expanded player has only a top border; its mini state has four.
    // Keep the native Lens geometry origin at the stage's border box even
    // when dimensions are reused and no texture allocation is needed.
    const border=getComputedStyle(renderer.stage);
    const left=-(parseFloat(border.borderLeftWidth)||0)+'px', top=-(parseFloat(border.borderTopWidth)||0)+'px';
    if (renderer.canvas.style.left!==left) renderer.canvas.style.left=left;
    if (renderer.canvas.style.top!==top) renderer.canvas.style.top=top;
    allocation=next; dirtySize=false;
  };
  renderer.use = (p, quad=[0,0,renderer.width,renderer.height]) => {
    const gl=renderer.gl;
    gl.useProgram(p.p); gl.bindVertexArray(renderer.vao); gl.bindBuffer(gl.ARRAY_BUFFER,renderer.buffer);
    if (!attributes.has(p)) attributes.set(p,gl.getAttribLocation(p.p,'aPosition'));
    const a=attributes.get(p); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
    gl.uniform2f(p.uniforms.uResolution,renderer.width,renderer.height); gl.uniform4fv(p.uniforms.uQuad,quad);
    if (p===renderer.programs.background) {
      copies.begin();
      gl.uniform2f(p.uniforms.uOrigin,rect.left,rect.top); gl.uniform1f(p.uniforms.uScale,renderer.dpr); gl.uniform3fv(p.uniforms.uBackground,background);
    } else if (p===renderer.programs.lens) copies.lens(quad);
  };
  const nativeInvalidate=renderer.invalidate.bind(renderer);
  renderer.invalidate = (duration=0, geometry=true) => {
    if (player && renderer.stage.hasAttribute('data-lens-player-morph')) {
      renderer.dirty=true; renderer.rectDirty ||= geometry;
      renderer.animatingUntil=Math.max(renderer.animatingUntil,performance.now()+duration);
    } else nativeInvalidate(duration,geometry);
  };
  renderer.render = now => {
    if (renderer.destroyed||renderer.suspended||renderer.lost||!renderer.gl||document.hidden||!renderer.visible) {renderer.frame=0; return;}
    const start=performance.now();
    // A moving host needs a new origin, not a new background texture.
    if (dirtySize || renderer.rectDirty || now<renderer.animatingUntil) flushSize();
    const pointer=renderer.pointer;
    renderer.pointer={x:pointer.x,y:pointer.y+renderer.height-rect.height*renderer.dpr};
    nativeRender(now); renderer.pointer=pointer;
    if (player && renderer.stage.hasAttribute('data-lens-player-morph')) {cancelAnimationFrame(renderer.frame); renderer.frame=0;}
    stats.frames++; stats.cpuMs=performance.now()-start;
    stats.copiedPixels=copies.stats.pixels; stats.fullCopies=copies.stats.fullCopies;
    if (now-lastReport>500) {
      lastReport=now;
      renderer.canvas.dataset.lensFrames=String(stats.frames);
      renderer.canvas.dataset.lensAllocations=String(stats.allocations);
      renderer.canvas.dataset.lensCpuMs=stats.cpuMs.toFixed(1);
      renderer.canvas.dataset.lensCopyPixels=String(Math.round(stats.copiedPixels));
    }
  };
  renderer.startGPU = () => {
    nativeStart();
    if (!renderer.suspended && !renderer.lost && renderer.gl) {cancelAnimationFrame(renderer.frame); renderer.frame=0; renderer.render(performance.now());}
  };
  renderer.drawNow = () => {cancelAnimationFrame(renderer.frame); renderer.frame=0; renderer.rectDirty=true; renderer.render(performance.now());};
  renderer.performanceStats=stats;
  renderer.destroy = () => {copies?.destroy(); nativeDestroy();};
}
