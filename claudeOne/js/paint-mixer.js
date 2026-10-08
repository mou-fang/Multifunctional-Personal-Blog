(function () {
  "use strict";
  const C = window.PaintMixerCore, KEY = "claudeOne:paint-mixer:v1", BASE = "libs/paint-data-20261008/";
  let host, root, ac, bridge, state, baseModel, model, catalogue, byId, result, worker, results = [], job = 0, generation = 0, page = 0, loading = false, importType;
  let undo = [], redo = [], deletedRecipe, exportedURL;
  const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const listen = (target, type, fn) => target.addEventListener(type, fn, { signal: ac.signal });
  const title = p => p.brand === "酋长大陆" ? `${p.code || ""} ${p.label || p.name}`.trim() : p.label ? `${p.label} · ${p.name}` : p.name;
  const label = p => `${p.brand} / ${p.range}${p.code ? " / " + p.code : ""}`;
  const errorText = value => value < .001 ? "<0.001" : value.toFixed(3);
  const button = (text, action, id) => { const n = el("button", "btn btn-sm", text); n.type = "button"; n.dataset.pmAction = action; if (id !== undefined) n.dataset.pmId = id; return n; };
  const status = (text, error = false) => { if (root) { $("[data-pm-status]").textContent = text; $("[data-pm-status]").dataset.error = String(error); } };
  const recipe = () => state.mix.map(r => ({ paint: byId.get(r.id), weight: r.weight }));
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); $("[data-pm-storage]").textContent = "颜料、配方和标定库已保存在本浏览器，请导出 JSON 备份。"; return true; }
    catch (_) { $("[data-pm-storage]").textContent = "浏览器无法保存或空间已满；当前操作仍可使用，请立即导出 JSON 备份。"; return false; }
  }
  function rebuild() {
    const all = [...catalogue.paints], measured = new Map(baseModel.paints.map(p => [p.id, p]));
    for (const custom of state.models) for (const p of custom.paints) { measured.set(p.id, p); all.push(p); }
    byId = new Map(all.map(p => [p.id, measured.get(p.id) || p]));
    model = state.group === baseModel.paints[0].group ? baseModel : state.models.find(m => m.paints[0].group === state.group) || baseModel;
    state.group = model.paints[0].group;
  }
  function validateCustom(raw) {
    const m = C.validateModel(raw, baseModel);
    if (m.paints.some(p => p.id.startsWith("kimera-") || p.group === baseModel.paints[0].group || !p.id.startsWith(p.group + "-"))) throw new Error("用户色号 ID 必须以自己的标定组 ID 开头，不能覆盖内置实测数据。");
    return m;
  }
  function validateState(value) {
    if (!value || typeof value !== "object") throw new Error("备份格式不正确。");
    const next = { mode: value.mode === "estimate" ? "estimate" : "measured", group: typeof value.group === "string" ? value.group : baseModel.paints[0].group, target: typeof value.target === "string" ? value.target.toUpperCase() : "#D0A36A", task: value.task === "solve" ? "solve" : "mix", compare: value.compare === true, mass: Number(value.mass), owned: [], mix: [], saved: [], models: [] };
    next.name = typeof value.name === "string" ? value.name.slice(0, 80) : "我的调色配方";
    next.brand = typeof value.brand === "string" ? value.brand.slice(0, 120) : "";
    next.range = typeof value.range === "string" ? value.range.slice(0, 120) : "";
    C.hexRGB(next.target);
    if (!Number.isFinite(next.mass) || next.mass < .01 || next.mass > 10000 || Math.abs(next.mass * 100 - Math.round(next.mass * 100)) > 1e-7) throw new Error("备份总质量无效。");
    if (!Array.isArray(value.models) || value.models.length > 10) throw new Error("备份最多支持 10 个用户标定库。");
    const ids = new Set(catalogue.paints.map(p => p.id)), groups = new Set([baseModel.paints[0].group]);
    for (const raw of value.models) {
      const m = validateCustom(raw);
      if (groups.has(m.paints[0].group) || m.paints.some(p => ids.has(p.id))) throw new Error("备份标定组或色号重复。");
      groups.add(m.paints[0].group); m.paints.forEach(p => ids.add(p.id)); next.models.push(m);
    }
    if (!groups.has(next.group)) throw new Error("备份缺少所选择的标定库。");
    if (!Array.isArray(value.owned) || value.owned.length > 15000 || value.owned.some(id => typeof id !== "string" || !ids.has(id))) throw new Error("备份颜料库存含未知色号。");
    next.owned = [...new Set(value.owned)];
    const validRecipe = r => {
      if (!Array.isArray(r) || r.length > 8 || r.some(x => !x || !ids.has(x.id) || !Number.isFinite(x.weight) || x.weight < 0 || x.weight > 1000) || new Set(r.map(x => x.id)).size !== r.length) throw new Error("备份配方含未知、重复色号或无效用量。");
      return r.map(x => ({ id: x.id, weight: x.weight }));
    };
    next.mix = validRecipe(value.mix || []);
    if (!Array.isArray(value.saved) || value.saved.length > 100) throw new Error("最多支持 100 份已保存配方。");
    next.saved = value.saved.map(s => {
      if (!s || typeof s.name !== "string" || !s.name.trim() || !["measured", "estimate"].includes(s.mode) || !groups.has(s.group) || !Number.isFinite(s.mass) || s.mass < .01 || s.mass > 10000 || Math.abs(s.mass * 100 - Math.round(s.mass * 100)) > 1e-7) throw new Error("已保存配方的名称或计算设置无效。");
      C.hexRGB(s.target);
      return { id: typeof s.id === "string" ? s.id.slice(0, 100) : crypto.randomUUID(), name: s.name.slice(0, 80), mode: s.mode, group: s.group, target: s.target.toUpperCase(), compare: s.compare !== false, mass: s.mass, recipe: validRecipe(s.recipe) };
    });
    if (new Set(next.saved.map(s => s.id)).size !== next.saved.length) throw new Error("备份的配方 ID 重复。");
    if (next.saved.some(s => !s.recipe.some(r => r.weight > 0))) throw new Error("已保存配方没有有效用量。");
    const paints = new Map(catalogue.paints.map(p => [p.id, p]));
    baseModel.paints.forEach(p => paints.set(p.id, p)); next.models.forEach(m => m.paints.forEach(p => paints.set(p.id, p)));
    for (const item of [{ mode: next.mode, group: next.group, recipe: next.mix }, ...next.saved]) {
      const entries = item.recipe.filter(r => r.weight > 0).map(r => paints.get(r.id));
      if (entries.some(p => !C.eligible(p, item.mode, item.group)) || item.mode === "estimate" && new Set(entries.map(p => C.mixingGroup(p))).size > 1) throw new Error("备份配方包含不兼容的数据、介质或混色系列。");
    }
    return next;
  }
  async function initialize() {
    if (state || loading) return;
    loading = true; const token = generation, signal = ac.signal;
    status("正在加载品牌目录和实测光谱数据…");
    try {
      const load = async file => { const r = await fetch(new URL(BASE + file + "?v=20261008-chief-2", document.baseURI), { signal }); if (!r.ok) throw new Error("数据加载失败，请确认完整部署了颜料资源后重试。"); return r.json(); };
      const data = await Promise.all([load("catalogue.json"), load("kimera-model.json")]);
      if (token !== generation || signal.aborted) return;
      catalogue = data[0]; baseModel = C.validateModel(data[1]);
      if (!Array.isArray(catalogue.paints) || catalogue.paints.length > 20000) throw new Error("颜料目录格式不正确。");
      const fallback = { mode: "measured", group: baseModel.paints[0].group, target: "#D0A36A", task: "solve", compare: false, name: "我的调色配方", brand: "", range: "", mass: 10, owned: [], mix: [], saved: [], models: [] };
      let recovered = false;
      try { const raw = localStorage.getItem(KEY); state = raw ? validateState(JSON.parse(raw)) : fallback; }
      catch (_) { state = fallback; recovered = true; }
      rebuild(); $("[data-pm-content]").hidden = false; renderSettings(); renderAll();
      status(recovered ? "本机草稿无法恢复，已打开新的调色工作台；旧存储在下一次保存前保留。" : `已加载 ${byId.size.toLocaleString()} 个色号。选择上方任务即可开始。`);
    } catch (error) { if (token === generation && !signal.aborted) status(error.message, true); }
    finally { if (token === generation) loading = false; }
  }
  function cancel(clear = false) {
    job++; if (worker) worker.terminate(); worker = null;
    if (root && state) { $("[data-pm-cancel]").hidden = true; $("[data-pm-progress]").hidden = true; renderSolveReady(); }
    if (clear && root) { results = []; $("[data-pm-results]").replaceChildren(); $("[data-pm-solve-note]").textContent = "设置已更新，请重新寻找配方。"; }
  }
  const snapshot = () => JSON.stringify({ mode: state.mode, group: state.group, mix: state.mix, brand: state.brand, range: state.range, name: state.name });
  function commit(fn, redraw = true) {
    cancel(true); undo.push(snapshot()); if (undo.length > 40) undo.shift(); redo = []; fn();
    persist(); if (redraw) renderIngredients(); renderPreview();
  }
  function fillSelect(node, values, first, selected = "", caption = value => value) {
    node.replaceChildren(); if (first !== null) { const o = el("option", "", first); o.value = ""; node.append(o); }
    for (const value of values) { const o = el("option", "", caption(value)); o.value = value; node.append(o); }
    node.value = values.includes(selected) ? selected : "";
  }
  function countsFor(paints, key) {
    const counts = new Map();
    for (const p of paints) { const count = counts.get(p[key]) || { total: 0, usable: 0 }; count.total++; if (C.eligible(p, state.mode, state.group)) count.usable++; counts.set(p[key], count); }
    return counts;
  }
  const countCaption = counts => value => `${value}（可混 ${counts.get(value).usable} / 共 ${counts.get(value).total} 色）`;
  function renderSettings() {
    root.dataset.mode = state.mode;
    $$('[aria-invalid]').forEach(n => n.removeAttribute("aria-invalid"));
    $("[data-pm-mode]").value = state.mode; $("[data-pm-target]").value = state.target; $("[data-pm-target-picker]").value = state.target;
    $("[data-pm-mass]").value = state.mass; $("[data-pm-mass-field]").hidden = state.mode !== "measured";
    $("[data-pm-name]").value = state.name;
    const selector = $("[data-pm-group]"); selector.replaceChildren();
    for (const m of [baseModel, ...state.models]) { const option = el("option", "", (m === baseModel ? "Kimera · 13 色公开标定" : "用户标定 · " + m.paints[0].brand) + `（${m.paints.length} 色）`); option.value = m.paints[0].group; selector.append(option); }
    selector.value = state.group; $("[data-pm-group-field]").hidden = state.mode !== "measured"; $("[data-pm-remove-model]").disabled = model === baseModel;
    $("[data-pm-source-title]").textContent = state.mode === "measured" ? `实测标定 · ${model.paints[0].brand} ${model.paints.length} 色 · 可按克称量` : "品牌色号估算 · 仅供调色参考";
    const verification = model.validationReport;
    $("[data-pm-model-note]").textContent = state.mode === "measured" ? (model === baseModel ? "当前可称量：Kimera 13 色。其他品牌可切换到“品牌色号估算”；实际结果仍受批次、底材和照明影响。" : "当前使用用户标定库，可按质量比例配制。" + (verification ? `用户提供 ${verification.count} 个验证样本：平均 ΔE00 ${errorText(verification.meanDeltaE)}，最大 ${errorText(verification.maxDeltaE)}。本站未核验仪器、批次和取样。` : "未提供独立验证样本，实物误差尚未验证。")) : "更多品牌的普通色号可作混色参考；估算比例不等于实体克数或滴数。";
    const counts = countsFor([...byId.values()], "brand");
    fillSelect($("[data-pm-brand]"), [...counts.keys()].sort(), "全部品牌", state.brand, countCaption(counts)); renderRanges(state.range);
  }
  function renderRanges(selected = "") {
    const brand = $("[data-pm-brand]").value;
    const counts = countsFor([...byId.values()].filter(p => !brand || p.brand === brand), "range");
    fillSelect($("[data-pm-range]"), [...counts.keys()].sort(), "全部系列", selected, countCaption(counts));
    state.brand = brand; state.range = $("[data-pm-range]").value;
  }
  function filtered(forSolve = false, overrides = {}) {
    return C.filterPaints([...byId.values()], { mode: state.mode, group: state.group, brand: $("[data-pm-brand]").value, range: $("[data-pm-range]").value, query: $("[data-pm-search]").value, scope: forSolve ? $("[data-pm-scope]").value : "catalogue", owned: state.owned, ownedOnly: $("[data-pm-owned-only]").checked, ids: state.mix.map(r => r.id), compatible: forSolve || $("[data-pm-compatible]").checked, ...overrides });
  }
  function renderSolveReady() {
    const available = filtered(true).length, scope = $("[data-pm-scope]").value;
    $("[data-pm-solve]").disabled = !!worker || !available || !!$("[data-pm-target][aria-invalid='true']");
    $("[data-pm-solve]").textContent = worker ? "正在寻找配方…" : "③ 帮我计算配方";
    $("[data-pm-scope-note]").textContent = available ? `将使用 ${available.toLocaleString()} 种可混颜料。${scope === "mix" ? "只用当前配方，不受目录筛选影响。" : "遵循目录的品牌、系列、搜索词和库存筛选。"}` : scope === "mix" ? "当前配方没有可用颜料，先到目录加入颜料，或改用全部可混色号。" : scope === "owned" || $("[data-pm-owned-only]").checked ? "当前范围没有库存颜料。在目录点“我有这色”登记，或改用全部可混色号。" : "当前筛选没有可混颜料，请清除筛选或在目录切换计算方式。";
    $("[data-pm-action='reset-scope']").hidden = available > 0;
  }
  function renderCatalogue() {
    const paints = filtered(), pages = Math.max(1, Math.ceil(paints.length / 8)); page = Math.min(page, pages - 1);
    const container = $("[data-pm-paints]"); container.replaceChildren();
    for (const p of paints.slice(page * 8, page * 8 + 8)) {
      const row = el("div", "pm-paint"), swatch = el("div", "pm-paint-color"); row.dataset.paintId = p.id; swatch.dataset.available = String(!!p.hex); if (p.hex) swatch.style.backgroundColor = p.hex; swatch.setAttribute("aria-label", p.hex || "暂缺参考色");
      const info = el("div", "pm-paint-info"); info.append(el("strong", "", title(p)), el("small", "", label(p)), el("small", "", `${p.hex || "暂缺参考色"} · ${p.K ? (p.group === baseModel.paints[0].group ? "公开实测标定" : "用户标定") : p.referenceBasis === "bottle-photo" ? "瓶照近似色，非漆膜实测" : p.referenceBasis === "catalogue-swatch" ? "商品色卡近似色，非光谱实测" : p.hex ? "目录近似色" : "仅色号资料"}${p.metallic ? " · 金属色" : ""}${p.discontinued ? " · 已停产" : ""}`));
      const selected = state.mix.some(r => r.id === p.id), currentPaint = state.mix.length ? byId.get(state.mix[0].id) : null, reason = C.compatibilityReason(p, state.mode, state.group, currentPaint?.binder, currentPaint ? C.mixingGroup(currentPaint) : null);
      row.dataset.selected = String(selected);
      const actions = el("div", "pm-paint-actions"), add = button(selected ? "✓ 已加入" : reason ? "不可混色" : "＋ 加入配方", "add", p.id); add.disabled = !!reason || selected || state.mix.length >= 8;
      if (reason) { add.title = reason; info.append(el("small", "pm-compatibility", reason)); }
      else if (state.mix.length >= 8 && !selected) add.title = "一份配方最多 8 色，请先移除一色";
      const own = button(state.owned.includes(p.id) ? "✓ 我有这色" : "我有这色", "own", p.id); own.setAttribute("aria-pressed", String(state.owned.includes(p.id)));
      const target = button("设为目标", "target", p.id); target.disabled = !p.hex;
      actions.append(add, own, target);
      if (p.referenceURL) { const source = el("a", "pm-source-link", "参考图 ↗"); source.href = p.referenceURL; source.target = "_blank"; source.rel = "noopener"; actions.append(source); }
      row.append(swatch, info, actions); container.append(row);
    }
    if (!paints.length) {
      const hidden = filtered(false, { compatible: false }), empty = el("div", "pm-empty"), actions = el("div", "ct-row");
      empty.append(el("strong", "", hidden.length ? `目录里有 ${hidden.length} 色，当前模式可混 0 色` : "当前筛选没有找到色号"));
      empty.append(el("p", "ct-hint", hidden.length ? (state.mode === "measured" ? "这些色号没有当前标定库的数据。可查看色号资料；有参考色的普通颜料还可以改用品牌估算。" : hidden.some(p => p.type === "opaque" && !p.hex) ? "这些色号尚缺参考色，不填虚构 HEX；仍可登记库存或下载测量模板。" : "这些色号属于金属、透明、特效等材料，当前模型仅列色号资料。") : $("[data-pm-owned-only]").checked ? "取消库存筛选后，可在色号卡片点“我有这色”登记库存。" : "试试删掉搜索词，或清除品牌和系列筛选。"));
      if (hidden.length) actions.append(button("查看这些色号", "show-all"));
      if (state.mode === "measured" && hidden.some(p => C.eligible(p, "estimate"))) actions.append(button("改用品牌估算", "estimate"));
      actions.append(button("清除筛选", "reset-filters")); empty.append(actions); container.append(empty);
    }
    $("[data-pm-count]").textContent = `${paints.length.toLocaleString()} 色`; $("[data-pm-page]").textContent = `${page + 1} / ${pages}`;
    $("[data-pm-prev]").disabled = page === 0; $("[data-pm-next]").disabled = page + 1 >= pages;
    $("[data-pm-inventory-count]").textContent = `我的颜料 ${state.owned.length} 色 · 完整目录 ${byId.size.toLocaleString()} 色`;
    $("[data-pm-selection]").textContent = `当前配方 ${state.mix.length} / 8 色`;
    $("[data-pm-action='go-mix']").disabled = !state.mix.length;
    const chief = [...byId.values()].filter(p => p.brand === "酋长大陆" && !p.K);
    $("[data-pm-chief-count]").textContent = `${chief.length} 个色号`;
    $("[data-pm-catalogue-size]").textContent = `${new Set(catalogue.paints.map(p => p.brand)).size} 个品牌、${catalogue.paints.length.toLocaleString()} 个条目`;
    $("[data-pm-chief-guide]").hidden = state.brand !== "酋长大陆" && !state.mix.some(r => byId.get(r.id).brand === "酋长大陆");
    const selectedFamily = state.mix.length ? C.mixingGroup(byId.get(state.mix[0].id)) : null;
    const wantedFamily = state.range === "SM 喷涂纯色" ? "sheik-mainland-airbrush" : "sheik-mainland-brush";
    $("[data-pm-chief-guide] .ct-hint").textContent = state.mode === "measured" && model.paints[0].brand === "酋长大陆" ? "当前使用你导入的光谱库；验证结果见“更换计算方式”，仪器与批次尚未经本站核验。" : "参考色来自商品色卡或瓶照，实物混色尚未标定；这里的百分比不是克数或滴数。";
    $("[data-pm-action='chief-start']").hidden = state.mode === "measured" && model.paints[0].brand === "酋长大陆" || state.mode === "estimate" && (!state.mix.length || selectedFamily === wantedFamily);
    renderSolveReady();
  }
  function renderIngredients() {
    const container = $("[data-pm-ingredients]"); container.replaceChildren();
    state.mix.forEach((r, i) => {
      const p = byId.get(r.id), row = el("div", "pm-ingredient"), head = el("div", "pm-ingredient-head"), dot = el("span", "pm-dot"); dot.style.backgroundColor = p.hex;
      const remove = button("×", "remove", i); remove.className = "pm-remove"; remove.setAttribute("aria-label", "移除 " + title(p)); head.append(dot, el("strong", "", title(p)), remove);
      const controls = el("div", "pm-weight"), sliderLabel = el("label", "", "比例"), slider = el("input"), numberLabel = el("label", "", "百分比 %"), number = el("input", "input");
      slider.type = "range"; slider.min = "0"; slider.max = "100"; slider.step = ".1"; slider.dataset.pmWeight = i; slider.dataset.pmSlider = ""; slider.disabled = state.mix.length < 2;
      const total = state.mix.reduce((sum, entry) => sum + entry.weight, 0);
      number.type = "number"; number.min = "0"; number.max = "100"; number.step = "any"; number.value = total > 0 ? Number((r.weight / total * 100).toFixed(3)) : 0; number.disabled = state.mix.length < 2; number.dataset.pmWeight = i; number.dataset.pmNumber = "";
      slider.setAttribute("aria-label", title(p) + " 比例滑块"); number.setAttribute("aria-label", title(p) + " 百分比"); sliderLabel.append(slider); numberLabel.append(number); controls.append(sliderLabel, numberLabel);
      const percent = el("p", "pm-percent"); percent.dataset.pmPercent = i; row.append(head, controls, percent); container.append(row);
    });
    if (!state.mix.length) { const empty = el("div", "pm-empty"); empty.append(el("strong", "", "先选 1–8 种颜料"), el("p", "ct-hint", "从目录点“加入配方”，再回来调整百分比。"), button("去选颜料", "go-catalogue")); container.append(empty); }
    $("[data-pm-undo]").disabled = !undo.length; $("[data-pm-redo]").disabled = !redo.length;
    renderCatalogue();
  }
  function paintSwatch(node, hex, text = hex) { node.style.backgroundColor = hex; node.style.color = window.ColorToolsCore.ink(hex); node.textContent = text; }
  function renderPreview() {
    if (!state) return;
    paintSwatch($("[data-pm-target-swatch]"), state.target);
    const total = state.mix.reduce((sum, r) => sum + r.weight, 0);
    $$('[data-pm-slider]').forEach(n => { const r = state.mix[Number(n.dataset.pmWeight)]; n.value = total > 0 ? r.weight / total * 100 : 0; });
    $$('[data-pm-number]').forEach(n => { if (n !== document.activeElement && !n.hasAttribute("aria-invalid")) { const r = state.mix[Number(n.dataset.pmWeight)]; n.value = total > 0 ? Number((r.weight / total * 100).toFixed(3)) : 0; } });
    $$('[data-pm-percent]').forEach(n => { const r = state.mix[Number(n.dataset.pmPercent)]; n.textContent = total > 0 ? `${(r.weight / total * 100).toFixed(3)}%${state.mode === "measured" ? " · 质量比例" : " · 估算参数"}` : "用量为零"; });
    const invalid = !!$("[data-pm-weight][aria-invalid='true']") || state.mode === "measured" && !!$("[data-pm-mass][aria-invalid='true']") || state.compare && !!$("[data-pm-target][aria-invalid='true']"); result = null;
    try {
      if (invalid) throw new Error("请修正标出的目标色或用量，再查看结果。");
      result = C.mix(recipe(), state.mode, model);
      paintSwatch($("[data-pm-mix-swatch]"), result.hex);
      const chiefEstimate = state.mode === "estimate" && state.mix.some(r => byId.get(r.id).brand === "酋长大陆");
      $("[data-pm-result]").textContent = `${state.mode === "measured" ? "实测标定模型预测" : chiefEstimate ? "酋长大陆参考色估算，实物混色尚未标定" : "品牌色号估算参考"}${state.compare ? ` · 与目标的模型色差 ΔE00 ${errorText(C.deltaE(result.lab, C.hexLab(state.target)))}（越小越接近）` : " · 开启“对照目标色”可比较色差"}${result.clipped ? " · 超出屏幕 sRGB 色域，显示色已裁切；色差按未裁切模型计算" : ""}`;
      const weighing = $("[data-pm-weighing]"); weighing.replaceChildren();
      if (state.mode === "measured") {
        const normalized = C.normalized(recipe()), masses = C.grams(recipe(), state.mass);
        normalized.forEach((r, i) => weighing.append(el("div", "", `${title(r.paint)}：${masses[i].toFixed(2)} g${masses[i] === 0 ? "（低于 0.01g 分辨率，请增加总量）" : ""}`)));
        const rounded = C.mix(normalized.map((r, i) => ({ paint: r.paint, weight: masses[i] })), state.mode, model);
        const drift = C.deltaE(result.lab, rounded.lab);
        if (drift > .1) weighing.append(el("p", "ct-hint", `称量精度 0.01g；按显示克数混合会改变预测色（ΔE00 ${drift.toFixed(3)}）。请增加总量或提高称量精度。`));
      } else weighing.textContent = "估算比例未按具体产品的质量和着色力标定，不输出实体克数。";
    } catch (error) { $("[data-pm-result]").textContent = state.mix.length ? error.message : "选好颜料后，这里会实时显示混色结果。"; $("[data-pm-weighing]").replaceChildren(); $("[data-pm-mix-swatch]").textContent = state.mix.length ? "请修正标出的输入" : "等待加入颜料"; $("[data-pm-mix-swatch]").style.backgroundColor = "var(--surface-sunken)"; $("[data-pm-mix-swatch]").style.color = "var(--ink)"; }
    for (const key of ["save", "copy", "add-color", "png"]) $(`[data-pm-${key}]`).disabled = !result;
    renderSolveReady(); $("[data-pm-action='solve-current']").disabled = !state.mix.length;
    $("[data-pm-undo]").disabled = !undo.length; $("[data-pm-redo]").disabled = !redo.length;
  }
  function renderSaved() {
    const list = $("[data-pm-saved]"); list.replaceChildren(); $("[data-pm-saved-count]").textContent = `${state.saved.length} / 100`;
    for (const s of state.saved) { const row = el("div", "pm-saved-item"), text = el("div"); text.append(el("strong", "", s.name), el("small", "ct-hint", `${s.mode === "measured" ? "质量配方" : "估算参考"} · ${s.target} · ${s.recipe.length} 色`)); row.append(text, button("打开", "load", s.id), button("删除", "delete", s.id)); list.append(row); }
    if (!state.saved.length) list.append(el("p", "ct-hint", "还没有保存配方。在“自己试混色”中调整后保存。"));
    if (deletedRecipe) list.append(button("撤销删除配方", "restore"));
  }
  function renderAll() { renderTask(); renderIngredients(); renderPreview(); renderSaved(); }
  function add(id) {
    const p = byId.get(id);
    if (!p || !C.eligible(p, state.mode, state.group)) { status("此色号缺少当前模式可用的数据，可设为目标或加入库存。", true); return; }
    if (state.mix.length >= 8 || state.mix.some(r => r.id === id)) return;
    const first = state.mix.length ? byId.get(state.mix[0].id) : null;
    const reason = C.compatibilityReason(p, state.mode, state.group, first?.binder, first ? C.mixingGroup(first) : null);
    if (reason) { status(reason, true); return; }
    commit(() => state.mix.push({ id, weight: state.mix.length ? state.mix.reduce((sum, r) => sum + r.weight, 0) / state.mix.length || 1 : 1 })); status(`已加入 ${title(p)} · 当前 ${state.mix.length} 色，可继续选料或点“去调比例”。`);
  }
  function setTarget(hex) {
    C.hexRGB(hex); state.target = hex.toUpperCase(); $("[data-pm-target]").value = state.target; $("[data-pm-target]").removeAttribute("aria-invalid"); $("[data-pm-target-picker]").value = state.target;
    cancel(true); persist(); renderPreview();
  }
  function tab(name, focus = false) {
    if (worker) { cancel(); status("已切换任务，计算已取消。"); }
    state.task = name; renderTask(); renderPreview(); persist();
    if (focus) $(`[data-pm-tab='${name}']`).focus({ preventScroll: true });
  }
  function renderTask() {
    const name = state.task;
    root.dataset.task = name;
    $$('[data-pm-tab]').forEach(b => { const active = b.dataset.pmTab === name; b.setAttribute("aria-selected", String(active)); b.tabIndex = active ? 0 : -1; });
    $$('[data-pm-panel]').forEach(p => p.hidden = p.dataset.pmPanel !== name);
    $("[data-pm-flow]").textContent = name === "mix" ? "选颜料 → 调百分比 → 看结果并保存" : "定目标色 → 选可用颜料范围 → 计算并采用配方";
    $("[data-pm-target-area]").hidden = name === "mix" && !state.compare;
    $("[data-pm-target-area] h3").textContent = name === "solve" ? "① 你想调成什么颜色？" : "对照目标色（可选）";
    $("[data-pm-target-compare]").hidden = !state.compare;
    $("[data-pm-compare]").checked = state.compare;
    $(".pm-comparison").dataset.compare = String(state.compare);
    $("#pm-catalogue-title").textContent = name === "mix" ? "① 选颜料" : "颜料目录与库存";
  }
  function jump(selector) {
    const node = $(selector); node.focus({ preventScroll: true }); node.scrollIntoView({ behavior: "auto", block: "start" });
  }
  function switchMode(mode, group = state.group) {
    if (mode === state.mode && group === state.group) return;
    undo.push(snapshot()); if (undo.length > 40) undo.shift(); redo = []; cancel(true); state.mode = mode; state.group = group; rebuild();
    state.mix = state.mix.filter(r => C.eligible(byId.get(r.id), mode, group));
    if (mode === "estimate" && state.mix.length) state.mix = state.mix.filter(r => C.mixingGroup(byId.get(r.id)) === C.mixingGroup(byId.get(state.mix[0].id)));
    page = 0; $$('[aria-invalid]').forEach(n => n.removeAttribute("aria-invalid")); renderSettings(); renderAll(); persist();
    status((mode === "measured" ? "已改用实测标定，仅保留同一标定库的颜料。" : "已改用品牌估算，比例仅供参考。") + "原配方可点上方“撤销”恢复。");
  }
  function recipeText() {
    const normalized = C.normalized(recipe()), masses = state.mode === "measured" ? C.grams(recipe(), state.mass) : null;
    const rounded = masses ? C.mix(normalized.map((r, i) => ({ paint: r.paint, weight: masses[i] })), state.mode, model) : null;
    const chief = state.mode === "estimate" && normalized.some(r => r.paint.brand === "酋长大陆"), sources = [...new Set(normalized.map(r => r.paint.sourceKey).filter(Boolean))].map(key => catalogue.sources?.[key]).filter(Boolean);
    return [`${$("[data-pm-name]").value.trim() || "调色配方"}`, state.mode === "measured" ? (model === baseModel ? "公开光谱标定 · Kimera · 质量配方" : "用户光谱标定 · 质量配方 · 仪器与批次由用户提供") : "目录光谱估算 · 非实体质量配方", ...(chief ? ["酋长大陆参考色来自商品色卡或瓶照，未经该批次实物混色标定；百分比不能当作克数或滴数。"] : []), ...(state.mode === "measured" && model !== baseModel ? [model.validationReport ? `用户验证样本 ${model.validationReport.count} 个，平均 ΔE00 ${errorText(model.validationReport.meanDeltaE)}，最大 ${errorText(model.validationReport.maxDeltaE)}；本站未核验测量过程。` : "未提供独立实物验证样本。"] : []), state.compare ? `目标 ${state.target} / 预测 ${result.hex} / ΔE00 ${errorText(C.deltaE(result.lab, C.hexLab(state.target)))}` : `预测混合色 ${result.hex}`, ...normalized.map((r, i) => `${r.paint.brand === "酋长大陆" ? r.paint.brand + " / " + r.paint.range : label(r.paint)} / ${title(r.paint)}：${(r.weight * 100).toFixed(4)}%${masses ? ` · ${masses[i].toFixed(2)}g${masses[i] === 0 ? "（低于称量分辨率）" : ""}` : ""}`), ...(rounded ? [`总量 ${state.mass.toFixed(2)}g；0.01g 舍入后的预测 ${rounded.hex} / ${state.compare ? "目标色差" : "与原配方预测的色差"} ${errorText(C.deltaE(rounded.lab, state.compare ? C.hexLab(state.target) : result.lab))}`, "称量舍入会改变预测结果；小比例成分请增加总量或提高称量精度。"] : []), "D65 / CIE1931 2°；ΔE 为模型色差，不代表实体混色成功率。", model === baseModel && state.mode === "measured" ? "数据：miciwan/PaintMixing (CC BY 4.0) https://github.com/miciwan/PaintMixing" : "计算：Spectral.js 或用户自有标定；目录：Paintdex / 酋长大陆公开商品事实。", ...[...new Map(sources.map(s => [s.publisher, s])).values()].map(s => `参考资料：${s.publisher} ${s.publisher === "HRS" ? "https://www.hiroshisanmodel.com/collections/酋長大陸" : s.publisher === "The Chaotic Goods" ? "https://thechaoticgoods.gg/collections/sheik-mainland" : s.url}`)].join("\n");
  }
  function download(blob, filename) {
    if (exportedURL) URL.revokeObjectURL(exportedURL); exportedURL = URL.createObjectURL(blob);
    const link = $("[data-pm-download]"); link.href = exportedURL; link.download = filename; $("[data-pm-download-row]").hidden = false;
    link.click(); status("文件已生成，可在下方再次下载。");
  }
  function jsonDownload(value, filename) { download(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }), filename); }
  function saveRecipe() {
    if (!result) return;
    let name = $("[data-pm-name]").value.trim().slice(0, 80);
    if (!name) { $("[data-pm-name]").setAttribute("aria-invalid", "true"); $("[data-pm-name]").focus(); status("请给配方起一个名称。", true); return; }
    if (name === "我的调色配方") { const base = "调色 " + result.hex; name = base; let n = 2; while (state.saved.some(s => s.name === name)) name = `${base} (${n++})`; $("[data-pm-name]").value = name; }
    state.name = name;
    const existing = state.saved.findIndex(s => s.name === name);
    if (existing < 0 && state.saved.length >= 100) { status("已保存 100 份配方，请先导出备份或删除旧配方。", true); return; }
    const item = { id: existing < 0 ? crypto.randomUUID() : state.saved[existing].id, name, mode: state.mode, group: state.group, target: state.target, compare: state.compare, mass: state.mass, recipe: state.mix.map(r => ({ ...r })) };
    if (existing < 0) state.saved.push(item); else state.saved[existing] = item;
    const saved = persist(); renderSaved(); status(saved ? `已${existing < 0 ? "保存" : "更新"}“${name}”。` : "配方已加入当前会话，请导出备份以免丢失。", !saved);
  }
  async function png() {
    if (!result) return; const token = generation, text = recipeText(), target = state.target, predicted = result.hex, compare = state.compare;
    const canvas = el("canvas"), context = canvas.getContext("2d"), lines = [];
    context.font = "24px system-ui, sans-serif";
    for (const line of text.split("\n")) { let fragment = ""; for (const char of line) { if (context.measureText(fragment + char).width > 1060) { lines.push(fragment); fragment = char; } else fragment += char; } lines.push(fragment); }
    canvas.width = 1200; canvas.height = 330 + lines.length * 39; context.fillStyle = "#FFFFFF"; context.fillRect(0, 0, canvas.width, canvas.height);
    (compare ? [target, predicted] : [predicted]).forEach((hex, i) => { context.fillStyle = hex; context.fillRect(50 + i * 560, 50, compare ? 540 : 1100, 190); context.fillStyle = window.ColorToolsCore.ink(hex); context.font = "28px system-ui, sans-serif"; context.fillText(`${compare && i === 0 ? "目标" : "预测"} ${hex}`, 75 + i * 560, 210); });
    context.fillStyle = "#1E293B"; context.font = "24px system-ui, sans-serif"; lines.forEach((line, i) => context.fillText(line, 60, 295 + 39 * i));
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (token !== generation) return; if (!blob) { status("图片导出失败，请重试。", true); return; } download(blob, "paint-recipe.png");
  }
  function renderResults() {
    const list = $("[data-pm-results]"); list.replaceChildren();
    results.forEach((r, i) => { const card = el("div", "pm-recipe"), strip = el("div", "pm-recipe-preview"); card.dataset.recommended = String(i === 0); [state.target, r.result.hex].forEach((hex, j) => { const n = el("span"); paintSwatch(n, hex, `${j ? "配方预测" : "想要的颜色"} ${hex}`); strip.append(n); }); const apply = button("采用并微调 →", "apply", i); if (i === 0) apply.classList.add("btn-primary"); card.append(el("h4", "", `${i === 0 ? "推荐 · " : ""}${r.kind} · ${r.recipe.length} 色`), strip, el("p", "ct-hint", `模型色差 ΔE00 ${errorText(r.error)}（越小越接近）`), el("p", "", r.recipe.map(t => `${title(byId.get(t.id))} ${(t.weight * 100).toFixed(3)}%`).join(" + ")), apply); if (state.mode === "estimate") card.append(el("p", "ct-hint", r.recipe.some(t => byId.get(t.id).brand === "酋长大陆") ? "酋长大陆商品色卡/瓶照参考，未经实物混色标定；百分比不是克数或滴数。" : "品牌估算参考，未经具体实体颜料标定。")); list.append(card); });
  }
  function solve() {
    cancel(true);
    if ($("[data-pm-target][aria-invalid='true']")) return;
    const paints = filtered(true); if (!paints.length) { status("范围内没有可计算的颜料。请调整品牌、系列或“我的颜料”范围。", true); return; }
    const current = ++job, token = generation;
    try {
      worker = new Worker(new URL("js/paint-mixer-worker.js?v=20261008-chief-2", document.baseURI));
      $("[data-pm-solve]").disabled = true; $("[data-pm-cancel]").hidden = false; $("[data-pm-progress]").hidden = false; $("[data-pm-progress]").value = 0;
      status("正在本地搜索颜料组合并优化比例…");
      worker.onmessage = ({ data }) => {
        if (token !== generation || data.job !== current) return;
        if (data.progress) { $("[data-pm-progress]").value = data.progress.done / data.progress.total; $("[data-pm-solve-note]").textContent = `已搜索 ${data.progress.done} / ${data.progress.total} 个组合`; return; }
        cancel();
        if (data.error) { status(data.error, true); return; }
        results = data.result.recipes; renderResults();
        $("[data-pm-solve-note]").textContent = `搜索 ${data.result.candidates} / ${data.result.available} 个候选色号、${data.result.combinations} 个组合；${data.result.exhaustive ? "已枚举范围内所有 1–" + Math.min(Number($("[data-pm-max]").value), data.result.candidates) + " 色组合" : "大目录使用近似色和色域覆盖筛选，未穷举全部色号"}。比例使用数值优化，不能证明全局最优。`;
        status(`找到 ${results.length} 份方案，最佳模型 ΔE00 ${errorText(results[0].error)}${results[0].error > 3 ? "；现有颜料只能近似，请比较结果后试调" : ""}。`);
      };
      worker.onerror = () => { if (token === generation && current === job) { cancel(); status("计算未完成，请检查资源部署并重试。", true); } };
      worker.postMessage({ job: current, paints, target: state.target, mode: state.mode, model, maxColors: Number($("[data-pm-max]").value) });
    } catch (error) { cancel(); status("无法启动本地计算：" + error.message, true); }
  }
  function template() {
    jsonDownload({ format: "claudeOne.paint-measurements", version: 1, name: "我的品牌 / 系列", group: "my-calibration-v1", binder: "acrylic", basis: "mass", wavelengths: baseModel.wavelengths, white: { name: "同一批次基准白", reflectance: [] }, paints: [{ id: "my-calibration-v1-paint-01", name: "颜料名称与色号", reflectance: [], tints: [{ paintMass: 1, whiteMass: 1, reflectance: [] }] }], instructions: "填写仪器实测反射率（0–1），各数组长度与 wavelengths 一致。白、纯色和混合色须在相同底材、充分覆盖且相同干燥条件下测量。可换成仪器原生波长网格，只要覆盖全区间。binder 为 acrylic / oil / enamel / lacquer。不要把 HEX 或手机照片填成光谱。" }, "paint-measurement-template.json");
  }
  function beginChief(useCurrentRange = false) {
    const chosenRange = useCurrentRange && state.range === "SM 喷涂纯色" ? "SM 喷涂纯色" : "BT 笔涂纯色", family = chosenRange === "SM 喷涂纯色" ? "sheik-mainland-airbrush" : "sheik-mainland-brush";
    commit(() => { state.mode = "estimate"; state.mix = state.mix.filter(r => C.mixingGroup(byId.get(r.id)) === family); state.name = "我的调色配方"; state.brand = "酋长大陆"; state.range = chosenRange; });
    $("[data-pm-search]").value = ""; $("[data-pm-owned-only]").checked = false; $("[data-pm-compatible]").checked = true; page = 0; renderSettings(); renderAll(); persist();
    status("已打开酋长大陆参考估算；原计算方式和配方可点“撤销”恢复。请先选你手里的真实色号。");
  }
  function chiefTemplate() {
    const airbrush = state.range === "SM 喷涂纯色", family = airbrush ? "sheik-mainland-airbrush" : "sheik-mainland-brush";
    const paints = catalogue.paints.filter(p => p.brand === "酋长大陆" && p.mixingGroup === family);
    const white = paints.find(p => p.code === (airbrush ? "SM5011" : "BT2006"));
    jsonDownload(C.measurementTemplate(paints, white.id, baseModel), airbrush ? "sheik-mainland-sm-measurements.json" : "sheik-mainland-bt-btsy-measurements.json");
  }
  function addNeutral(white) {
    const first = state.mix.length ? byId.get(state.mix[0].id) : null;
    const candidates = filtered(false, { compatible: true }).filter(p => !state.mix.some(r => r.id === p.id) && !C.compatibilityReason(p, state.mode, state.group, first?.binder, first ? C.mixingGroup(first) : null));
    let chosen;
    if (state.mode === "measured") chosen = white ? model.paints[0] : candidates.find(p => p.code === "BT2009" || p.code === "SM5010" || p.id === "kimera-black");
    else if (first?.brand === "酋长大陆" || state.brand === "酋长大陆") {
      const airbrush = first ? C.mixingGroup(first) === "sheik-mainland-airbrush" : state.range === "SM 喷涂纯色";
      const code = airbrush ? white ? "SM5011" : "SM5010" : state.range === "BTSY 色之源" ? white ? "BTSY01" : "BTSY10" : white ? "BT2006" : "BT2009";
      chosen = byId.get("sheik-mainland-" + code.toLowerCase());
    }
    if (chosen && state.mix.some(r => r.id === chosen.id)) { status(`${title(chosen)} 已在配方中，可直接调整它的百分比。`); return; }
    if (!chosen) chosen = candidates.sort((a, b) => white ? C.hexLab(b.hex)[0] - C.hexLab(a.hex)[0] : C.hexLab(a.hex)[0] - C.hexLab(b.hex)[0])[0];
    if (chosen) add(chosen.id); else status("当前系列没有可加入的白色或黑色，请从目录选择具体色号。", true);
  }
  async function importFile(file) {
    if (!file) return; const token = generation, kind = importType;
    try {
      if (file.size > 12 * 1024 * 1024) throw new Error("JSON 文件最大 12 MB。");
      const raw = JSON.parse(await file.text()); if (token !== generation) return;
      if (kind === "backup") {
        if (raw.format !== "claudeOne.paint-workspace" || raw.version !== 1) throw new Error("请选择本站导出的颜料与配方备份。");
        const next = validateState(raw.state); cancel(true); state = next; rebuild(); undo = redo = []; deletedRecipe = null; renderSettings(); renderAll();
        status(persist() ? "备份已完整导入；当前库存和配方已替换，可用先前导出的备份恢复。" : "备份已导入当前会话；浏览器无法持久保存，请保留原文件。");
      } else {
        const m = raw.format === "claudeOne.paint-measurements" ? C.calibrate(raw, baseModel) : validateCustom(raw); validateCustom(m);
        if (state.models.length >= 10 || state.models.some(x => x.paints[0].group === m.paints[0].group) || m.paints.some(p => byId.has(p.id))) throw new Error("标定库已存在、色号冲突，或已达到 10 库上限。请使用独立标定组 ID。");
        cancel(true); state.models.push(m); state.group = m.paints[0].group; state.mode = "measured"; state.brand = m.paints[0].brand; state.range = m.paints[0].range; state.mix = []; rebuild(); undo = redo = []; renderSettings(); renderAll(); persist();
        status(`已导入 ${m.paints.length} 色用户标定库；实际精度须用独立混色样本验证。`);
      }
    } catch (error) { if (token === generation) status(error.message || "导入失败，原有数据保留。", true); }
  }
  function actions(event) {
    const b = event.target.closest("button"); if (!b || !state) return;
    if (b.dataset.pmTab) { tab(b.dataset.pmTab); return; }
    const action = b.dataset.pmAction, id = b.dataset.pmId;
    try {
      if (action === "add") add(id);
      else if (action === "own") { cancel(true); const index = state.owned.indexOf(id); if (index < 0) state.owned.push(id); else state.owned.splice(index, 1); persist(); renderCatalogue(); }
      else if (action === "target") { setTarget(byId.get(id).hex); tab("solve"); jump("[data-pm-target]"); status("目标已设为 " + title(byId.get(id)) + "，选好范围后点击计算配方。"); }
      else if (action === "go-catalogue") jump("#pm-catalogue-title");
      else if (action === "go-mix") { tab("mix"); jump("#pm-panel-mix"); }
      else if (action === "solve-current") { $("[data-pm-scope]").value = "mix"; tab("solve"); jump("[data-pm-target]"); }
      else if (action === "chief" || action === "chief-start") beginChief(action === "chief-start");
      else if (action === "chief-template") chiefTemplate();
      else if (action === "show-all") { $("[data-pm-compatible]").checked = false; page = 0; cancel(true); renderCatalogue(); }
      else if (action === "estimate") switchMode("estimate");
      else if (action === "reset-filters" || action === "reset-scope") { $("[data-pm-search]").value = ""; $("[data-pm-brand]").value = ""; $("[data-pm-owned-only]").checked = false; $("[data-pm-compatible]").checked = true; if (action === "reset-scope") $("[data-pm-scope]").value = "group"; renderRanges(); page = 0; cancel(true); renderCatalogue(); }
      else if (action === "remove") commit(() => state.mix.splice(Number(id), 1));
      else if (action === "apply") { const r = results[Number(id)]; state.compare = true; state.name = "我的调色配方"; commit(() => state.mix = r.recipe.map(t => ({ id: t.id, weight: t.weight * 100 }))); $("[data-pm-name]").value = state.name; tab("mix"); jump("#pm-panel-mix"); status("已采用配方。可调百分比、输入总克数，再命名保存。"); }
      else if (action === "load") { const s = state.saved.find(x => x.id === id); cancel(true); state.mode = s.mode; state.group = s.group; state.target = s.target; state.compare = s.compare; state.name = s.name; state.mass = s.mass; state.mix = s.recipe.map(t => ({ ...t })); rebuild(); undo = redo = []; renderSettings(); renderAll(); tab("mix"); jump("#pm-panel-mix"); status("已打开“" + s.name + "”，同名保存会更新这份配方。"); }
      else if (action === "delete") { const i = state.saved.findIndex(s => s.id === id); deletedRecipe = { item: state.saved[i], index: i }; state.saved.splice(i, 1); persist(); renderSaved(); }
      else if (action === "restore") { if (state.saved.length >= 100) throw new Error("配方已满，请先释放一个位置。"); state.saved.splice(deletedRecipe.index, 0, deletedRecipe.item); deletedRecipe = null; persist(); renderSaved(); }
      else if (b.hasAttribute("data-pm-white") || b.hasAttribute("data-pm-black")) addNeutral(b.hasAttribute("data-pm-white"));
      else if (b.hasAttribute("data-pm-equal")) commit(() => state.mix.forEach(r => r.weight = 1));
      else if (b.hasAttribute("data-pm-clear")) commit(() => state.mix = []);
      else if (b.hasAttribute("data-pm-undo") || b.hasAttribute("data-pm-redo")) { const backwards = b.hasAttribute("data-pm-undo"), from = backwards ? undo : redo, to = backwards ? redo : undo; if (from.length) { cancel(true); to.push(snapshot()); Object.assign(state, JSON.parse(from.pop())); rebuild(); renderSettings(); renderAll(); persist(); status(backwards ? "已撤销，原计算方式和配方已恢复。" : "已重做。"); } }
      else if (b.hasAttribute("data-pm-use-current")) setTarget(bridge.getColor());
      else if (b.hasAttribute("data-pm-save")) saveRecipe();
      else if (b.hasAttribute("data-pm-copy") && result) { const token = generation; navigator.clipboard.writeText(recipeText()).then(() => { if (token === generation) status("配方已复制。"); }, () => { if (token === generation) status("浏览器未允许复制，请使用 JSON 或 PNG 导出。", true); }); }
      else if (b.hasAttribute("data-pm-add-color") && result) { const hex = result.hex; if (bridge.addColor(hex, $("[data-pm-name]").value.trim() || "颜料混合色")) status(hex + " 已加入上方色卡。"); else status("色卡已满，请先移除一个颜色。", true); }
      else if (b.hasAttribute("data-pm-png")) png();
      else if (b.hasAttribute("data-pm-solve")) solve();
      else if (b.hasAttribute("data-pm-cancel")) { cancel(); status("计算已取消，未应用任何结果。"); }
      else if (b.hasAttribute("data-pm-prev")) { page = Math.max(0, page - 1); renderCatalogue(); }
      else if (b.hasAttribute("data-pm-next")) { page++; renderCatalogue(); }
      else if (b.hasAttribute("data-pm-backup")) jsonDownload({ format: "claudeOne.paint-workspace", version: 1, state, sources: ["https://github.com/miciwan/PaintMixing", "https://github.com/s10-steve/paintdex", "https://www.hiroshisanmodel.com/collections/%E9%85%8B%E9%95%B7%E5%A4%A7%E9%99%B8", "https://sugotoys.com.au/product/sm-paint/"], licensing: "PaintMixing measured data CC BY 4.0; Paintdex directory MIT; Sheik Mainland public product facts with attribution, source images not redistributed; user models supplied by user." }, "paint-workspace.json");
      else if (b.hasAttribute("data-pm-template")) template();
      else if (b.hasAttribute("data-pm-import-backup") || b.hasAttribute("data-pm-import-model")) { importType = b.hasAttribute("data-pm-import-backup") ? "backup" : "model"; $("[data-pm-file]").value = ""; $("[data-pm-file]").click(); }
      else if (b.hasAttribute("data-pm-remove-model") && model !== baseModel) { cancel(true); const ids = new Set(model.paints.map(p => p.id)); state.models = state.models.filter(m => m !== model); state.owned = state.owned.filter(id => !ids.has(id)); state.saved = state.saved.filter(s => s.group !== state.group && !s.recipe.some(r => ids.has(r.id))); state.mix = []; state.group = baseModel.paints[0].group; state.mode = "measured"; deletedRecipe = null; undo = redo = []; rebuild(); renderSettings(); renderAll(); persist(); status("用户标定库及引用它的配方已从本机移除。可通过 JSON 备份恢复。"); }
    } catch (error) { status(error.message, true); }
  }
  function mount(container, callbacks) {
    unmount(); host = container; root = container.querySelector("[data-pm]"); bridge = callbacks; ac = new AbortController(); const opener = host.querySelector("[data-pm-open]");
    listen(opener, "click", async () => { const page = root; page.open = true; await initialize(); if (root === page && page.open) page.scrollIntoView({ behavior: "auto", block: "start" }); });
    listen(root, "toggle", () => { if (root.open) initialize(); else if (worker) { cancel(); status("面板已收起，计算已取消。"); } });
    listen(root, "click", actions);
    listen(root, "input", event => {
      const field = event.target; if (!state) return;
      if (field.hasAttribute("data-pm-search")) { page = 0; cancel(true); renderCatalogue(); }
      else if (field.hasAttribute("data-pm-target")) { cancel(true); try { setTarget(field.value.trim()); } catch (_) { field.setAttribute("aria-invalid", "true"); renderPreview(); } }
      else if (field.hasAttribute("data-pm-target-picker")) setTarget(field.value);
      else if (field.hasAttribute("data-pm-weight")) {
        const i = Number(field.dataset.pmWeight), value = Number(field.value);
        if (!field.value.trim() || !Number.isFinite(value) || value < 0 || value > 100) { field.setAttribute("aria-invalid", "true"); renderPreview(); return; }
        field.removeAttribute("aria-invalid");
        const weights = C.percentageWeights(state.mix.map(r => r.weight), i, value);
        $$('[data-pm-number]').forEach(n => n.removeAttribute("aria-invalid"));
        commit(() => state.mix.forEach((r, j) => r.weight = weights[j]), false);
      } else if (field.hasAttribute("data-pm-mass")) { const value = Number(field.value); if (!field.value.trim() || !field.checkValidity() || value < .01 || value > 10000 || !Number.isFinite(value)) field.setAttribute("aria-invalid", "true"); else { field.removeAttribute("aria-invalid"); state.mass = value; persist(); } renderPreview(); }
      else if (field.hasAttribute("data-pm-name")) { field.removeAttribute("aria-invalid"); state.name = field.value; persist(); renderPreview(); }
    });
    listen(root, "change", event => {
      const field = event.target; if (!state) return;
      if (field.hasAttribute("data-pm-mode")) switchMode(field.value);
      else if (field.hasAttribute("data-pm-compare")) { state.compare = field.checked; renderTask(); renderPreview(); persist(); }
      else if (field.hasAttribute("data-pm-group")) switchMode("measured", field.value);
      else if (field.hasAttribute("data-pm-brand")) { page = 0; renderRanges(); cancel(true); renderCatalogue(); persist(); }
      else if (["data-pm-range", "data-pm-owned-only", "data-pm-compatible"].some(a => field.hasAttribute(a))) { state.range = $("[data-pm-range]").value; page = 0; cancel(true); renderCatalogue(); persist(); }
      else if (field.hasAttribute("data-pm-scope") || field.hasAttribute("data-pm-max")) { cancel(true); renderSolveReady(); }
      else if (field.hasAttribute("data-pm-file")) importFile(field.files[0]);
    });
    listen(root, "keydown", event => { const b = event.target.closest("[data-pm-tab]"); if (b && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); tab(event.key === "Home" ? "mix" : event.key === "End" ? "solve" : b.dataset.pmTab === "mix" ? "solve" : "mix", true); } });
    listen(document, "visibilitychange", () => { if (document.hidden && worker) { cancel(); status("页面已进入后台，计算已取消。返回后可重新寻找配方。"); } });
  }
  function unmount() {
    generation++; cancel(); if (ac) ac.abort(); if (exportedURL) URL.revokeObjectURL(exportedURL);
    exportedURL = null; root = host = ac = bridge = state = baseModel = model = catalogue = byId = result = null; loading = false; results = []; undo = redo = []; deletedRecipe = null;
  }
  window.PaintMixer = Object.freeze({ mount, unmount });
})();
