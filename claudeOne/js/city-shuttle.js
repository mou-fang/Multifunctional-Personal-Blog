/* ===== claudeOne :: city-shuttle.js =====
 * Infinite procedural city flight rendered through high-resolution colored ASCII.
 * SPA lifecycle: window.__page_city_shuttle
 */

(function cityShuttlePage() {
  "use strict";

  var Core = window.CityShuttleCore;
  var SETTINGS_KEY = "claudeOne.cityShuttle.settings.v1";
  var ASCII_SCALE = 3;
  var TAU = Math.PI * 2;
  var COLORS = {
    road: [0.055, 0.075, 0.092], roadEdge: [0.19, 0.27, 0.31], lane: [0.88, 0.70, 0.25],
    grass: [0.08, 0.30, 0.18], grassLight: [0.12, 0.46, 0.25], water: [0.04, 0.33, 0.55],
    trunk: [0.32, 0.20, 0.10], white: [0.82, 0.88, 0.88], dark: [0.028, 0.038, 0.052],
    rail: [0.33, 0.42, 0.46], red: [0.95, 0.08, 0.12], green: [0.10, 0.92, 0.44],
    amber: [1.0, 0.55, 0.08], cyan: [0.06, 0.86, 1.0], magenta: [0.94, 0.18, 0.70],
    shuttle: [0.72, 0.82, 0.88], glass: [0.08, 0.38, 0.60], engine: [0.08, 0.76, 1.0]
  };

  var CLUSTER_LAYOUTS = [
    [[0,0,1]], [[-18,-12,.82],[18,13,1.08]], [[-23,0,.70],[0,8,1.16],[23,-7,.76]],
    [[-20,-20,.66],[20,-20,.84],[-20,20,.78],[20,20,1.02]], [[0,0,1.28],[-28,18,.54],[28,18,.54]],
    [[-26,0,.72],[0,0,1.18],[26,0,.72]], [[-18,-18,.78],[18,-18,.78],[0,19,1.12]],
    [[0,-18,1.12],[-22,18,.68],[22,18,.84]], [[-25,-16,.62],[0,-5,1.24],[25,15,.72]],
    [[-24,-20,.60],[24,-20,.60],[-24,20,.92],[24,20,.92]], [[0,0,1.18],[-30,0,.55],[30,0,.55],[0,30,.68]],
    [[-22,-22,.66],[22,-22,1.0],[-22,22,1.0],[22,22,.66],[0,0,1.25]]
  ];

  var root = null;
  var stage = null;
  var canvas = null;
  var renderer = null;
  var abortController = null;
  var resizeObserver = null;
  var rafId = 0;
  var lastFrame = 0;
  var accumulator = 0;
  var world = null;
  var flight = null;
  var staticWorld = null;
  var activeChunkKey = "";
  var renderOrigin = { x: 0, z: 0 };
  var keys = Object.create(null);
  var steer = { x: 0, y: 0 };
  var cameraMode = "third";
  var charMode = "standard";
  var running = false;
  var paused = false;
  var crashing = false;
  var crashTimer = 0;
  var missionOffer = null;
  var offerSerial = 0;
  var toastTimer = 0;
  var immersiveFallback = false;
  var audio = null;
  var previousPosition = null;
  var invulnerable = 0;
  var fpsClock = 0;
  var fpsFrames = 0;
  var els = {};

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function mixColor(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function scaleColor(color, amount) { return [color[0] * amount, color[1] * amount, color[2] * amount]; }
  function distance3(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }
  function setText(node, value) { if (node) node.textContent = value; }
  function rotateXZ(x, z, angle) { var c = Math.cos(angle); var s = Math.sin(angle); return { x: x * c - z * s, z: x * s + z * c }; }

  function compileShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var message = gl.getShaderInfoLog(shader) || "unknown shader error";
      gl.deleteShader(shader);
      throw new Error("着色器编译失败：" + message);
    }
    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    var vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    var fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    var program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      var message = gl.getProgramInfoLog(program) || "unknown program error";
      gl.deleteProgram(program);
      throw new Error("渲染程序链接失败：" + message);
    }
    return program;
  }

  function mat4Perspective(out, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) / (near - far); out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = (2 * far * near) / (near - far); out[15] = 0;
  }

  function mat4LookAt(out, eye, center, up) {
    var zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
    var zLength = Math.hypot(zx, zy, zz) || 1; zx /= zLength; zy /= zLength; zz /= zLength;
    var xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    var xLength = Math.hypot(xx, xy, xz) || 1; xx /= xLength; xy /= xLength; xz /= xLength;
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]); out[15] = 1;
  }

  function createGlyphTexture(gl) {
    var glyphs = " .,:;irsXA253hMHGS#9B&@";
    var cellWidth = 48, cellHeight = 72;
    var atlas = document.createElement("canvas");
    atlas.width = cellWidth * glyphs.length; atlas.height = cellHeight;
    var context = atlas.getContext("2d");
    context.fillStyle = "#000"; context.fillRect(0, 0, atlas.width, atlas.height);
    context.fillStyle = "#fff"; context.textAlign = "center"; context.textBaseline = "middle";
    context.font = "900 58px 'Cascadia Mono','Consolas',monospace";
    for (var index = 0; index < glyphs.length; index += 1) context.fillText(glyphs[index], index * cellWidth + cellWidth / 2, cellHeight / 2 + 2);
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { texture: texture, count: glyphs.length };
  }

  function createCubeMesh(gl) {
    var vertices = new Float32Array([
      -0.5,-0.5, .5,0,0,1, .5,-0.5,.5,0,0,1, .5,.5,.5,0,0,1, -.5,.5,.5,0,0,1,
       .5,-.5,-.5,0,0,-1, -.5,-.5,-.5,0,0,-1, -.5,.5,-.5,0,0,-1, .5,.5,-.5,0,0,-1,
      -.5,-.5,-.5,-1,0,0, -.5,-.5,.5,-1,0,0, -.5,.5,.5,-1,0,0, -.5,.5,-.5,-1,0,0,
       .5,-.5,.5,1,0,0, .5,-.5,-.5,1,0,0, .5,.5,-.5,1,0,0, .5,.5,.5,1,0,0,
      -.5,.5,.5,0,1,0, .5,.5,.5,0,1,0, .5,.5,-.5,0,1,0, -.5,.5,-.5,0,1,0,
      -.5,-.5,-.5,0,-1,0, .5,-.5,-.5,0,-1,0, .5,-.5,.5,0,-1,0, -.5,-.5,.5,0,-1,0
    ]);
    var indices = new Uint16Array([0,1,2,0,2,3,4,5,6,4,6,7,8,9,10,8,10,11,12,13,14,12,14,15,16,17,18,16,18,19,20,21,22,20,22,23]);
    var vertex = gl.createBuffer(), index = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex); gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    return { vertex: vertex, index: index, count: indices.length };
  }

  function createRenderer(targetCanvas) {
    var gl = targetCanvas.getContext("webgl2", { alpha: false, antialias: false, depth: true, powerPreference: "high-performance" });
    if (!gl) throw new Error("本游戏需要支持 WebGL2 的桌面浏览器与显卡");
    var sceneVertex = `#version 300 es
      precision highp float;
      layout(location=0) in vec3 aPosition; layout(location=1) in vec3 aNormal;
      layout(location=2) in vec3 iPosition; layout(location=3) in vec3 iScale;
      layout(location=4) in vec3 iColor; layout(location=5) in vec3 iRotation; layout(location=6) in float iEmission;
      uniform mat4 uProjection; uniform mat4 uView;
      out vec3 vWorld; out vec3 vNormal; out vec3 vColor; out float vEmission;
      mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,s,0,-s,c);}
      mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0,s,0,1,0,-s,0,c);}
      mat3 rotZ(float a){float c=cos(a),s=sin(a);return mat3(c,s,0,-s,c,0,0,0,1);}
      void main(){mat3 rotation=rotY(iRotation.y)*rotX(iRotation.x)*rotZ(iRotation.z);vec3 world=rotation*(aPosition*iScale)+iPosition;vWorld=world;vNormal=normalize(rotation*aNormal);vColor=iColor;vEmission=iEmission;gl_Position=uProjection*uView*vec4(world,1.0);}`;
    var sceneFragment = `#version 300 es
      precision highp float; in vec3 vWorld; in vec3 vNormal; in vec3 vColor; in float vEmission;
      uniform vec3 uCamera; uniform vec3 uSunDirection; uniform vec3 uFogColor; uniform float uDaylight; uniform float uTime;
      out vec4 outColor;
      void main(){vec3 n=normalize(vNormal);float diffuse=max(dot(n,uSunDirection),0.0);float rim=pow(1.0-max(dot(n,normalize(uCamera-vWorld)),0.0),2.0);float windowBand=step(.79,fract(vWorld.y*.085+vWorld.x*.011))*step(.25,abs(n.y-.0));float distanceEye=distance(vWorld,uCamera);vec3 lit=vColor*(.20+uDaylight*.34+diffuse*(.40+uDaylight*.48)+rim*.18);lit+=vColor*windowBand*(1.0-uDaylight)*.45;lit+=vColor*vEmission*(.8+.2*sin(uTime*5.0+vWorld.x));float fog=smoothstep(1050.0,2250.0,distanceEye);outColor=vec4(mix(lit,uFogColor,fog),1.0);}`;
    var postVertex = `#version 300 es
      precision highp float; layout(location=0) in vec2 aPosition; out vec2 vUv;
      void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0,1);}`;
    var postFragment = `#version 300 es
      precision highp float; in vec2 vUv; uniform sampler2D uScene; uniform sampler2D uGlyphs;
      uniform vec2 uGrid; uniform float uGlyphCount; uniform float uTime; uniform float uSpeed; uniform float uCrash; out vec4 outColor;
      float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));} float hash(float v){return fract(sin(v*91.733)*43758.5453);}
      void main(){vec2 uv=vUv;float edgeWarp=pow(abs(uv.y-.5)*2.0,3.0)*uSpeed*.004;uv.x+=sin(uv.y*95.0+uTime*3.0)*edgeWarp;float line=floor(uv.y*uGrid.y);uv.x+=(hash(line+floor(uTime*18.0))-.5)*uCrash*.065;uv=clamp(uv,vec2(.002),vec2(.998));vec2 cell=floor(uv*uGrid);vec2 local=fract(uv*uGrid);vec2 center=(cell+.5)/uGrid;vec2 texel=1.0/uGrid;vec3 c=texture(uScene,center).rgb;vec3 l=texture(uScene,center-vec2(texel.x,0)).rgb;vec3 r=texture(uScene,center+vec2(texel.x,0)).rgb;vec3 u=texture(uScene,center+vec2(0,texel.y)).rgb;vec3 d=texture(uScene,center-vec2(0,texel.y)).rgb;vec3 scene=c*.68+(l+r+u+d)*.08;float lum=luma(scene);float outline=abs(luma(l)-luma(r))+abs(luma(u)-luma(d));float density=clamp(.025+lum*1.16+outline*.92,0.0,.999);float index=floor(density*uGlyphCount);float glyph=texture(uGlyphs,vec2((index+local.x)/uGlyphCount,local.y)).r;float peak=max(scene.r,max(scene.g,scene.b));vec3 hue=peak>.001?scene/peak:vec3(.55,.62,.66);vec3 ink=hue*(.45+lum*2.2+outline*.75)+scene*.62;float scan=.94+.06*sin(vUv.y*uGrid.y*6.283);vec3 finalColor=scene*.055+ink*glyph*scan;finalColor+=vec3(.9,.02,.025)*uCrash*step(.89,hash(cell.x+cell.y*19.0+floor(uTime*35.0)))*.55;outColor=vec4(finalColor,1);}`;

    var sceneProgram = createProgram(gl, sceneVertex, sceneFragment);
    var postProgram = createProgram(gl, postVertex, postFragment);
    var mesh = createCubeMesh(gl), glyphs = createGlyphTexture(gl);
    var instanceBuffer = gl.createBuffer(), quadBuffer = gl.createBuffer();
    var sceneVao = gl.createVertexArray(), postVao = gl.createVertexArray();
    var projection = new Float32Array(16), view = new Float32Array(16);
    var framebuffer = gl.createFramebuffer(), frameTexture = gl.createTexture(), frameDepth = gl.createRenderbuffer();
    var frameWidth = 0, frameHeight = 0, cssWidth = 1, cssHeight = 1;

    gl.bindVertexArray(sceneVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertex);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    var stride = 13 * 4;
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,3,gl.FLOAT,false,stride,0); gl.vertexAttribDivisor(2,1);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3,3,gl.FLOAT,false,stride,12); gl.vertexAttribDivisor(3,1);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4,3,gl.FLOAT,false,stride,24); gl.vertexAttribDivisor(4,1);
    gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5,3,gl.FLOAT,false,stride,36); gl.vertexAttribDivisor(5,1);
    gl.enableVertexAttribArray(6); gl.vertexAttribPointer(6,1,gl.FLOAT,false,stride,48); gl.vertexAttribDivisor(6,1);
    gl.bindVertexArray(postVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.bindVertexArray(null);

    var sceneLoc = {
      projection: gl.getUniformLocation(sceneProgram,"uProjection"), view: gl.getUniformLocation(sceneProgram,"uView"),
      camera: gl.getUniformLocation(sceneProgram,"uCamera"), sun: gl.getUniformLocation(sceneProgram,"uSunDirection"),
      fog: gl.getUniformLocation(sceneProgram,"uFogColor"), daylight: gl.getUniformLocation(sceneProgram,"uDaylight"), time: gl.getUniformLocation(sceneProgram,"uTime")
    };
    var postLoc = {
      scene: gl.getUniformLocation(postProgram,"uScene"), glyphs: gl.getUniformLocation(postProgram,"uGlyphs"), grid: gl.getUniformLocation(postProgram,"uGrid"),
      glyphCount: gl.getUniformLocation(postProgram,"uGlyphCount"), time: gl.getUniformLocation(postProgram,"uTime"), speed: gl.getUniformLocation(postProgram,"uSpeed"), crash: gl.getUniformLocation(postProgram,"uCrash")
    };

    function resize() {
      var rect = targetCanvas.getBoundingClientRect(); cssWidth = Math.max(1,rect.width); cssHeight = Math.max(1,rect.height);
      var dpr = Math.min(window.devicePixelRatio || 1,1.5), width = Math.max(2,Math.round(cssWidth*dpr)), height = Math.max(2,Math.round(cssHeight*dpr));
      if (targetCanvas.width !== width || targetCanvas.height !== height) { targetCanvas.width=width; targetCanvas.height=height; }
    }

    function ensureFrame(width,height) {
      if (width===frameWidth && height===frameHeight) return; frameWidth=width; frameHeight=height;
      gl.bindTexture(gl.TEXTURE_2D,frameTexture); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.bindRenderbuffer(gl.RENDERBUFFER,frameDepth); gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,width,height);
      gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,frameTexture,0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,frameDepth);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw new Error("ASCII 帧缓冲初始化失败"); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }

    function render(objects,camera,time,quality,environment) {
      resize();
      var columns = Math.max(216,Math.min(quality.columns,Math.floor(cssWidth/(7/ASCII_SCALE))));
      var rows = Math.max(102,Math.round(columns*(cssHeight/cssWidth)/1.55));
      targetCanvas.dataset.asciiGrid=columns+"x"+rows; ensureFrame(columns,rows);
      var eye=[camera.eye.x-renderOrigin.x,camera.eye.y,camera.eye.z-renderOrigin.z];
      var center=[camera.center.x-renderOrigin.x,camera.center.y,camera.center.z-renderOrigin.z];
      mat4Perspective(projection,Math.PI*.34,targetCanvas.width/Math.max(1,targetCanvas.height),.3,2450);
      mat4LookAt(view,eye,center,[0,1,0]);
      var packed=[]; var forward=camera.forward;
      for(var i=0;i<objects.length;i+=1){var o=objects[i],dx=o.x-camera.eye.x,dy=o.y-camera.eye.y,dz=o.z-camera.eye.z,dist=Math.hypot(dx,dy,dz);if(dist>2380)continue;if(dist>380&&(dx*forward.x+dy*forward.y+dz*forward.z)/dist<-.58)continue;packed.push(o.x-renderOrigin.x,o.y,o.z-renderOrigin.z,o.sx,o.sy,o.sz,o.color[0],o.color[1],o.color[2],o.rx||0,o.ry||0,o.rz||0,o.emission||0);}
      var instanceData=new Float32Array(packed); gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer); gl.bufferData(gl.ARRAY_BUFFER,instanceData,gl.DYNAMIC_DRAW);
      gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer); gl.viewport(0,0,columns,rows); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
      gl.clearColor(environment.fog[0],environment.fog[1],environment.fog[2],1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(sceneProgram); gl.bindVertexArray(sceneVao); gl.uniformMatrix4fv(sceneLoc.projection,false,projection); gl.uniformMatrix4fv(sceneLoc.view,false,view); gl.uniform3fv(sceneLoc.camera,eye); gl.uniform3fv(sceneLoc.sun,environment.sun); gl.uniform3fv(sceneLoc.fog,environment.fog); gl.uniform1f(sceneLoc.daylight,environment.daylight); gl.uniform1f(sceneLoc.time,time); gl.drawElementsInstanced(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0,packed.length/13);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,targetCanvas.width,targetCanvas.height); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(postProgram); gl.bindVertexArray(postVao); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,frameTexture); gl.uniform1i(postLoc.scene,0); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,glyphs.texture); gl.uniform1i(postLoc.glyphs,1); gl.uniform2f(postLoc.grid,columns,rows); gl.uniform1f(postLoc.glyphCount,glyphs.count); gl.uniform1f(postLoc.time,time); gl.uniform1f(postLoc.speed,clamp(environment.speed/210,0,1)); gl.uniform1f(postLoc.crash,environment.crash); gl.drawArrays(gl.TRIANGLE_STRIP,0,4); gl.bindVertexArray(null);
      targetCanvas.dataset.instances=String(packed.length/13);
    }

    function dispose(){gl.deleteBuffer(mesh.vertex);gl.deleteBuffer(mesh.index);gl.deleteBuffer(instanceBuffer);gl.deleteBuffer(quadBuffer);gl.deleteTexture(glyphs.texture);gl.deleteTexture(frameTexture);gl.deleteRenderbuffer(frameDepth);gl.deleteFramebuffer(framebuffer);gl.deleteVertexArray(sceneVao);gl.deleteVertexArray(postVao);gl.deleteProgram(sceneProgram);gl.deleteProgram(postProgram);}
    return {render:render,resize:resize,dispose:dispose,gl:gl};
  }

  function addBox(list,x,y,z,sx,sy,sz,color,options){options=options||{};list.push({x:x,y:y,z:z,sx:sx,sy:sy,sz:sz,color:color,rx:options.rx||0,ry:options.ry||0,rz:options.rz||0,emission:options.emission||0});}
  function addCollider(list,x,y,z,hx,hy,hz,tag){list.push({x:x,y:y,z:z,hx:hx,hy:hy,hz:hz,tag:tag||"structure"});}
  function addRing(list,x,y,z,radius,color,vertical,phase,emission){var segments=24;for(var i=0;i<segments;i+=1){var a=phase+i/segments*TAU;if(vertical)addBox(list,x+Math.cos(a)*radius,y+Math.sin(a)*radius,z,4.8,1.1,1.1,color,{rz:a+Math.PI/2,emission:emission});else addBox(list,x+Math.cos(a)*radius,y,z+Math.sin(a)*radius,4.8,1.1,1.1,color,{ry:-a,emission:emission});}}

  function addTree(list,x,z,variant,scale){scale=scale||1;var greens=[[.05,.31,.15],[.08,.42,.21],[.16,.48,.23],[.08,.36,.30],[.25,.48,.18]];addBox(list,x,2.1*scale,z,.65*scale,4.2*scale,.65*scale,COLORS.trunk);var c=greens[variant%greens.length];if(variant%2)addBox(list,x,5.0*scale,z,3.0*scale,3.4*scale,3.0*scale,c,{ry:.5});else{addBox(list,x,4.4*scale,z,3.8*scale,2.3*scale,3.8*scale,c,{ry:.3});addBox(list,x,6.0*scale,z,2.6*scale,2.0*scale,2.6*scale,scaleColor(c,1.12),{ry:-.4});}}

  function addTower(list,colliders,x,z,height,width,variant,palette,detail){var style=variant%6, tier=Math.floor(variant/6);var glass=mixColor(palette.glass,palette.stone,.15+tier*.12);var rotation=(variant%4)*Math.PI*.125;if(detail===0){addBox(list,x,height*.5,z,width,height,width,glass,{ry:rotation});return;}
    if(style===0){addBox(list,x,height*.46,z,width,height*.92,width,glass,{ry:rotation});addBox(list,x,height*.94,z,width*.58,height*.12,width*.58,palette.light,{ry:rotation,emission:.42});addBox(list,x,height+10,z,1.3,20,1.3,palette.accent,{emission:.8});}
    else if(style===1){addBox(list,x,height*.25,z,width,height*.5,width,palette.stone,{ry:rotation});addBox(list,x,height*.61,z,width*.76,height*.34,width*.76,glass,{ry:rotation});addBox(list,x,height*.87,z,width*.50,height*.18,width*.50,palette.light,{ry:rotation,emission:.3});}
    else if(style===2){addBox(list,x-width*.25,height*.48,z,width*.42,height*.96,width*.68,glass,{ry:rotation});addBox(list,x+width*.25,height*.42,z,width*.42,height*.84,width*.68,scaleColor(glass,.82),{ry:rotation});addBox(list,x,height*.68,z,width*.62,4,width*.36,palette.accent,{ry:rotation,emission:.48});}
    else if(style===3){addBox(list,x,height*.46,z,width*.78,height*.92,width*.78,glass,{ry:rotation});for(var level=1;level<4;level+=1)addBox(list,x,height*level*.22,z,width*(1-level*.08),3.2,width*(1-level*.08),COLORS.grassLight,{ry:rotation,emission:.08});}
    else if(style===4){addBox(list,x,height*.5,z,width*.70,height,width,glass,{ry:rotation});addBox(list,x,height*.54,z,width*.76,height*.028,width*1.04,palette.light,{ry:rotation,emission:.58});addBox(list,x,height*.82,z,width*.76,height*.025,width*1.04,palette.accent,{ry:rotation,emission:.46});}
    else{addBox(list,x,height*.45,z,width,height*.90,width,glass,{ry:rotation});addBox(list,x,height*.91,z,width*1.16,height*.07,width*1.16,palette.stone,{ry:rotation});addBox(list,x,height*.99,z,width*.62,height*.10,width*.62,palette.light,{ry:rotation,emission:.5});}
    addCollider(colliders,x,height*.48,z,width*.52,height*.52,width*.52,"tower");
  }

  function addTowerCluster(desc,list,colliders,x,z,detail,lotIndex){var layout=CLUSTER_LAYOUTS[(desc.clusterVariant+lotIndex)%CLUSTER_LAYOUTS.length];var rng=Core.createRng(world.seedHash,desc.chunkX*7+lotIndex,desc.chunkZ,233);for(var i=0;i<layout.length;i+=1){var item=layout[i];var h=(76+desc.density*150+rng()*56)*item[2];var w=22+rng()*22;addTower(list,colliders,x+item[0],z+item[1],h,w,(desc.towerVariant+i*5)%24,desc.palette,detail);}}

  function addVilla(desc,list,colliders,x,z,variant,detail){var tone=mixColor(desc.palette.stone,[.85,.78,.66],.45);var angle=(variant%4)*Math.PI*.5;var width=24+(variant%3)*4;addBox(list,x,4.2,z,width,8.4,17,tone,{ry:angle});addBox(list,x,9.2,z,width*.78,2.0,18,scaleColor(tone,.62),{ry:angle,rz:variant%2?.16:-.16});if(detail>0){addBox(list,x+Math.cos(angle)*8,4.8,z-Math.sin(angle)*8,7,4,1.2,desc.palette.glass,{ry:angle,emission:.12});addTree(list,x-15,z+11,variant,0.7);if(variant%3===0)addBox(list,x+15,.25,z+10,9,.35,6,COLORS.water,{emission:.08});}addCollider(colliders,x,4.5,z,width*.52,5,10,"villa");}

  function addCommercial(desc,list,colliders,x,z,variant,detail){var w=42+(variant%3)*9,h=18+(variant%5)*8,d=38+((variant+1)%3)*8;addBox(list,x,h*.5,z,w,h,d,mixColor(desc.palette.stone,desc.palette.glass,.35),{ry:(variant%2)*.12});addBox(list,x,h*.72,z+d*.51,w*.74,3,1.0,variant%2?desc.palette.accent:desc.palette.light,{emission:.62});if(detail>0){for(var i=-1;i<=1;i+=1)addBox(list,x+i*w*.24,5,z-d*.51,2.0,8,1.0,desc.palette.light,{emission:.35});}addCollider(colliders,x,h*.5,z,w*.52,h*.52,d*.52,"commercial");}

  function addPark(desc,list,x,z,variant,detail){if(variant===0)addBox(list,x,.15,z,72,.25,48,COLORS.water,{emission:.07});else if(variant===1)addBox(list,x,.12,z,54,.20,54,[.42,.44,.38]);else if(variant===2){addBox(list,x,1.2,z,56,2.4,7,desc.palette.stone);addBox(list,x,3.0,z,10,3.6,10,desc.palette.accent,{emission:.18});}var count=detail>0?12:5;for(var i=0;i<count;i+=1){var rng=Core.createRng(world.seedHash,desc.chunkX*19+i,desc.chunkZ*17+variant,311);addTree(list,x-62+rng()*124,z-57+rng()*114,(variant+i)%5,.65+rng()*.45);}}

  function addRoads(desc,list){var cx=desc.chunkX*320+160,cz=desc.chunkZ*320+160;var ns=desc.roads.mainNS?30:18,ew=desc.roads.mainEW?30:18;addBox(list,cx,-.4,cz,ns,.7,320,COLORS.road);addBox(list,cx,-.35,cz,320,.72,ew,COLORS.road);if(desc.roadVariant%2===0){addBox(list,cx,.05,cz,1.2,.1,320,COLORS.lane,{emission:.06});addBox(list,cx,.06,cz,320,.1,1.2,COLORS.lane,{emission:.06});}}

  function addTrafficLights(desc,list){var cx=desc.chunkX*320+160,cz=desc.chunkZ*320+160;var phase=(Math.floor(performance.now()/2600)+desc.chunkX+desc.chunkZ)&1;var color=phase?COLORS.green:COLORS.red;var positions=[[-19,-19],[19,-19],[-19,19],[19,19]];for(var i=0;i<positions.length;i+=1){addBox(list,cx+positions[i][0],3.5,cz+positions[i][1],.6,7,.6,COLORS.dark);addBox(list,cx+positions[i][0],7.0,cz+positions[i][1],1.3,1.3,1.3,color,{emission:.85});}}

  function addRail(desc,list,colliders,detail){var cx=desc.chunkX*320+160,cz=desc.chunkZ*320+160;if(desc.rail.eastWest){addBox(list,cx,15,cz+46,320,3.2,13,COLORS.rail);addBox(list,cx,17,cz+42,320,.7,.8,COLORS.white);addBox(list,cx,17,cz+50,320,.7,.8,COLORS.white);if(detail>0)for(var x=-140;x<=140;x+=40)addBox(list,cx+x,7.5,cz+46,2,15,2,COLORS.dark);addCollider(colliders,cx,15,cz+46,160,2.2,7,"rail");}if(desc.rail.northSouth){addBox(list,cx+46,15,cz,13,3.2,320,COLORS.rail);addBox(list,cx+42,17,cz,.8,.7,320,COLORS.white);addBox(list,cx+50,17,cz,.8,.7,320,COLORS.white);if(detail>0)for(var z=-140;z<=140;z+=40)addBox(list,cx+46,7.5,cz+z,2,15,2,COLORS.dark);addCollider(colliders,cx+46,15,cz,7,2.2,160,"rail");}}

  function addInterchange(desc,list,colliders){var cx=desc.chunkX*320+160,cz=desc.chunkZ*320+160;var variant=desc.interchangeVariant;addBox(list,cx,17,cz,22,2.6,320,scaleColor(COLORS.roadEdge,.8),{ry:variant===1?.05:0});for(var z=-130;z<=130;z+=52)addBox(list,cx,8,cz+z,3,16,3,COLORS.rail);if(variant>=2){for(var i=0;i<18;i+=1){var a=i/18*TAU;addBox(list,cx+Math.cos(a)*54,24,cz+Math.sin(a)*54,21,2.3,10,COLORS.roadEdge,{ry:-a});}}addCollider(colliders,cx,17,cz,12,2,160,"interchange");}

  function addAirport(desc,list,colliders,detail){var cx=desc.chunkX*320+160,cz=desc.chunkZ*320+160;addBox(list,cx,-.2,cz,320,.6,320,[.10,.13,.15]);var horizontal=desc.airport.side%2===0;if(horizontal){addBox(list,cx,.2,cz,horizontal?320:42,.25,horizontal?42:320,[.19,.22,.23]);for(var x=-140;x<=140;x+=34)addBox(list,cx+x,.42,cz,15,.12,1.4,COLORS.white,{emission:.08});}else{addBox(list,cx,.2,cz,42,.25,320,[.19,.22,.23]);for(var z=-140;z<=140;z+=34)addBox(list,cx,.42,cz+z,1.4,.12,15,COLORS.white,{emission:.08});}if(desc.localX===desc.airport.startX&&desc.localZ===desc.airport.startZ){addBox(list,cx,18,cz+(horizontal?92:0),horizontal?150:72,36,horizontal?72:150,desc.palette.stone);addBox(list,cx,28,cz+(horizontal?53:0),horizontal?120:62,12,horizontal?8:120,desc.palette.glass,{emission:.18});addCollider(colliders,cx,18,cz+(horizontal?92:0),horizontal?76:38,19,horizontal?38:76,"terminal");}}

  function addAmusement(desc,list,colliders,time){var cx=desc.chunkX*320+160,cz=desc.chunkZ*320+160;var lx=desc.localX-desc.amusement.startX,lz=desc.localZ-desc.amusement.startZ;addBox(list,cx,-.25,cz,320,.5,320,[.12,.28,.20]);if(lx===0&&lz===0){addRing(list,cx-48,72,cz,52,COLORS.magenta,true,time*.18,0.5);addBox(list,cx-48,38,cz,3,76,3,COLORS.white);addCollider(colliders,cx-48,45,cz,56,55,5,"ferris-wheel");addBox(list,cx+64,48,cz,9,96,9,COLORS.amber,{emission:.42});for(var i=0;i<5;i+=1)addBox(list,cx+64,15+i*17,cz,22-i*2,2.2,22-i*2,COLORS.cyan,{ry:time*(.3+i*.04),emission:.38});}else if(lx===1&&lz===0){for(var s=0;s<26;s+=1){var px=-130+s*10,py=24+Math.sin(s*.58)*19,pz=Math.sin(s*.25)*70;addBox(list,cx+px,py,cz+pz,12,2.2,3.2,s%2?COLORS.cyan:COLORS.amber,{ry:Math.sin(s*.25)*.35,rz:Math.cos(s*.58)*.55,emission:.25});}addCollider(colliders,cx,35,cz,150,32,78,"coaster");}else if(lx===0&&lz===1){addBox(list,cx-60,12,cz,5,24,5,COLORS.white);for(var arm=0;arm<8;arm+=1){var a=time*.65+arm/8*TAU;addBox(list,cx-60+Math.cos(a)*28,25,cz+Math.sin(a)*28,26,2,3,COLORS.magenta,{ry:-a,emission:.35});}addBox(list,cx+65,10,cz,5,20,5,COLORS.amber);addBox(list,cx+65,23+Math.sin(time)*12,cz,26,5,26,COLORS.cyan,{emission:.4});}else{addBox(list,cx,36,cz,8,72,8,COLORS.white);addRing(list,cx,73,cz,34,COLORS.cyan,false,time*.3,.38);addCollider(colliders,cx,40,cz,40,42,40,"sky-ride");}}

  function addLandmark(desc,list,colliders){var cx=desc.chunkX*320+160,cz=desc.chunkZ*320+160;var v=desc.city.landmarkVariant,p=desc.palette;if(v===0){addTower(list,colliders,cx,cz,330,54,0,p,2);addRing(list,cx,270,cz,54,p.accent,false,0,.62);}else if(v===1){addTower(list,colliders,cx-44,cz,285,42,2,p,2);addTower(list,colliders,cx+44,cz,285,42,8,p,2);addBox(list,cx,210,cz,92,9,18,p.accent,{emission:.55});}else if(v===2){addBox(list,cx,108,cz,34,216,34,p.glass,{ry:.78});addBox(list,cx,232,cz,13,72,13,p.light,{ry:.78,emission:.5});addCollider(colliders,cx,125,cz,28,145,28,"landmark");}else if(v===3){for(var i=0;i<7;i+=1)addBox(list,cx,24+i*34,cz,92-i*10,26,92-i*10,i%2?p.glass:COLORS.grassLight,{ry:i*.16,emission:i%2?.12:.02});addCollider(colliders,cx,130,cz,50,130,50,"landmark");}else if(v===4){addRing(list,cx,142,cz,105,p.accent,true,.1,.5);addBox(list,cx-105,72,cz,10,144,10,p.stone);addBox(list,cx+105,72,cz,10,144,10,p.stone);addCollider(colliders,cx,142,cz,116,112,12,"landmark");}else if(v===5){for(var t=0;t<9;t+=1)addBox(list,cx+Math.sin(t*.7)*24,18+t*31,cz+Math.cos(t*.7)*24,52-t*2,27,52-t*2,t%2?p.glass:p.stone,{ry:t*.24});addCollider(colliders,cx,145,cz,48,145,48,"landmark");}else if(v===6){addBox(list,cx,35,cz,166,70,42,p.stone);addBox(list,cx,122,cz,42,174,42,p.glass,{emission:.12});addRing(list,cx,225,cz,38,p.light,false,0,.6);addCollider(colliders,cx,130,cz,85,130,30,"landmark");}else{for(var petal=0;petal<5;petal+=1){var a=petal/5*TAU;addTower(list,colliders,cx+Math.cos(a)*48,cz+Math.sin(a)*48,210+petal*12,30,petal+3,p,2);}addBox(list,cx,178,cz,118,8,118,p.accent,{ry:.78,emission:.5});}}

  function addPeopleAndPets(desc,list,time){var cx=desc.chunkX*320+160,cz=desc.chunkZ*320+160;var count=Math.max(3,Math.round(desc.traffic*8));for(var i=0;i<count;i+=1){var rng=Core.createRng(world.seedHash,desc.chunkX*31+i,desc.chunkZ*29,601);var side=i%2?1:-1;var along=((time*(1.1+rng())*side+rng()*300)%300+300)%300-150;var x=i%2?cx+along:cx+24*side;var z=i%2?cz+24*side:cz+along;var shirt=i%3===0?desc.palette.accent:i%3===1?desc.palette.light:[.72,.62,.48];addBox(list,x,1.45,z,.7,2.9,.7,shirt);addBox(list,x,3.25,z,.72,.72,.72,[.78,.62,.50]);if(i%4===0){addBox(list,x+2.2,0.65,z+1.0,1.6,1.0,.8,i%8? [.48,.30,.16]:[.12,.12,.13]);addBox(list,x+3.0,1.0,z+1.0,.7,.7,.7,[.34,.20,.11]);}}
  }

  function addRideMotion(desc,list,time){if(desc.special!=="amusement")return;var cx=desc.chunkX*320+160,cz=desc.chunkZ*320+160,lx=desc.localX-desc.amusement.startX,lz=desc.localZ-desc.amusement.startZ;if(lx===0&&lz===0){for(var seat=0;seat<12;seat+=1){var a=time*.18+seat/12*TAU;addBox(list,cx-48+Math.cos(a)*52,72+Math.sin(a)*52,cz,4.6,3.0,3.4,seat%2?COLORS.cyan:COLORS.magenta,{emission:.72});}}else if(lx===1&&lz===0){var progress=(time*.72)%25;var px=-130+progress*10,py=24+Math.sin(progress*.58)*19,pz=Math.sin(progress*.25)*70;addBox(list,cx+px,py+2,cz+pz,13,3.6,5.0,COLORS.amber,{ry:Math.sin(progress*.25)*.35,rz:Math.cos(progress*.58)*.55,emission:.72});}else if(lx===0&&lz===1){for(var cabin=0;cabin<8;cabin+=1){var spin=time*.65+cabin/8*TAU;addBox(list,cx-60+Math.cos(spin)*28,25,cz+Math.sin(spin)*28,4.5,3.2,4.5,cabin%2?COLORS.cyan:COLORS.magenta,{emission:.6});}var swing=Math.sin(time*.9)*.72;addBox(list,cx+62,34,cz+62,5,42,5,COLORS.white,{rz:swing});addBox(list,cx+62+Math.sin(swing)*20,13+Math.cos(swing)*20,cz+62,24,5,8,COLORS.amber,{rz:swing,emission:.45});}else{var lift=44+(Math.sin(time*.55)*.5+.5)*58;addBox(list,cx,lift,cz,42,4,42,COLORS.cyan,{ry:time*.24,emission:.58});}}

  function addChunk(desc,detail,objects,colliders,time){var cx=desc.chunkX*320+160,cz=desc.chunkZ*320+160;var ground=desc.district.id==="park"||desc.district.id==="greenbelt"||desc.district.id==="villa"?mixColor(COLORS.grass,COLORS.grassLight,desc.greenery*.35):[.10,.13,.15];addBox(objects,cx,-1.1,cz,320,1.8,320,ground);
    if(desc.special==="airport"){addAirport(desc,objects,colliders,detail);return;}addRoads(desc,objects);if(detail>0&&(desc.roads.mainNS||desc.roads.mainEW))addTrafficLights(desc,objects);if(desc.rail.eastWest||desc.rail.northSouth)addRail(desc,objects,colliders,detail);if(desc.special==="amusement"){addAmusement(desc,objects,colliders,time);return;}if(desc.special==="landmark"){addLandmark(desc,objects,colliders);return;}if(desc.district.id==="transit"&&desc.roads.mainNS&&desc.roads.mainEW)addInterchange(desc,objects,colliders);
    var lots=[[-82,-82],[82,-82],[-82,82],[82,82]];for(var i=0;i<lots.length;i+=1){var x=cx+lots[i][0],z=cz+lots[i][1];if(desc.district.id==="park"||desc.district.id==="greenbelt")addPark(desc,objects,x,z,(desc.parkVariant+i)%6,detail);else if(desc.district.id==="villa")addVilla(desc,objects,colliders,x,z,(desc.villaVariant+i)%12,detail);else if(desc.district.id==="commercial"||desc.district.id==="mixed"||desc.district.id==="transit"){if(i%2===0)addCommercial(desc,objects,colliders,x,z,(desc.commercialVariant+i)%10,detail);else addTowerCluster(desc,objects,colliders,x,z,detail,i);}else if(desc.district.id==="eco"){if(i%2)addPark(desc,objects,x,z,(desc.parkVariant+i)%6,detail);else addTowerCluster(desc,objects,colliders,x,z,detail,i);}else addTowerCluster(desc,objects,colliders,x,z,detail,i);}
  }

  function addVehicles(desc,list,time){var cx=desc.chunkX*320+160,cz=desc.chunkZ*320+160;var count=Math.max(2,Math.round(desc.traffic*7));for(var i=0;i<count;i+=1){var hash=Core.hash2D(world.seedHash,desc.chunkX*13+i,desc.chunkZ,721);var type=hash%4;var speed=13+(hash%17);var along=((time*speed+(hash>>>5)%320)%320)-160;var lane=(i%2?1:-1)*(desc.roads.mainEW?7:4.5);var color=type===0?desc.palette.accent:type===1?COLORS.cyan:type===2?[.92,.82,.30]:[.72,.78,.82];if(i%2)addBox(list,cx+along,1.25,cz+lane,type===3?11:5.8,type===3?3.6:2.2,type===3?3.2:2.8,color,{emission:.08});else addBox(list,cx+lane,1.25,cz+along,type===3?3.2:2.8,type===3?3.6:2.2,type===3?11:5.8,color,{emission:.08});}}

  function addTrain(desc,list,time){var cx=desc.chunkX*320+160,cz=desc.chunkZ*320+160;if(desc.rail.eastWest){var lead=((time*92+world.seedHash%2100)%2240)-960;for(var i=0;i<7;i+=1){var x=lead-i*31;if(x>=-180&&x<=500)addBox(list,cx+x-160,20.5,cz+46,27,6.5,7.5,i===0?COLORS.cyan:COLORS.white,{emission:i===0?.45:.06});}}if(desc.rail.northSouth){var leadZ=((time*96+(world.seedHash>>>6)%1900)%2240)-960;for(var j=0;j<7;j+=1){var z=leadZ-j*31;if(z>=-180&&z<=500)addBox(list,cx+46,20.5,cz+z-160,7.5,6.5,27,j===0?COLORS.magenta:COLORS.white,{emission:j===0?.45:.06});}}}

  function addPlane(desc,list,time){if(desc.special!=="airport"||desc.localX!==desc.airport.startX||desc.localZ!==desc.airport.startZ)return;var cx=desc.chunkX*320+160,cz=desc.chunkZ*320+160;var travel=((time*74+world.seedHash%900)%1800)-900;var horizontal=desc.airport.side%2===0;var x=horizontal?cx+travel:cx+40,z=horizontal?cz:cz+travel,y=58+Math.abs(travel)*.12;addBox(list,x,y,z,horizontal?25:5.5,5.2,horizontal?5.5:25,COLORS.white,{ry:horizontal?Math.PI/2:0});addBox(list,x,y,z,horizontal?7:34,1.0,horizontal?34:7,desc.palette.accent,{ry:horizontal?Math.PI/2:0});addBox(list,x,y,z,horizontal?6:2.5,2.5,horizontal?2.5:6,COLORS.cyan,{emission:.7});}

  function buildDynamicColliders(time){var list=[];if(!staticWorld)return list;for(var index=0;index<staticWorld.descriptors.length;index+=1){var desc=staticWorld.descriptors[index];if(Math.max(Math.abs(desc.chunkX-staticWorld.centerX),Math.abs(desc.chunkZ-staticWorld.centerZ))>1)continue;var cx=desc.chunkX*320+160,cz=desc.chunkZ*320+160,count=Math.max(2,Math.round(desc.traffic*7));for(var i=0;i<count;i+=1){var hash=Core.hash2D(world.seedHash,desc.chunkX*13+i,desc.chunkZ,721),type=hash%4,speed=13+(hash%17),along=((time*speed+(hash>>>5)%320)%320)-160,lane=(i%2?1:-1)*(desc.roads.mainEW?7:4.5);if(i%2)addCollider(list,cx+along,1.25,cz+lane,type===3?5.8:3.1,type===3?2.0:1.4,type===3?2.0:1.6,"道路车辆");else addCollider(list,cx+lane,1.25,cz+along,type===3?2.0:1.6,type===3?2.0:1.4,type===3?5.8:3.1,"道路车辆");}
      if(desc.rail.eastWest){var trainX=((time*92+world.seedHash%2100)%2240)-960;for(var car=0;car<7;car+=1){var localX=trainX-car*31;if(localX>=-180&&localX<=500)addCollider(list,cx+localX-160,20.5,cz+46,14,3.6,4.2,"高铁");}}
      if(desc.rail.northSouth){var trainZ=((time*96+(world.seedHash>>>6)%1900)%2240)-960;for(var railCar=0;railCar<7;railCar+=1){var localZ=trainZ-railCar*31;if(localZ>=-180&&localZ<=500)addCollider(list,cx+46,20.5,cz+localZ-160,4.2,3.6,14,"高铁");}}
      if(desc.special==="airport"&&desc.localX===desc.airport.startX&&desc.localZ===desc.airport.startZ){var travel=((time*74+world.seedHash%900)%1800)-900,horizontal=desc.airport.side%2===0,planeX=horizontal?cx+travel:cx+40,planeZ=horizontal?cz:cz+travel,planeY=58+Math.abs(travel)*.12;addCollider(list,planeX,planeY,planeZ,horizontal?18:4,horizontal?4:4,horizontal?4:18,"客机");}}
    return list;}

  function distanceToCollider(point,box){var dx=Math.max(Math.abs(point.x-box.x)-box.hx,0),dy=Math.max(Math.abs(point.y-box.y)-box.hy,0),dz=Math.max(Math.abs(point.z-box.z)-box.hz,0);return Math.hypot(dx,dy,dz);}

  function addShuttle(list,time){
    if(cameraMode!=="third"||!flight)return;
    var p=flight.position;
    var rotation={x:flight.pitch,y:flight.yaw,z:-flight.roll};
    function addPart(offset,sx,sy,sz,color,options){
      var worldOffset=Core.rotateModelVector(offset,rotation);
      addBox(list,p.x+worldOffset.x,p.y+worldOffset.y,p.z+worldOffset.z,sx,sy,sz,color,Object.assign({rx:rotation.x,ry:rotation.y,rz:rotation.z},options||{}));
    }
    addPart({x:0,y:0,z:0},3.5,1.55,7.4,COLORS.shuttle);
    addPart({x:0,y:.34,z:-.8},2.3,1.05,3.2,COLORS.glass,{emission:.12});
    addPart({x:0,y:0,z:.8},9.2,.42,2.8,scaleColor(COLORS.shuttle,.82));
    addPart({x:0,y:0,z:3.9},1.8,.85,.8,COLORS.engine,{emission:.95});
    for(var i=1;i<=4;i+=1){
      var spread=i*2.7;
      addPart({x:0,y:0,z:5+spread},1.0+i*.35,.42+i*.10,2.1,COLORS.engine,{emission:.9-i*.12});
    }
  }

  function rebuildStaticWorld(time){if(!flight||!world)return;var cx=Core.floorDiv(flight.position.x,320),cz=Core.floorDiv(flight.position.z,320);var key=cx+","+cz;if(staticWorld&&key===activeChunkKey)return;activeChunkKey=key;var objects=[],colliders=[],descriptors=[];for(var dz=-3;dz<=3;dz+=1){for(var dx=-3;dx<=3;dx+=1){var distance=Math.max(Math.abs(dx),Math.abs(dz));var detail=distance<=1?2:distance<=2?1:0;var desc=Core.describeChunk(world,cx+dx,cz+dz);descriptors.push(desc);addChunk(desc,detail,objects,colliders,time);}}staticWorld={objects:objects,colliders:colliders,descriptors:descriptors,centerX:cx,centerZ:cz};}

  function buildFrameObjects(time){var objects=staticWorld?staticWorld.objects.slice():[];if(staticWorld){for(var i=0;i<staticWorld.descriptors.length;i+=1){var d=staticWorld.descriptors[i];if(Math.max(Math.abs(d.chunkX-staticWorld.centerX),Math.abs(d.chunkZ-staticWorld.centerZ))<=1){addVehicles(d,objects,time);addTrain(d,objects,time);addPlane(d,objects,time);addPeopleAndPets(d,objects,time);addRideMotion(d,objects,time);}}}if(missionOffer)addRing(objects,missionOffer.point.x,missionOffer.point.y,missionOffer.point.z,15,COLORS.amber,false,time*1.4,.9);if(flight&&flight.mission&&!flight.mission.failed){for(var cp=flight.mission.checkpointIndex;cp<Math.min(flight.mission.checkpoints.length,flight.mission.checkpointIndex+3);cp+=1){var point=flight.mission.checkpoints[cp];addRing(objects,point.x,point.y,point.z,point.radius,cp===flight.mission.checkpointIndex?COLORS.cyan:COLORS.magenta,false,time*(cp===flight.mission.checkpointIndex?1.5:.35),.85);}}addShuttle(objects,time);return objects;}

  function environmentAt(time){var phase=((flight?flight.elapsed:0)%960)/960*TAU;var sunHeight=.5+.5*Math.sin(phase+.35);var daylight=clamp(.12+sunHeight*1.05,.12,1);var fog=mixColor([.018,.028,.068],[.26,.56,.72],daylight);var sun=[Math.cos(phase)*.45,.35+daylight*.62,Math.sin(phase)*.45];var length=Math.hypot(sun[0],sun[1],sun[2]);sun=[sun[0]/length,sun[1]/length,sun[2]/length];return{daylight:daylight,fog:fog,sun:sun,speed:flight?flight.speed:0,crash:crashing?clamp(1-crashTimer/.8,0,1):0};}

  function cameraState(){var p=flight.position,forward=Core.forwardVector(flight.yaw,flight.pitch);if(cameraMode==="first")return{eye:{x:p.x+forward.x*3.2,y:p.y+forward.y*3.2+.7,z:p.z+forward.z*3.2},center:{x:p.x+forward.x*120,y:p.y+forward.y*120,z:p.z+forward.z*120},forward:forward};var distance=27+flight.speed*.04;return{eye:{x:p.x-forward.x*distance,y:p.y-forward.y*distance+10.5,z:p.z-forward.z*distance},center:{x:p.x+forward.x*58,y:p.y+forward.y*58-2.5,z:p.z+forward.z*58},forward:forward};}

  function hashParams(){return new URLSearchParams(location.hash.split("?")[1]||"");}
  function parseSeedFromHash(){var value=hashParams().get("seed");return value?Core.normalizeSeed(value):"";}
  function randomSeed(){var values=new Uint32Array(2);crypto.getRandomValues(values);return "SKY-"+values[0].toString(36).toUpperCase()+values[1].toString(36).toUpperCase().slice(0,4);}
  function updateSeedUrl(seed){var preview=(location.hostname==="localhost"||location.hostname==="127.0.0.1")?hashParams().get("preview"):"";var next="#/city-shuttle?seed="+encodeURIComponent(Core.normalizeSeed(seed))+(preview?"&preview="+encodeURIComponent(preview):"");history.replaceState(null,"",next);}
  function applyLocalPreview(){if(!flight||!world||(location.hostname!=="localhost"&&location.hostname!=="127.0.0.1"))return;var preview=hashParams().get("preview");if(!preview)return;var target=null;for(var z=0;z<24&&!target;z+=1)for(var x=0;x<24;x+=1){var desc=Core.describeChunk(world,x,z);if(desc.special===preview||desc.district.id===preview){target=desc;break;}}if(!target)return;flight.position={x:target.chunkX*320+160,y:preview==="landmark"?238:preview==="airport"?112:96,z:target.chunkZ*320+380};flight.yaw=0;flight.pitch=0;flight.checkpoint={x:flight.position.x,y:flight.position.y,z:flight.position.z,yaw:0};}

  function loadSettings(){try{var value=JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}");charMode=value.charMode==="large"?"large":"standard";cameraMode=value.cameraMode==="first"?"first":"third";if(els.sensitivity)els.sensitivity.value=String(clamp(Number(value.sensitivity)||1,0.5,1.8));var savedVolume=Number(value.volume);if(els.volume)els.volume.value=String(Number.isFinite(savedVolume)?clamp(savedVolume,0,1):.6);}catch(error){charMode="standard";cameraMode="third";}}
  function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify({charMode:charMode,cameraMode:cameraMode,sensitivity:els.sensitivity?Number(els.sensitivity.value):1,volume:els.volume?Number(els.volume.value):.6}));}catch(error){}}

  function createOffer(){if(!flight||flight.mission)return;var forward=Core.forwardVector(flight.yaw,0),desc=currentDescriptor(),typeId="ring-race";if(desc){if(desc.special==="airport"||desc.district.id==="airport")typeId="airport-wake";else if(desc.special==="amusement"||desc.district.id==="amusement")typeId="amusement-thread";else if(desc.special==="landmark")typeId="landmark-scan";else if(desc.rail.eastWest||desc.rail.northSouth)typeId="rail-shadow";else if(desc.district.id==="transit")typeId="interchange";else if(desc.district.id==="cbd"||desc.district.id==="commercial")typeId="tower-canyon";}if(offerSerial%4===3)typeId="ring-race";var type=Core.MISSION_CATALOG.filter(function(item){return item.id===typeId;})[0]||Core.MISSION_CATALOG[0];offerSerial+=1;missionOffer={type:type.id,label:type.label,point:{x:flight.position.x+forward.x*245,y:clamp(flight.position.y,52,210),z:flight.position.z+forward.z*245}};setText(els.objective,"飞入金色航线门 · "+type.label);}
  function refreshOffer(){if(!missionOffer||!flight)return;if(distance3(flight.position,missionOffer.point)>620)createOffer();}
  function startMission(){var mission=Core.createMission(world,missionOffer.type,flight.position,flight.yaw);var futureColliders=[];var checked=Object.create(null);for(var i=0;i<mission.checkpoints.length;i+=1){var point=mission.checkpoints[i],cx=Core.floorDiv(point.x,320),cz=Core.floorDiv(point.z,320);for(var dz=-1;dz<=1;dz+=1)for(var dx=-1;dx<=1;dx+=1){var key=(cx+dx)+","+(cz+dz);if(checked[key])continue;checked[key]=true;var trash=[];addChunk(Core.describeChunk(world,cx+dx,cz+dz),1,trash,futureColliders,flight.elapsed);}}
    for(var p=0;p<mission.checkpoints.length;p+=1){var cp=mission.checkpoints[p],raise=0;while(raise<7){var blocked=false;for(var c=0;c<futureColliders.length;c+=1){var box=futureColliders[c];if(Math.abs(cp.x-box.x)<box.hx+22&&Math.abs(cp.z-box.z)<box.hz+22&&Math.abs(cp.y-box.y)<box.hy+22){cp.y=Math.min(360,box.y+box.hy+28);blocked=true;break;}}if(!blocked)break;raise+=1;}}
    flight.mission=mission;missionOffer=null;showToast("航线开始 // "+mission.label,2.2);playCue("mission");}

  function updateMission(dt){if(!flight)return;if(!flight.mission){if(!missionOffer)createOffer();refreshOffer();if(missionOffer&&distance3(flight.position,missionOffer.point)<=18)startMission();return;}var before=flight.mission.checkpointIndex;flight.mission=Core.advanceMission(flight.mission,flight.position,dt);if(flight.mission.checkpointIndex>before){flight.combo=Math.min(Core.WORLD_CONFIG.maxCombo,flight.combo+.35);flight.comboClock=0;flight.totalScore+=Math.round(240*flight.combo);var reached=flight.mission.checkpoints[Math.max(0,flight.mission.checkpointIndex-1)];flight.checkpoint={x:reached.x,y:reached.y,z:reached.z,yaw:flight.yaw};showToast("CHECKPOINT "+flight.mission.checkpointIndex+" / "+flight.mission.checkpoints.length,1.1);playCue("checkpoint");}
    if(flight.mission.complete){var reward=Core.scoreMission(flight.mission,flight.combo);flight.totalScore+=reward;showToast("航线完成 +"+Core.formatNumber(reward),3);playCue("complete");flight.mission=null;setTimeout(function(){if(root&&!flight.mission)createOffer();},900);}else if(flight.mission.failed){showToast("航线超时 · 继续自由飞行",2.6);flight.mission=null;flight.combo=1;setTimeout(function(){if(root&&!flight.mission)createOffer();},900);}}

  function triggerCrash(reason){if(crashing||invulnerable>0)return;crashing=true;crashTimer=.8;running=false;flight.combo=1;showToast(reason||"撞击 // 航线重置",1.2);playCue("crash");if(document.pointerLockElement===canvas&&document.exitPointerLock)document.exitPointerLock();stage.dataset.crashing="true";}
  function finishCrash(){flight=Core.resolveCrash(flight);previousPosition={x:flight.position.x,y:flight.position.y,z:flight.position.z};crashing=false;stage.dataset.crashing="false";invulnerable=1.5;running=true;activeChunkKey="";rebuildStaticWorld(flight.elapsed);requestPointer();}

  function simulate(dt){if(!running||paused||crashing||!flight)return;invulnerable=Math.max(0,invulnerable-dt);var previous={x:flight.position.x,y:flight.position.y,z:flight.position.z};var sensitivity=els.sensitivity?Number(els.sensitivity.value):1;var input={turnX:clamp(steer.x+(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0),-1,1),turnY:clamp(steer.y+(keys.ArrowUp?1:0)-(keys.ArrowDown?1:0),-1,1),bank:(keys.KeyD?1:0)-(keys.KeyA?1:0),thrust:keys.KeyW,brake:keys.KeyS,boost:keys.ShiftLeft||keys.ShiftRight};flight=Core.stepFlight(flight,input,dt);steer.x*=Math.max(0,1-dt*3.2);steer.y*=Math.max(0,1-dt*3.2);if(flight.position.y>Core.WORLD_CONFIG.maxAltitude+35)flight.position.y=Core.WORLD_CONFIG.maxAltitude+35;
    rebuildStaticWorld(flight.elapsed);var collisionSet=staticWorld.colliders.concat(buildDynamicColliders(flight.elapsed));if(invulnerable<=0){if(flight.position.y<Core.WORLD_CONFIG.minAltitude){triggerCrash("撞击地面 // 航线重置");return;}var hit=Core.sweepSphere(previous,flight.position,Core.WORLD_CONFIG.shuttleRadius,collisionSet);if(hit){triggerCrash("撞击"+(hit.collider.tag||"建筑")+" // 航线重置");return;}}
    var stepScore=flight.speed*dt*(.05+.02*flight.combo),nearest=80;for(var nearby=0;nearby<collisionSet.length;nearby+=1){if(Math.abs(collisionSet[nearby].x-flight.position.x)>55||Math.abs(collisionSet[nearby].z-flight.position.z)>55)continue;nearest=Math.min(nearest,distanceToCollider(flight.position,collisionSet[nearby]));}if(nearest<24&&nearest>Core.WORLD_CONFIG.shuttleRadius){stepScore+=(24-nearest)*dt*8*flight.combo;flight.comboClock=0;}if(Math.abs(flight.roll)>.58&&flight.speed>108){stepScore+=dt*95*flight.combo;flight.comboClock=0;}flight.totalScore+=stepScore;updateMission(dt);updateHud();updateAudio();if(Math.hypot(flight.position.x-renderOrigin.x,flight.position.z-renderOrigin.z)>Core.WORLD_CONFIG.floatingOriginDistance){renderOrigin.x=Math.floor(flight.position.x/Core.WORLD_CONFIG.floatingOriginDistance)*Core.WORLD_CONFIG.floatingOriginDistance;renderOrigin.z=Math.floor(flight.position.z/Core.WORLD_CONFIG.floatingOriginDistance)*Core.WORLD_CONFIG.floatingOriginDistance;}}

  function render(time){if(!renderer||!flight)return;rebuildStaticWorld(time);renderer.render(buildFrameObjects(time),cameraState(),time,{columns:(charMode==="large"?(document.fullscreenElement===stage||immersiveFallback?104:88):(document.fullscreenElement===stage||immersiveFallback?128:112))*ASCII_SCALE},environmentAt(time));}
  function frame(now){if(!root)return;var dt=clamp((now-lastFrame)/1000,0,.05);lastFrame=now;if(crashing){crashTimer-=dt;if(crashTimer<=0)finishCrash();}if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0&&els.toast)els.toast.dataset.visible="false";}accumulator+=dt;while(accumulator>=1/120){simulate(1/120);accumulator-=1/120;}fpsClock+=dt;fpsFrames+=1;if(fpsClock>=3){canvas.dataset.asciiFps=(fpsFrames/fpsClock).toFixed(1);fpsClock=0;fpsFrames=0;}try{render(now/1000);}catch(error){console.error("[CITY SHUTTLE] render failed",error);running=false;showOverlay("渲染失败",error.message||"未知图形错误",false);return;}rafId=requestAnimationFrame(frame);}

  function currentDescriptor(){if(!flight||!world)return null;return Core.describeChunk(world,Core.floorDiv(flight.position.x,320),Core.floorDiv(flight.position.z,320));}
  function updateHud(){if(!flight)return;var desc=currentDescriptor();setText(els.speed,Math.round(flight.speed)+" m/s");setText(els.altitude,Math.max(0,Math.round(flight.position.y))+" m");setText(els.city,desc?desc.city.name:"--");setText(els.district,desc?desc.district.label:"--");setText(els.score,Core.formatNumber(flight.totalScore));setText(els.combo,"×"+(Math.floor(flight.combo*10)/10).toFixed(1));setText(els.heading,String(Math.round((flight.yaw%TAU+TAU)%TAU/TAU*360)).padStart(3,"0")+"°");if(els.boost)els.boost.style.setProperty("--boost",String(flight.boostEnergy));if(flight.mission){setText(els.mission,flight.mission.label);setText(els.missionProgress,flight.mission.checkpointIndex+" / "+flight.mission.checkpoints.length);setText(els.missionTime,Math.max(0,flight.mission.timeLimit-flight.mission.elapsed).toFixed(1)+"s");setText(els.objective,"穿过前方青色航线门");}else{setText(els.mission,"自由飞行");setText(els.missionProgress,"航线待命");setText(els.missionTime,"--");}setText(els.camera,cameraMode==="third"?"尾随视角":"座舱视角");}
  function showToast(text,duration){setText(els.toast,text);if(els.toast)els.toast.dataset.visible="true";toastTimer=duration||2;}

  function showOverlay(title,text,canStart){setText(els.overlayTitle,title);setText(els.overlayText,text);if(els.overlay)els.overlay.hidden=false;if(els.start)els.start.disabled=!canStart;}
  function hideOverlay(){if(els.overlay)els.overlay.hidden=true;}
  function startGame(fullscreen){if(!renderer||!flight)return;if(fullscreen)enterFullscreen();running=true;paused=false;hideOverlay();initAudio();requestPointer();showToast("航线已连接 · 保持高速",2.2);createOffer();updateHud();}
  function togglePause(){if(!flight||crashing)return;paused=!paused;running=!paused;if(paused){if(document.pointerLockElement===canvas&&document.exitPointerLock)document.exitPointerLock();showOverlay("飞行暂停","当前城市保持在内存中。继续后立即恢复高速飞行。",true);setText(els.start,"继续飞行");}else{hideOverlay();running=true;requestPointer();}}
  function prepareNewCity(){if(document.pointerLockElement===canvas&&document.exitPointerLock)document.exitPointerLock();running=false;paused=false;els.seed.value=randomSeed();setText(els.start,"进入新城市");showOverlay("生成另一片天际城","输入或随机生成城市种子。起飞后本次分数将从零开始。",true);}
  function restartWithSeed(seed,fullscreen){seed=Core.normalizeSeed(seed);world=Core.createWorld(seed);flight=Core.createFlightState(seed);applyLocalPreview();previousPosition={x:flight.position.x,y:flight.position.y,z:flight.position.z};missionOffer=null;offerSerial=0;renderOrigin={x:0,z:0};activeChunkKey="";staticWorld=null;updateSeedUrl(seed);if(els.seed)els.seed.value=seed;setText(els.seedHud,seed);rebuildStaticWorld(0);updateHud();startGame(fullscreen);}

  function requestPointer(){if(!canvas||document.pointerLockElement===canvas)return;try{var result=canvas.requestPointerLock();if(result&&result.catch)result.catch(function(){});}catch(error){}}
  function toggleCamera(){cameraMode=cameraMode==="third"?"first":"third";saveSettings();updateHud();showToast(cameraMode==="third"?"第三人称尾随":"第一人称座舱",1.2);}
  function toggleChars(){charMode=charMode==="standard"?"large":"standard";saveSettings();syncButtons();showToast(charMode==="standard"?"标准字符 3×":"大字符 3×",1.2);}
  function syncButtons(){var full=document.fullscreenElement===stage||immersiveFallback;Array.prototype.forEach.call(root.querySelectorAll("[data-cs-fullscreen]"),function(button){button.textContent=full?"退出全屏 (F)":"全屏 (F)";button.setAttribute("aria-label",full?"退出全屏":"进入全屏");});Array.prototype.forEach.call(root.querySelectorAll("[data-cs-char]"),function(button){button.textContent=charMode==="standard"?"字符：标准":"字符：大";});}

  function setFallback(active){immersiveFallback=active;stage.dataset.immersive=active?"true":"false";document.body.classList.toggle("city-shuttle-immersive",active);syncButtons();}
  function enterFullscreen(){if(stage.requestFullscreen){stage.requestFullscreen().catch(function(){setFallback(true);showToast("浏览器拒绝全屏，已进入沉浸模式",2.4);});}else{setFallback(true);showToast("已进入沉浸模式",1.8);}}
  function exitFullscreen(){if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(function(){});setFallback(false);}
  function toggleFullscreen(){if(document.fullscreenElement===stage||immersiveFallback)exitFullscreen();else enterFullscreen();}

  function initAudio(){if(audio){if(audio.context.state==="suspended")audio.context.resume().catch(function(){});return;}var AudioContextClass=window.AudioContext||window.webkitAudioContext;if(!AudioContextClass)return;try{var context=new AudioContextClass(),master=context.createGain(),engine=context.createOscillator(),engineGain=context.createGain(),filter=context.createBiquadFilter();master.gain.value=els.volume?Number(els.volume.value):.6;engine.type="sawtooth";engine.frequency.value=70;engineGain.gain.value=.055;filter.type="lowpass";filter.frequency.value=460;engine.connect(filter).connect(engineGain).connect(master).connect(context.destination);engine.start();audio={context:context,master:master,engine:engine,engineGain:engineGain,filter:filter};}catch(error){audio=null;}}
  function updateAudio(){if(!audio||!flight)return;var now=audio.context.currentTime,a=clamp(flight.speed/210,0,1);audio.engine.frequency.setTargetAtTime(62+a*126,now,.08);audio.engineGain.gain.setTargetAtTime(.035+a*.07,now,.08);audio.filter.frequency.setTargetAtTime(360+a*920,now,.08);audio.master.gain.setTargetAtTime(els.volume?Number(els.volume.value):.6,now,.05);}
  function playCue(type){if(!audio)return;var context=audio.context,osc=context.createOscillator(),gain=context.createGain(),now=context.currentTime;osc.type=type==="crash"?"sawtooth":"sine";osc.frequency.setValueAtTime(type==="complete"?620:type==="checkpoint"?440:type==="mission"?280:95,now);osc.frequency.exponentialRampToValueAtTime(type==="crash"?32:(type==="complete"?980:520),now+(type==="crash"?.55:.16));gain.gain.setValueAtTime(type==="crash"?.25:.12,now);gain.gain.exponentialRampToValueAtTime(.001,now+(type==="crash"?.62:.28));osc.connect(gain).connect(audio.master);osc.start(now);osc.stop(now+(type==="crash"?.64:.30));}
  function disposeAudio(){if(!audio)return;try{audio.engine.stop();audio.context.close();}catch(error){}audio=null;}

  function collectElements(scope){els.overlay=scope.querySelector("[data-cs-overlay]");els.overlayTitle=scope.querySelector("[data-cs-overlay-title]");els.overlayText=scope.querySelector("[data-cs-overlay-text]");els.start=scope.querySelector("[data-cs-start]");els.startFull=scope.querySelector("[data-cs-start-full]");els.seed=scope.querySelector("[data-cs-seed]");els.random=scope.querySelector("[data-cs-random]");els.copy=scope.querySelector("[data-cs-copy]");els.pause=scope.querySelector("[data-cs-pause]");els.newCity=scope.querySelector("[data-cs-new-city]");els.speed=scope.querySelector("[data-cs-speed]");els.altitude=scope.querySelector("[data-cs-altitude]");els.city=scope.querySelector("[data-cs-city]");els.district=scope.querySelector("[data-cs-district]");els.score=scope.querySelector("[data-cs-score]");els.combo=scope.querySelector("[data-cs-combo]");els.heading=scope.querySelector("[data-cs-heading]");els.boost=scope.querySelector("[data-cs-boost]");els.mission=scope.querySelector("[data-cs-mission]");els.missionProgress=scope.querySelector("[data-cs-mission-progress]");els.missionTime=scope.querySelector("[data-cs-mission-time]");els.objective=scope.querySelector("[data-cs-objective]");els.toast=scope.querySelector("[data-cs-toast]");els.camera=scope.querySelector("[data-cs-camera]");els.seedHud=scope.querySelector("[data-cs-seed-hud]");els.sensitivity=scope.querySelector("[data-cs-sensitivity]");els.volume=scope.querySelector("[data-cs-volume]");}

  function on(target,type,handler){target.addEventListener(type,handler,{signal:abortController.signal});}
  function wireUi(){on(window,"keydown",function(event){keys[event.code]=true;if(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].indexOf(event.code)>=0)event.preventDefault();if(event.repeat)return;if(event.code==="KeyC")toggleCamera();else if(event.code==="KeyF")toggleFullscreen();else if(event.code==="KeyP")togglePause();else if(event.code==="KeyR"&&flight)triggerCrash("手动重置航线");else if(event.code==="Escape"&&running)setTimeout(function(){if(root&&document.pointerLockElement!==canvas)togglePause();},0);});on(window,"keyup",function(event){keys[event.code]=false;});on(document,"mousemove",function(event){if(!running||paused||crashing||document.pointerLockElement!==canvas)return;var sensitivity=els.sensitivity?Number(els.sensitivity.value):1;steer.x=clamp(steer.x+event.movementX*.006*sensitivity,-1,1);steer.y=clamp(steer.y-event.movementY*.006*sensitivity,-1,1);});on(canvas,"click",function(){if(running&&!paused)requestPointer();});on(document,"fullscreenchange",function(){if(document.fullscreenElement===stage)setFallback(false);syncButtons();});on(els.start,"click",function(){if(paused){togglePause();return;}restartWithSeed(els.seed.value,false);});on(els.startFull,"click",function(){restartWithSeed(els.seed.value,true);});on(els.random,"click",function(){els.seed.value=randomSeed();});on(els.copy,"click",function(){var seed=Core.normalizeSeed(els.seed.value);updateSeedUrl(seed);var text=location.href;if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(function(){showToast("城市链接已复制",1.6);}).catch(function(){showToast("种子："+seed,2.2);});else showToast("种子："+seed,2.2);});on(els.pause,"click",togglePause);on(els.newCity,"click",prepareNewCity);Array.prototype.forEach.call(root.querySelectorAll("[data-cs-fullscreen]"),function(button){on(button,"click",toggleFullscreen);});Array.prototype.forEach.call(root.querySelectorAll("[data-cs-char]"),function(button){on(button,"click",toggleChars);});Array.prototype.forEach.call(root.querySelectorAll("[data-cs-camera-button]"),function(button){on(button,"click",toggleCamera);});on(els.sensitivity,"change",saveSettings);on(els.volume,"input",function(){saveSettings();updateAudio();});}

  function mount(scope){root=scope.querySelector("[data-cs-root]");if(!root||!Core)return;stage=root.querySelector("[data-cs-stage]");canvas=root.querySelector("[data-cs-canvas]");abortController=new AbortController();collectElements(root);loadSettings();document.body.classList.add("city-shuttle-route");var unsupported=(window.matchMedia&&window.matchMedia("(pointer: coarse)").matches)||window.innerWidth<850;if(unsupported){root.dataset.unsupported="true";showOverlay("需要 PC 键鼠","《无界穿梭：天际城》仅面向桌面浏览器开发，需要键盘、鼠标与 WebGL2。",false);return;}try{renderer=createRenderer(canvas);}catch(error){showOverlay("无法启动 WebGL2",error.message,false);return;}var seed=parseSeedFromHash()||randomSeed();els.seed.value=seed;world=Core.createWorld(seed);flight=Core.createFlightState(seed);applyLocalPreview();setText(els.seedHud,seed);previousPosition={x:flight.position.x,y:flight.position.y,z:flight.position.z};wireUi();syncButtons();updateHud();rebuildStaticWorld(0);resizeObserver=new ResizeObserver(function(){if(renderer)renderer.resize();});resizeObserver.observe(stage);lastFrame=performance.now();rafId=requestAnimationFrame(frame);}

  function unmount(){if(!root)return;cancelAnimationFrame(rafId);if(abortController)abortController.abort();if(resizeObserver)resizeObserver.disconnect();if(document.pointerLockElement===canvas&&document.exitPointerLock)document.exitPointerLock();if(document.fullscreenElement===stage&&document.exitFullscreen)document.exitFullscreen().catch(function(){});setFallback(false);disposeAudio();if(renderer)renderer.dispose();document.body.classList.remove("city-shuttle-route","city-shuttle-immersive");root=null;stage=null;canvas=null;renderer=null;world=null;flight=null;staticWorld=null;missionOffer=null;keys=Object.create(null);}

  window.__page_city_shuttle={mount:mount,unmount:unmount};
})();
