const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const Core=require("../js/city-shuttle-core.js");
const Scene=require("../js/city-shuttle-scene.js");
const root=path.resolve(__dirname,"..");
const assetSource=fs.readFileSync(path.join(root,"js/city-shuttle-engine-url.js"),"utf8");
const wasm=fs.readFileSync(path.join(root,assetSource.match(/"([^\"]+\.wasm)"/)[1]));

async function createEngine(scene) {
  const {instance}=await WebAssembly.instantiate(wasm,{});const e=instance.exports;
  if(scene){const count=scene.length/Scene.STRIDE;const ptr=e.scene_buffer(count);new Float32Array(e.memory.buffer,ptr,scene.length).set(scene);assert.equal(e.scene_commit(count),count);}
  return e;
}
function state(e){return Array.from(new Float32Array(e.memory.buffer,e.state_ptr(),8));}
function object(x,y,z,w,h,d,shape=0,yaw=0) {return new Float32Array([x,y,z,w/2,h/2,d/2,yaw,.3,.7,.5,1,35,.1,3,4,53215,shape,1,0,.2,.3,.4,0,0,0,0]);}
function render(e,columns=180,rows=80){const ptr=e.render_ascii(columns,rows,1.7);return Buffer.from(new Uint8Array(e.memory.buffer,ptr,columns*rows*4));}

test("authored composition has stable identities, finite geometry and distinct building silhouettes",()=>{
  const a=Scene.build(),b=Scene.build();assert.deepEqual(a.packed,b.packed);
  assert.equal(new Set(a.objects.map(o=>o.id)).size,a.objects.length);
  assert.ok(a.sites.length>=30);assert.ok(a.objects.length>=600);
  for(const site of a.sites){assert.ok(site.description.length>10);assert.ok(site.count>0);}
  const silhouettes=new Set();
  for(const site of a.sites.filter(s=>!['ground','streets','street-life'].includes(s.id)&&!['road','junction'].includes(s.kind))){
    const geometry=a.objects.slice(site.start,site.start+site.count).map(o=>[...o.values.slice(0,7).map((v,i)=>i===0?v-site.x:i===2?v-site.z:v),o.values[16],...o.values.slice(24,26)]);
    const signature=JSON.stringify(geometry);assert.ok(!silhouettes.has(signature),"duplicate composition: "+site.name);silhouettes.add(signature);
  }
  assert.doesNotMatch(fs.readFileSync(path.join(root,"js/city-shuttle-scene.js"),"utf8"),/Math\.random|describeChunk|towerVariant/);
});

test("runtime loads the built first-party Wasm and content hash matches build manifest",async()=>{
  const metadata=JSON.parse(fs.readFileSync(path.join(root,"libs/city-shuttle-20261008/build.json"),"utf8"));
  assert.equal(crypto.createHash("sha256").update(wasm).digest("hex"),metadata.sha256);
  assert.equal(wasm.length,metadata.bytes);
  const module=await WebAssembly.compile(wasm);assert.deepEqual(WebAssembly.Module.imports(module),[]);
  assert.equal((await createEngine()).engine_version(),3);
});

test("each actual starting view renders coloured characters and roofs use the same scene",async()=>{
  const scene=Scene.build();const e=await createEngine(scene.packed);
  for(const spawn of Scene.SPAWNS){e.reset_flight(spawn.x,spawn.y,spawn.z,spawn.yaw,spawn.pitch);const pixels=render(e);let visible=0;let colours=new Set();
    for(let i=0;i<pixels.length;i+=4){if(pixels[i]!==32){visible++;colours.add(pixels.subarray(i+1,i+4).toString("hex"));}}
    assert.ok(visible>1200,spawn.name+" has insufficient visible geometry");assert.ok(colours.size>15,spawn.name+" lacks colour detail");
    assert.deepEqual(render(e),pixels,"stationary view must be stable");
  }
});

