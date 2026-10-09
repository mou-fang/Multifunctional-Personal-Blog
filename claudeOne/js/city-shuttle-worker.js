/* One frame in flight at a time. Rust owns simulation, BVH and surface sampling. */
"use strict";
var engine = null, life = null, generation = 0;
importScripts("city-shuttle-geometry.js?v=20261009-live-5","city-shuttle-streets.js?v=20261009-live-5","city-shuttle-neighborhoods.js?v=20261009-live-5","city-shuttle-actors.js?v=20261009-live-5","city-shuttle-transit.js?v=20261009-live-5","city-shuttle-city.js?v=20261009-live-5","city-shuttle-scene.js?v=20261009-live-5","city-shuttle-life.js?v=20261009-live-5");
self.onmessage = async function(event) {
  var message = event.data;
  if(message.type === "init") {
    var ticket = ++generation;
    try {
      var response = await fetch(message.wasmUrl);
      if(!response.ok) throw new Error("飞行核心加载失败（" + response.status + "）");
      var instance = await WebAssembly.instantiate(await response.arrayBuffer(), {});
      if(ticket !== generation) return;
      engine = instance.instance.exports;
      if(!engine.scene_stride||engine.scene_stride()!==message.stride)throw new Error("城市与渲染核心的版本不一致，请刷新页面。");
      if(engine.engine_version()<3||!engine.dynamic_buffer||!engine.floor_height)throw new Error("城市动态核心未更新，请刷新页面。");
      var scene = message.scene || self.CityShuttleScene.build().packed;
      var count = scene.length / message.stride;
      var ptr = engine.scene_buffer(count);
      new Float32Array(engine.memory.buffer,ptr,scene.length).set(scene);
      var loaded = engine.scene_commit(count);
      if(loaded !== count) throw new Error("城市数据不完整");
      var spawn = message.spawn;
      engine.reset_flight(spawn.x,spawn.y,spawn.z,spawn.yaw,spawn.pitch);
      life=new self.CityShuttleLife.World();
      self.postMessage({type:"ready",objects:loaded,version:engine.engine_version()});
    } catch(error) {self.postMessage({type:"error",message:error.message});}
  } else if(message.type === "frame" && engine) {
    try {
      var start = performance.now();
      var remaining = Math.min(0.1,Math.max(0,message.dt));
      while(remaining>0) {var dt=Math.min(remaining,1/60);engine.flight_tick(dt,message.flags,message.turnX,message.turnY);remaining-=dt;}
      var state = Array.from(new Float32Array(engine.memory.buffer,engine.state_ptr(),8));
      life.update(engine.world_time());var live=life.frame(state,function(x,z,y){return engine.floor_height(x,z,y,2);});
      var movingCount=live.packed.length/engine.scene_stride();
      var movingPtr=engine.dynamic_buffer(movingCount);new Float32Array(engine.memory.buffer,movingPtr,live.packed.length).set(live.packed);
      if(engine.dynamic_commit(movingCount)!==movingCount)throw new Error("城市活动数据不完整");
      var ptr = engine.render_ascii(message.columns,message.rows,message.aspect);
      var pixels = new Uint8Array(message.columns*message.rows*4);
      pixels.set(new Uint8Array(engine.memory.buffer,ptr,pixels.length));
      self.postMessage({type:"frame",pixels:pixels,columns:message.columns,rows:message.rows,state:state,elapsed:performance.now()-start,serial:message.serial,life:live.metrics,audio:live.audio,time:live.time},[pixels.buffer]);
    } catch(error) {self.postMessage({type:"error",message:error.message});}
  } else if(message.type === "reset" && engine) {
    var point=message.spawn;engine.reset_flight(point.x,point.y,point.z,point.yaw,point.pitch);
  }
};
