/* Authored city flight: Rust/Wasm Worker -> ASCII cells -> WebGL glyph atlas. */
(function () {
  "use strict";
  var Core=window.CityShuttleCore,Scene=window.CityShuttleScene;
  var workerUrl=new URL("city-shuttle-worker.js?v=20261009-living-5",document.currentScript.src).href;
  var root=null,canvas=null,stage=null,worker=null,renderer=null,audio=null,controller=null,observer=null;
  var ready=false,active=false,paused=false,busy=false,raf=0,lastTime=0,serial=0,ticket=0;
  var keys=Object.create(null),pressedFlags=0,look={x:0,y:0},detailed=false,hudVisible=true,sensitivity=1;
  var state=null,pendingSpawn=null,pendingRefresh=false,ui={},lastFrame=null,pendingDt=0,soundVolume=.55,soundMuted=false,soundBlocked=false;
  var SETTINGS_KEY="claudeOne:city-shuttle-flight:v2";

  function compile(gl,type,source) {
    var shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){var message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(message||"字符着色器编译失败");}
    return shader;
  }
  function createRenderer(target) {
    var gl=target.getContext("webgl2",{alpha:false,antialias:false,depth:false,powerPreference:"high-performance"});
    if(!gl)throw new Error("浏览器无法启动 WebGL2。请使用开启硬件加速的桌面浏览器。");
    var vertex=null,fragment=null,program=null,glyphTexture=null,cellTexture=null;
    try {
    vertex=compile(gl,gl.VERTEX_SHADER,"#version 300 es\nprecision highp float;out vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.0-1.0,0.,1.);}");
    fragment=compile(gl,gl.FRAGMENT_SHADER,`#version 300 es
      precision highp float; precision highp int;
      in vec2 uv; uniform sampler2D cells; uniform sampler2D glyphs; uniform vec2 grid; out vec4 color;
      void main(){vec2 view=vec2(uv.x,1.0-uv.y);vec2 cell=floor(view*grid);vec2 local=fract(view*grid);
        vec4 data=texelFetch(cells,ivec2(clamp(cell,vec2(0),grid-1.0)),0);float code=floor(data.r*255.0+.5);
        vec2 tile=vec2(mod(code,16.0),floor(code/16.0));float ink=texture(glyphs,(tile+local)/16.0).r;
        vec3 rgb=data.gba;vec3 surface=code==32.0?rgb*.9:rgb*(.16+ink*.84); color=vec4(surface,1.0);}`);
    program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);vertex=null;fragment=null;
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||"字符渲染程序链接失败");
    var atlas=document.createElement("canvas");atlas.width=256;atlas.height=384;
    var context=atlas.getContext("2d");context.fillStyle="#000";context.fillRect(0,0,atlas.width,atlas.height);
    context.fillStyle="#fff";context.textAlign="center";context.textBaseline="middle";context.font="700 19px Consolas,'Cascadia Mono',monospace";
    for(var code=32;code<127;code+=1)context.fillText(String.fromCharCode(code),(code%16)*16+8,Math.floor(code/16)*24+12);
    glyphTexture=gl.createTexture();cellTexture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,glyphTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D,cellTexture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    var gridLocation=gl.getUniformLocation(program,"grid");gl.useProgram(program);gl.uniform1i(gl.getUniformLocation(program,"cells"),0);gl.uniform1i(gl.getUniformLocation(program,"glyphs"),1);
    var cw=0,ch=0;
    function draw(frame) {
      var rect=target.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
      var width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));
      if(target.width!==width||target.height!==height){target.width=width;target.height=height;}
      gl.viewport(0,0,width,height);gl.useProgram(program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,cellTexture);
      if(cw!==frame.columns||ch!==frame.rows){cw=frame.columns;ch=frame.rows;gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,cw,ch,0,gl.RGBA,gl.UNSIGNED_BYTE,frame.pixels);}
      else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,cw,ch,gl.RGBA,gl.UNSIGNED_BYTE,frame.pixels);
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,glyphTexture);gl.uniform2f(gridLocation,cw,ch);gl.drawArrays(gl.TRIANGLES,0,3);
      target.dataset.asciiGrid=cw+"x"+ch;
    }
    return {draw:draw,dispose:function(){gl.deleteTexture(glyphTexture);gl.deleteTexture(cellTexture);gl.deleteProgram(program);}};
    } catch(error) {
      if(vertex)gl.deleteShader(vertex);if(fragment)gl.deleteShader(fragment);
      if(glyphTexture)gl.deleteTexture(glyphTexture);if(cellTexture)gl.deleteTexture(cellTexture);
      if(program)gl.deleteProgram(program);throw error;
    }
  }
  function listen(target,type,fn){target.addEventListener(type,fn,{signal:controller.signal});}
  function text(node,value){if(node)node.textContent=value;}
  function clearInput(){keys=Object.create(null);pressedFlags=0;look.x=0;look.y=0;}
  function save(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify({detailed:detailed,hud:hudVisible,sensitivity:sensitivity,volume:soundVolume,muted:soundMuted}));}catch(ignore){}}
  function syncSound(){if(ui.sound){text(ui.sound,audio&&audio.available?(soundMuted?"声音：静音 (M)":soundBlocked?"声音：点按重试":"声音：开启 (M)"):"声音不可用");ui.sound.disabled=!audio||!audio.available;ui.sound.setAttribute("aria-pressed",String(!soundMuted));}if(ui.volume){ui.volume.value=String(Math.round(soundVolume*100));ui.volume.disabled=!audio||!audio.available;}if(stage)stage.dataset.sound=!audio||!audio.available?"unavailable":soundMuted?"muted":soundBlocked?"blocked":active&&!paused?"active":"waiting";}
  function startSound(){if(!audio||soundMuted)return;var current=ticket;audio.start().then(function(ok){if(current!==ticket||!root)return;soundBlocked=!ok;syncSound();});}
  function toggleSound(){if(soundBlocked&&!soundMuted&&active&&!paused){startSound();return;}soundMuted=!soundMuted;if(audio)audio.setMuted(soundMuted);if(!soundMuted&&active&&!paused)startSound();syncSound();save();}
  function syncHud(){root.dataset.hud=String(hudVisible);var button=root.querySelector("[data-cs-hud-toggle]");text(button,hudVisible?"隐藏信息 (H)":"显示信息 (H)");button.setAttribute("aria-pressed",String(hudVisible));}
  function showOverlay(title,message,visible) {
    text(ui.title,title);text(ui.message,message);ui.overlay.hidden=!visible;
    ui.pause.disabled=!ready;
    if(visible){ui.start.disabled=!ready;text(ui.start,active?"继续飞行":"进入城市");}
  }
  function hud(frame) {
    state=frame.state;var district=Core.district(state[0],state[2]);
    text(ui.district,district);text(ui.altitude,Math.round(state[1])+" m");text(ui.speed,Math.round(Math.abs(state[6]))+" m/s");
    text(ui.status,state[7]>0.5?"贴近建筑 · 请转向":"自由飞行");
    canvas.dataset.position=state.slice(0,3).map(function(v){return v.toFixed(2);}).join(",");canvas.dataset.engineMs=frame.elapsed.toFixed(2);
    stage.dataset.engine="rust-wasm";
    if(frame.life){stage.dataset.people=String(frame.life.people);stage.dataset.vehicles=String(frame.life.vehicles);canvas.dataset.worldTime=frame.time.toFixed(2);}
  }
  function requestFrame(dt) {
    if(!root||!ready||document.hidden)return;
    if(busy){if(dt===0)pendingRefresh=true;return;}
    var rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
    var grid=Core.grid(rect.width,rect.height,detailed);busy=true;pendingDt=0;
    var turnX=look.x+(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0);
    var turnY=look.y+(keys.ArrowUp?1:0)-(keys.ArrowDown?1:0);
    worker.postMessage({type:"frame",dt:active&&!paused?dt:0,flags:Core.flags(keys)|pressedFlags,turnX:turnX,turnY:turnY,columns:grid.columns,rows:grid.rows,aspect:grid.aspect,serial:++serial});
    if(dt>0||!active||paused)pressedFlags=0;
    look.x*=0.68;look.y*=0.68;
  }
  function loop(time) {
    raf=0;if(!root||document.hidden)return;
    var dt=lastTime?Math.min((time-lastTime)/1000,.05):0;lastTime=time;
    if(active&&!paused){pendingDt=Math.min(pendingDt+dt,.1);requestFrame(pendingDt);}
    if(active&&!paused)raf=requestAnimationFrame(loop);
  }
  function beginLoop(){lastTime=0;if(!raf&&active&&!paused&&!document.hidden)raf=requestAnimationFrame(loop);}
  function pause(value) {
    if(!ready)return;paused=value;pendingDt=0;clearInput();cancelAnimationFrame(raf);raf=0;
    if(audio)audio.setPaused(paused);syncSound();
    if(paused){if(document.pointerLockElement===canvas)document.exitPointerLock();showOverlay("停在这一刻","城市飞行已暂停。继续后从当前位置出发。",true);ui.start.focus();}
    else {showOverlay("","",false);canvas.focus();startSound();beginLoop();}
    text(ui.pause,paused?"继续飞行 (P)":"暂停 (P)");
  }
  function start() {
    if(!ready)return;active=true;pause(false);
    // Pointer lock is optional; arrow keys remain usable when it is unavailable.
    if(canvas.requestPointerLock){try{var result=canvas.requestPointerLock();if(result&&result.catch)result.catch(function(){text(ui.status,"方向键转向 · 点击画面可用鼠标");});}catch(ignore){}}
  }
  function reset(spawn) {
    if(!ready)return;clearInput();worker.postMessage({type:"reset",spawn:spawn});pendingSpawn=spawn;
    if(!busy)requestFrame(0);
  }
  function fail(message) {
    ++ticket;ready=false;active=false;paused=true;busy=false;pendingDt=0;pendingSpawn=null;pendingRefresh=false;lastFrame=null;cancelAnimationFrame(raf);raf=0;
    clearInput();if(document.pointerLockElement===canvas&&document.exitPointerLock)document.exitPointerLock();
    if(worker){worker.terminate();worker=null;}if(observer){observer.disconnect();observer=null;}if(renderer){renderer.dispose();renderer=null;}if(audio){audio.dispose();audio=null;}syncSound();showOverlay("城市暂时无法启动",message,true);ui.start.disabled=true;
  }
  async function fullscreen() {
    try{if(document.fullscreenElement===stage)await document.exitFullscreen();else await stage.requestFullscreen();}
    catch(ignore){text(ui.status,"此浏览器暂不支持全屏");}
  }
  function syncFullscreen(){var enabled=document.fullscreenElement===stage;root.querySelectorAll("[data-cs-fullscreen]").forEach(function(button){text(button,enabled?"退出全屏 (F)":"全屏 (F)");button.setAttribute("aria-label",enabled?"退出全屏":"进入全屏");});}
  function syncQuality(){root.querySelectorAll("[data-cs-quality]").forEach(function(button){text(button,detailed?"字符：精细":"字符：标准");button.setAttribute("aria-pressed",String(detailed));});}
  function mount(scope) {
    unmount();root=scope.querySelector("[data-cs-root]");if(!root||!Core||!Scene)return;
    var current=++ticket;stage=root.querySelector("[data-cs-stage]");canvas=root.querySelector("[data-cs-canvas]");controller=new AbortController();
    ui={overlay:root.querySelector("[data-cs-overlay]"),title:root.querySelector("[data-cs-overlay-title]"),message:root.querySelector("[data-cs-overlay-text]"),start:root.querySelector("[data-cs-start]"),pause:root.querySelector("[data-cs-pause]"),district:root.querySelector("[data-cs-district]"),altitude:root.querySelector("[data-cs-altitude]"),speed:root.querySelector("[data-cs-speed]"),status:root.querySelector("[data-cs-status]"),sound:root.querySelector("[data-cs-sound]"),volume:root.querySelector("[data-cs-volume]")};
    ready=false;active=false;paused=false;busy=false;state=null;lastFrame=null;pendingSpawn=null;pendingRefresh=false;clearInput();
    detailed=false;hudVisible=true;sensitivity=1;soundVolume=.55;soundMuted=false;soundBlocked=false;
    try{var settings=JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}");detailed=!!settings.detailed;hudVisible=settings.hud!==false;sensitivity=Core.clamp(Number(settings.sensitivity)||1,.3,2);if(Number.isFinite(settings.volume))soundVolume=Core.clamp(settings.volume,0,1);soundMuted=settings.muted===true;}catch(ignore){}
    audio=window.CityShuttleAudio?new window.CityShuttleAudio.Sound({volume:soundVolume,muted:soundMuted}):null;
    syncHud();syncQuality();syncFullscreen();syncSound();document.body.classList.add("city-shuttle-route");
    delete stage.dataset.engine;delete stage.dataset.objects;delete stage.dataset.people;delete stage.dataset.vehicles;delete canvas.dataset.worldTime;delete canvas.dataset.engineMs;delete canvas.dataset.position;
    var sensitivityInput=root.querySelector("[data-cs-sensitivity]");sensitivityInput.value=String(sensitivity);
    var select=root.querySelector("[data-cs-startpoint]");select.replaceChildren();Scene.SPAWNS.forEach(function(spawn){var option=document.createElement("option");option.value=spawn.id;option.textContent=spawn.name;select.appendChild(option);});
    var unsupported=window.matchMedia("(pointer: coarse)").matches||window.innerWidth<600;
    listen(window,"resize",function(){var next=window.matchMedia("(pointer: coarse)").matches||window.innerWidth<600;if(root&&next!==(root.dataset.unsupported==="true"))mount(scope);});
    if(unsupported){root.dataset.unsupported="true";showOverlay("请使用 PC 键鼠","城市飞行需要桌面键盘、鼠标、WebAssembly 与 WebGL2。窄屏仍可浏览网站其他页面。",true);return;}
    root.dataset.unsupported="false";
    try{renderer=createRenderer(canvas);}catch(error){fail(error.message);return;}
    showOverlay("城市正在载入","正在准备街道、立面与字符渲染核心…",true);
    try{worker=new Worker(workerUrl);worker.postMessage({type:"init",wasmUrl:new URL(window.CityShuttleEngineUrl,document.baseURI).href,stride:Scene.STRIDE,spawn:Scene.SPAWNS[0]});}
    catch(error){fail(error.message);return;}
    listen(worker,"message",function(event){
      if(!root||current!==ticket)return;var message=event.data;
      if(message.type==="ready"){ready=true;stage.dataset.objects=String(message.objects);var startPoint=Scene.SPAWNS.find(function(p){return p.id===select.value;})||Scene.SPAWNS[0];worker.postMessage({type:"reset",spawn:startPoint});showOverlay("起飞，只为看这座城","按 W 前行，松开悬停；鼠标或方向键转向，Q / E 升降。你可以沿街慢飞，也可以越过屋顶。",true);requestFrame(0);}
      else if(message.type==="frame"){busy=false;lastFrame=message;renderer.draw(message);hud(message);if(audio)audio.update(message);if(pendingSpawn||pendingRefresh){pendingSpawn=null;pendingRefresh=false;requestFrame(0);}}
      else if(message.type==="error")fail(message.message);
    });
    listen(worker,"error",function(event){fail(event.message||"城市 Worker 启动失败");});
    listen(ui.start,"click",start);listen(ui.pause,"click",function(){if(active)pause(!paused);else start();});
    listen(select,"change",function(){var spawn=Scene.SPAWNS.find(function(p){return p.id===select.value;});if(spawn)reset(spawn);});
    listen(sensitivityInput,"input",function(){sensitivity=Number(sensitivityInput.value);save();});
    if(ui.sound)listen(ui.sound,"click",toggleSound);
    if(ui.volume)listen(ui.volume,"input",function(){soundVolume=Number(ui.volume.value)/100;if(audio)audio.setVolume(soundVolume);save();});
    root.querySelectorAll("[data-cs-quality]").forEach(function(button){listen(button,"click",function(){detailed=!detailed;syncQuality();save();requestFrame(0);});});
    root.querySelectorAll("[data-cs-fullscreen]").forEach(function(button){listen(button,"click",fullscreen);});
    listen(document,"fullscreenchange",syncFullscreen);
    listen(root.querySelector("[data-cs-hud-toggle]"),"click",function(){hudVisible=!hudVisible;syncHud();save();});
    listen(root.querySelector("[data-cs-reset]"),"click",function(){reset(Scene.SPAWNS.find(function(p){return p.id===select.value;})||Scene.SPAWNS[0]);});
    listen(canvas,"click",function(){if(active&&!paused)start();});
    listen(window,"keydown",function(event){
      if(event.ctrlKey||event.metaKey||event.altKey)return;
      if(event.target.matches("input,select,textarea"))return;
      if(!active||!ready)return;
      if(event.target.matches("button")&&!["KeyP","Escape","KeyF","KeyH","KeyM"].includes(event.code))return;
      if(paused&&!["KeyP","Escape","KeyF","KeyH","KeyM"].includes(event.code))return;
      keys[event.code]=true;
      pressedFlags|=Core.flags(keys);
      if(["KeyW","KeyS","KeyA","KeyD","KeyQ","KeyE","Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.code))event.preventDefault();
      if(event.repeat)return;if(event.code==="KeyP"||event.code==="Escape")pause(!paused);
      else if(event.code==="KeyF")fullscreen();else if(event.code==="KeyH"){hudVisible=!hudVisible;syncHud();save();}else if(event.code==="KeyM")toggleSound();
    });
    listen(window,"keyup",function(event){keys[event.code]=false;});
    listen(document,"mousemove",function(event){if(active&&!paused&&document.pointerLockElement===canvas){look.x=Core.clamp(look.x+event.movementX*.09*sensitivity,-2,2);look.y=Core.clamp(look.y-event.movementY*.09*sensitivity,-2,2);}});
    listen(document,"pointerlockchange",function(){if(active&&!paused&&document.pointerLockElement!==canvas)pause(true);});
    listen(window,"blur",function(){if(active&&!paused)pause(true);clearInput();});
    listen(document,"visibilitychange",function(){clearInput();if(document.hidden&&active&&!paused)pause(true);else if(!document.hidden&&!active)requestFrame(0);});
    listen(canvas,"webglcontextlost",function(event){event.preventDefault();fail("显卡渲染上下文已丢失。请离开页面后重新进入。");});
    observer=new ResizeObserver(function(){if(lastFrame&&renderer)renderer.draw(lastFrame);if(!active||paused)requestFrame(0);});observer.observe(stage);
  }
  function unmount() {
    ++ticket;cancelAnimationFrame(raf);raf=0;if(controller)controller.abort();if(observer)observer.disconnect();
    if(worker)worker.terminate();if(document.pointerLockElement===canvas&&document.exitPointerLock)document.exitPointerLock();
    if(document.fullscreenElement===stage&&document.exitFullscreen)document.exitFullscreen().catch(function(){});
    if(renderer)renderer.dispose();if(audio)audio.dispose();document.body.classList.remove("city-shuttle-route");
    root=null;canvas=null;stage=null;worker=null;renderer=null;audio=null;controller=null;observer=null;lastFrame=null;ui={};ready=false;active=false;busy=false;clearInput();
  }
  window.__page_city_shuttle={mount:mount,unmount:unmount};
})();
