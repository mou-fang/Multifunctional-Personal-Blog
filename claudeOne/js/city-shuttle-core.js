/* ===== claudeOne :: city-shuttle-core.js =====
 * Deterministic infinite-city generation, arcade flight, missions and collision.
 */

(function exposeCityShuttleCore(root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CityShuttleCore = api;
})(typeof window !== "undefined" ? window : globalThis, function createCityShuttleCore() {
  "use strict";

  var WORLD_CONFIG = Object.freeze({
    chunkSize: 320,
    metroChunks: 24,
    transitionChunks: 4,
    floatingOriginDistance: 4096,
    minSpeed: 45,
    cruiseSpeed: 92,
    maxSpeed: 145,
    boostSpeed: 210,
    minAltitude: 5,
    maxAltitude: 520,
    shuttleRadius: 2.4,
    maxCombo: 5
  });

  var CONTENT_COUNTS = Object.freeze({
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

  var DISTRICT_CATALOG = Object.freeze([
    Object.freeze({ id: "cbd", label: "中央天际区", density: 1.0, greenery: 0.14 }),
    Object.freeze({ id: "commercial", label: "都会商业区", density: 0.78, greenery: 0.22 }),
    Object.freeze({ id: "mixed", label: "未来混合区", density: 0.62, greenery: 0.34 }),
    Object.freeze({ id: "eco", label: "垂直生态区", density: 0.66, greenery: 0.74 }),
    Object.freeze({ id: "villa", label: "花园住宅区", density: 0.28, greenery: 0.68 }),
    Object.freeze({ id: "park", label: "城市公园带", density: 0.12, greenery: 0.92 }),
    Object.freeze({ id: "amusement", label: "天空游乐港", density: 0.34, greenery: 0.48 }),
    Object.freeze({ id: "transit", label: "立体交通枢纽", density: 0.56, greenery: 0.18 }),
    Object.freeze({ id: "airport", label: "都会航空港", density: 0.08, greenery: 0.16 }),
    Object.freeze({ id: "greenbelt", label: "城市过渡绿带", density: 0.16, greenery: 0.86 })
  ]);

  var MISSION_CATALOG = Object.freeze([
    Object.freeze({ id: "ring-race", label: "城市穿环竞速", checkpointCount: 8, timeLimit: 78, altitude: 105, spacing: 145 }),
    Object.freeze({ id: "tower-canyon", label: "摩天楼峡谷航线", checkpointCount: 9, timeLimit: 88, altitude: 92, spacing: 132 }),
    Object.freeze({ id: "interchange", label: "立交桥特技链", checkpointCount: 7, timeLimit: 70, altitude: 38, spacing: 118 }),
    Object.freeze({ id: "rail-shadow", label: "高铁编队追随", checkpointCount: 10, timeLimit: 96, altitude: 48, spacing: 138 }),
    Object.freeze({ id: "airport-wake", label: "客机尾流回避", checkpointCount: 9, timeLimit: 90, altitude: 126, spacing: 160 }),
    Object.freeze({ id: "landmark-scan", label: "地标高速扫描", checkpointCount: 6, timeLimit: 82, altitude: 188, spacing: 176 }),
    Object.freeze({ id: "amusement-thread", label: "游乐设施连续穿越", checkpointCount: 8, timeLimit: 80, altitude: 62, spacing: 126 })
  ]);

  var CITY_PREFIXES = Object.freeze(["澄光", "星湾", "云脊", "青岚", "曜川", "镜海", "风庭", "日环", "银浦", "新穹", "栖霞", "赫港"]);
  var CITY_SUFFIXES = Object.freeze(["市", "都会", "新城", "港", "天际城", "绿洲", "都市圈", "空港城"]);
  var ARCHITECTURES = Object.freeze(["crystal", "terrace", "arc", "garden", "monolith", "crown"]);
  var PALETTES = Object.freeze([
    Object.freeze({ glass: [0.18, 0.58, 0.76], stone: [0.42, 0.52, 0.60], light: [0.24, 0.92, 1.0], accent: [1.0, 0.46, 0.18] }),
    Object.freeze({ glass: [0.38, 0.30, 0.76], stone: [0.54, 0.50, 0.66], light: [0.78, 0.56, 1.0], accent: [0.18, 0.92, 0.70] }),
    Object.freeze({ glass: [0.14, 0.68, 0.60], stone: [0.40, 0.58, 0.52], light: [0.28, 1.0, 0.68], accent: [1.0, 0.72, 0.20] }),
    Object.freeze({ glass: [0.18, 0.42, 0.78], stone: [0.66, 0.66, 0.62], light: [0.42, 0.74, 1.0], accent: [1.0, 0.30, 0.36] }),
    Object.freeze({ glass: [0.70, 0.34, 0.22], stone: [0.62, 0.50, 0.42], light: [1.0, 0.66, 0.30], accent: [0.20, 0.76, 1.0] }),
    Object.freeze({ glass: [0.22, 0.62, 0.70], stone: [0.74, 0.72, 0.64], light: [0.55, 0.96, 1.0], accent: [0.96, 0.34, 0.66] })
  ]);

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function floorDiv(value, divisor) {
    return Math.floor(value / divisor);
  }

  function positiveMod(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function normalizeSeed(value) {
    var text = String(value == null ? "" : value).trim().replace(/\s+/g, "-").slice(0, 32);
    return text || "SKYLINE-01";
  }

  function mix32(value) {
    value = (value ^ (value >>> 16)) >>> 0;
    value = Math.imul(value, 0x7feb352d) >>> 0;
    value = (value ^ (value >>> 15)) >>> 0;
    value = Math.imul(value, 0x846ca68b) >>> 0;
    return (value ^ (value >>> 16)) >>> 0;
  }

  function hashSeed(seed) {
    var text = normalizeSeed(seed);
    var hash = 2166136261 >>> 0;
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return mix32(hash);
  }

  function hash2D(seedHash, x, z, salt) {
    var value = seedHash >>> 0;
    value ^= Math.imul(x | 0, 0x1f123bb5);
    value ^= Math.imul(z | 0, 0x5f356495);
    value ^= Math.imul((salt || 0) | 0, 0x6c8e9cf5);
    return mix32(value >>> 0);
  }

  function unitFromHash(value) {
    return (value >>> 0) / 4294967296;
  }

  function createRng(seedHash, x, z, salt) {
    var state = hash2D(seedHash, x, z, salt || 0) || 0x9e3779b9;
    return function seededRandom() {
      state = (state + 0x6d2b79f5) >>> 0;
      var mixed = state;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  }

  function cityDescriptor(world, metroX, metroZ) {
    var cityHash = hash2D(world.seedHash, metroX, metroZ, 91);
    var accentHash = hash2D(world.seedHash, metroX, metroZ, 113);
    return Object.freeze({
      metroX: metroX,
      metroZ: metroZ,
      name: CITY_PREFIXES[cityHash % CITY_PREFIXES.length] + CITY_SUFFIXES[(cityHash >>> 7) % CITY_SUFFIXES.length],
      architecture: ARCHITECTURES[(cityHash >>> 11) % ARCHITECTURES.length],
      paletteIndex: (cityHash >>> 17) % PALETTES.length,
      greenery: 0.22 + unitFromHash(accentHash) * 0.54,
      traffic: 0.42 + unitFromHash(hash2D(world.seedHash, metroX, metroZ, 117)) * 0.52,
      landmarkVariant: cityHash % 8,
      airportSide: (cityHash >>> 4) % 4,
      identity: cityHash % 4
    });
  }

  function airportInfo(localX, localZ, city) {
    var offset = 6 + (hash2D(city.landmarkVariant, city.metroX, city.metroZ, 131) % 9);
    var side = city.airportSide;
    var startX = side === 0 ? 1 : side === 2 ? 19 : offset;
    var startZ = side === 1 ? 1 : side === 3 ? 19 : offset;
    var width = side % 2 === 0 ? 4 : 3;
    var depth = side % 2 === 0 ? 3 : 4;
    var inside = localX >= startX && localX < startX + width && localZ >= startZ && localZ < startZ + depth;
    return { inside: inside, startX: startX, startZ: startZ, width: width, depth: depth, side: side };
  }

  function amusementInfo(localX, localZ, city) {
    var quadrant = (city.landmarkVariant + city.airportSide + 1) % 4;
    var startX = quadrant === 0 || quadrant === 3 ? 4 : 18;
    var startZ = quadrant < 2 ? 18 : 4;
    return { inside: localX >= startX && localX < startX + 2 && localZ >= startZ && localZ < startZ + 2, startX: startX, startZ: startZ };
  }

  function districtById(id) {
    for (var index = 0; index < DISTRICT_CATALOG.length; index += 1) {
      if (DISTRICT_CATALOG[index].id === id) return DISTRICT_CATALOG[index];
    }
    return DISTRICT_CATALOG[2];
  }

  function describeChunk(world, chunkX, chunkZ) {
    if (!world || !Number.isFinite(world.seedHash)) throw new Error("无效城市世界");
    chunkX = Math.floor(Number(chunkX) || 0);
    chunkZ = Math.floor(Number(chunkZ) || 0);
    var metroX = floorDiv(chunkX, WORLD_CONFIG.metroChunks);
    var metroZ = floorDiv(chunkZ, WORLD_CONFIG.metroChunks);
    var localX = positiveMod(chunkX, WORLD_CONFIG.metroChunks);
    var localZ = positiveMod(chunkZ, WORLD_CONFIG.metroChunks);
    var city = cityDescriptor(world, metroX, metroZ);
    var center = (WORLD_CONFIG.metroChunks - 1) * 0.5;
    var radial = Math.hypot(localX - center, localZ - center) / (center * 1.4142);
    var edgeDistance = Math.min(localX, localZ, WORLD_CONFIG.metroChunks - 1 - localX, WORLD_CONFIG.metroChunks - 1 - localZ);
    var transition = clamp((WORLD_CONFIG.transitionChunks - edgeDistance) / WORLD_CONFIG.transitionChunks, 0, 1);
    var airport = airportInfo(localX, localZ, city);
    var amusement = amusementInfo(localX, localZ, city);
    var random = unitFromHash(hash2D(world.seedHash, chunkX, chunkZ, 7));
    var districtId;
    var special = "";

    if (airport.inside) {
      districtId = "airport";
      special = "airport";
    } else if (amusement.inside) {
      districtId = "amusement";
      special = "amusement";
    } else if (localX === 12 && localZ === 12) {
      districtId = "cbd";
      special = "landmark";
    } else if (transition > 0.72) {
      districtId = random < 0.58 ? "greenbelt" : "villa";
    } else if (radial < 0.23) {
      districtId = random < 0.72 ? "cbd" : "commercial";
    } else if (radial < 0.47) {
      districtId = random < 0.34 ? "commercial" : random < 0.56 ? "eco" : "mixed";
    } else if (radial < 0.73) {
      districtId = random < 0.28 ? "park" : random < 0.64 ? "villa" : "mixed";
    } else {
      districtId = random < city.greenery ? "park" : "villa";
    }

    var mainNS = positiveMod(chunkX, 3) === 0 || localX === 12;
    var mainEW = positiveMod(chunkZ, 3) === 0 || localZ === 12;
    var railEW = positiveMod(chunkZ, WORLD_CONFIG.metroChunks) === 8;
    var railNS = positiveMod(chunkX, WORLD_CONFIG.metroChunks * 2) === 18;
    if ((railEW || railNS) && !special && districtId !== "park") districtId = "transit";

    var district = districtById(districtId);
    var variantHash = hash2D(world.seedHash, chunkX, chunkZ, 19);
    return Object.freeze({
      key: chunkX + "," + chunkZ,
      chunkX: chunkX,
      chunkZ: chunkZ,
      localX: localX,
      localZ: localZ,
      city: city,
      district: district,
      special: special,
      transition: transition,
      greenery: clamp(lerp(district.greenery, 0.86, transition * 0.58), 0, 1),
      density: clamp(district.density * (1 - transition * 0.45), 0.06, 1),
      traffic: clamp(city.traffic * (districtId === "cbd" || districtId === "commercial" ? 1.1 : 0.72), 0.12, 1),
      roads: Object.freeze({ north: mainNS, south: mainNS, east: mainEW, west: mainEW, mainNS: mainNS, mainEW: mainEW }),
      rail: Object.freeze({ eastWest: railEW && !airport.inside, northSouth: railNS && !airport.inside }),
      airport: Object.freeze(airport),
      amusement: Object.freeze(amusement),
      towerVariant: variantHash % 24,
      clusterVariant: (variantHash >>> 5) % 12,
      villaVariant: (variantHash >>> 9) % 12,
      commercialVariant: (variantHash >>> 13) % 10,
      parkVariant: (variantHash >>> 17) % 6,
      roadVariant: (variantHash >>> 20) % 6,
      interchangeVariant: (variantHash >>> 23) % 4,
      palette: PALETTES[city.paletteIndex]
    });
  }

  function createWorld(seed) {
    var normalized = normalizeSeed(seed);
    return Object.freeze({ seed: normalized, seedHash: hashSeed(normalized) });
  }

  function forwardVector(yaw, pitch) {
    var cp = Math.cos(pitch);
    return { x: Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
  }

  // Mirrors the model-space rotation order used by the WebGL shader: Y * X * Z.
  function rotateModelVector(vector, rotation) {
    var x = Number(vector && vector.x) || 0;
    var y = Number(vector && vector.y) || 0;
    var z = Number(vector && vector.z) || 0;
    var rx = Number(rotation && rotation.x) || 0;
    var ry = Number(rotation && rotation.y) || 0;
    var rz = Number(rotation && rotation.z) || 0;
    var cx = Math.cos(rx), sx = Math.sin(rx);
    var cy = Math.cos(ry), sy = Math.sin(ry);
    var cz = Math.cos(rz), sz = Math.sin(rz);
    var x1 = cz * x - sz * y;
    var y1 = sz * x + cz * y;
    var z1 = z;
    var x2 = x1;
    var y2 = cx * y1 - sx * z1;
    var z2 = sx * y1 + cx * z1;
    return {
      x: cy * x2 - sy * z2,
      y: y2,
      z: sy * x2 + cy * z2
    };
  }

  function createFlightState(seed) {
    return {
      seed: normalizeSeed(seed),
      position: { x: 3680, y: 138, z: 3680 },
      yaw: 0,
      pitch: 0,
      roll: 0,
      speed: WORLD_CONFIG.cruiseSpeed,
      boostEnergy: 1,
      totalScore: 0,
      combo: 1,
      comboClock: 0,
      distance: 0,
      elapsed: 0,
      crashes: 0,
      checkpoint: { x: 3680, y: 138, z: 3680, yaw: 0 },
      mission: null
    };
  }

  function cloneMission(mission) {
    if (!mission) return null;
    return {
      id: mission.id,
      type: mission.type,
      label: mission.label,
      checkpoints: mission.checkpoints.map(function (point) { return { x: point.x, y: point.y, z: point.z, radius: point.radius }; }),
      checkpointIndex: mission.checkpointIndex,
      elapsed: mission.elapsed,
      timeLimit: mission.timeLimit,
      complete: mission.complete,
      failed: mission.failed,
      baseScore: mission.baseScore
    };
  }

  function cloneFlight(state) {
    return {
      seed: state.seed,
      position: { x: state.position.x, y: state.position.y, z: state.position.z },
      yaw: state.yaw,
      pitch: state.pitch,
      roll: state.roll,
      speed: state.speed,
      boostEnergy: state.boostEnergy,
      totalScore: state.totalScore,
      combo: state.combo,
      comboClock: state.comboClock,
      distance: state.distance,
      elapsed: state.elapsed,
      crashes: state.crashes,
      checkpoint: { x: state.checkpoint.x, y: state.checkpoint.y, z: state.checkpoint.z, yaw: state.checkpoint.yaw },
      mission: cloneMission(state.mission)
    };
  }

  function stepFlight(state, input, dt) {
    if (!state) throw new Error("飞行状态不存在");
    input = input || {};
    dt = clamp(Number(dt) || 0, 0, 1 / 30);
    var next = cloneFlight(state);
    var turnX = clamp(Number(input.turnX) || 0, -1, 1);
    var turnY = clamp(Number(input.turnY) || 0, -1, 1);
    var bank = clamp(Number(input.bank) || 0, -1, 1);
    next.yaw += turnX * 1.22 * dt;
    next.pitch = clamp(next.pitch + turnY * 1.02 * dt, -1.02, 1.02);
    var desiredRoll = clamp(-turnX * 0.72 + bank * 0.92, -1.15, 1.15);
    next.roll = lerp(next.roll, desiredRoll, clamp(dt * 4.8, 0, 1));

    var target = WORLD_CONFIG.cruiseSpeed;
    if (input.thrust) target = WORLD_CONFIG.maxSpeed;
    if (input.brake) target = WORLD_CONFIG.minSpeed;
    var boosting = !!input.boost && next.boostEnergy > 0.025;
    if (boosting) {
      target = WORLD_CONFIG.boostSpeed;
      next.boostEnergy = Math.max(0, next.boostEnergy - dt * 0.24);
    } else {
      next.boostEnergy = Math.min(1, next.boostEnergy + dt * 0.105);
    }
    var acceleration = target > next.speed ? (boosting ? 58 : 32) : 44;
    var deltaSpeed = clamp(target - next.speed, -acceleration * dt, acceleration * dt);
    next.speed = clamp(next.speed + deltaSpeed, WORLD_CONFIG.minSpeed, WORLD_CONFIG.boostSpeed);

    if (next.position.y > WORLD_CONFIG.maxAltitude && next.pitch > -0.15) next.pitch = lerp(next.pitch, -0.22, clamp(dt * 2.2, 0, 1));
    var forward = forwardVector(next.yaw, next.pitch);
    var distance = next.speed * dt;
    next.position.x += forward.x * distance;
    next.position.y += forward.y * distance;
    next.position.z += forward.z * distance;
    next.distance += distance;
    next.elapsed += dt;
    next.comboClock += dt;
    if (next.comboClock > 6) next.combo = Math.max(1, next.combo - dt * 0.5);
    return next;
  }

  function segmentAabb(start, end, box, radius) {
    var min = { x: box.x - box.hx - radius, y: box.y - box.hy - radius, z: box.z - box.hz - radius };
    var max = { x: box.x + box.hx + radius, y: box.y + box.hy + radius, z: box.z + box.hz + radius };
    var direction = { x: end.x - start.x, y: end.y - start.y, z: end.z - start.z };
    var tMin = 0;
    var tMax = 1;
    var axes = ["x", "y", "z"];
    for (var index = 0; index < axes.length; index += 1) {
      var axis = axes[index];
      if (Math.abs(direction[axis]) < 1e-8) {
        if (start[axis] < min[axis] || start[axis] > max[axis]) return null;
      } else {
        var inverse = 1 / direction[axis];
        var near = (min[axis] - start[axis]) * inverse;
        var far = (max[axis] - start[axis]) * inverse;
        if (near > far) { var swap = near; near = far; far = swap; }
        tMin = Math.max(tMin, near);
        tMax = Math.min(tMax, far);
        if (tMin > tMax) return null;
      }
    }
    return tMin;
  }

  function sweepSphere(start, end, radius, colliders) {
    var earliest = null;
    for (var index = 0; index < (colliders || []).length; index += 1) {
      var hitTime = segmentAabb(start, end, colliders[index], radius);
      if (hitTime == null) continue;
      if (!earliest || hitTime < earliest.time) earliest = { time: hitTime, collider: colliders[index] };
    }
    return earliest;
  }

  function findMissionType(id) {
    for (var index = 0; index < MISSION_CATALOG.length; index += 1) {
      if (MISSION_CATALOG[index].id === id) return MISSION_CATALOG[index];
    }
    return MISSION_CATALOG[0];
  }

  function createMission(world, typeId, origin, yaw) {
    var definition = findMissionType(typeId);
    var originChunkX = floorDiv(origin.x, WORLD_CONFIG.chunkSize);
    var originChunkZ = floorDiv(origin.z, WORLD_CONFIG.chunkSize);
    var rng = createRng(world.seedHash, originChunkX, originChunkZ, MISSION_CATALOG.indexOf(definition) + 401);
    var sideX = Math.cos(yaw);
    var forwardX = Math.sin(yaw);
    var forwardZ = -Math.cos(yaw);
    var sideZ = Math.sin(yaw);
    var checkpoints = [];
    for (var index = 0; index < definition.checkpointCount; index += 1) {
      var distance = 105 + index * definition.spacing;
      var wave = Math.sin(index * 1.17 + rng() * 0.8) * (definition.id === "tower-canyon" ? 38 : 72);
      var lift = Math.sin(index * 0.82 + rng()) * (definition.id === "landmark-scan" ? 48 : 26);
      checkpoints.push({
        x: origin.x + forwardX * distance + sideX * wave,
        y: clamp(definition.altitude + lift, 24, 300),
        z: origin.z + forwardZ * distance + sideZ * wave,
        radius: definition.id === "interchange" ? 15 : 20
      });
    }
    return {
      id: definition.id + "-" + hash2D(world.seedHash, originChunkX, originChunkZ, 509).toString(36),
      type: definition.id,
      label: definition.label,
      checkpoints: checkpoints,
      checkpointIndex: 0,
      elapsed: 0,
      timeLimit: definition.timeLimit,
      complete: false,
      failed: false,
      baseScore: 2600 + definition.checkpointCount * 350
    };
  }

  function missionHasClearance(mission, colliders, clearance) {
    clearance = Number(clearance) || 10;
    if (!mission || !mission.checkpoints.length) return false;
    for (var index = 0; index < mission.checkpoints.length; index += 1) {
      var point = mission.checkpoints[index];
      for (var boxIndex = 0; boxIndex < (colliders || []).length; boxIndex += 1) {
        var box = colliders[boxIndex];
        if (Math.abs(point.x - box.x) <= box.hx + clearance &&
            Math.abs(point.y - box.y) <= box.hy + clearance &&
            Math.abs(point.z - box.z) <= box.hz + clearance) return false;
      }
    }
    return true;
  }

  function advanceMission(mission, position, dt) {
    var next = cloneMission(mission);
    if (!next || next.complete || next.failed) return next;
    next.elapsed += Math.max(0, Number(dt) || 0);
    if (next.elapsed > next.timeLimit) {
      next.failed = true;
      return next;
    }
    var point = next.checkpoints[next.checkpointIndex];
    if (point && Math.hypot(position.x - point.x, position.y - point.y, position.z - point.z) <= point.radius) {
      next.checkpointIndex += 1;
      if (next.checkpointIndex >= next.checkpoints.length) next.complete = true;
    }
    return next;
  }

  function scoreMission(mission, combo) {
    if (!mission || !mission.complete) return 0;
    var remaining = Math.max(0, mission.timeLimit - mission.elapsed);
    return Math.round((mission.baseScore + remaining * 42) * clamp(Number(combo) || 1, 1, WORLD_CONFIG.maxCombo));
  }

  function resolveCrash(state) {
    var next = cloneFlight(state);
    next.position = { x: next.checkpoint.x, y: Math.max(72, next.checkpoint.y), z: next.checkpoint.z };
    next.yaw = next.checkpoint.yaw;
    next.pitch = 0;
    next.roll = 0;
    next.speed = WORLD_CONFIG.minSpeed;
    next.combo = 1;
    next.comboClock = 0;
    next.crashes += 1;
    if (next.mission) {
      next.mission.elapsed = 0;
      next.mission.failed = false;
      next.mission.complete = false;
    }
    return next;
  }

  function formatNumber(value) {
    return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString("zh-CN");
  }

  return Object.freeze({
    WORLD_CONFIG: WORLD_CONFIG,
    CONTENT_COUNTS: CONTENT_COUNTS,
    DISTRICT_CATALOG: DISTRICT_CATALOG,
    MISSION_CATALOG: MISSION_CATALOG,
    normalizeSeed: normalizeSeed,
    hashSeed: hashSeed,
    hash2D: hash2D,
    createRng: createRng,
    createWorld: createWorld,
    cityDescriptor: cityDescriptor,
    describeChunk: describeChunk,
    createFlightState: createFlightState,
    stepFlight: stepFlight,
    forwardVector: forwardVector,
    rotateModelVector: rotateModelVector,
    sweepSphere: sweepSphere,
    createMission: createMission,
    missionHasClearance: missionHasClearance,
    advanceMission: advanceMission,
    scoreMission: scoreMission,
    resolveCrash: resolveCrash,
    formatNumber: formatNumber,
    clamp: clamp,
    floorDiv: floorDiv,
    positiveMod: positiveMod
  });
});
