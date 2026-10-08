const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");
const C = require("../js/paint-mixer-core.js");
const rawModel = require("../libs/paint-data-20261008/kimera-model.json");
const model = C.validateModel(rawModel);
const reference = require("./fixtures/paint-mixer-reference.json");
const paint = id => model.paints.find(p => p.id === id);
const recipe = entries => entries.map(r => ({ paint: paint(r.id), weight: r.weight }));
const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test("physical mixtures agree with 17 independent upstream Python references before display clipping", () => {
  for (const fixture of reference.fixtures) {
    const result = C.mix(recipe(fixture.recipe), "measured", model);
    result.xyz.forEach((v, i) => close(v, fixture.xyz[i]));
    result.rgb.forEach((v, i) => close(v, fixture.rgb[i]));
    result.reflectance.forEach((v, i) => close(v, fixture.reflectance[i]));
  }
});
test("all 12 published fitted white mixtures reconstruct the measured spectra", () => {
  // These are fitting samples, NOT an independent real-paint accuracy validation.
  for (const fixture of reference.calibration) {
    const result = C.mix(recipe(fixture.recipe), "measured", model);
    result.reflectance.forEach((v, i) => close(v, fixture.reflectance[i], 1e-9));
  }
});
test("CIEDE2000 matches published Sharma reference pairs, including zero chroma and hue wrapping", () => {
  const pairs = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.0200], [50, 0, -82.7485], 3.4412],
    [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.49, -.001], [50, -2.49, .0011], 7.2195]
  ];
  for (const [a, b, expected] of pairs) { close(C.deltaE(a, b), expected, .00005); close(C.deltaE(a, b), C.deltaE(b, a)); }
  close(C.deltaE([0, 0, 0], [0, 0, 0]), 0);
});
test("mass mixtures are independent of ingredient order and overall scale, with zero components inert", () => {
  const input = recipe(reference.fixtures.at(-1).recipe), snapshot = JSON.stringify(input);
  const a = C.mix(input, "measured", model), b = C.mix([...input].reverse().map(r => ({ ...r, weight: r.weight * 91 })), "measured", model);
  a.xyz.forEach((v, i) => close(v, b.xyz[i]));
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(C.mix([...input, { paint: { id: "ignored" }, weight: 0 }], "measured", model).hex, a.hex);
  for (const input of [[], [{ paint: paint("kimera-white"), weight: -1 }], [{ paint: paint("kimera-white"), weight: 0 }], [{ paint: paint("kimera-white"), weight: NaN }]]) assert.throws(() => C.mix(input, "measured", model));
});
test("physical mixing rejects missing calibration, mismatched groups and invalid model coefficients", () => {
  assert.throws(() => C.mix([{ paint: { ...model.paints[0], group: "another" }, weight: 1 }, { paint: model.paints[1], weight: 1 }], "measured", model));
  assert.throws(() => C.mix([{ paint: { name: "HEX only", hex: "#FFFF00" }, weight: 1 }], "measured", model));
  for (const mutate of [m => m.basis = "volume", m => m.convention = "single-constant", m => m.paints[0].S[0] = 0, m => m.paints[0].K[0] = -1, m => m.paints[0].K.pop(), m => m.paints.push(m.paints[0]), m => m.xyzWeights[0][0] = -1]) { const m = structuredClone(rawModel); mutate(m); assert.throws(() => C.validateModel(m)); }
});
test("raw spectrophotometer sample calibration recovers the independently fitted upstream K and S", () => {
  const example = require("./fixtures/paint-measurement-example.json"), calibrated = C.calibrate(example, model);
  for (const p of calibrated.paints) {
    const original = paint(p.id.replace("example-kimera-", "kimera-"));
    p.K.forEach((v, i) => close(v, original.K[i], 1e-8));
    p.S.forEach((v, i) => close(v, original.S[i], 1e-8));
  }
  for (const mutate of [m => m.white.reflectance[0] = 100, m => m.paints[0].tints[0].paintMass = 0, m => m.paints[0].reflectance = [], m => m.group = "paintmixing-kimera-v1"]) { const value = structuredClone(example); mutate(value); assert.throws(() => C.calibrate(value, model)); }
});
test("reverse search finds real-model target mixtures and does not worsen their simpler solutions", () => {
  const subset = [paint("kimera-white"), paint("kimera-yellow-oxide"), paint("kimera-red-oxide"), paint("kimera-black")];
  const target = C.mix(subset.slice(0, 3).map((p, i) => ({ paint: p, weight: [.61, .26, .13][i] })), "measured", model).hex;
  const solved = C.solve({ paints: subset, target, mode: "measured", model, maxColors: 3 });
  assert.equal(solved.combinations, 14); assert.equal(solved.exhaustive, true);
  assert.ok(solved.recipes[0].error < .1, solved.recipes[0].error);
  for (const candidate of solved.recipes) {
    assert.ok(candidate.recipe.length <= 3); close(candidate.recipe.reduce((sum, r) => sum + r.weight, 0), 1);
    const predicted = C.mix(recipe(candidate.recipe), "measured", model);
    close(C.deltaE(predicted.lab, C.hexLab(target)), candidate.error);
    assert.equal(predicted.hex, candidate.result.hex);
  }
  assert.throws(() => C.solve({ paints: [], target, mode: "measured", model }));
});
test("estimated mode uses multi-pigment spectral mixing and excludes non-modelled finishes/media", () => {
  const spectral = require("../libs/spectral-3.0.0/spectral.js");
  const yellow = { id: "yellow", name: "yellow", hex: "#FCD200", type: "opaque", binder: "acrylic" };
  const blue = { ...yellow, id: "blue", name: "blue", hex: "#002185" };
  const expected = spectral.mix([new spectral.Color(yellow.hex), .5], [new spectral.Color(blue.hex), .5]);
  const actual = C.mix([{ paint: yellow, weight: 1 }, { paint: blue, weight: 1 }], "estimate", model);
  actual.xyz.forEach((v, i) => close(v, expected.XYZ[i]));
  assert.ok(parseInt(actual.hex.slice(3, 5), 16) > parseInt(actual.hex.slice(1, 3), 16));
  for (const changes of [{ metallic: true }, { type: "glaze" }, { delivery: "spray" }, { name: "Fluorescent Yellow" }, { binder: "unknown" }]) assert.throws(() => C.mix([{ paint: { ...yellow, ...changes }, weight: 1 }], "estimate", model));
  assert.throws(() => C.mix([{ paint: yellow, weight: 1 }, { paint: { ...blue, binder: "oil" }, weight: 1 }], "estimate", model));
});
test("mass rounding preserves the displayed total and rejects non-finite/tiny amounts", () => {
  const entries = model.paints.slice(0, 3).map(paint => ({ paint, weight: 1 }));
  const masses = C.grams(entries, 10); assert.deepEqual(masses, [3.34, 3.33, 3.33]); close(masses.reduce((a, b) => a + b, 0), 10);
  for (const value of [0, -.1, .001, 1.234, Infinity, NaN, 10001]) assert.throws(() => C.grams(entries, value));
});

