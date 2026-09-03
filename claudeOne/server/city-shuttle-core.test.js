const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Core = require("../js/city-shuttle-core.js");

const root = path.resolve(__dirname, "..");

test("world configuration locks the authored flight and streaming scale", () => {
  assert.equal(Core.WORLD_CONFIG.chunkSize, 320);
  assert.equal(Core.WORLD_CONFIG.metroChunks, 24);
  assert.equal(Core.WORLD_CONFIG.minSpeed, 45);
  assert.equal(Core.WORLD_CONFIG.maxSpeed, 145);
  assert.equal(Core.WORLD_CONFIG.boostSpeed, 210);
  assert.equal(Core.DISTRICT_CATALOG.length, 10);
  assert.equal(Core.MISSION_CATALOG.length, 7);
  assert.deepEqual(Core.CONTENT_COUNTS, {
    towerVariants: 24,
    towerClusters: 12,
    villaVariants: 12,
    commercialVariants: 10,
    parkVariants: 6,
    roadVariants: 6,
    interchangeVariants: 4,
    landmarkVariants: 8,
    treeVariants: 5,
    missionTypes: 7
  });
});

test("same seed and coordinates always describe the same chunk", () => {
  const a = Core.describeChunk(Core.createWorld("SKY-ALPHA"), 143, -87);
  const b = Core.describeChunk(Core.createWorld("SKY-ALPHA"), 143, -87);
  assert.deepEqual(a, b);
  assert.equal(a.key, "143,-87");
});

test("different seeds produce meaningfully different cities", () => {
  const a = Core.describeChunk(Core.createWorld("SKY-ALPHA"), 12, 12);
  const b = Core.describeChunk(Core.createWorld("SKY-BETA"), 12, 12);
  assert.notDeepEqual({ city: a.city, tower: a.towerVariant }, { city: b.city, tower: b.towerVariant });
});

test("road and rail connectors remain continuous across chunk boundaries", () => {
  const world = Core.createWorld("CONNECTORS");
  for (let z = -30; z <= 30; z += 1) {
    const current = Core.describeChunk(world, 0, z);
    const next = Core.describeChunk(world, 0, z + 1);
    assert.equal(current.roads.north, next.roads.south);
  }
  for (let x = -30; x <= 30; x += 1) {
    assert.equal(Core.describeChunk(world, x, 8).rail.eastWest, true);
  }
});

test("every sampled metropolis has one landmark and a non-overlapping airport", () => {
  const world = Core.createWorld("AIRSPACE");
  for (let metroZ = -2; metroZ <= 2; metroZ += 1) {
    for (let metroX = -2; metroX <= 2; metroX += 1) {
      let landmarks = 0;
      let airports = 0;
      for (let z = 0; z < 24; z += 1) {
        for (let x = 0; x < 24; x += 1) {
          const chunk = Core.describeChunk(world, metroX * 24 + x, metroZ * 24 + z);
          if (chunk.special === "landmark") landmarks += 1;
          if (chunk.special === "airport") airports += 1;
          assert.notEqual(chunk.special === "landmark" && chunk.airport.inside, true);
        }
      }
      assert.equal(landmarks, 1);
      assert.ok(airports >= 12);
    }
  }
});

test("metropolis edges form low-density transition belts", () => {
  const world = Core.createWorld("GREEN-EDGE");
  const edge = Core.describeChunk(world, 0, 0);
  const center = Core.describeChunk(world, 11, 11);
  assert.ok(edge.transition > 0.7);
  assert.ok(edge.density < center.density);
  assert.ok(edge.greenery > 0.5);
});

test("a representative world exposes every district and authored variant family", () => {
  const world = Core.createWorld("CONTENT-COVERAGE");
  const districts = new Set();
  const towers = new Set();
  const clusters = new Set();
  const villas = new Set();
  const commerce = new Set();
  const parks = new Set();
  const landmarks = new Set();
  for (let z = -48; z < 72; z += 1) {
    for (let x = -48; x < 72; x += 1) {
      const chunk = Core.describeChunk(world, x, z);
      districts.add(chunk.district.id);
      towers.add(chunk.towerVariant);
      clusters.add(chunk.clusterVariant);
      villas.add(chunk.villaVariant);
      commerce.add(chunk.commercialVariant);
      parks.add(chunk.parkVariant);
      if (chunk.special === "landmark") landmarks.add(chunk.city.landmarkVariant);
    }
  }
  assert.equal(districts.size, Core.DISTRICT_CATALOG.length);
  assert.equal(towers.size, Core.CONTENT_COUNTS.towerVariants);
  assert.equal(clusters.size, Core.CONTENT_COUNTS.towerClusters);
  assert.equal(villas.size, Core.CONTENT_COUNTS.villaVariants);
  assert.equal(commerce.size, Core.CONTENT_COUNTS.commercialVariants);
  assert.equal(parks.size, Core.CONTENT_COUNTS.parkVariants);
  assert.ok(landmarks.size >= 6);
});

test("flight never drops below cruise floor or exceeds boost cap", () => {
  let state = Core.createFlightState("FLIGHT");
  for (let index = 0; index < 1200; index += 1) state = Core.stepFlight(state, { brake: true }, 1 / 120);
  assert.equal(state.speed, 45);
  for (let index = 0; index < 1200; index += 1) state = Core.stepFlight(state, { boost: true }, 1 / 120);
  assert.ok(state.speed <= 210);
  assert.ok(state.speed >= 45);
  assert.ok(state.distance > 0);
});