test("flight moves, stops smoothly, can rise and turn without missions or automatic propulsion",async()=>{
  const e=await createEngine();e.reset_flight(0,10,100,0,0);
  for(let i=0;i<60;i++)e.flight_tick(1/60,1,0,0);
  const moved=state(e);assert.ok(moved[2]<80);assert.ok(moved[6]>30);
  for(let i=0;i<300;i++)e.flight_tick(1/60,0,0,0);
  const stop=state(e);assert.ok(Math.abs(stop[6])<.001);
  for(let i=0;i<60;i++)e.flight_tick(1/60,32,1,.1);
  const risen=state(e);assert.ok(risen[1]>25);assert.ok(risen[3]>1);assert.ok(risen[4]>0);
});

test("swept collision prevents fast flight through a thin wall and allows parallel sliding",async()=>{
  const e=await createEngine(object(0,10,0,40,40,.4));e.reset_flight(0,10,10,0,0);
  for(let i=0;i<120;i++)e.flight_tick(1/60,17,0,0);
  assert.ok(state(e)[2]>=.9,"must remain in front of thin wall");
  const before=state(e);for(let i=0;i<30;i++)e.flight_tick(1/60,9,0,0);
  assert.ok(state(e)[0]>before[0]+4,"sideways motion should slide along the wall");
});

test("oblique geometry and ellipsoids produce different directional ray hits",async()=>{
  const flat=await createEngine(object(0,10,0,20,20,3));const rotated=await createEngine(object(0,10,0,20,20,3,0,.65));
  flat.reset_flight(0,10,28,0,0);rotated.reset_flight(0,10,28,0,0);assert.notDeepEqual(render(flat),render(rotated));
  const sphere=await createEngine(object(0,10,0,20,20,20,1));sphere.reset_flight(0,10,28,0,0);assert.notDeepEqual(render(flat),render(sphere));
});

test("interior gallery is traversable and its rear wall prevents leaving through solid masonry",async()=>{
  const e=await createEngine(Scene.build().packed);const spawn=Scene.SPAWNS.find(s=>s.id==="arcade");e.reset_flight(spawn.x,spawn.y,spawn.z,spawn.yaw,spawn.pitch);
  e.reset_flight(spawn.x,spawn.y,-190,spawn.yaw,spawn.pitch);
  for(let i=0;i<60;i++)e.flight_tick(1/60,1,0,0);assert.ok(state(e)[2]<-210,"entrance should be open");
  for(let i=0;i<240;i++)e.flight_tick(1/60,17,0,0);assert.ok(state(e)[2]>-270.5,"solid rear wall should stop flight");
});

test("window apertures reveal actual objects outside while retaining physical glass collision",async()=>{
  const front=object(0,10,0,20,20,1);const back=object(0,10,-20,20,20,3);back[7]=1;back[8]=.15;back[9]=.05;back[10]=0;
  const opaque=await createEngine(new Float32Array([...front,...back]));front[10]=10;
  const open=await createEngine(new Float32Array([...front,...back]));opaque.reset_flight(0,10,25,0,0);open.reset_flight(0,10,25,0,0);
  const index=(40*181+90)*4;const a=render(opaque,181,81),b=render(open,181,81);
  assert.ok(a[index+2]>a[index+1],"opaque facade should appear green");assert.ok(b[index+1]>b[index+2],"window should reveal the red object behind it");
  for(let i=0;i<180;i++)open.flight_tick(1/60,17,0,0);assert.ok(state(open)[2]>.9,"glass must remain a physical boundary");
});

test("desktop grid stays within Wasm limits and input expresses only free-flight movement",()=>{
  for(const size of [[1280,720],[1920,1080],[900,600],[3840,2160],[900,1800]])for(const detailed of [false,true]){const g=Core.grid(...size,detailed);assert.ok(g.columns>=32&&g.columns<=840);assert.ok(g.rows>=24&&g.rows<=480);}
  assert.equal(Core.flags({}),0);assert.equal(Core.flags({KeyW:true,ShiftLeft:true,KeyE:true}),49);
  assert.equal(Core.flags({ShiftLeft:true}),0);
});

