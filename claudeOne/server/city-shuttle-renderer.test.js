const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const G=require("../js/city-shuttle-geometry.js"),Scene=require("../js/city-shuttle-scene.js");
const Actors=require("../js/city-shuttle-actors.js");
const root=path.resolve(__dirname,".."),asset=fs.readFileSync(path.join(root,"js/city-shuttle-engine-url.js"),"utf8").match(/"([^\"]+\.wasm)"/)[1];
const wasm=fs.readFileSync(path.join(root,asset));
function build(draw){const b=new G.Builder("test");b.site("world","测试",0,0,"用于真实渲染与碰撞测试的几何",draw);return b.finish().packed;}
async function engine(scene){const {instance}=await WebAssembly.instantiate(wasm,{}),e=instance.exports;if(scene)load(e,scene,false);return e;}
function load(e,packed,dynamic){const count=packed.length/G.STRIDE,ptr=dynamic?e.dynamic_buffer(count):e.scene_buffer(count);new Float32Array(e.memory.buffer,ptr,packed.length).set(packed);assert.equal(dynamic?e.dynamic_commit(count):e.scene_commit(count),count);}
function frame(e){const columns=181,rows=81,ptr=e.render_ascii(columns,rows,1.7);return Buffer.from(new Uint8Array(e.memory.buffer,ptr,columns*rows*4));}
function centre(pixels){return Array.from(pixels.subarray((40*181+90)*4,(40*181+90)*4+4));}
function state(e){return Array.from(new Float32Array(e.memory.buffer,e.state_ptr(),8));}

test("tapered circular geometry narrows with height and does not fill its square bounding box",async()=>{
  const e=await engine(build(b=>b.cylinder("taper",0,10,0,10,20,10,"teal",{parameter:.45})));
  assert.equal(e.is_space_clear(7,2,0,.2),0);assert.equal(e.is_space_clear(7,18,0,.2),1);
  assert.equal(e.is_space_clear(8,10,8,.2),1,"empty cylinder corners are not solid rectangles");
  e.reset_flight(0,10,30,0,0);assert.notEqual(centre(frame(e))[0],32);
});

test("authored triangle faces keep their actual outline and stop swept flight",async()=>{
  const e=await engine(build(b=>{
    b.triangle("triangular-front",[[-10,0,0],[10,0,0],[0,20,0]],[.1,.8,.2]);
    b.part("background",0,10,-20,30,25,1,[.8,.12,.05]);
  }));
  e.reset_flight(0,15,25,0,0);const inside=centre(frame(e));assert.ok(inside[2]>inside[1]);
  e.reset_flight(8,18,25,0,0);const outside=centre(frame(e));assert.ok(outside[1]>outside[2],"the upper triangular corner must reveal the background");
  e.reset_flight(0,10,20,0,0);for(let i=0;i<120;i++)e.flight_tick(1/60,17,0,0);
  assert.ok(state(e)[2]>.8,"a fast camera must not pass through the mesh face");
});

test("moving geometry has its own index, changes occlusion and can be removed without replacing the city",async()=>{
  const e=await engine(build(b=>b.part("static-background",0,10,-20,30,25,1,[.8,.12,.05])));
  e.reset_flight(0,10,25,0,0);const background=centre(frame(e));assert.ok(background[1]>background[2]);
  load(e,build(b=>b.ball("person",0,10,0,3,5,3,[.12,.8,.2],{solid:false})),true);
  const person=centre(frame(e));assert.ok(person[2]>person[1]);
  load(e,build(b=>b.ball("person",15,10,0,3,5,3,[.12,.8,.2],{solid:false})),true);
  assert.deepEqual(centre(frame(e)),background,"moving the actor must uncover the original city");
  load(e,new Float32Array(0),true);assert.deepEqual(centre(frame(e)),background);
  assert.equal(e.world_time(),0);e.flight_tick(.05,0,0,0);assert.ok(e.world_time()>.049);
});

test("vehicle glass reveals actual seated geometry while preserving its coloured tint",async()=>{
  const e=await engine(build(b=>{
    b.part("window",0,10,0,15,15,.12,"glass",{material:16,solid:false});
    b.part("passenger",0,10,-6,6,7,2,[.8,.2,.1]);
  }));
  e.reset_flight(0,10,20,0,0);const passenger=centre(frame(e));assert.ok(passenger[1]>passenger[2]*2,"glass must reveal the red passenger behind it");
});
test("the actual hollow car model reveals its real driver through the side window",async()=>{
  function car(driver){const b=new G.Builder("model");Actors.drawVehicle(b,"cab",{x:0,y:0,z:0,yaw:0},{type:"car",paint:"silver",driver,passengers:[],speed:0},0,4);return b.finish().packed;}
  const e=await engine(car(false));e.reset_flight(4,1.38,.10,-Math.PI/2,0);const empty=centre(frame(e));load(e,car(12),false);e.reset_flight(4,1.38,.10,-Math.PI/2,0);const driver=centre(frame(e));assert.notDeepEqual(driver,empty);assert.ok(driver[1]>driver[2]*1.15,"the driver's warm skin must be visible through the glazing");
});

test("headlamps illuminate road surfaces rather than only drawing bright dots",async()=>{
  const e=await engine(build(b=>b.part("road",0,0,0,50,.2,90,"asphalt",{material:11})));
  e.reset_flight(0,5,-12,Math.PI,-.4);const before=centre(frame(e));
  load(e,build(b=>b.light("headlamp",0,1.2,-6,"white",30,{material:12})),true);
  const after=centre(frame(e));assert.ok(after[1]>before[1]+5,"the ground pixel must receive real headlight illumination");
});

test("the new landmark openings are physically flyable, including the SWFC sky portal and Raffles interior",async()=>{
  const e=await engine(Scene.build().packed);
  const paths=[{a:[-1050,460,-875],b:[-1050,460,-1040]},{a:[0,110,-1380],b:[0,110,-1690]},{a:[1790,255,1520],b:[2130,255,1520]},{a:[-1750,5,-1780],b:[-1750,5,-2030]},{a:[886,6,2050],b:[886,6,1946]}];
  for(const p of paths){const delta=p.b.map((v,i)=>v-p.a[i]),length=Math.hypot(...delta),yaw=Math.atan2(delta[0],-delta[2]);e.reset_flight(...p.a,yaw,0);
    let distance=0;for(let i=0;i<1800&&distance<length;i++){e.flight_tick(1/60,1,0,0);const s=state(e);assert.equal(s[7],0,"a designed landmark opening is obstructed");distance=Math.hypot(...s.slice(0,3).map((v,j)=>v-p.a[j]));}
    assert.ok(distance>=length);
  }
});
