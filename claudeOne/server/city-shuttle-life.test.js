const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const Scene=require("../js/city-shuttle-scene.js"),Life=require("../js/city-shuttle-life.js"),Road=require("../js/city-shuttle-streets.js"),Transit=require("../js/city-shuttle-transit.js");
const root=path.resolve(__dirname,".."),asset=fs.readFileSync(path.join(root,"js/city-shuttle-engine-url.js"),"utf8").match(/"([^\"]+\.wasm)"/)[1],wasm=fs.readFileSync(path.join(root,asset));
const Actors=require("../js/city-shuttle-actors.js");
async function engine(){const {instance}=await WebAssembly.instantiate(wasm,{}),e=instance.exports,s=Scene.build(),ptr=e.scene_buffer(s.objects.length);new Float32Array(e.memory.buffer,ptr,s.packed.length).set(s.packed);assert.equal(e.scene_commit(s.objects.length),s.objects.length);return e;}

test("every walking corridor has a supported route for a full adult body around street furniture",async()=>{
  const e=await engine();for(const walk of Life.WALK_PATHS){const road={points:walk.points},track=Road.segments(road);for(let distance=.25;distance<track.length;distance+=.35){
    let clear=false;for(const lane of [0,-.47,.47,-.8,.8]){const p=Road.sample(road,distance,lane),floor=e.floor_height(p.x,p.z,p.y+.8,2);if(Number.isFinite(floor)&&Math.abs(floor-p.y)<.12&&e.static_space_clear(p.x,floor+.65,p.z,.41)&&e.static_space_clear(p.x,floor+1.1,p.z,.41)&&e.static_space_clear(p.x,floor+1.55,p.z,.24)){clear=true;break;}}
    assert.ok(clear,`${walk.id}: no body-sized route around the obstacle at ${distance}`);
  }}
});
test("city traffic and elevated routes have physical clearance, including ramp junctions",async()=>{
  const e=await engine(),w=new Life.World();for(const route of w.routes)for(let d=1;d<route._path.length;d+=3){const p=Road.sample(route,d,route.lane);assert.equal(e.is_space_clear(p.x,p.y+1.5,p.z,.9),1,route.id+" intersects a building or barrier at "+p.x+","+p.z);}
});

test("complete bus footprints are on physical roads at bends, ramp merges and bridge transitions",async()=>{
  const e=await engine(),w=new Life.World();for(const route of w.routes)for(let d=1;d<route._path.length;d+=2){const p=Road.sample(route,d,route.lane),sin=Math.sin(p.yaw),cos=Math.cos(p.yaw);
    for(const x of [-1.15,1.15])for(const z of [-4.3,4.3]){const px=p.x+x*cos+z*sin*Math.cos(p.pitch),pz=p.z-x*sin+z*cos*Math.cos(p.pitch),expected=p.y+.19-z*Math.sin(p.pitch),floor=e.floor_height(px,pz,expected+.6,2),material=e.floor_material(px,pz,expected+.6,2);
      assert.ok(Number.isFinite(floor)&&Math.abs(floor-expected)<.28&&[2,5,11].includes(material),`${route.id}: wheel leaves the actual road at ${px},${pz}; material ${material}, height ${floor}`);
      assert.equal(e.static_space_clear(px,expected+1.4,pz,.1),1,`${route.id}: body corner intersects scenery at ${px},${pz}`);
    }
  }
});

test("moving pedestrians keep body clearance and separation while continuing through real streets",async()=>{
  const e=await engine(),w=new Life.World(),hooks={ground:(x,z,y)=>e.floor_height(x,z,y,2),clear:(x,y,z,r)=>e.static_space_clear(x,y,z,r)===1};w.update(0,hooks);
  for(let step=1;step<=1200;step++){w.update(step/30,hooks);if(step%30)continue;for(const p of w.people.filter(p=>p.path)){const s=p.profile.height/1.77,f=e.floor_height(p.pose.x,p.pose.z,p.pose.y+.8,2);assert.ok(Number.isFinite(f)&&Math.abs(f-p.pose.y)<.04,p.id+" loses ground support");assert.equal(e.static_space_clear(p.pose.x,f+.63*s,p.pose.z,(p.mode==="cycle"?.60:.41)*s),1,p.id+" clips scenery with the real body");assert.equal(e.static_space_clear(p.pose.x,f+1.54*s,p.pose.z,.24*s),1,p.id+" clips scenery with the head");
      for(const q of w.people){if(q===p||Math.abs(q.pose.y-p.pose.y)>1.1)continue;const min=(p.mode==="cycle"?.85:.43*s)+(q.mode==="cycle"?.85:.43*q.profile.height/1.77);assert.ok(Math.hypot(q.pose.x-p.pose.x,q.pose.z-p.pose.z)>=min-.005,p.id+" walks through "+q.id);}
    }}
  for(const p of w.people.filter(p=>p.path))assert.ok(p.routeTravel>2,p.id+" is permanently frozen or only shuffling instead of progressing along its street");
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

test("trains reverse on their own tracks and align their floor and wheel gauge with real platforms",()=>{
  const G=require("../js/city-shuttle-geometry.js");let previous=new Map();for(let t=0;t<420;t+=.5){const b=new G.Builder("test"),f=Transit.draw(b,t,[-1490,16,-2220]);for(const rail of f.audio.filter(s=>s.kind==="rail")){const before=previous.get(rail.id);if(before){assert.equal(rail.z,before.z,"reversing must not teleport across the other track");assert.ok(Math.abs(rail.x-before.x)<35);}previous.set(rail.id,rail);}}
  const b=new G.Builder("test");Transit.draw(b,40,[-1490,16,-2220]);const floor=b.objects.find(o=>o.id.includes("metro-0-car-floor-0"));assert.ok(floor);const v=floor.values;assert.ok(Math.abs(v[1]+v[4]-15.12)<.001);const bodyEdge=v[2]+v[3],platformEdge=-2223.1;assert.ok(platformEdge-bodyEdge>0&&platformEdge-bodyEdge<.12,"platform gap is under 12 cm");
  const wheels=b.objects.filter(o=>o.id.includes("metro-0-wheel-")&&!o.id.includes("rim"));assert.ok(wheels.length>8);for(const wheel of wheels){assert.ok(Math.abs(Math.abs(wheel.values[2]+2224.68)-.76)<.002,"wheel centres are on the 1.52 m gauge");assert.ok(Math.abs(wheel.values[1]-wheel.values[4]-14.23)<.002,"wheels contact the actual rail head");}
});