test("editing a percentage preserves the other paints' relative amounts and a 100 percent total", () => {
  const next = C.percentageWeights([1, 1, 2], 0, 40);
  assert.deepEqual(next, [40, 20, 40]);
  assert.deepEqual(C.percentageWeights([100, 100, 200], 0, 40), next);
  assert.deepEqual(C.percentageWeights([100, 0, 0], 0, 40), [40, 30, 30]);
  assert.deepEqual(C.percentageWeights([1, 1, 2], 0, 100), [100, 0, 0]);
  assert.deepEqual(C.percentageWeights([1], 0, 0), [100]);
  const paints = model.paints.slice(0, 3);
  assert.deepEqual(C.grams(paints.map((paint, i) => ({ paint, weight: next[i] })), 10), [4, 2, 4]);
  for (const args of [[[], 0, 10], [[1, NaN], 0, 10], [[1, -1], 0, 10], [[1, 1], 2, 50], [[1, 1], 0, 101], [[1, 1], 0, -1]]) assert.throws(() => C.percentageWeights(...args));
});

test("catalogue and solver scope honour search and stock filters while current-recipe scope ignores browsing filters", () => {
  const rows = require("../libs/paint-data-20261008/catalogue.json").paints;
  const weather = { mode: "estimate", brand: "Vallejo", range: "Weathering FX" };
  assert.equal(C.filterPaints(rows, weather).length, 26);
  assert.equal(C.filterPaints(rows, { ...weather, compatible: true }).length, 0);
  assert.equal(C.filterPaints(rows, { ...weather, query: "73.806" })[0].id, "vallejo-black-splash-mud");
  const options = { mode: "measured", group: model.paints[0].group, compatible: true };
  assert.equal(C.filterPaints(model.paints, { ...options, query: "冷黄" }).length, 1);
  assert.equal(C.filterPaints(model.paints, { ...options, scope: "owned", owned: ["kimera-white"] }).length, 1);
  assert.equal(C.filterPaints(model.paints, { ...options, scope: "owned", owned: ["kimera-white"], query: "violet" }).length, 0);
  assert.deepEqual(C.filterPaints(model.paints, { ...options, scope: "mix", ids: ["kimera-white", "kimera-red-oxide"], brand: "wrong-brand", query: "no-match", ownedOnly: true }).map(p => p.id).sort(), ["kimera-red-oxide", "kimera-white"]);
});