test("fixed-step flight turns, banks and respects altitude steering", () => {
  let state = Core.createFlightState("CONTROL");
  const start = { ...state.position };
  for (let index = 0; index < 120; index += 1) state = Core.stepFlight(state, { turnX: 0.7, turnY: 0.25, bank: 1, thrust: true }, 1 / 120);
  assert.notEqual(state.yaw, 0);
  assert.ok(state.roll > 0);
  assert.notDeepEqual(state.position, start);
});

test("third-person shuttle nose follows flight yaw and pitch", () => {
  const samples = [
    { yaw: 0, pitch: 0, roll: 0 },
    { yaw: 0.8, pitch: 0.35, roll: 0.5 },
    { yaw: -1.4, pitch: -0.42, roll: -0.7 },
    { yaw: Math.PI, pitch: 0.18, roll: 1.1 }
  ];
  for (const sample of samples) {
    const flightForward = Core.forwardVector(sample.yaw, sample.pitch);
    const modelForward = Core.rotateModelVector(
      { x: 0, y: 0, z: -1 },
      { x: sample.pitch, y: sample.yaw, z: -sample.roll }
    );
    assert.ok(Math.abs(modelForward.x - flightForward.x) < 1e-12);
    assert.ok(Math.abs(modelForward.y - flightForward.y) < 1e-12);
    assert.ok(Math.abs(modelForward.z - flightForward.z) < 1e-12);
  }
});

test("positive shuttle bank lowers its right wing", () => {
  const modelRight = Core.rotateModelVector(
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: -0.6 }
  );
  assert.ok(modelRight.y < 0);
});

test("swept-sphere collision catches thin structures at boost speed", () => {
  const hit = Core.sweepSphere(
    { x: -100, y: 30, z: 0 },
    { x: 100, y: 30, z: 0 },
    2.4,
    [{ x: 0, y: 30, z: 0, hx: 0.4, hy: 20, hz: 20, tag: "thin-wall" }]
  );
  assert.ok(hit);
  assert.equal(hit.collider.tag, "thin-wall");
  assert.ok(hit.time < 0.6);
});

test("all seven mission types create forward, completable checkpoint routes", () => {
  const world = Core.createWorld("MISSIONS");
  for (const definition of Core.MISSION_CATALOG) {
    let mission = Core.createMission(world, definition.id, { x: 160, y: 110, z: 160 }, 0);
    assert.equal(mission.checkpoints.length, definition.checkpointCount);
    assert.ok(mission.checkpoints.every((point) => point.radius >= 15 && point.y >= 24));
    assert.equal(Core.missionHasClearance(mission, [], 10), true);
    for (const point of mission.checkpoints) mission = Core.advanceMission(mission, point, 0.1);
    assert.equal(mission.complete, true);
    assert.ok(Core.scoreMission(mission, 2) > mission.baseScore);
  }
});

test("crash recovery preserves total score while clearing combo", () => {
  const state = Core.createFlightState("CRASH");
  state.totalScore = 9876;
  state.combo = 4.8;
  state.crashes = 2;
  state.checkpoint = { x: 800, y: 40, z: -500, yaw: 1.2 };
  const recovered = Core.resolveCrash(state);
  assert.equal(recovered.totalScore, 9876);
  assert.equal(recovered.combo, 1);
  assert.equal(recovered.crashes, 3);
  assert.deepEqual(recovered.position, { x: 800, y: 72, z: -500 });
});

test("twenty minutes of fixed-step flight crosses many metros without a world edge", () => {
  const world = Core.createWorld("ENDLESS-RUN");
  let state = Core.createFlightState(world.seed);
  const metros = new Set();
  for (let frame = 0; frame < 1200 * 120; frame += 1) {
    state = Core.stepFlight(state, { thrust: true }, 1 / 120);
    if (frame % 120 === 0) {
      const chunk = Core.describeChunk(world, Core.floorDiv(state.position.x, 320), Core.floorDiv(state.position.z, 320));
      metros.add(chunk.city.metroX + "," + chunk.city.metroZ);
    }
  }
  assert.ok(Number.isFinite(state.position.x) && Number.isFinite(state.position.z));
  assert.ok(state.distance > 150000);
  assert.ok(metros.size >= 18);
});

test("city shuttle replaces the old page while preserving route aliases", () => {
  const registry = fs.readFileSync(path.join(root, "js/page-registry.js"), "utf8");
  const cards = fs.readFileSync(path.join(root, "js/tool-cards.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const game = fs.readFileSync(path.join(root, "js/city-shuttle.js"), "utf8");
  assert.match(registry, /"city-shuttle"/);
  assert.match(registry, /"anomaly-bureau"/);
  assert.match(registry, /"ascii-void"/);
  assert.match(registry, /__page_city_shuttle/);
  assert.match(cards, /无界穿梭：天际城/);
  assert.match(cards, /#\/city-shuttle/);
  assert.match(html, /template id="page-city-shuttle"/);
  assert.match(html, /data-cs-seed/);
  assert.match(html, /PC 键鼠/);
  assert.match(game, /getContext\("webgl2"/);
  assert.match(game, /drawElementsInstanced/);
  assert.match(game, /ASCII_SCALE\s*=\s*3/);
  assert.match(game, /mat3 rotY\(float a\).*mat3\(c,0,s,0,1,0,-s,0,c\)/);
  assert.doesNotMatch(game, /rx:-pitch,ry:yaw/);
  assert.match(game, /window\.__page_city_shuttle/);
});

test("procedural generation contains no nondeterministic Math.random calls", () => {
  const core = fs.readFileSync(path.join(root, "js/city-shuttle-core.js"), "utf8");
  const game = fs.readFileSync(path.join(root, "js/city-shuttle.js"), "utf8");
  assert.doesNotMatch(core, /Math\.random/);
  assert.doesNotMatch(game, /Math\.random/);
});
