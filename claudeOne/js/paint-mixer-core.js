/* Physical model adapted from miciwan/PaintMixing (MIT).
 * Preserve its two-diffuse-flux coefficient convention: (1-R)^2/(4R).
 * Catalogue-only colours use Spectral.js and are explicitly estimates.
 */
(function (scope) {
  "use strict";
  const spectral = typeof module === "object" && module.exports ? require("../libs/spectral-3.0.0/spectral.js") : scope.spectral;
  const estimatedColors = new WeakMap();
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const rad = x => x * Math.PI / 180, deg = x => x * 180 / Math.PI;
  const hexRGB = hex => {
    if (typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) throw new Error("请输入完整的 HEX 颜色，例如 #D0A36A。");
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  };
  const encode = x => x <= .0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - .055;
  const decode = x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4;
  const toHex = values => "#" + values.map(x => Math.round(clamp(x) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
  function xyzLab(xyz) {
    const f = x => x > 216 / 24389 ? Math.cbrt(x) : (24389 / 27 * x + 16) / 116;
    const [x, y, z] = xyz.map((v, i) => f(v / [.95047, 1, 1.08883][i]));
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  function hexLab(hex) {
    const [r, g, b] = hexRGB(hex).map(decode);
    return xyzLab([.4124 * r + .3576 * g + .1805 * b, .2126 * r + .7152 * g + .0722 * b, .0193 * r + .1192 * g + .9505 * b]);
  }
  // CIEDE2000, unit weighting factors; hue wrap follows Sharma et al.
  function deltaE(a, b) {
    const [l1, a1, b1] = a, [l2, a2, b2] = b;
    const c1 = Math.hypot(a1, b1), c2 = Math.hypot(a2, b2), cm = (c1 + c2) / 2;
    const g = .5 * (1 - Math.sqrt(cm ** 7 / (cm ** 7 + 25 ** 7)));
    const ap1 = (1 + g) * a1, ap2 = (1 + g) * a2;
    const cp1 = Math.hypot(ap1, b1), cp2 = Math.hypot(ap2, b2);
    const hue = (x, y) => x === 0 && y === 0 ? 0 : (deg(Math.atan2(y, x)) + 360) % 360;
    const h1 = hue(ap1, b1), h2 = hue(ap2, b2), dl = l2 - l1, dc = cp2 - cp1;
    let dh = h2 - h1;
    if (cp1 * cp2 === 0) dh = 0;
    else if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
    const dH = 2 * Math.sqrt(cp1 * cp2) * Math.sin(rad(dh / 2));
    const lm = (l1 + l2) / 2, cpm = (cp1 + cp2) / 2;
    let hm = h1 + h2;
    if (cp1 * cp2 !== 0) hm = Math.abs(h1 - h2) <= 180 ? hm / 2 : (hm + (hm < 360 ? 360 : -360)) / 2;
    const t = 1 - .17 * Math.cos(rad(hm - 30)) + .24 * Math.cos(rad(2 * hm)) + .32 * Math.cos(rad(3 * hm + 6)) - .20 * Math.cos(rad(4 * hm - 63));
    const sl = 1 + .015 * (lm - 50) ** 2 / Math.sqrt(20 + (lm - 50) ** 2), sc = 1 + .045 * cpm, sh = 1 + .015 * cpm * t;
    const rt = -2 * Math.sqrt(cpm ** 7 / (cpm ** 7 + 25 ** 7)) * Math.sin(rad(60 * Math.exp(-(((hm - 275) / 25) ** 2))));
    return Math.sqrt(Math.max(0, (dl / sl) ** 2 + (dc / sc) ** 2 + (dH / sh) ** 2 + rt * (dc / sc) * (dH / sh)));
  }
  function validateModel(value, reference) {
    if (!value || value.format !== "claudeOne.paint-model" || value.version !== 1 || value.convention !== "two-diffuse-flux-4R" || value.illuminant !== "D65" || value.observer !== "CIE1931-2" || value.basis !== "mass") throw new Error("标定库需要质量比例、D65 / CIE 1931 2° 和 two-diffuse-flux-4R 参数。");
    const waves = value.wavelengths;
    if (!Array.isArray(waves) || waves.length < 20 || waves.length > 500 || waves.some((x, i) => !Number.isFinite(x) || x < 350 || x > 800 || i > 0 && x <= waves[i - 1])) throw new Error("光谱波长应为严格递增的有效数组。");
    if (reference && (waves.length !== reference.wavelengths.length || waves.some((x, i) => Math.abs(x - reference.wavelengths[i]) > 1e-6))) throw new Error("光谱网格不匹配，请使用标定模板或导入原始测量格式。");
    const weights = reference?.xyzWeights || value.xyzWeights;
    if (!Array.isArray(weights) || weights.length !== 3 || weights.some(row => !Array.isArray(row) || row.length !== waves.length || row.some(x => !Number.isFinite(x) || x < 0))) throw new Error("缺少有效的光谱到 XYZ 积分权重。");
    if (!Array.isArray(value.paints) || !value.paints.length || value.paints.length > 250) throw new Error("每个标定库支持 1–250 个颜料。");
    const seen = new Set();
    const paints = value.paints.map(p => {
      if (!p || typeof p.id !== "string" || !/^[a-z0-9-]{1,100}$/.test(p.id) || seen.has(p.id)) throw new Error("色号 ID 无效或重复。");
      seen.add(p.id); hexRGB(p.hex);
      for (const key of ["K", "S"]) if (!Array.isArray(p[key]) || p[key].length !== waves.length || p[key].some(x => !Number.isFinite(x) || x < 0 || x > 1e8 || key === "S" && x === 0)) throw new Error(`${p.name || p.id} 的 ${key} 参数无效，不能用于物理混色。`);
      const str = key => typeof p[key] === "string" ? p[key].trim().slice(0, 120) : "";
      if (!str("name") || !str("brand") || !str("range") || !str("group")) throw new Error("请提供颜料名称、品牌、系列和统一标定组。");
      if (p.binder !== undefined && !["acrylic", "oil", "enamel", "lacquer"].includes(p.binder)) throw new Error("标定介质应为 acrylic、oil、enamel 或 lacquer。");
      return { id: p.id, name: str("name"), label: str("label"), code: str("code"), catalogueId: str("catalogueId"), brand: str("brand"), range: str("range"), group: str("group"), binder: p.binder || "acrylic", type: "opaque", hex: p.hex.toUpperCase(), K: [...p.K], S: [...p.S] };
    });
    if (new Set(paints.map(p => p.group)).size !== 1) throw new Error("一个导入库内的颜料必须使用同一标定基准。");
    if (new Set(paints.map(p => p.binder)).size !== 1) throw new Error("一个标定库必须使用同一种介质。");
    const result = { format: value.format, version: 1, convention: value.convention, illuminant: "D65", observer: "CIE1931-2", basis: "mass", wavelengths: [...waves], xyzWeights: weights.map(row => [...row]), paints, source: typeof value.source === "string" ? value.source.slice(0, 300) : "用户提供" };
    if (value.conditions !== undefined) {
      if (!value.conditions || typeof value.conditions !== "object" || Array.isArray(value.conditions)) throw new Error("测量条件应为包含批次、底材、干燥、仪器和几何的对象。");
      result.conditions = Object.fromEntries(["batch", "substrate", "drying", "instrument", "geometry"].map(key => [key, typeof value.conditions[key] === "string" ? value.conditions[key].trim().slice(0, 200) : ""]));
    }
    if (value.validation !== undefined) { result.validation = validateSamples(value.validation, result); result.validationReport = evaluateSamples(result, result.validation); }
    return result;
  }
  function normalized(recipe) {
    if (!Array.isArray(recipe) || !recipe.length || recipe.length > 8) throw new Error("请选择 1–8 个颜料。");
    if (recipe.some(r => !r.paint || !Number.isFinite(r.weight) || r.weight < 0 || r.weight > 1e9)) throw new Error("颜料用量应为有效的非负数。");
    const total = recipe.reduce((sum, r) => sum + r.weight, 0);
    if (!(total > 0)) throw new Error("至少一种颜料的用量应大于 0。");
    return recipe.filter(r => r.weight > 0).map(r => ({ paint: r.paint, weight: r.weight / total }));
  }
  function eligible(paint, mode, group) {
    if (mode === "measured") return !!paint.K && !!paint.S && paint.group === group;
    return /^#[0-9A-F]{6}$/i.test(paint.hex || "") && paint.type === "opaque" && !paint.metallic && paint.delivery !== "spray" && !/fluor|neon/i.test(`${paint.name} ${paint.range || ""}`) && ["acrylic", "oil", "enamel", "lacquer"].includes(paint.binder);
  }
  function mixingGroup(paint) { return paint.mixingGroup || paint.binder; }
  function compatibilityReason(paint, mode, group, binder, family) {
    if (!paint) return "缺少色号数据";
    if (mode === "measured" && !eligible(paint, mode, group)) return paint.K && paint.S ? "属于另一标定库" : eligible(paint, "estimate") ? "缺少实测标定，可查色或切换到品牌估算" : "缺少实测标定，该材料仅可查色";
    if (mode === "estimate") {
      if (paint.metallic) return "金属色只能查色，不支持此混色模型";
      if (paint.delivery === "spray") return "喷罐色号只能查色";
      if (paint.type === "fluorescent" || /fluor|neon/i.test(`${paint.name} ${paint.range || ""}`)) return "荧光色只能查色，不支持此混色模型";
      if (paint.type !== "opaque") return paint.type === "technical" ? "旧化或特效材料只能查色" : "透明或特殊材料不支持此混色模型";
      if (!/^#[0-9A-F]{6}$/i.test(paint.hex || "")) return "仅有色号资料，缺少可用参考色；不能混色";
      if (!["acrylic", "oil", "enamel", "lacquer"].includes(paint.binder)) return "介质信息不足，只能查色";
      if (binder && paint.binder !== binder) return "与当前配方介质不同，请另配一份";
      if (family && mixingGroup(paint) !== family) return "与当前配方不是同一混色系列，请另配一份";
    }
    return "";
  }
  function filterPaints(paints, { mode, group, brand = "", range = "", query = "", scope = "catalogue", owned = [], ownedOnly = false, ids = [], compatible = false } = {}) {
    const stock = new Set(owned), selected = new Set(ids), term = query.trim().toLowerCase();
    return paints.filter(p => {
      if (scope === "mix") return selected.has(p.id) && eligible(p, mode, group);
      return (!brand || p.brand === brand) && (!range || p.range === range) && (!(scope === "owned" || ownedOnly) || stock.has(p.id)) && (!compatible || eligible(p, mode, group)) && (!term || `${p.name} ${p.label || ""} ${p.aliases || ""} ${p.brand} ${p.range} ${p.code || ""} ${p.hex || ""}`.toLowerCase().includes(term));
    });
  }
  function percentageWeights(weights, index, percent) {
    if (!Array.isArray(weights) || !weights.length || weights.length > 8 || weights.some(w => !Number.isFinite(w) || w < 0) || !Number.isInteger(index) || index < 0 || index >= weights.length || !Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error("比例应为 0–100% 的有效数字。");
    if (weights.length === 1) return [100];
    const others = weights.reduce((sum, w, i) => sum + (i === index ? 0 : w), 0);
    return weights.map((w, i) => i === index ? percent : others > 0 ? w / others * (100 - percent) : (100 - percent) / (weights.length - 1));
  }
  function mix(recipe, mode, model) {
    if (!["measured", "estimate"].includes(mode)) throw new Error("请选择有效混色模式。");
    const entries = normalized(recipe);
    let xyz, reflectance;
    if (mode === "measured") {
      if (entries.some(r => !eligible(r.paint, mode, entries[0].paint.group) || r.paint.K.length !== model.wavelengths.length || r.paint.S.length !== model.wavelengths.length)) throw new Error("实测模式需要同一标定组的完整 K、S 数据。");
      reflectance = model.wavelengths.map((_, i) => {
        let k = 0, s = 0;
        for (const entry of entries) { k += entry.paint.K[i] * entry.weight; s += entry.paint.S[i] * entry.weight; }
        const q = k / s;
        return 1 / (1 + 2 * q + 2 * Math.sqrt(q * (q + 1)));
      });
      xyz = model.xyzWeights.map(row => row.reduce((sum, w, i) => sum + w * reflectance[i], 0));
    } else {
      if (!spectral) throw new Error("估算混色库未加载，请刷新后重试。");
      if (entries.some(r => !eligible(r.paint, mode))) throw new Error("金属、荧光、透明、喷罐或无介质信息的色号只能查色，无法计算这个混色模型。");
      if (new Set(entries.map(r => r.paint.binder)).size !== 1) throw new Error("不同介质不能作为一份混色配方，请选择同一种介质。");
      if (new Set(entries.map(r => mixingGroup(r.paint))).size !== 1) throw new Error("酋长大陆等独立混色系列不能与其他系列或品牌合并为一份配方。");
      const result = spectral.mix(...entries.map(r => {
        let cached = estimatedColors.get(r.paint);
        if (!cached || cached.hex !== r.paint.hex) { cached = { hex: r.paint.hex, color: new spectral.Color(r.paint.hex) }; estimatedColors.set(r.paint, cached); }
        return [cached.color, r.weight];
      }));
      xyz = result.XYZ;
    }
    const [x, y, z] = xyz;
    const linearRGB = [3.2406 * x - 1.5372 * y - .4986 * z, -.9689 * x + 1.8758 * y + .0415 * z, .0557 * x - .2040 * y + 1.0570 * z];
    const rgb = linearRGB.map(v => clamp(encode(v)));
    return { xyz, lab: xyzLab(xyz), rgb, hex: toHex(rgb), reflectance, clipped: linearRGB.some(v => v < -1e-5 || v > 1 + 1e-5) };
  }
  function shortlist(paints, target, limit = 18) {
    if (paints.length <= limit) return paints;
    const lab = hexLab(target), ranked = paints.map(p => { const l = hexLab(p.hex); return { p, lab: l, score: deltaE(l, lab) }; });
    ranked.sort((a, b) => a.score - b.score);
    const chosen = ranked.slice(0, Math.min(8, limit));
    // Keep light/dark extremes and gamut diversity, not just individually close colours.
    for (const light of [true, false]) {
      const p = [...ranked].sort((a, b) => light ? b.lab[0] - a.lab[0] : a.lab[0] - b.lab[0])[0];
      if (!chosen.includes(p)) chosen.push(p);
    }
    const remaining = ranked.filter(p => !chosen.includes(p)).map(p => ({ ...p, distance: Math.min(...chosen.map(c => deltaE(p.lab, c.lab))) }));
    while (chosen.length < limit && remaining.length) {
      let index = 0; for (let i = 1; i < remaining.length; i++) if (remaining[i].distance > remaining[index].distance) index = i;
      const next = remaining.splice(index, 1)[0]; chosen.push(next);
      remaining.forEach(p => p.distance = Math.min(p.distance, deltaE(p.lab, next.lab)));
    }
    return chosen.map(x => x.p);
  }
  function optimize(paints, targetLab, mode, model, initial, fine = false) {
    let weights = initial ? [...initial] : paints.map(() => 1 / paints.length);
    const score = w => deltaE(mix(paints.map((paint, i) => ({ paint, weight: w[i] })), mode, model).lab, targetLab);
    let error = score(weights);
    for (let step = .25; step >= (fine ? .000061 : .0039); step /= 2) {
      for (let pass = 0; pass < (fine ? 24 : 10); pass++) {
        let improved = false;
        for (let i = 0; i < weights.length; i++) for (let j = 0; j < weights.length; j++) {
          if (i === j || weights[j] < 1e-12) continue;
          const candidate = [...weights], amount = Math.min(step, candidate[j]);
          candidate[i] += amount; candidate[j] -= amount;
          const e = score(candidate);
          if (e < error - 1e-9) { weights = candidate; error = e; improved = true; }
        }
        if (!improved) break;
      }
    }
    const recipe = paints.map((paint, i) => ({ paint, weight: weights[i] })).filter(r => r.weight > .00001);
    const result = mix(recipe, mode, model);
    return { recipe: normalized(recipe), result, error: deltaE(result.lab, targetLab) };
  }
  function solve({ paints, target, mode, model, maxColors = 4 }, progress = () => {}) {
    if (!["measured", "estimate"].includes(mode)) throw new Error("请选择有效混色模式。");
    if (!paints.length) throw new Error("计算范围内没有可混合的颜料，请调整筛选或加入我的颜料。");
    if (!Number.isInteger(maxColors) || maxColors < 1 || maxColors > 4) throw new Error("自动配方支持 1–4 色。");
    const selected = shortlist(paints, target), targetLab = hexLab(target), candidates = [];
    let total = 0, done = 0;
    const combos = [];
    function enumerate(start, remaining, chosen) {
      if (!remaining) { combos.push(chosen); return; }
      for (let i = start; i <= selected.length - remaining; i++) enumerate(i + 1, remaining - 1, [...chosen, selected[i]]);
    }
    for (let n = 1; n <= Math.min(maxColors, selected.length); n++) enumerate(0, n, []);
    total = combos.length;
    for (const combo of combos) {
      // Different measured groups and binders are separate physical problems.
      if (new Set(combo.map(p => mode === "measured" ? p.group : mixingGroup(p))).size === 1) candidates.push(optimize(combo, targetLab, mode, model));
      done++; if (done % 16 === 0) progress({ done, total });
    }
    candidates.sort((a, b) => a.error - b.error);
    const finalists = candidates.slice(0, 30);
    // Preserve the best answer at every colour count for the simpler alternatives.
    for (let n = 1; n <= maxColors; n++) {
      const candidate = candidates.find(c => c.recipe.length === n);
      if (candidate && !finalists.includes(candidate)) finalists.push(candidate);
    }
    const refined = finalists.map(c => {
      let best = optimize(c.recipe.map(r => r.paint), targetLab, mode, model, c.recipe.map(r => r.weight), true);
      if (best.recipe.length > 1) for (let dominant = 0; dominant < best.recipe.length; dominant++) {
        const initial = best.recipe.map((_, i) => i === dominant ? .7 : .3 / (best.recipe.length - 1));
        const alternative = optimize(best.recipe.map(r => r.paint), targetLab, mode, model, initial, true);
        if (alternative.error < best.error) best = alternative;
      }
      return best;
    }).sort((a, b) => a.error - b.error);
    const unique = [], keys = new Set();
    for (const c of refined) {
      const key = [...c.recipe].sort((a, b) => a.paint.id.localeCompare(b.paint.id)).map(r => r.paint.id).join("|");
      if (!keys.has(key)) { unique.push(c); keys.add(key); }
    }
    const best = unique[0];
    if (!best) throw new Error("没有兼容的组合，请选择同一标定组或介质。");
    const simple = [...unique].filter(c => c.error <= best.error + 2).sort((a, b) => a.recipe.length - b.recipe.length || a.error - b.error)[0];
    const list = [best, ...(simple !== best ? [simple] : []), ...unique.filter(c => c !== best && c !== simple)].slice(0, 6);
    progress({ done: total, total });
    return { recipes: list.map(c => ({ recipe: c.recipe.map(r => ({ id: r.paint.id, weight: r.weight })), result: { ...c.result, reflectance: undefined }, error: c.error, kind: c === best ? "最接近" : c === simple ? "更少用色" : "备选方案" })), candidates: selected.length, available: paints.length, combinations: total, exhaustive: paints.length <= selected.length };
  }
  function resample(wavelengths, values, grid) {
    if (!Array.isArray(wavelengths) || wavelengths.length < 20 || !Array.isArray(values) || values.length !== wavelengths.length || wavelengths.some((x, i) => !Number.isFinite(x) || i && x <= wavelengths[i - 1]) || values.some(x => !Number.isFinite(x) || x <= 0 || x > 1) || wavelengths[0] > grid[0] || wavelengths.at(-1) < grid.at(-1)) throw new Error("反射率须为 0–1、波长递增并覆盖完整标定网格；请勿直接使用 0–100 的百分数。");
    return grid.map(x => {
      let i = 0; while (i + 1 < wavelengths.length && wavelengths[i + 1] < x) i++;
      if (x === wavelengths[i]) return values[i];
      const t = (x - wavelengths[i]) / (wavelengths[i + 1] - wavelengths[i]);
      return values[i] * (1 - t) + values[i + 1] * t;
    });
  }
  function calibrate(value, reference) {
    if (value?.format !== "claudeOne.paint-measurements" || value.version !== 1 || value.basis !== "mass" || typeof value.name !== "string" || !value.name.trim() || !Array.isArray(value.paints) || !value.paints.length || value.paints.length > 249) throw new Error("请选择完整的质量比例光谱测量模板。");
    if (value.validation !== undefined && !Array.isArray(value.validation)) throw new Error("独立验证样本应为数组。");
    const group = value.group;
    if (typeof group !== "string" || !/^[a-z0-9-]{1,90}$/.test(group) || group === "paintmixing-kimera-v1") throw new Error("用户标定组 ID 必须为独立的英文字母、数字或连字符。");
    if (value.binder !== undefined && !["acrylic", "oil", "enamel", "lacquer"].includes(value.binder)) throw new Error("请提供有效标定介质。");
    const binder = value.binder || "acrylic";
    const whiteR = resample(value.wavelengths, value.white?.reflectance, reference.wavelengths);
    const ratio = r => (1 - r) ** 2 / (4 * r), whiteK = whiteR.map(ratio);
    const brand = typeof value.brand === "string" && value.brand.trim() ? value.brand.trim() : value.name;
    const range = typeof value.range === "string" && value.range.trim() ? value.range.trim() : "用户光谱标定";
    const paints = [{ id: group + "-white", name: value.white.name || "Reference White", code: value.white.code, catalogueId: value.white.catalogueId, brand, range, group, type: "opaque", binder, K: whiteK, S: whiteK.map(() => 1), hex: "#FFFFFF" }];
    const fitted = new Set([group + "-white:1.000000000"]);
    for (const p of value.paints) {
      const pure = resample(value.wavelengths, p.reflectance, reference.wavelengths);
      if (!Array.isArray(p.tints) || !p.tints.length || p.tints.length > 20) throw new Error("每色需要至少一个与基准白的已知质量比例混合样本。");
      const tints = p.tints.map(t => {
        if (![t.paintMass, t.whiteMass].every(x => Number.isFinite(x) && x > 0 && x < 1e6)) throw new Error("标定样本必须提供有效颜料和白色质量。");
        return { ...t, reflectance: resample(value.wavelengths, t.reflectance, reference.wavelengths) };
      });
      fitted.add(p.id + ":1.000000000");
      for (const t of tints) fitted.add(recipeKey([{ id: p.id, weight: t.paintMass }, { id: group + "-white", weight: t.whiteMass }]));
      const K = [], S = [];
      for (let i = 0; i < pure.length; i++) {
        const rows = [[4 * pure[i], -((1 - pure[i]) ** 2), 0]];
        for (const t of tints) {
          const r = t.reflectance[i], wp = t.paintMass / (t.paintMass + t.whiteMass), ww = 1 - wp;
          rows.push([4 * r * wp, -((1 - r) ** 2) * wp, -4 * r * whiteK[i] * ww + (1 - r) ** 2 * ww]);
        }
        let aa = 0, ab = 0, bb = 0, ay = 0, by = 0;
        for (const [a, b, y] of rows) { aa += a * a; ab += a * b; bb += b * b; ay += a * y; by += b * y; }
        const determinant = aa * bb - ab * ab;
        if (!(determinant > 1e-16)) throw new Error(`${p.name} 在 ${reference.wavelengths[i].toFixed(1)} nm 的测量无法识别 K、S，请更换混合比例或检查数据。`);
        const k = (ay * bb - by * ab) / determinant, s = (by * aa - ay * ab) / determinant;
        if (k < 0 || !(s > 0)) throw new Error(`${p.name} 的测量产生非物理参数，请检查样本和仪器；未修改数据来伪造有效标定。`);
        K.push(k); S.push(s);
      }
      paints.push({ id: p.id, name: p.name, code: p.code, catalogueId: p.catalogueId, brand, range, group, type: "opaque", binder, K, S, hex: "#808080" });
    }
    for (const p of paints) p.hex = mix([{ paint: p, weight: 1 }], "measured", reference).hex;
    const calibrated = { ...reference, source: "用户提供的光谱测量 · " + value.name, paints };
    delete calibrated.conditions;
    if (value.conditions !== undefined) calibrated.conditions = value.conditions;
    delete calibrated.validation; delete calibrated.validationReport;
    if (value.validation !== undefined && value.validation.length) {
      calibrated.validation = validateSamples(value.validation.map(sample => ({ ...sample, reflectance: resample(value.wavelengths, sample.reflectance, reference.wavelengths) })), calibrated);
      if (calibrated.validation.some(sample => fitted.has(recipeKey(sample.recipe)))) throw new Error("独立验证不能使用已参与拟合的纯色或白色混合比例，请提供另一次独立试调。");
    }
    return validateModel(calibrated, reference);
  }
  function recipeKey(recipe) {
    const total = recipe.reduce((sum, item) => sum + item.weight, 0);
    return recipe.filter(item => item.weight > 0).map(item => `${item.id}:${(item.weight / total).toFixed(9)}`).sort().join("|");
  }
  function validateSamples(samples, model) {
    if (!Array.isArray(samples) || !samples.length || samples.length > 100) throw new Error("验证数据需要 1–100 个独立混色样本。");
    const ids = new Set(model.paints.map(p => p.id)), seen = new Set();
    return samples.map((sample, index) => {
      const r = sample?.recipe;
      if (!Array.isArray(r) || !r.length || r.length > 8 || r.some(item => !ids.has(item.id) || !Number.isFinite(item.weight) || item.weight < 0) || !r.some(item => item.weight > 0) || new Set(r.map(item => item.id)).size !== r.length) throw new Error("验证样本含未知、重复色号或无效称量比例。");
      const key = recipeKey(r); if (seen.has(key)) throw new Error("验证样本的配方比例重复，请使用不同的独立样本。"); seen.add(key);
      return { name: typeof sample.name === "string" ? sample.name.slice(0, 100) : `验证样本 ${index + 1}`, recipe: r.map(item => ({ id: item.id, weight: item.weight })), reflectance: resample(model.wavelengths, sample.reflectance, model.wavelengths) };
    });
  }
  function evaluateSamples(model, samples) {
    const byId = new Map(model.paints.map(p => [p.id, p]));
    const evaluated = validateSamples(samples, model).map(sample => {
      const predicted = mix(sample.recipe.map(item => ({ paint: byId.get(item.id), weight: item.weight })), "measured", model);
      const observedXYZ = model.xyzWeights.map(row => row.reduce((sum, weight, i) => sum + weight * sample.reflectance[i], 0));
      return { name: sample.name, error: deltaE(predicted.lab, xyzLab(observedXYZ)), reflectanceRMSE: Math.sqrt(sample.reflectance.reduce((sum, r, i) => sum + (r - predicted.reflectance[i]) ** 2, 0) / sample.reflectance.length) };
    });
    return { count: evaluated.length, meanDeltaE: evaluated.reduce((sum, sample) => sum + sample.error, 0) / evaluated.length, maxDeltaE: Math.max(...evaluated.map(sample => sample.error)), samples: evaluated };
  }
  function measurementTemplate(paints, whiteId, reference) {
    const white = paints.find(p => p.id === whiteId), colours = paints.filter(p => p.id !== whiteId);
    if (!white || !colours.length || paints.length > 250 || new Set(paints.map(p => mixingGroup(p))).size !== 1 || paints.some(p => p.type !== "opaque" || p.metallic)) throw new Error("测量模板需要同一混色系列的普通颜料和基准白，最多 250 色。");
    const group = mixingGroup(white) + "-calibration-v1";
    const newId = p => p.id === whiteId ? group + "-white" : group + "-" + p.code.toLowerCase();
    return {
      format: "claudeOne.paint-measurements", version: 1, name: white.brand + " / " + (white.mixingGroup === "sheik-mainland-brush" ? "BT 与 BTSY" : white.range), brand: white.brand, range: "用户实测 · " + white.range, group, binder: white.binder, basis: "mass", wavelengths: [...reference.wavelengths],
      conditions: { batch: "", substrate: "", drying: "", instrument: "", geometry: "" },
      white: { name: white.label || white.name, code: white.code, catalogueId: white.id, reflectance: [] },
      paints: colours.map(p => ({ id: newId(p), catalogueId: p.id, code: p.code, name: p.label || p.name, reflectance: [], tints: [{ paintMass: 1, whiteMass: 1, reflectance: [] }, { paintMass: 1, whiteMass: 4, reflectance: [] }] })),
      validation: [{ name: "另配的独立样本，勿使用拟合样本", recipe: [{ id: newId(white), weight: 3 }, { id: newId(colours[0]), weight: 2 }], reflectance: [] }],
      instructions: "所有空数组须填仪器实测反射率 0–1，不能填写照片/HEX/猜测光谱。纯色、基准白和按质量称量的混合样本在同一批次、底材、充分遮盖、相同干燥条件和仪器几何下测量。可换为仪器原生波长网格，但必须覆盖模板区间。validation 必须另外配制且未参与拟合；可增加独立样本，缺少验证时可移除该数组，但界面会注明未验证实物误差。导入会重新计算色差，不信任手填的误差报告。"
    };
  }
  function grams(recipe, total) {
    if (!Number.isFinite(total) || total < .01 || total > 10000) throw new Error("总量应为 0.01–10000 克。");
    if (Math.abs(total * 100 - Math.round(total * 100)) > 1e-7) throw new Error("总量请使用 0.01 克精度。");
    const entries = normalized(recipe), cents = Math.round(total * 100);
    const values = entries.map(r => r.weight * cents), units = values.map(Math.floor);
    const order = values.map((v, i) => ({ i, remainder: v - units[i] })).sort((a, b) => b.remainder - a.remainder);
    const missing = cents - units.reduce((a, b) => a + b, 0);
    for (let i = 0; i < missing; i++) units[order[i % order.length].i]++;
    return units.map(v => v / 100);
  }
  const api = { hexRGB, hexLab, xyzLab, deltaE, toHex, validateModel, normalized, eligible, mixingGroup, compatibilityReason, filterPaints, percentageWeights, mix, shortlist, solve, resample, calibrate, validateSamples, evaluateSamples, measurementTemplate, grams };
  if (typeof module === "object" && module.exports) module.exports = api;
  else scope.PaintMixerCore = Object.freeze(api);
})(typeof window === "object" ? window : globalThis);