test("user-facing incompatibility reasons agree with the mathematical eligibility rules", () => {
  const rows = require("../libs/paint-data-20261008/catalogue.json").paints;
  for (const p of [...rows, ...model.paints]) for (const mode of ["measured", "estimate"]) assert.equal(C.compatibilityReason(p, mode, model.paints[0].group) === "", C.eligible(p, mode, model.paints[0].group), p.id);
  const acrylic = { id: "ordinary", name: "ordinary", hex: "#AABBCC", type: "opaque", binder: "acrylic" };
  assert.match(C.compatibilityReason(acrylic, "estimate", undefined, "oil"), /介质不同/);
  assert.match(C.compatibilityReason({ ...acrylic, type: "technical" }, "estimate"), /特效/);
});
test("candidate reduction retains black/white and hue diversity, exposing that larger catalogues are not exhaustive", () => {
  const paints = Array.from({ length: 30 }, (_, i) => ({ id: "p" + i, name: "Colour", type: "opaque", binder: "acrylic", hex: "#" + (i * 560003 % 0xffffff).toString(16).padStart(6, "0") }));
  paints.push({ ...paints[0], id: "white", hex: "#FFFFFF" }, { ...paints[0], id: "black", hex: "#000000" });
  const selected = C.shortlist(paints, "#777777"); assert.equal(selected.length, 18); assert.ok(selected.some(p => p.hex === "#FFFFFF")); assert.ok(selected.some(p => p.hex === "#000000"));
  const solved = C.solve({ paints, target: "#777777", mode: "estimate", model, maxColors: 1 }); assert.equal(solved.exhaustive, false); assert.equal(solved.available, 32);
});
test("pinned catalogue/model assets, licenses, source hashes and worker wiring remain intact", () => {
  const base = path.join(__dirname, "../libs/paint-data-20261008"), catalogue = require(path.join(base, "catalogue.json"));
  assert.equal(catalogue.paints.length, 5841); assert.equal(new Set(catalogue.paints.map(p => p.brand)).size, 13); assert.equal(new Set(catalogue.paints.map(p => p.id)).size, catalogue.paints.length);
  for (const [file, expected] of Object.entries(require(path.join(base, "manifest.json")))) assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(base, file))).digest("hex"), expected, file);
  const replies = [], context = vm.createContext({ self: { postMessage: data => replies.push(data) } });
  context.importScripts = (...files) => files.forEach(file => vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../js", file.split("?")[0]), "utf8"), context));
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/paint-mixer-worker.js"), "utf8"), context);
  context.self.onmessage({ data: { job: 37, paints: model.paints.slice(0, 2), target: "#D0A36A", mode: "measured", model, maxColors: 2 } });
  assert.equal(replies.at(-1).job, 37); assert.equal(replies.at(-1).result.recipes[0].recipe.length <= 2, true);
});

