/* One frame in flight at a time. Rust owns simulation, BVH and surface sampling. */
"use strict";
var engine = null, generation = 0;
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
      var count = message.scene.length / message.stride;
      var ptr = engine.scene_buffer(count);
      new Float32Array(engine.memory.buffer,ptr,message.scene.length).set(message.scene);
      var loaded = engine.scene_commit(count);
      if(loaded !== count) throw new Error("城市数据不完整");
      var spawn = message.spawn;
      engine.reset_flight(spawn.x,spawn.y,spawn.z,spawn.yaw,spawn.pitch);
      self.postMessage({type:"ready",objects:loaded,version:engine.engine_version()});
    } catch(error) {self.postMessage({type:"error",message:error.message});}
  } else if(message.type === "frame" && engine) {
    try {
      var start = performance.now();
      var remaining = Math.min(0.1,Math.max(0,message.dt));
      while(remaining>0) {var dt=Math.min(remaining,1/60);engine.flight_tick(dt,message.flags,message.turnX,message.turnY);remaining-=dt;}
      var ptr = engine.render_ascii(message.columns,message.rows,message.aspect);
      var pixels = new Uint8Array(message.columns*message.rows*4);
      pixels.set(new Uint8Array(engine.memory.buffer,ptr,pixels.length));
      var state = Array.from(new Float32Array(engine.memory.buffer,engine.state_ptr(),8));
      self.postMessage({type:"frame",pixels:pixels,columns:message.columns,rows:message.rows,state:state,elapsed:performance.now()-start,serial:message.serial},[pixels.buffer]);
    } catch(error) {self.postMessage({type:"error",message:error.message});}
  } else if(message.type === "reset" && engine) {
    var point=message.spawn;engine.reset_flight(point.x,point.y,point.z,point.yaw,point.pitch);
  }
};
