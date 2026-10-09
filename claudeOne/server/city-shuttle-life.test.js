const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const Scene=require("../js/city-shuttle-scene.js"),Life=require("../js/city-shuttle-life.js"),Road=require("../js/city-shuttle-streets.js"),Transit=require("../js/city-shuttle-transit.js");
const root=path.resolve(__dirname,".."),asset=fs.readFileSync(path.join(root,"js/city-shuttle-engine-url.js"),"utf8").match(/"([^\"]+\.wasm)"/)[1],wasm=fs.readFileSync(path.join(root,asset));
const Actors=require("../js/city-shuttle-actors.js");
async function engine(){const {instance}=await WebAssembly.instantiate(wasm,{}),e=instance.exports,s=Scene.build(),ptr=e.scene_buffer(s.objects.length);new Float32Array(e.memory.buffer,ptr,s.packed.length).set(s.packed);assert.equal(e.scene_commit(s.objects.length),s.objects.length);return e;}

test("every pedestrian lane is supported by the actual city surface and stays outside walls and street furniture",async()=>{
  const e=await engine();for(const walk of Life.WALK_PATHS){const road={points:walk.points},track=Road.segments(road);for(let distance=.25;distance<track.length;distance+=.35)for(const lane of [-1,0,1]){
    const p=Road.sample(road,distance,lane*(walk.spread==null?.55:walk.spread)),floor=e.floor_height(p.x,p.z,p.y+.8,2);
    assert.ok(Number.isFinite(floor)&&Math.abs(floor-p.y-.014)<.06,`${walk.id}: unsupported feet at ${p.x},${p.z}; floor=${floor}`);
    assert.equal(e.is_space_clear(p.x,p.y+1,p.z,.22),1,`${walk.id}: body intersects scenery at ${p.x},${p.z}`);
  }}
});
test("city traffic and elevated routes have physical clearance, including ramp junctions",async()=>{
  const e=await engine(),w=new Life.World();for(const route of w.routes)for(let d=1;d<route._path.length;d+=3){const p=Road.sample(route,d,route.lane);assert.equal(e.is_space_clear(p.x,p.y+1.5,p.z,.9),1,route.id+" intersects a building or barrier at "+p.x+","+p.z);}
});
test("parked vehicles occupy real open space, and children ride as passengers rather than drivers",async()=>{
  const e=await engine(),w=new Life.World();for(const p of Life.PARKED)assert.equal(e.is_space_clear(p.x,p.y+1.1,p.z,.8),1,"parked vehicle is hidden inside scenery: "+p.id);for(const v of w.vehicles)assert.equal(Actors.PROFILES[v.spec.driver].child===true,false,v.id+" has a child driver");
});
test("ten minutes of actual traffic maintain headway, stop for red signals and use bus stops",()=>{
  const w=new Life.World();let minGap=Infinity,redStops=0,busStops=0;
  for(let step=1;step<=18000;step++){w.update(step/30);for(const route of w.routes){const cars=w.vehicles.filter(v=>v.route===route).sort((a,b)=>a.distance-b.distance);for(let i=0;i<cars.length;i++){const a=cars[i],b=cars[(i+1)%cars.length],gap=(b.distance-a.distance+route._path.length)%route._path.length-(a.length+b.length)/2;minGap=Math.min(minGap,gap);if(a.spec.atStop)busStops++;if(a.speed<.1&&route.stops.some(stop=>!Life.green(w.time,stop.junction,stop.northSouth)))redStops++;}}}
  assert.ok(minGap>2.8,"vehicles collide or stack up: "+minGap);assert.ok(redStops>300);assert.ok(busStops>100);
});
test("pausing freezes people, traffic, transport, signals and sound events; resuming changes real geometry",()=>{
  const w=new Life.World(),camera=[1000,5,1740];w.update(.05);const a=w.frame(camera);w.update(.05);const paused=w.frame(camera);assert.deepEqual(paused.packed,a.packed);assert.deepEqual(paused.audio,a.audio);
  w.update(.1);const b=w.frame(camera);assert.notDeepEqual(b.packed,a.packed);assert.ok(b.audio.some(s=>s.kind==="footsteps"&&s.oneShot&&Number.isInteger(s.event)));
  assert.ok(a.metrics.vehicles>0&&a.metrics.trains>0&&a.metrics.boats>0&&a.metrics.planes>0);
});
test("every authored view fits the dynamic ABI budget and includes finite transport and actor geometry",()=>{
  const w=new Life.World();for(const spawn of Scene.SPAWNS){const f=w.frame([spawn.x,spawn.y,spawn.z]);assert.ok(f.packed.length/Scene.STRIDE<12000,spawn.name+" exceeds dynamic capacity");assert.ok(f.packed.every(Number.isFinite));assert.equal(new Set(f.objects.map(o=>o.id)).size,f.objects.length);}
});
test("rail and aircraft positions stay continuous across acceleration, approach and loop boundaries",()=>{
  for(let t=0;t<800;t+=.05){const a=Transit.shuttle(t,0),b=Transit.shuttle(t+.05,0);assert.ok(Math.abs(b.x-a.x)<3.5,"train jumps at "+t);}
  for(let t=0;t<340;t+=.05){const a=Transit.planePose(t,0),b=Transit.planePose(t+.05,0);assert.ok(Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)<10,"aircraft jumps at "+t);assert.ok(Number.isFinite(a.pitch)&&Number.isFinite(a.yaw));}
});