test("Sheik Mainland catalogue has traceable facts, distinguishes photographs from swatches and never fabricates unavailable colours", () => {
  const chief = require("../libs/paint-data-20261008/sheik-mainland/catalogue.json"), facts = require("../libs/paint-data-20261008/sheik-mainland/source-records.json");
  assert.equal(chief.paints.length, 449);
  const usable = chief.paints.filter(p => C.eligible(p, "estimate")); assert.equal(usable.length, 192);
  assert.equal(usable.filter(p => p.referenceBasis === "bottle-photo").length, 168);
  assert.equal(usable.filter(p => p.referenceBasis === "catalogue-swatch").length, 24);
  assert.equal(chief.paints.filter(p => p.hex === null).length, 257);
  for (const p of chief.paints) {
    assert.ok(chief.sources[p.sourceKey]);
    const original = facts.records.find(r => r.code === p.code); assert.ok(original);
    assert.equal(original.reference.hex, p.hex);
    assert.equal(p.K, undefined); assert.equal(p.S, undefined);
    if (p.hex) { assert.match(original.reference.sha256, /^[a-f0-9]{64}$/); assert.equal(original.reference.sampleBox.length, 4); assert.equal(p.referenceURL, original.reference.image); }
    assert.equal(C.eligible(p, "measured", model.paints[0].group), false);
  }
  for (const term of ["BT2001", "bt2001", "哑光大红", "Sheik Mainland", "酋長大陸", "德森派乐"]) assert.ok(C.filterPaints(chief.paints, { mode: "estimate", query: term }).length);
  assert.equal(C.filterPaints(chief.paints, { mode: "estimate", range: "BT 金属色", compatible: true }).length, 0);
  assert.equal(C.filterPaints(chief.paints, { mode: "estimate", query: "BTYG", compatible: true }).length, 0);
  const missing = chief.paints.find(p => p.type === "opaque" && p.hex === null);
  assert.match(C.compatibilityReason(missing, "estimate"), /缺少可用参考色/);
  assert.throws(() => C.mix([{ paint: missing, weight: 1 }], "estimate", model));
});

test("Sheik Mainland manual and inverse spectral mixing respect brush and airbrush families", () => {
  const paints = require("../libs/paint-data-20261008/sheik-mainland/catalogue.json").paints, get = code => paints.find(p => p.code === code);
  const input = [{ paint: get("BT2001"), weight: .25 }, { paint: get("BT2006"), weight: .5 }, { paint: get("BTSY05"), weight: .25 }];
  const a = C.mix(input, "estimate", model), b = C.mix([...input].reverse().map(r => ({ ...r, weight: r.weight * 300 })), "estimate", model);
  a.xyz.forEach((v, i) => close(v, b.xyz[i]));
  assert.throws(() => C.mix([input[0], { paint: get("SM5003"), weight: 1 }], "estimate", model), /系列/);
  assert.throws(() => C.mix([input[0], { paint: paint("kimera-white"), weight: 1 }], "estimate", model), /系列/);
  assert.match(C.compatibilityReason(get("SM5003"), "estimate", undefined, "acrylic", C.mixingGroup(input[0].paint)), /系列/);
  const solved = C.solve({ paints: [get("BT2001"), get("BT2006"), get("BTSY05"), get("SM5003"), get("SM5011")], target: a.hex, mode: "estimate", model, maxColors: 3 });
  assert.ok(solved.recipes[0].error < .1, solved.recipes[0].error);
  for (const r of solved.recipes) {
    assert.equal(new Set(r.recipe.map(item => C.mixingGroup(paints.find(p => p.id === item.id)))).size, 1);
    const prediction = C.mix(r.recipe.map(item => ({ paint: paints.find(p => p.id === item.id), weight: item.weight })), "estimate", model);
    assert.equal(prediction.hex, r.result.hex);
  }
});