test("doubled character grids render complete Wasm frames beyond the former size limits",async()=>{
  const e=await createEngine(object(0,10,0,20,20,3));e.reset_flight(0,10,28,0,0);
  for(const detailed of [false,true]){
    const g=Core.grid(1920,1080,detailed);
    assert.deepEqual([g.columns,g.rows],detailed?[640,244]:[480,184]);
    const pixels=render(e,g.columns,g.rows);
    assert.equal(pixels.length,g.columns*g.rows*4);
    assert.ok(pixels[(g.rows*g.columns-1)*4]>=32,"last cell must contain a rendered glyph");
    const index=(Math.floor(g.rows/2)*g.columns+Math.floor(g.columns/2))*4;
    assert.notEqual(pixels[index],32,"centre must show the actual foreground geometry");
  }
});

test("every authored portal can actually be flown through, including ascending and inclined interior streets",async()=>{
  const scene=Scene.build();const e=await createEngine(scene.packed);
  for(const spawn of Scene.SPAWNS)assert.equal(e.is_space_clear(spawn.x,spawn.y,spawn.z,.8),1,spawn.name+" starts inside a structure");
  for(const passage of Scene.PASSAGES){
    for(let i=0;i<passage.points.length-1;i++){
      const a=passage.points[i],b=passage.points[i+1],delta=b.map((v,j)=>v-a[j]),length=Math.hypot(...delta),horizontal=Math.hypot(delta[0],delta[2]);
      const yaw=Math.atan2(delta[0],-delta[2]),pitch=Math.atan2(delta[1],horizontal),flags=horizontal<.01?(delta[1]>0?32:64):1;
      e.reset_flight(...a,yaw,horizontal<.01?0:pitch);
      let travelled=0;
      for(let frame=0;frame<1800&&travelled<length;frame++){
        e.flight_tick(1/60,flags,0,0);const position=state(e);travelled=Math.hypot(position[0]-a[0],position[1]-a[1],position[2]-a[2]);
        assert.equal(position[7],0,passage.id+" hits a structure in segment "+i);
        assert.equal(e.is_space_clear(...position.slice(0,3),.79),1,passage.id+" clips through geometry");
      }
      assert.ok(travelled>=length,passage.id+" cannot traverse the planned space");
    }
  }
});

test("pitch and roll geometry keeps collision in the actual rotated space",async()=>{
  const ramp=object(0,10,0,50,1,20);ramp[25]=Math.PI/4;
  const e=await createEngine(ramp);assert.equal(e.is_space_clear(5,15,0,.8),0);assert.equal(e.is_space_clear(5,4,0,.8),1);
  e.reset_flight(5,2,0,0,0);let firstHit=null;
  for(let i=0;i<120;i++){e.flight_tick(1/60,32,0,0);const p=state(e);if(p[7]&&!firstHit)firstHit=p;assert.equal(e.is_space_clear(...p.slice(0,3),.79),1,"sliding must not enter the rotated slab");}
  assert.ok(firstHit&&firstHit[1]>12&&firstHit[1]<15,"first contact must occur at the inclined local surface");
});

test("world signs have shaped lettering instead of repeating one glyph across a rectangle",async()=>{
  const front=object(0,10,0,20,20,1);front[10]=8;front[11]="O".charCodeAt(0);front[17]=0;
  const back=object(0,10,-20,20,20,3);back[7]=1;back[8]=.15;back[9]=.05;back[10]=0;
  const e=await createEngine(new Float32Array([...front,...back]));const index=(40*181+90)*4;
  e.reset_flight(0,10,25,0,0);const hole=render(e,181,81);assert.ok(hole[index+1]>hole[index+2],"letter O must reveal the red background at its centre");
  e.reset_flight(-8,10,25,0,0);const stroke=render(e,181,81);assert.ok(stroke[index+2]>stroke[index+1],"letter O must keep the green side stroke");assert.equal(stroke[index],35);
});

test("route aliases load the new core and obsolete mission controls are removed",()=>{
  const registry=fs.readFileSync(path.join(root,"js/page-registry.js"),"utf8");const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const template=html.slice(html.indexOf('<template id="page-city-shuttle">'),html.indexOf('</template>',html.indexOf('<template id="page-city-shuttle">')));
  assert.match(registry,/"anomaly-bureau"/);assert.match(registry,/"ascii-void"/);assert.match(registry,/city-shuttle-scene\.js/);
  assert.doesNotMatch(template,/data-cs-score|data-cs-mission|data-cs-seed|随机城市|任务/);
  assert.match(template,/data-cs-startpoint/);
});