test("Sheik Mainland templates preserve actual colour codes, an independent reference white and empty measured arrays", () => {
  const paints = require("../libs/paint-data-20261008/sheik-mainland/catalogue.json").paints;
  for (const [family, code, count] of [["sheik-mainland-brush", "BT2006", 191], ["sheik-mainland-airbrush", "SM5011", 24]]) {
    const selected = paints.filter(p => p.mixingGroup === family), template = C.measurementTemplate(selected, selected.find(p => p.code === code).id, model);
    assert.equal(template.brand, "酋长大陆"); assert.equal(template.white.code, code); assert.equal(template.paints.length, count - 1);
    assert.deepEqual(template.white.reflectance, []); assert.equal(template.validation.length, 1);
    for (const p of template.paints) { assert.ok(selected.some(row => row.id === p.catalogueId && row.code === p.code)); assert.deepEqual(p.reflectance, []); assert.deepEqual(p.tints.map(t => t.whiteMass), [1, 4]); }
    assert.throws(() => C.calibrate(template, model), /反射率/);
  }
});

test("validation reports are recalculated from supplied spectra and fitting samples cannot masquerade as independent validation", () => {
  const fixture = reference.fixtures.at(-1), samples = [{ name: "Numerical reference fixture only, not new physical measurements", recipe: fixture.recipe, reflectance: fixture.reflectance }];
  const report = C.evaluateSamples(model, samples); assert.equal(report.count, 1); assert.ok(report.maxDeltaE < 1e-8);
  const perturbed = structuredClone(samples); perturbed[0].reflectance = perturbed[0].reflectance.map(v => Math.min(.999, v * .8));
  assert.ok(C.evaluateSamples(model, perturbed).maxDeltaE > 2);
  const imported = C.validateModel({ ...rawModel, validation: perturbed, validationReport: { maxDeltaE: 0 } }); assert.ok(imported.validationReport.maxDeltaE > 2);
  const value = structuredClone(require("./fixtures/paint-measurement-example.json"));
  const calibrated = C.calibrate(value, model), measuredRecipe = [{ id: "example-kimera-white", weight: .6 }, { id: value.paints[0].id, weight: .4 }];
  const predicted = C.mix(measuredRecipe.map(item => ({ paint: calibrated.paints.find(p => p.id === item.id), weight: item.weight })), "measured", calibrated);
  value.brand = "酋长大陆"; value.paints[0].code = "BT2010"; value.paints[0].catalogueId = "sheik-mainland-bt2010";
  value.conditions = { batch: "numerical regression only", geometry: "not a physical experiment" };
  value.validation = [{ name: "Synthetic verification for numerical regression", recipe: measuredRecipe, reflectance: predicted.reflectance }];
  const withReport = C.calibrate(value, model); assert.ok(withReport.validationReport.maxDeltaE < 1e-7);
  assert.equal(withReport.paints[1].brand, "酋长大陆"); assert.equal(withReport.paints[1].code, "BT2010"); assert.equal(withReport.paints[1].catalogueId, "sheik-mainland-bt2010");
  assert.equal(C.validateModel(withReport).conditions.batch, "numerical regression only");
  assert.equal(C.validateModel(withReport).conditions.geometry, "not a physical experiment");
  const t = value.paints[0].tints[0]; value.validation = [{ recipe: [{ id: value.paints[0].id, weight: t.paintMass }, { id: "example-kimera-white", weight: t.whiteMass }], reflectance: t.reflectance }];
  assert.throws(() => C.calibrate(value, model), /参与拟合/);
  assert.throws(() => C.evaluateSamples(model, [...samples, ...samples]), /重复/);
  assert.throws(() => C.evaluateSamples(model, [{ ...samples[0], recipe: [{ id: "missing", weight: 1 }] }]), /未知/);
});
