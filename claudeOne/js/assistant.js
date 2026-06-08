~/* ===== claudeOne :: assistant.js =====
 * Global site assistant. It asks DeepSeek for a structured intent:
 *   { reply: string, actions: [{ page, action, args }] }
 * The executor only runs whitelisted page actions; it never evals model text.
 */
(function bootstrapSiteAssistant() {
  "use strict";

  const CFG = window.CLAUDE_ONE_CONFIG && window.CLAUDE_ONE_CONFIG.deepseek;
  const CS = window.ClaudeOne;
  const ROUTER = () => window.__ClaudeOneRouter;
  const ROOT = document.querySelector("[data-site-assistant]");
  if (!CFG || !CS || !ROOT) return;

  const STORAGE_KEY = "claudeOne:site-assistant-history-v1";
  const OPEN_KEY = "claudeOne:site-assistant-open";
  const CONVERSATIONS_KEY = "claudeOne:site-assistant-conversations-v1";
  const ACTIVE_CONVERSATION_KEY = "claudeOne:site-assistant-active-conversation";
  const PREFS_KEY = "claudeOne:site-assistant-prefs-v1";
  const GEOMETRY_KEY = "claudeOne:site-assistant-geometry-v1";
  const MAX_INPUT = 4000;
  const MAX_HISTORY = 28;
  const MAX_CONVERSATIONS = 24;
  const MIN_PANEL_WIDTH = 320;
  const MIN_PANEL_HEIGHT = 430;
  const GEOMETRY_MARGIN = 10;
  const THINKING_OFF = "普通模式";
  const THINKING_ON = "深度思考";

  const PAGE_GUIDE = {
    home: {
      name: "首页魔方",
      summary: "可交互 3D 魔方首页，可转动指定面、打乱、还原，也展示工具入口。",
      actions: ["turn", "scramble", "reset", "play"],
    },
    games: {
      name: "游戏中心",
      summary: "游戏列表页，可打开俄罗斯转盘或推箱子。",
      actions: ["openPage"],
    },
    tools: {
      name: "工具箱",
      summary: "工具列表页，可打开抽奖、音乐解锁、ASCII、像素化、压缩、二维码、AI 聊天等工具。",
      actions: ["openPage"],
    },
    game: {
      name: "俄罗斯转盘",
      summary: "聚会随机转盘游戏，可设置玩家、弹巢、子弹、结束规则并开始/扣扳机。",
      actions: ["setPlayers", "setSettings", "start", "fire", "newGame", "sameSettings"],
    },
    sokoban: {
      name: "推箱子",
      summary: "固定关卡和随机关卡推箱子，可移动、重置、提示、自动完成、生成随机关卡。",
      actions: ["move", "reset", "hint", "auto", "selectLevel", "random", "brutal"],
    },
    minesweeper: {
      name: "扫雷",
      summary: "经典扫雷页面，可调整棋盘大小和炸弹数量，包含计时、标旗、规则说明和渐进式提示。",
      actions: ["newGame", "setBoard", "hint", "answer", "reveal", "flag"],
    },
    lottery: {
      name: "幸运抽奖",
      summary: "大转盘抽奖工具，可管理参与者、奖项、名额、中奖记录并开始抽奖。",
      actions: ["setParticipants", "addParticipant", "setPrizes", "addPrize", "selectPrize", "draw", "resetWinners", "resetAll", "copyWinners", "clearParticipants"],
    },
    music: {
      name: "音乐解锁",
      summary: "浏览器本地解锁加密音乐文件的工具，只用于 ncm/qmc 等加密音乐文件，不是内置音乐播放器。",
      actions: ["openFilePicker", "setNaming", "playFirst", "downloadAll", "clear"],
    },
    playlist: {
      name: "播放歌单",
      summary: "全局音乐播放器和内置歌单页面。网站内置音乐可直接播放、暂停、上一首、下一首、按序号或歌名点歌。",
      actions: ["playTrack", "play", "pause", "next", "prev", "cycleMode", "openPlaylist"],
    },
    ascii: {
      name: "ASCII 艺术",
      summary: "上传图片转 ASCII 或 Braille 字符画，可设置宽高、字符集、颜色并导出。",
      actions: ["openFilePicker", "setParams", "convert", "copy", "downloadText", "downloadPng", "clear", "loadHistory"],
    },
    pixel: {
      name: "图片像素化",
      summary: "把图片处理成像素风，可设置块大小、尺寸、调色板、抖动、网格和特效。",
      actions: ["openFilePicker", "setParams", "exportPng", "copyConfig", "reset", "clear"],
    },
    compress: {
      name: "图片压缩",
      summary: "批量压缩、调整尺寸、转换格式并下载图片或 ZIP。",
      actions: ["openFilePicker", "setParams", "start", "cancel", "downloadAll", "downloadZip", "recompress", "clear"],
    },
    qr: {
      name: "二维码美化",
      summary: "生成带 Logo、渐变、点样式、角标、纠错等级的二维码并导出。",
      actions: ["setContent", "setStyle", "applyPreset", "openLogoPicker", "removeLogo", "exportPng", "exportSvg", "copyConfig", "importConfig", "reset", "clear"],
    },
    ai: {
      name: "DeepSeek 聊天",
      summary: "完整 AI 聊天页，支持模型、思维链、提示词和话题管理。",
      actions: ["newTopic", "clearTopic", "openApiKey", "openPrompt"],
    },
  };

  const ACTION_HINTS = {
    navigate: "全局跳转: args { page }",
    generic: "通用页面动作: setField { label,value }, chooseOption { group,label|value }, toggleSwitch { label,checked }, clickControl { label }, setRange { label,value }",
    home: "turn { move:'U' }, scramble { count }, reset, play { count }",
    game: "setPlayers { names }, setSettings { chamberSize, bulletCount, endCondition, turnOrder, autoSpin, revealAfterMiss }, start, fire",
    sokoban: "move { dir:'up|down|left|right' }, reset, hint, auto, selectLevel { id }, random { difficulty }, brutal",
    minesweeper: "newGame { preset:'beginner|intermediate|expert' }, setBoard { cols, rows, bombs }, hint, answer, reveal { row, col }, flag { row, col }",
    lottery: "setParticipants { names }, setPrizes { prizes:[{name, quota}] }, addPrize { name, quota }, selectPrize { name }, draw",
    music: "音乐解锁工具: openFilePicker, setNaming { format }, playFirst, downloadAll, clear。只在用户说解锁/加密音乐文件时使用。",
    playlist: "内置音乐播放器: playTrack { index|number|title|query }, play, pause, next, prev, cycleMode, openPlaylist。听歌/播放音乐/点歌必须使用 playlist，不要使用 music。",
    ascii: "openFilePicker, setParams { mode, width, height, charSet, colored }, convert, copy, downloadText, downloadPng",
    pixel: "openFilePicker, setParams { blockSize, palette, dither, gridLines, crt, noise }, exportPng, reset, clear",
    compress: "openFilePicker, setParams { quality, format, maxDim, concurrency }, start, cancel, downloadAll, downloadZip",
    qr: "setContent { type, value }, setStyle { width,height,margin,bgColor,dotsColor,dotsType,preset,transparentBg,gradient,gradientType,gradientColor1,gradientColor2,gradientRotation,cornersSquareType,cornersSquareColor,cornersSquareFollowDots,cornersDotType,cornersDotColor,cornersDotFollowDots,logoSize,logoMargin,logoHideBg,errorCorrection,exportName,exportScale }, openLogoPicker, removeLogo, exportPng, exportSvg, reset, clear",
    ai: "newTopic, clearTopic, openApiKey, openPrompt",
  };

  const PAGE_ALIASES = [
    { page: "minesweeper", words: ["扫雷", "地雷", "炸弹", "标旗", "雷区", "雷数"] },
    { page: "sokoban", words: ["推箱子", "箱子", "过一关", "自动完成", "自动过关"] },
    { page: "home", words: ["魔方", "cube", "首页魔方"] },
    { page: "lottery", words: ["抽奖", "开奖", "中奖", "名单", "奖项", "奖品"] },
    { page: "qr", words: ["二维码", "qr", "码", "背景色", "主题色", "渐变", "预设"] },
    { page: "compress", words: ["图片压缩", "压缩图片", "压缩", "webp", "jpg", "jpeg"] },
    { page: "pixel", words: ["像素化", "像素风", "马赛克"] },
    { page: "ascii", words: ["ascii", "字符画", "braille", "盲文"] },
    { page: "playlist", words: ["播放音乐", "听歌", "听音乐", "放歌", "点歌", "点播", "来首歌", "来一首歌", "歌曲", "内置音乐", "内置歌单", "播放器", "歌单", "播放列表", "音乐播放"] },
    { page: "music", words: ["音乐解锁", "解锁音乐", "加密音乐", "音乐文件", "ncm", "qmc"] },
    { page: "game", words: ["俄罗斯转盘", "转盘", "轮盘"] },
    { page: "tools", words: ["工具箱", "工具列表"] },
    { page: "games", words: ["游戏中心", "游戏列表"] },
    { page: "ai", words: ["ai 聊天", "deepseek", "聊天页"] },
  ];

  const FILE_TOOL_PAGES = new Set(["compress", "pixel", "ascii", "music"]);
  const EXECUTION_WORDS = /(?:你来|你帮|帮我|替我|给我|开始|执行|操作|点|点击|打开|进入|跳转|导航|去|弄|搞|设置|修改|改|还原|重置|打乱|自动完成|自动过|抽|开抽|玩玩|随便|处理|压缩|转换|生成|导出|复制|下载|解锁|播放|听歌|听音乐|放歌|点歌|点播|暂停|上一首|下一首|换一首)/;
  const CONTINUE_WORDS = /^(?:\?+|？+|!+|！+|嗯+|好+|行+|可以|继续|再来|重试|再试|来吧|开始吧|弄吧|搞啊|点啊|你点啊|导航啊|打开啊|执行啊|快点|不是说了吗|你不是说了吗|然后呢|接着)$/;
  const PROMISE_WORDS = /(?:我(?:来|会|马上|现在|帮你|为你|将|准备|可以帮你).*(?:导航|跳转|打开|点击|执行|开始|自动完成|还原|抽奖|设置|导入|处理|压缩|转换|生成)|(?:马上|现在|准备).*(?:导航|跳转|打开|点击|执行|开始|自动完成|还原|抽奖|设置|导入|处理|压缩|转换|生成)|(?:已|已经).*(?:准备|开始|为你))/;

  const state = {
    open: CS.storage.get(OPEN_KEY) === "true",
    busy: false,
    abort: null,
    prefs: loadPrefs(),
    geometry: loadAssistantGeometry(),
    geometryAnimation: null,
    geometryAnimationRun: 0,
    openMenu: null,
    renamingConversationId: null,
    deletingConversationId: null,
    conversations: loadConversations(),
    activeConversationId: null,
    messages: [],
  };

  let els = {};
  state.activeConversationId = storageGet(ACTIVE_CONVERSATION_KEY) || (state.conversations[0] && state.conversations[0].id);
  if (!activeConversation() && state.conversations[0]) state.activeConversationId = state.conversations[0].id;
  state.messages = activeConversation() ? activeConversation().messages.slice(-MAX_HISTORY) : [];

  function esc(value) {
    return CS.escapeHtml ? CS.escapeHtml(value) : String(value ?? "");
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function renderMarkdown(content) {
    const source = String(content || "");
    const chunks = [];
    let cursor = 0;
    source.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (match, lang, code, offset) => {
      if (offset > cursor) chunks.push({ type: "text", value: source.slice(cursor, offset) });
      chunks.push({ type: "code", value: code });
      cursor = offset + match.length;
      return match;
    });
    if (cursor < source.length) chunks.push({ type: "text", value: source.slice(cursor) });
    if (!chunks.length) chunks.push({ type: "text", value: source });
    return chunks.map((chunk) => {
      if (chunk.type === "code") return "<pre><code>" + esc(chunk.value.replace(/\n$/, "")) + "</code></pre>";
      return renderInlineMarkdown(chunk.value);
    }).join("");
  }

  function renderInlineMarkdown(text) {
    return esc(text)
      .replace(/`([^`\n]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  function storageGet(key) {
    return CS.storage.get(key);
  }

  function storageSet(key, value) {
    CS.storage.set(key, value);
  }

  function makeConversation(title) {
    return {
      id: "conv-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
      title: title || "新对话",
      messages: [],
      taskMemory: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  function loadPrefs() {
    try {
      const raw = storageGet(PREFS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const models = Array.isArray(CFG.models) ? CFG.models : [CFG.defaultModel];
      return {
        model: models.includes(parsed.model) ? parsed.model : CFG.defaultModel,
        thinking: parsed.thinking !== false,
        showTools: parsed.showTools !== false,
      };
    } catch {
      return { model: CFG.defaultModel, thinking: true, showTools: true };
    }
  }

  function savePrefs() {
    storageSet(PREFS_KEY, JSON.stringify(state.prefs));
  }

  function loadHistory() {
    try {
      const raw = storageGet(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY) : [];
    } catch {
      return [];
    }
  }

  function loadConversations() {
    try {
      const raw = storageGet(CONVERSATIONS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length) {
        return parsed
          .filter((c) => c && c.id && Array.isArray(c.messages))
          .map((c) => Object.assign({ taskMemory: {} }, c))
          .slice(0, MAX_CONVERSATIONS);
      }
    } catch {}
    const migrated = makeConversation("旧助手对话");
    migrated.messages = loadHistory();
    migrated.updatedAt = Date.now();
    return [migrated];
  }

  function saveConversations() {
    const active = activeConversation();
    if (active) {
      active.messages = state.messages.slice(-MAX_HISTORY);
      active.updatedAt = Date.now();
    }
    state.conversations.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    state.conversations = state.conversations.slice(0, MAX_CONVERSATIONS);
    storageSet(CONVERSATIONS_KEY, JSON.stringify(state.conversations));
    if (state.activeConversationId) storageSet(ACTIVE_CONVERSATION_KEY, state.activeConversationId);
    storageSet(STORAGE_KEY, JSON.stringify(state.messages.slice(-MAX_HISTORY)));
  }

  function persistConversationList() {
    state.conversations = state.conversations.slice(0, MAX_CONVERSATIONS);
    storageSet(CONVERSATIONS_KEY, JSON.stringify(state.conversations));
    if (state.activeConversationId) storageSet(ACTIVE_CONVERSATION_KEY, state.activeConversationId);
  }

  function activeConversation() {
    return state.conversations.find((c) => c.id === state.activeConversationId) || null;
  }

  function setActiveConversation(id) {
    const found = state.conversations.find((c) => c.id === id) || state.conversations[0] || makeConversation();
    if (!state.conversations.includes(found)) state.conversations.unshift(found);
    state.activeConversationId = found.id;
    state.messages = Array.isArray(found.messages) ? found.messages.slice(-MAX_HISTORY) : [];
    storageSet(ACTIVE_CONVERSATION_KEY, found.id);
    renderConversationSelect();
    renderMessages();
  }

  function updateConversationTitle(text) {
    const active = activeConversation();
    if (!active || active.titleManual || active.title !== "新对话") return;
    const clean = normalizeText(text).slice(0, 18);
    if (clean) active.title = clean;
  }

  function taskMemory() {
    const active = activeConversation();
    return (active && active.taskMemory) || {};
  }

  function updateTaskMemory(memory) {
    if (!memory || typeof memory !== "object") return;
    const active = activeConversation();
    if (!active) return;
    const previous = active.taskMemory || {};
    const previousSlots = Object.assign({}, previous.slots || {});
    active.taskMemory = Object.assign({}, previous, memory);
    if (memory.slots && typeof memory.slots === "object") {
      active.taskMemory.slots = Object.assign({}, previousSlots, memory.slots);
    }
    active.updatedAt = Date.now();
    saveConversations();
  }

  function newConversation() {
    const conv = makeConversation();
    state.conversations.unshift(conv);
    state.activeConversationId = conv.id;
    state.messages = [];
    state.openMenu = null;
    state.renamingConversationId = null;
    state.deletingConversationId = null;
    saveConversations();
    renderConversationSelect();
    renderMessages();
    addMessage("system", "已新建对话。", { silent: true });
  }

  function startRenameConversation(id) {
    if (!state.conversations.find((c) => c.id === id)) return;
    state.openMenu = "history";
    state.renamingConversationId = id;
    state.deletingConversationId = null;
    renderConversationSelect();
    setTimeout(() => {
      const input = ROOT.querySelector('[data-assistant-rename-input="' + cssEscape(id) + '"]');
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  function commitRenameConversation(id, value) {
    const conv = state.conversations.find((c) => c.id === id);
    if (!conv) return;
    const title = normalizeText(value).slice(0, 36);
    if (!title) {
      setStatus("名称不能为空");
      return;
    }
    conv.title = title;
    conv.titleManual = true;
    conv.updatedAt = Date.now();
    state.renamingConversationId = null;
    persistConversationList();
    renderConversationSelect();
    setStatus("对话已重命名");
  }

  function requestDeleteConversation(id) {
    if (!state.conversations.find((c) => c.id === id)) return;
    state.openMenu = "history";
    state.deletingConversationId = id;
    state.renamingConversationId = null;
    renderConversationSelect();
  }

  function cancelConversationInlineAction() {
    state.renamingConversationId = null;
    state.deletingConversationId = null;
    renderConversationSelect();
  }

  function confirmDeleteConversation(id) {
    const conv = state.conversations.find((c) => c.id === id);
    if (!conv) return;
    if (state.abort && conv.id === state.activeConversationId) state.abort.abort();
    state.conversations = state.conversations.filter((c) => c.id !== conv.id);
    if (!state.conversations.length) state.conversations.unshift(makeConversation());
    if (conv.id === state.activeConversationId || !state.conversations.find((c) => c.id === state.activeConversationId)) {
      state.activeConversationId = state.conversations[0].id;
      state.messages = Array.isArray(state.conversations[0].messages) ? state.conversations[0].messages.slice(-MAX_HISTORY) : [];
    }
    state.deletingConversationId = null;
    persistConversationList();
    renderConversationSelect();
    renderMessages();
    setStatus("对话已删除");
  }

  function routeNow() {
    return (ROUTER() && ROUTER().getCurrent && ROUTER().getCurrent()) || document.body.getAttribute("data-page") || "home";
  }

  function pageMeta(page) {
    const router = ROUTER();
    return (router && router.getMeta && router.getMeta(page)) || (window.__CLAUDEONE_PAGES && window.__CLAUDEONE_PAGES[page]) || null;
  }

  function lifecycleFor(page) {
    const meta = pageMeta(page);
    return meta && meta.lifecycle ? window[meta.lifecycle] : null;
  }

  function pageAssistant(page) {
    const lc = lifecycleFor(page);
    return lc && lc.assistant ? lc.assistant : null;
  }

  function attachLifecycleAssistant(page) {
    const meta = pageMeta(page);
    const lc = lifecycleFor(page);
    if (!meta || !lc || lc.assistant || !ADAPTERS[page]) return;
    lc.assistant = ADAPTERS[page];
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function currentPageText() {
    const main = document.querySelector("[data-content-slot]");
    return normalizeText(main ? main.innerText : "").slice(0, 1600);
  }

  function labelForControl(el) {
    if (!el) return "";
    const explicit = el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("title");
    if (explicit) return normalizeText(explicit);
    const label = el.closest("label");
    if (label) return normalizeText(label.textContent);
    const field = el.closest(".qr-field, .field, .form-field, .control-row, .settings-row, .panel-row");
    if (field) {
      const named = field.querySelector(".qr-field__label, .field__label, .label, h3, h4, span");
      if (named) return normalizeText(named.textContent);
    }
    const dataName = Array.from(el.attributes || [])
      .map((attr) => attr.name.startsWith("data-") ? attr.name.replace(/^data-/, "") : "")
      .find(Boolean);
    return dataName || normalizeText(el.textContent).slice(0, 40);
  }

  function controlValue(el) {
    if (!el) return "";
    if (el.type === "checkbox") return el.checked;
    if (el.type === "radio") return el.checked ? el.value : "";
    if ("value" in el) return el.value;
    return normalizeText(el.textContent);
  }

  function collectInteractiveControls() {
    const root = mainRoot();
    const items = [];
    const push = (kind, label, value, extra) => {
      label = normalizeText(label);
      if (!label) return;
      items.push(Object.assign({ kind, label, value }, extra || {}));
    };

    qa("input, textarea, select", root).forEach((el) => {
      if (el.type === "hidden" || el.hidden) return;
      if (el.type === "radio") return;
      const kind = el.type === "range" ? "range" : el.type === "checkbox" ? "switch" : el.tagName.toLowerCase();
      push(kind, labelForControl(el), controlValue(el), el.type === "range" ? { min: el.min, max: el.max, step: el.step } : {});
    });

    const radioNames = new Set(qa('input[type="radio"]', root).map((el) => el.name).filter(Boolean));
    radioNames.forEach((name) => {
      const radios = qa('input[type="radio"][name="' + name + '"]', root);
      const group = radios[0] && (radios[0].closest('[role="radiogroup"]') || radios[0].closest(".segmented"));
      push("radio", group ? labelForControl(group) : name, radios.find((r) => r.checked)?.value || "", {
        name,
        options: radios.map((r) => ({ value: r.value, label: labelForControl(r) || r.value })).slice(0, 12),
      });
    });

    qa("button, [role='button'], .pill", root).slice(0, 80).forEach((el) => {
      if (el.disabled || el.hidden) return;
      const label = normalizeText(el.getAttribute("aria-label") || el.textContent || el.title);
      if (label) push("button", label, "");
    });

    return items.slice(0, 90);
  }

  function collectContext() {
    const current = routeNow();
    const meta = pageMeta(current) || {};
    const adapter = getAdapter(current);
    let pageState = {};
    try {
      pageState = adapter && adapter.getState ? adapter.getState() : {};
    } catch (e) {
      pageState = { error: e.message };
    }
    return {
      currentRoute: current,
      currentPage: PAGE_GUIDE[current] || { name: meta.title || current, summary: meta.description || "" },
      title: document.title,
      metaDescription: meta.description || "",
      visibleText: currentPageText(),
      pageState,
      player: collectPlayerContext(),
      interactiveControls: collectInteractiveControls(),
      taskMemory: taskMemory(),
      pages: Object.keys(PAGE_GUIDE).map((key) => ({
        route: key,
        name: PAGE_GUIDE[key].name,
        summary: PAGE_GUIDE[key].summary,
        actions: PAGE_GUIDE[key].actions.concat(["setField", "chooseOption", "toggleSwitch", "clickControl", "setRange"]),
      })),
      globalActions: ["navigate", "playerPlay", "playerPause", "playerToggle", "playerNext", "playerPrev", "playerCycleMode", "playerOpenPlaylist"],
      actionHints: ACTION_HINTS,
      assistantPrefs: { model: state.prefs.model, thinking: !!state.prefs.thinking },
    };
  }

  function collectPlayerContext() {
    const tracks = getPlayerTracks();
    const p = window.ClaudeOnePlayer;
    let playerState = {};
    try {
      playerState = p && typeof p.getState === "function" ? p.getState() : {};
    } catch {
      playerState = {};
    }
    return {
      builtInCount: Array.isArray(window.__MUSIC_PLAYLIST) ? window.__MUSIC_PLAYLIST.length : 0,
      playlistLength: tracks.length,
      playing: !!playerState.playing,
      currentIndex: Number.isFinite(playerState.currentIndex) ? playerState.currentIndex : -1,
      currentTrack: playerState.track ? {
        title: playerState.track.title || "",
        artist: playerState.track.artist || "",
        album: playerState.track.album || "",
      } : null,
      tracks: tracks.slice(0, 12).map((track) => ({
        index: track.index,
        number: track.index + 1,
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
      })),
    };
  }

  function getPlayerTracks() {
    let raw = [];
    const p = window.ClaudeOnePlayer;
    try {
      if (p && typeof p.getSequentialPlaylist === "function") raw = p.getSequentialPlaylist();
      else if (p && typeof p.getPlaylist === "function") raw = p.getPlaylist();
      else if (Array.isArray(window.__MUSIC_PLAYLIST)) raw = window.__MUSIC_PLAYLIST;
    } catch {
      raw = [];
    }
    return (Array.isArray(raw) ? raw : []).map((track, index) => ({
      index: Number.isInteger(track.index) ? track.index : index,
      src: track.src || track.file || "",
      title: track.title || "Unknown",
      artist: track.artist || "Unknown Artist",
      album: track.album || "",
      duration: track.duration || "",
      source: track.source || "playlist",
    }));
  }

  function normalizeSongText(value) {
    return normalizeText(value)
      .toLowerCase()
      .replace(/[《》「」『』“”"'\s·\-_/\\|:：,，.。!！?？()[\]（）【】]/g, "");
  }

  function findTrackIndex(args) {
    const tracks = getPlayerTracks();
    if (!tracks.length) return -1;
    const explicitNumber = Number(args.number || args.no || args.order || 0);
    if (Number.isFinite(explicitNumber) && explicitNumber > 0 && explicitNumber <= tracks.length) {
      return tracks[explicitNumber - 1].index;
    }
    const explicitIndex = Number(args.index ?? args.track);
    if (Number.isFinite(explicitIndex) && explicitIndex >= 0 && explicitIndex < tracks.length) {
      return tracks.find((track) => track.index === explicitIndex)?.index ?? explicitIndex;
    }
    const query = normalizeSongText(args.title || args.name || args.query || args.keyword || "");
    if (!query) return -1;
    const exact = tracks.find((track) => normalizeSongText(track.title) === query || normalizeSongText(track.artist + track.title) === query);
    if (exact) return exact.index;
    const loose = tracks.find((track) => {
      const haystack = normalizeSongText([track.title, track.artist, track.album].join(" "));
      return haystack.includes(query) || query.includes(normalizeSongText(track.title));
    });
    return loose ? loose.index : -1;
  }

  function systemPrompt(context) {
    return [
      "你是 claudeOne 网站里的全站 AI 助手。你必须用中文回答，简洁、准确、直接。",
      "你知道网站页面、当前页面文本、状态和白名单动作。需要操作网站时，只能返回 actions 数组里的白名单动作。",
      "只要用户表达的是让你操作网站，就必须给出 actions，不要只说“我来操作”。短句要结合当前页面、前文和 taskMemory 理解，例如“你还原”在魔方页就是 home.reset，“你点啊”要执行刚才承诺或 taskMemory.nextAction。",
      "如果一个任务需要多轮收集信息，请把已知信息写入 memory.slots，并只问下一个最关键缺失项。用户补充后必须合并旧 slots，不要只使用最后一句。",
      "memory 可以包含 activeGoal、lastTargetPage、lastPromisedActions、pendingActions、slots、missing、lastFailure。承诺执行时请同步写入 pendingActions 或 actions。",
      "用户用代词、短句或追问时，要主动沿用最近的意图和当前页面。例如刚聊过推箱子自动完成，用户说“你点啊”，就执行 sokoban.auto；刚聊过抽奖，用户补充“名单是 A B C”，要把名单写进旧抽奖任务。",
      "音乐相关必须区分：用户说听歌、播放音乐、点歌、上一首、下一首、暂停、播放某首歌时，使用 playlist 页面和播放器动作；网站已有内置歌单，不要说必须先解锁音乐。只有用户明确说解锁/加密音乐文件/ncm/qmc/选择音乐文件时才使用 music 页面。",
      "如果信息已经足够执行，不要继续反复追问。执行前可以用 reply 简短说明会做什么，同时 actions 里给出真实动作。",
      "不要编造不存在的功能。文件选择、下载、剪贴板等浏览器权限如果需要用户参与，要在 reply 中说明。",
      state.prefs.thinking ? "需要复杂操作时，请先在内部充分推理，但最终仍只输出严格 JSON，不要输出思考过程。" : "关闭深度思考，优先快速给出直接答案和必要动作。",
      "输出必须是严格 JSON，不要 markdown，不要代码围栏，格式如下：",
      '{"reply":"给用户看的中文 Markdown 回复","actions":[{"page":"lottery","action":"setParticipants","args":{"names":["张三","李四"]}}],"memory":{"intent":"lottery","page":"lottery","slots":{"names":["张三","李四"]},"missing":[],"nextAction":null}}',
      "如果只是解释页面或回答问题，actions 为空数组。",
      "如果 reply 写了“我已开始/我会点击/我来还原/我来自动完成”，actions 里必须真的包含对应动作。",
      "当前上下文：",
      JSON.stringify(context),
    ].join("\n");
  }

  function renderShell() {
    ROOT.dataset.open = String(state.open);
    ROOT.innerHTML = `
      <button class="assistant-launcher" data-assistant-open type="button" aria-label="打开 AI 助手" title="AI 助手">
        <span class="assistant-launcher__glow" aria-hidden="true"></span>
        <span class="assistant-launcher__emblem" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3l1.6 4.7L18 9.4l-4.4 1.7L12 16l-1.6-4.9L6 9.4l4.4-1.7L12 3z"/>
            <path d="M5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8L5 15z"/>
          </svg>
        </span>
        <span class="assistant-launcher__label" aria-hidden="true">AI</span>
        <span class="assistant-launcher__rail" aria-hidden="true"><i></i><i></i><i></i></span>
      </button>
      <section class="assistant-panel" aria-label="全站 AI 助手">
        <header class="assistant-head">
          <div class="assistant-title">
            <strong>全站 AI 助手</strong>
            <small data-assistant-route></small>
          </div>
          <div class="assistant-head-actions">
            <button class="assistant-iconbtn" data-assistant-key type="button" title="DeepSeek API Key" aria-label="DeepSeek API Key">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="7.5" cy="12" r="3.5"/>
                <path d="M11 12h10"/>
                <path d="M17 12v3"/>
                <path d="M20 12v2"/>
              </svg>
            </button>
            <button class="assistant-iconbtn" data-assistant-close type="button" title="最小化" aria-label="最小化 AI 助手">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>
            </button>
          </div>
        </header>
        <div class="assistant-toolbar">
          <div class="assistant-toolbar__row assistant-toolbar__row--primary">
            <label class="assistant-field">
              <span>模型</span>
              <div class="assistant-menu assistant-menu--model" data-assistant-model-root>
                <button class="assistant-menu-button" data-assistant-model-toggle type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="选择 AI 模型">
                  <span class="assistant-menu-button__value" data-assistant-model-label></span>
                  <svg class="assistant-menu-button__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
                </button>
                <div class="assistant-menu-popover assistant-menu-popover--model" data-assistant-model-menu role="listbox" aria-label="模型列表"></div>
              </div>
            </label>
            <button class="assistant-think" data-assistant-thinking type="button" aria-pressed="false" title="切换思考模式">
              <span class="assistant-think__dot" aria-hidden="true"></span>
              <span data-assistant-thinking-label>${esc(THINKING_OFF)}</span>
            </button>
            <button class="assistant-tool-toggle" data-assistant-tools-toggle type="button" aria-pressed="true" title="显示或隐藏工具调用日志">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M8 6h13"/>
                <path d="M8 12h13"/>
                <path d="M8 18h13"/>
                <path d="M3 6h.01"/>
                <path d="M3 12h.01"/>
                <path d="M3 18h.01"/>
              </svg>
              <span data-assistant-tools-label>日志</span>
            </button>
          </div>
          <div class="assistant-field assistant-field--history">
            <span>对话</span>
            <div class="assistant-history-row">
              <div class="assistant-menu assistant-menu--history" data-assistant-history-root>
                <button class="assistant-menu-button assistant-menu-button--history" data-assistant-history-toggle type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="历史对话">
                  <span class="assistant-menu-button__value" data-assistant-history-label></span>
                  <span class="assistant-menu-button__meta" data-assistant-history-meta></span>
                  <svg class="assistant-menu-button__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
                </button>
                <div class="assistant-menu-popover assistant-menu-popover--history" data-assistant-history-menu role="listbox" aria-label="对话列表"></div>
              </div>
              <div class="assistant-history-actions" aria-label="对话操作">
                <button class="assistant-iconbtn assistant-iconbtn--compact" data-assistant-new type="button" title="新建对话" aria-label="新建对话">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h8A2.5 2.5 0 0 1 17 5.5v7A2.5 2.5 0 0 1 14.5 15H9l-4 4v-4.5A2.5 2.5 0 0 1 4 12.5z"/>
                    <path d="M15 18h5"/>
                    <path d="M17.5 15.5v5"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="assistant-messages" data-assistant-messages></div>
        <form class="assistant-composer" data-assistant-form>
          <div class="assistant-input-wrap">
            <textarea class="textarea assistant-input" data-assistant-input maxlength="${MAX_INPUT}" rows="3" placeholder="问我这个页面是什么，或让我操作网站..."></textarea>
            <span class="assistant-count" data-assistant-count>0 / ${MAX_INPUT}</span>
          </div>
          <div class="assistant-composer-actions">
            <span class="assistant-status" data-assistant-status>就绪</span>
            <span class="assistant-action-buttons">
              <button class="assistant-stop" data-assistant-stop type="button" hidden aria-label="中止生成">
                <span class="assistant-stop__halo" aria-hidden="true"></span>
                <span class="assistant-stop__icon" aria-hidden="true"></span>
                <span class="assistant-stop__text">中止</span>
              </button>
              <button class="assistant-send" data-assistant-send type="submit" aria-label="发送消息">
                <span class="assistant-send__text">发送</span>
                <svg class="assistant-send__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M5 12h14"/>
                  <path d="M13 6l6 6-6 6"/>
                </svg>
              </button>
            </span>
          </div>
        </form>
        <span class="assistant-resize-handle" data-assistant-resize title="拖动调整大小" aria-hidden="true"></span>
      </section>
    `;
    collectEls();
    syncPrefsControls();
    renderConversationSelect();
    wire();
    renderMessages();
    refreshRouteLabel();
    applyAssistantGeometry();
    if (state.messages.length === 0) {
      addMessage("system", "我可以解释当前页面，也可以按你的要求自动跳转和操作页面。比如：帮我去抽奖页，名单是张三、李四，奖项一等奖 1 名。", { silent: true });
    }
  }

  function syncPrefsControls() {
    renderModelMenu();
    if (els.thinking) {
      const on = !!state.prefs.thinking;
      els.thinking.dataset.active = String(on);
      els.thinking.setAttribute("aria-pressed", String(on));
      const label = ROOT.querySelector("[data-assistant-thinking-label]");
      if (label) label.textContent = on ? THINKING_ON : THINKING_OFF;
    }
    if (els.tools) {
      const on = state.prefs.showTools !== false;
      els.tools.dataset.active = String(on);
      els.tools.setAttribute("aria-pressed", String(on));
      const label = ROOT.querySelector("[data-assistant-tools-label]");
      if (label) label.textContent = on ? "日志开" : "日志关";
    }
  }

  function syncMenuState() {
    if (els.modelRoot) els.modelRoot.dataset.open = String(state.openMenu === "model");
    if (els.modelToggle) els.modelToggle.setAttribute("aria-expanded", String(state.openMenu === "model"));
    if (els.historyRoot) els.historyRoot.dataset.open = String(state.openMenu === "history");
    if (els.historyToggle) els.historyToggle.setAttribute("aria-expanded", String(state.openMenu === "history"));
  }

  function renderModelMenu() {
    if (!els.modelMenu) return;
    const models = Array.isArray(CFG.models) && CFG.models.length ? CFG.models : [CFG.defaultModel];
    const selected = models.includes(state.prefs.model) ? state.prefs.model : CFG.defaultModel;
    state.prefs.model = selected;
    if (els.modelLabel) els.modelLabel.textContent = selected;
    els.modelMenu.innerHTML = models
      .map((model) => {
        const active = model === selected;
        return `
          <button class="assistant-menu-option" data-assistant-model-option="${esc(model)}" data-active="${active}" role="option" aria-selected="${active}" type="button">
            <span>${esc(model)}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
          </button>
        `;
      })
      .join("");
    syncMenuState();
  }

  function renderConversationSelect() {
    if (!els.historyMenu) return;
    const active = activeConversation();
    if (els.historyLabel) els.historyLabel.textContent = active ? (active.title || "未命名对话") : "新对话";
    if (els.historyMeta) {
      const count = active && Array.isArray(active.messages) ? active.messages.filter((m) => m.role === "user" || m.role === "assistant").length : 0;
      els.historyMeta.textContent = count ? count + " 条" : "";
    }
    els.historyMenu.innerHTML = state.conversations
      .map((conv) => {
        const label = conv.title || "未命名对话";
        const time = conv.updatedAt ? new Date(conv.updatedAt).toLocaleDateString("zh-CN") : "";
        const active = conv.id === state.activeConversationId;
        if (state.renamingConversationId === conv.id) {
          return `
            <div class="assistant-conv-item" data-active="${active}" data-renaming="true">
              <form class="assistant-rename-form" data-assistant-rename-form="${esc(conv.id)}">
                <input class="assistant-rename-input" data-assistant-rename-input="${esc(conv.id)}" value="${esc(label)}" maxlength="36" aria-label="对话名称" />
                <button class="assistant-mini-action assistant-mini-action--ok" data-assistant-rename-save="${esc(conv.id)}" type="submit">保存</button>
                <button class="assistant-mini-action" data-assistant-inline-cancel type="button">取消</button>
              </form>
            </div>
          `;
        }
        return `
          <div class="assistant-conv-item" data-active="${active}">
            <button class="assistant-conv-main" data-assistant-conv-open="${esc(conv.id)}" role="option" aria-selected="${active}" type="button">
              <span class="assistant-conv-title">${esc(label)}</span>
              <span class="assistant-conv-meta">${time ? esc(time) : "刚刚"}</span>
            </button>
            <button class="assistant-conv-icon" data-assistant-conv-rename="${esc(conv.id)}" type="button" title="重命名" aria-label="重命名 ${esc(label)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
            </button>
            <button class="assistant-conv-icon assistant-conv-icon--danger" data-assistant-conv-delete="${esc(conv.id)}" type="button" title="删除" aria-label="删除 ${esc(label)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>
            </button>
            ${state.deletingConversationId === conv.id ? `
              <div class="assistant-inline-confirm">
                <span>确定删除？</span>
                <button class="assistant-mini-action" data-assistant-inline-cancel type="button">取消</button>
                <button class="assistant-mini-action assistant-mini-action--danger" data-assistant-delete-confirm="${esc(conv.id)}" type="button">删除</button>
              </div>
            ` : ""}
          </div>
        `;
      })
      .join("");
    syncMenuState();
    bindConversationMenuActions();
  }

  function bindConversationMenuActions() {
    if (!els.historyMenu || !els.historyMenu.querySelectorAll) return;
    els.historyMenu.querySelectorAll("[data-assistant-conv-open]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setActiveConversation(btn.getAttribute("data-assistant-conv-open"));
        state.openMenu = null;
        state.renamingConversationId = null;
        state.deletingConversationId = null;
        renderConversationSelect();
        setStatus("已切换对话");
      });
    });
    els.historyMenu.querySelectorAll("[data-assistant-conv-rename]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        startRenameConversation(btn.getAttribute("data-assistant-conv-rename"));
      });
    });
    els.historyMenu.querySelectorAll("[data-assistant-conv-delete]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        requestDeleteConversation(btn.getAttribute("data-assistant-conv-delete"));
      });
    });
    els.historyMenu.querySelectorAll("[data-assistant-delete-confirm]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        confirmDeleteConversation(btn.getAttribute("data-assistant-delete-confirm"));
      });
    });
    els.historyMenu.querySelectorAll("[data-assistant-inline-cancel]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        cancelConversationInlineAction();
      });
    });
    els.historyMenu.querySelectorAll("[data-assistant-rename-form]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const id = form.getAttribute("data-assistant-rename-form");
        const input = form.querySelector("[data-assistant-rename-input]");
        commitRenameConversation(id, input ? input.value : "");
      });
    });
    els.historyMenu.querySelectorAll("[data-assistant-rename-save]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const form = btn.closest("[data-assistant-rename-form]");
        const id = btn.getAttribute("data-assistant-rename-save");
        const input = form && form.querySelector("[data-assistant-rename-input]");
        commitRenameConversation(id, input ? input.value : "");
      });
    });
    els.historyMenu.querySelectorAll("[data-assistant-rename-input]").forEach((input) => {
      input.addEventListener("click", (event) => event.stopPropagation());
      input.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cancelConversationInlineAction();
        }
      });
    });
  }

  function collectEls() {
    els.open = ROOT.querySelector("[data-assistant-open]");
    els.close = ROOT.querySelector("[data-assistant-close]");
    els.head = ROOT.querySelector(".assistant-head");
    els.resize = ROOT.querySelector("[data-assistant-resize]");
    els.newChat = ROOT.querySelector("[data-assistant-new]");
    els.key = ROOT.querySelector("[data-assistant-key]");
    els.modelRoot = ROOT.querySelector("[data-assistant-model-root]");
    els.modelToggle = ROOT.querySelector("[data-assistant-model-toggle]");
    els.modelLabel = ROOT.querySelector("[data-assistant-model-label]");
    els.modelMenu = ROOT.querySelector("[data-assistant-model-menu]");
    els.thinking = ROOT.querySelector("[data-assistant-thinking]");
    els.tools = ROOT.querySelector("[data-assistant-tools-toggle]");
    els.historyRoot = ROOT.querySelector("[data-assistant-history-root]");
    els.historyToggle = ROOT.querySelector("[data-assistant-history-toggle]");
    els.historyLabel = ROOT.querySelector("[data-assistant-history-label]");
    els.historyMeta = ROOT.querySelector("[data-assistant-history-meta]");
    els.historyMenu = ROOT.querySelector("[data-assistant-history-menu]");
    els.route = ROOT.querySelector("[data-assistant-route]");
    els.messages = ROOT.querySelector("[data-assistant-messages]");
    els.form = ROOT.querySelector("[data-assistant-form]");
    els.input = ROOT.querySelector("[data-assistant-input]");
    els.count = ROOT.querySelector("[data-assistant-count]");
    els.status = ROOT.querySelector("[data-assistant-status]");
    els.send = ROOT.querySelector("[data-assistant-send]");
    els.stop = ROOT.querySelector("[data-assistant-stop]");
  }

  function wire() {
    els.open.addEventListener("click", () => setOpen(true));
    els.close.addEventListener("click", () => setOpen(false));
    els.key.addEventListener("click", openKeyModal);
    els.newChat.addEventListener("click", newConversation);
    els.modelToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleAssistantMenu("model");
    });
    els.modelMenu.addEventListener("click", onModelMenuClick);
    els.historyToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleAssistantMenu("history");
    });
    els.historyMenu.addEventListener("click", onHistoryMenuClick);
    els.historyMenu.addEventListener("submit", onHistoryMenuSubmit);
    els.thinking.addEventListener("click", () => {
      state.prefs.thinking = !state.prefs.thinking;
      savePrefs();
      syncPrefsControls();
      setStatus(state.prefs.thinking ? "深度思考已开启" : "普通模式已开启");
    });
    els.tools.addEventListener("click", () => {
      state.prefs.showTools = state.prefs.showTools === false;
      savePrefs();
      syncPrefsControls();
      renderMessages();
      setStatus(state.prefs.showTools === false ? "已隐藏工具日志" : "已显示工具日志");
    });
    els.input.addEventListener("input", () => {
      els.input.style.height = "auto";
      els.input.style.height = Math.min(els.input.scrollHeight, 190) + "px";
      els.count.textContent = (els.input.value || "").length + " / " + MAX_INPUT;
    });
    els.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        e.stopPropagation();
        send();
      }
    });
    els.form.addEventListener("submit", (e) => {
      e.preventDefault();
      e.stopPropagation();
      send();
    });
    els.form.addEventListener("keydown", (e) => {
      if (e.key === "Enter") e.stopPropagation();
    }, true);
    els.stop.addEventListener("click", () => {
      if (state.abort) state.abort.abort();
    });
    if (els.head) els.head.addEventListener("pointerdown", startAssistantDrag);
    if (els.resize) els.resize.addEventListener("pointerdown", startAssistantResize);
    window.addEventListener("resize", syncAssistantGeometryOnResize);
    document.addEventListener("click", closeAssistantMenusFromOutside);
    document.addEventListener("keydown", closeAssistantMenusOnEscape);
  }

  function toggleAssistantMenu(name) {
    state.openMenu = state.openMenu === name ? null : name;
    state.renamingConversationId = null;
    state.deletingConversationId = null;
    if (name === "history") renderConversationSelect();
    else syncMenuState();
  }

  function closeAssistantMenus() {
    if (!state.openMenu && !state.renamingConversationId && !state.deletingConversationId) return;
    state.openMenu = null;
    state.renamingConversationId = null;
    state.deletingConversationId = null;
    renderConversationSelect();
    syncMenuState();
  }

  function closeAssistantMenusFromOutside(event) {
    if (!state.openMenu) return;
    if (ROOT.contains && ROOT.contains(event.target)) return;
    closeAssistantMenus();
  }

  function closeAssistantMenusOnEscape(event) {
    if (event.key === "Escape") closeAssistantMenus();
  }

  function onModelMenuClick(event) {
    const btn = event.target.closest && event.target.closest("[data-assistant-model-option]");
    if (!btn) return;
    const model = btn.getAttribute("data-assistant-model-option");
    if (!model) return;
    state.prefs.model = model;
    savePrefs();
    state.openMenu = null;
    renderModelMenu();
    setStatus("模型已切换");
  }

  function onHistoryMenuClick(event) {
    const target = event.target;
    if (!(target && target.closest)) return;
    const cancel = target.closest("[data-assistant-inline-cancel]");
    if (cancel) {
      cancelConversationInlineAction();
      return;
    }
    const confirmDelete = target.closest("[data-assistant-delete-confirm]");
    if (confirmDelete) {
      confirmDeleteConversation(confirmDelete.getAttribute("data-assistant-delete-confirm"));
      return;
    }
    const rename = target.closest("[data-assistant-conv-rename]");
    if (rename) {
      startRenameConversation(rename.getAttribute("data-assistant-conv-rename"));
      return;
    }
    const del = target.closest("[data-assistant-conv-delete]");
    if (del) {
      requestDeleteConversation(del.getAttribute("data-assistant-conv-delete"));
      return;
    }
    const open = target.closest("[data-assistant-conv-open]");
    if (open) {
      setActiveConversation(open.getAttribute("data-assistant-conv-open"));
      state.openMenu = null;
      state.renamingConversationId = null;
      state.deletingConversationId = null;
      renderConversationSelect();
      setStatus("已切换对话");
    }
  }

  function onHistoryMenuSubmit(event) {
    const form = event.target.closest && event.target.closest("[data-assistant-rename-form]");
    if (!form) return;
    event.preventDefault();
    const id = form.getAttribute("data-assistant-rename-form");
    const input = form.querySelector("[data-assistant-rename-input]");
    commitRenameConversation(id, input ? input.value : "");
  }

  function setOpen(open) {
    open = !!open;
    if (state.open === open && !state.geometryAnimation) return;
    if (state.geometryAnimation) cancelAssistantAnimation(state.geometryAnimation);
    const from = ROOT.getBoundingClientRect();
    const fromGeometry = {
      left: from.left,
      top: from.top,
      width: from.width,
      height: from.height,
      radius: state.open ? 22 : 999,
    };

    state.open = open;
    storageSet(OPEN_KEY, String(state.open));

    if (open) {
      const target = state.geometry || defaultAssistantGeometry();
      state.geometry = clampAssistantGeometry(target);
      ROOT.dataset.open = "true";
      animateAssistantGeometry(fromGeometry, Object.assign({ radius: 22 }, state.geometry), () => {
        applyAssistantGeometry();
        if (els.input) setTimeout(() => els.input.focus(), 30);
      });
    } else {
      const target = miniAssistantGeometry();
      ROOT.dataset.open = "false";
      animateAssistantGeometry(fromGeometry, target, () => {
        applyMiniAssistantGeometry(target);
      });
    }
  }

  function loadAssistantGeometry() {
    try {
      const parsed = JSON.parse(storageGet(GEOMETRY_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return null;
      return clampAssistantGeometry({
        left: Number(parsed.left),
        top: Number(parsed.top),
        width: Number(parsed.width),
        height: Number(parsed.height),
      });
    } catch {
      return null;
    }
  }

  function saveAssistantGeometry() {
    if (state.geometry) storageSet(GEOMETRY_KEY, JSON.stringify(state.geometry));
  }

  function clearAssistantGeometryStyle(options) {
    options = options || {};
    delete ROOT.dataset.customGeometry;
    delete ROOT.dataset.dragging;
    delete ROOT.dataset.resizing;
    if (!options.keepAnimating) delete ROOT.dataset.animating;
    ["left", "top", "right", "bottom", "width", "height", "transform", "borderRadius"].forEach((key) => {
      ROOT.style[key] = "";
    });
  }

  function applyAssistantGeometry() {
    if (!state.open) {
      clearAssistantGeometryStyle();
      return;
    }
    if (!state.geometry) return;
    state.geometry = clampAssistantGeometry(state.geometry);
    ROOT.dataset.customGeometry = "true";
    ROOT.style.left = state.geometry.left + "px";
    ROOT.style.top = state.geometry.top + "px";
    ROOT.style.right = "auto";
    ROOT.style.bottom = "auto";
    ROOT.style.width = state.geometry.width + "px";
    ROOT.style.height = state.geometry.height + "px";
    ROOT.style.transform = "none";
  }

  function applyMiniAssistantGeometry(geometry) {
    const target = geometry || miniAssistantGeometry();
    ROOT.dataset.customGeometry = "true";
    ROOT.style.left = target.left + "px";
    ROOT.style.top = target.top + "px";
    ROOT.style.right = "auto";
    ROOT.style.bottom = "auto";
    ROOT.style.width = target.width + "px";
    ROOT.style.height = target.height + "px";
    ROOT.style.borderRadius = (target.radius || 999) + "px";
    ROOT.style.transform = "none";
  }

  function defaultAssistantGeometry() {
    const viewportW = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    const viewportH = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    return clampAssistantGeometry({
      width: Math.min(460, Math.max(MIN_PANEL_WIDTH, viewportW - 178)),
      height: Math.min(680, Math.max(MIN_PANEL_HEIGHT, viewportH - 48)),
      left: viewportW - Math.min(460, Math.max(MIN_PANEL_WIDTH, viewportW - 178)) - clampNumber(viewportW * 0.11, 124, 152),
      top: (viewportH - Math.min(680, Math.max(MIN_PANEL_HEIGHT, viewportH - 48))) / 2,
    });
  }

  function miniAssistantGeometry() {
    const viewportW = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    const viewportH = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    const width = 58;
    const height = 148;
    const compact = viewportW <= 720;
    const right = compact ? 14 : clampNumber(viewportW * 0.03, 16, 28);
    const centerY = viewportH * (compact ? 0.46 : 0.5);
    return {
      left: Math.round(viewportW - width - right),
      top: Math.round(centerY - height / 2),
      width,
      height,
      radius: 999,
    };
  }

  function animateAssistantGeometry(from, to, onDone) {
    const duration = 560;
    const startedAt = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    const runId = state.geometryAnimationRun + 1;
    state.geometryAnimationRun = runId;
    ROOT.dataset.animating = "true";
    ROOT.dataset.customGeometry = "true";
    ROOT.style.right = "auto";
    ROOT.style.bottom = "auto";
    ROOT.style.transform = "none";

    const frame = (now) => {
      const elapsed = (now || Date.now()) - startedAt;
      const t = clampNumber(elapsed / duration, 0, 1);
      const eased = easeAssistantMotion(t);
      writeAssistantGeometryFrame({
        left: lerpNumber(from.left, to.left, eased),
        top: lerpNumber(from.top, to.top, eased),
        width: lerpNumber(from.width, to.width, eased),
        height: lerpNumber(from.height, to.height, eased),
        radius: lerpNumber(from.radius == null ? 22 : from.radius, to.radius == null ? 22 : to.radius, eased),
      });
      if (t < 1) {
        state.geometryAnimation = requestAssistantAnimationFrame(frame);
        return;
      }
      writeAssistantGeometryFrame(to);
      state.geometryAnimation = null;
      if (typeof onDone === "function") onDone();
      requestAssistantAnimationFrame(() => {
        requestAssistantAnimationFrame(() => {
          if (state.geometryAnimationRun === runId) delete ROOT.dataset.animating;
        });
      });
    };

    writeAssistantGeometryFrame(from);
    state.geometryAnimation = requestAssistantAnimationFrame(frame);
  }

  function requestAssistantAnimationFrame(callback) {
    if (typeof requestAnimationFrame === "function") return requestAnimationFrame(callback);
    return setTimeout(() => callback(Date.now()), 16);
  }

  function cancelAssistantAnimation(handle) {
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(handle);
    else clearTimeout(handle);
  }

  function writeAssistantGeometryFrame(geometry) {
    ROOT.style.left = Math.round(geometry.left) + "px";
    ROOT.style.top = Math.round(geometry.top) + "px";
    ROOT.style.width = Math.round(geometry.width) + "px";
    ROOT.style.height = Math.round(geometry.height) + "px";
    ROOT.style.borderRadius = Math.max(0, Math.round(geometry.radius || 0)) + "px";
  }

  function easeAssistantMotion(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function lerpNumber(a, b, t) {
    return a + (b - a) * t;
  }

  function clampAssistantGeometry(geometry) {
    const viewportW = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    const viewportH = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    const maxW = Math.max(260, viewportW - GEOMETRY_MARGIN * 2);
    const maxH = Math.max(360, viewportH - GEOMETRY_MARGIN * 2);
    const minW = Math.min(MIN_PANEL_WIDTH, maxW);
    const minH = Math.min(MIN_PANEL_HEIGHT, maxH);
    const width = clampNumber(Number(geometry && geometry.width) || 460, minW, maxW);
    const height = clampNumber(Number(geometry && geometry.height) || 680, minH, maxH);
    const left = clampNumber(Number(geometry && geometry.left) || (viewportW - width - 140), GEOMETRY_MARGIN, Math.max(GEOMETRY_MARGIN, viewportW - width - GEOMETRY_MARGIN));
    const top = clampNumber(Number(geometry && geometry.top) || ((viewportH - height) / 2), GEOMETRY_MARGIN, Math.max(GEOMETRY_MARGIN, viewportH - height - GEOMETRY_MARGIN));
    return { left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) };
  }

  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function geometryFromRootRect() {
    const rect = ROOT.getBoundingClientRect();
    return clampAssistantGeometry({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    });
  }

  function startAssistantDrag(event) {
    if (!state.open || event.button !== 0 || isAssistantControlTarget(event.target)) return;
    event.preventDefault();
    const start = geometryFromRootRect();
    const startX = event.clientX;
    const startY = event.clientY;
    ROOT.dataset.dragging = "true";
    state.geometry = start;
    applyAssistantGeometry();
    const move = (e) => {
      state.geometry = clampAssistantGeometry({
        left: start.left + e.clientX - startX,
        top: start.top + e.clientY - startY,
        width: start.width,
        height: start.height,
      });
      applyAssistantGeometry();
    };
    const done = () => {
      delete ROOT.dataset.dragging;
      saveAssistantGeometry();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", done);
      window.removeEventListener("pointercancel", done);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", done, { once: true });
    window.addEventListener("pointercancel", done, { once: true });
  }

  function startAssistantResize(event) {
    if (!state.open || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const start = geometryFromRootRect();
    const startX = event.clientX;
    const startY = event.clientY;
    ROOT.dataset.resizing = "true";
    state.geometry = start;
    applyAssistantGeometry();
    const move = (e) => {
      state.geometry = clampAssistantGeometry({
        left: start.left,
        top: start.top,
        width: start.width + e.clientX - startX,
        height: start.height + e.clientY - startY,
      });
      applyAssistantGeometry();
    };
    const done = () => {
      delete ROOT.dataset.resizing;
      saveAssistantGeometry();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", done);
      window.removeEventListener("pointercancel", done);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", done, { once: true });
    window.addEventListener("pointercancel", done, { once: true });
  }

  function isAssistantControlTarget(target) {
    return !!(target && target.closest && target.closest("button, input, textarea, select, label, a, [data-assistant-resize]"));
  }

  function syncAssistantGeometryOnResize() {
    if (state.geometryAnimation) return;
    if (!state.open) {
      applyMiniAssistantGeometry();
      return;
    }
    if (!state.geometry) return;
    state.geometry = clampAssistantGeometry(state.geometry);
    applyAssistantGeometry();
    saveAssistantGeometry();
  }

  function setStatus(text) {
    if (els.status) els.status.textContent = text || "就绪";
  }

  function setBusy(on) {
    state.busy = !!on;
    if (els.send) els.send.disabled = !!on;
    if (els.input) els.input.disabled = !!on;
    if (els.stop) els.stop.hidden = !on;
  }

  function openKeyModal() {
    CS.createApiKeyModal({
      forceOpen: true,
      onSave: () => {
        CS.toast("Key 已更新", "ok");
      },
    });
  }

  function refreshRouteLabel() {
    const route = routeNow();
    const guide = PAGE_GUIDE[route];
    if (els.route) els.route.textContent = (guide ? guide.name : route) + " · " + route;
  }

  function addMessage(role, content, opts) {
    opts = opts || {};
    const item = {
      role,
      content: String(content || ""),
      at: Date.now(),
      actions: opts.actions || [],
      streaming: !!opts.streaming,
    };
    state.messages.push(item);
    state.messages = state.messages.slice(-MAX_HISTORY);
    if (role === "user") updateConversationTitle(content);
    if (!opts.silent) {
      saveConversations();
      renderConversationSelect();
    }
    renderMessages();
    return item;
  }

  function updateMessageContent(item, content, opts) {
    if (!item) return;
    item.content = String(content || "");
    if (opts && opts.streaming != null) item.streaming = !!opts.streaming;
    if (!opts || opts.render !== false) renderMessages();
  }

  function renderMessages() {
    if (!els.messages) return;
    els.messages.innerHTML = "";
    const showTools = state.prefs.showTools !== false;
    state.messages.forEach((m) => {
      if (!showTools && m.role === "tool") return;
      const row = document.createElement("article");
      row.className = "assistant-msg";
      row.dataset.role = m.role;
      if (m.streaming) row.dataset.streaming = "true";
      const bubble = document.createElement("div");
      bubble.className = "assistant-bubble";
      if (m.role === "assistant" || m.role === "system") {
        bubble.innerHTML = renderMarkdown(m.content);
      } else {
        bubble.textContent = m.content;
      }
      row.appendChild(bubble);
      if (showTools && m.actions && m.actions.length) {
        const log = document.createElement("div");
        log.className = "assistant-actions-log";
        log.innerHTML = m.actions.map((a) => "<span>" + esc(a) + "</span>").join("");
        row.appendChild(log);
      }
      els.messages.appendChild(row);
    });
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function showTyping() {
    const row = document.createElement("article");
    row.className = "assistant-msg";
    row.dataset.role = "assistant";
    row.dataset.typing = "true";
    row.innerHTML = '<div class="assistant-bubble"><span class="assistant-typing"><span></span><span></span><span></span></span></div>';
    els.messages.appendChild(row);
    els.messages.scrollTop = els.messages.scrollHeight;
    return row;
  }

  function removeTyping() {
    const row = els.messages && els.messages.querySelector('[data-typing="true"]');
    if (row) row.remove();
  }

  async function send() {
    if (state.busy) return;
    const text = (els.input.value || "").trim();
    if (!text) return;
    if (text.length > MAX_INPUT) {
      CS.toast("单次最多 " + MAX_INPUT + " 字", "err");
      return;
    }
    const apiKey = (storageGet(CFG.storageKey) || "").trim();
    if (!apiKey) {
      openKeyModal();
      addMessage("system", "需要先保存 DeepSeek API Key。我已经打开 Key 设置。");
      return;
    }

    addMessage("user", text);
    els.input.value = "";
    els.input.style.height = "auto";
    els.count.textContent = "0 / " + MAX_INPUT;
    setBusy(true);
    setStatus("正在理解和操作...");
    const assistantItem = addMessage("assistant", "…", { silent: true, streaming: true });
    state.abort = new AbortController();

    try {
      const intent = await requestIntentStream(apiKey, text, state.abort.signal, (visible) => {
        updateMessageContent(assistantItem, visible || "…", { streaming: true });
      });
      updateTaskMemory(intent.memory);
      const resolved = resolveUserIntent(text, intent);
      updateTaskMemory(resolved.memoryPatch);
      const actions = resolved.actions || [];
      if (resolved.visibleReason) {
        addMessage("tool", resolved.visibleReason + "\n" + actions.map(actionLabel).join("\n"));
      }
      updateMessageContent(assistantItem, resolved.reply || (actions.length ? "我来执行。" : "我看完了。"), { streaming: false });
      await executeActions(actions);
      setStatus("就绪");
    } catch (err) {
      const msg = err && err.name === "AbortError" ? "已中止。" : "请求失败：" + ((err && err.message) || "未知错误");
      updateMessageContent(assistantItem, msg, { streaming: false });
      setStatus("请求失败");
    } finally {
      state.abort = null;
      setBusy(false);
      saveConversations();
    }
  }

  function buildDeepSeekMessages(userText) {
    const context = collectContext();
    const history = state.messages
      .filter((m) => (m.role === "user" || m.role === "assistant") && m.content && m.content !== "…")
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));
    const last = history[history.length - 1];
    if (!last || last.role !== "user" || last.content !== userText) history.push({ role: "user", content: userText });
    return [
      { role: "system", content: systemPrompt(context) },
      ...history,
    ];
  }

  async function requestIntentStream(apiKey, userText, signal, onVisible) {
    const messages = buildDeepSeekMessages(userText);
    const body = {
      model: state.prefs.model || CFG.defaultModel,
      messages,
      stream: true,
      temperature: 0.2,
      max_tokens: 2200,
    };

    let content = "";
    let lastVisible = "";
    const emitVisible = (text) => {
      text = String(text || "");
      if (!text || text === lastVisible) return;
      lastVisible = text;
      if (typeof onVisible === "function") onVisible(text);
    };

    if (window.ClaudeOneDeepSeek && window.ClaudeOneDeepSeek.stream) {
      await window.ClaudeOneDeepSeek.stream(apiKey, body, signal, {
        onDelta(delta) {
          const piece = delta && typeof delta.content === "string" ? delta.content : "";
          if (!piece) return;
          content += piece;
          const visible = extractStreamingReply(content);
          if (visible != null) emitVisible(visible);
          else if (!looksLikeJsonStart(content)) emitVisible(content);
        },
      });
    } else {
      const json = await fallbackComplete(apiKey, Object.assign({}, body, { stream: false }), signal);
      content = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content || "";
      const parsed = normalizeIntent(parseIntent(content || ""));
      emitVisible(parsed.reply || content);
      return parsed;
    }

    const parsed = normalizeIntent(parseIntent(content || ""));
    if (parsed.reply) emitVisible(parsed.reply);
    return parsed;
  }

  async function requestIntent(apiKey, userText, signal) {
    const messages = buildDeepSeekMessages(userText);

    const body = {
        model: state.prefs.model || CFG.defaultModel,
        messages,
        stream: false,
        temperature: 0.2,
        max_tokens: 1800,
      };
    const json = window.ClaudeOneDeepSeek && window.ClaudeOneDeepSeek.complete
      ? await window.ClaudeOneDeepSeek.complete(apiKey, body, signal)
      : await fallbackComplete(apiKey, body, signal);
    const content = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    return normalizeIntent(parseIntent(content || ""));
  }

  function looksLikeJsonStart(content) {
    return /^\s*(```json\s*)?[\{\[]/i.test(String(content || ""));
  }

  function extractStreamingReply(content) {
    const text = String(content || "").replace(/^\s*```json\s*/i, "");
    const match = /"reply"\s*:\s*"/.exec(text);
    if (!match) return null;
    let i = match.index + match[0].length;
    let raw = "";
    let escaping = false;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (escaping) {
        raw += "\\" + ch;
        escaping = false;
        continue;
      }
      if (ch === "\\") {
        escaping = true;
        continue;
      }
      if (ch === '"') break;
      raw += ch;
    }
    return decodeJsonStringPartial(raw);
  }

  function decodeJsonStringPartial(raw) {
    return String(raw || "")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }

  async function fallbackComplete(apiKey, body, signal) {
    const resp = await fetch(CFG.baseUrl + CFG.chatPath, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      throw new Error("DeepSeek 返回 " + resp.status + ": " + detail.slice(0, 180));
    }
    return resp.json();
  }

  function parseIntent(content) {
    content = String(content || "").trim();
    try {
      return JSON.parse(content);
    } catch {
      const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenced && fenced[1]) {
        try { return JSON.parse(fenced[1].trim()); } catch {}
      }
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try { return JSON.parse(content.slice(start, end + 1)); } catch {}
      }
      return { reply: content || "我收到了，但这次没有生成可执行动作。", actions: [] };
    }
  }

  function normalizeIntent(intent) {
    const obj = intent && typeof intent === "object" ? intent : {};
    const actions = Array.isArray(obj.actions) ? obj.actions : [];
    return {
      reply: typeof obj.reply === "string" ? obj.reply : "",
      memory: obj.memory && typeof obj.memory === "object" ? obj.memory : null,
      actions: actions
        .filter((a) => a && typeof a === "object" && typeof a.action === "string")
        .slice(0, 8)
        .map((a) => ({
          page: typeof a.page === "string" ? a.page : routeNow(),
          action: a.action,
          args: a.args && typeof a.args === "object" ? a.args : {},
        })),
    };
  }

  function resolveUserIntent(userText, intent) {
    const normalized = normalizeIntent(intent || {});
    const text = normalizeText(userText);
    const reply = normalizeText(normalized.reply);
    const previous = taskMemory();
    const extracted = extractLocalMemory(text, previous);
    const modelMemory = normalized.memory && typeof normalized.memory === "object" ? normalized.memory : {};
    const memoryPatch = mergeMemoryPatch(modelMemory, extracted);
    const memory = mergeMemorySnapshot(previous, memoryPatch);
    const wantsAction = userWantsAction(text) || isContinuationText(text) || normalized.actions.length > 0 || replyPromisesExecution(reply);
    const targetPage = inferTargetPage(text, reply, memory);
    let actions = normalizeActions(normalized.actions);
    let visibleReason = "";

    if (!actions.length && isContinuationText(text)) {
      actions = continuationActions(memory, text);
      if (actions.length) visibleReason = "根据上一轮承诺继续执行：";
    }

    if (!actions.length && wantsAction) {
      actions = deriveDefaultActions(text, reply, targetPage, memory);
      if (actions.length) visibleReason = "根据当前页面和前文补全执行计划：";
    }

    if (actions.length) {
      const completed = completeActionPlan(actions, text, reply, targetPage, memory);
      if (completed.length > actions.length && !visibleReason) visibleReason = "根据用户真实意图补全后续动作：";
      actions = completed;
    }

    let finalReply = normalized.reply || "";
    if (wantsAction && (targetPage === "lottery" || memory.activeGoal === "lottery") && lotteryNeedsInfo(memory)) {
      const prefix = actions.length ? "我先带你到抽奖页。" : "";
      finalReply = prefix + lotteryMissingReply(memory);
    }

    if (actions.length) {
      const lastTarget = lastTargetPage(actions) || targetPage || routeNow();
      Object.assign(memoryPatch, {
        activeGoal: goalFromActions(actions, lastTarget),
        lastTargetPage: lastTarget,
        lastPromisedActions: actions,
        pendingActions: actions,
        lastFailure: null,
      });
    } else if (targetPage && wantsAction) {
      Object.assign(memoryPatch, {
        activeGoal: targetPage,
        lastTargetPage: targetPage,
      });
    }

    return {
      reply: finalReply,
      actions: actions.slice(0, 8),
      memoryPatch,
      visibleReason,
      targetPage,
      wantsAction,
    };
  }

  function mergeMemoryPatch(modelMemory, localMemory) {
    const patch = Object.assign({}, modelMemory || {}, localMemory || {});
    const slots = Object.assign({}, (modelMemory && modelMemory.slots) || {}, (localMemory && localMemory.slots) || {});
    if (Object.keys(slots).length) patch.slots = slots;
    return patch;
  }

  function mergeMemorySnapshot(previous, patch) {
    const merged = Object.assign({}, previous || {}, patch || {});
    merged.slots = Object.assign({}, (previous && previous.slots) || {}, (patch && patch.slots) || {});
    return merged;
  }

  function extractLocalMemory(text, previous) {
    const patch = {};
    const targetPage = inferTargetPage(text, "", previous || {});
    if (targetPage) {
      patch.lastTargetPage = targetPage;
      patch.activeGoal = targetPage;
    }

    const lottery = extractLotterySlots(text, previous || {});
    if (lottery && Object.keys(lottery).length) {
      patch.activeGoal = "lottery";
      patch.lastTargetPage = "lottery";
      patch.slots = Object.assign({}, patch.slots || {}, lottery);
    }

    const qrStyle = extractQrStyleArgs(text);
    if (qrStyle && Object.keys(qrStyle).length) {
      patch.activeGoal = "qr";
      patch.lastTargetPage = "qr";
      patch.slots = Object.assign({}, patch.slots || {}, { qrStyle });
    }

    const musicRequest = extractMusicRequest(text);
    if (musicRequest && Object.keys(musicRequest).length) {
      patch.activeGoal = "playlist";
      patch.lastTargetPage = "playlist";
      patch.slots = Object.assign({}, patch.slots || {}, { musicRequest });
    }

    return patch;
  }

  function userWantsAction(text) {
    if (!text) return false;
    if (isContinuationText(text)) return true;
    if (isMusicPlaybackIntent(text)) return true;
    const playCommand = /(?:你玩(?:个|一下)?|帮我玩|玩个|玩一下|过一关|自动过|自动完成|自己玩|随便玩)/.test(text);
    if (isPlainQuestion(text) && !playCommand) return false;
    return EXECUTION_WORDS.test(text) || playCommand;
  }

  function isPlainQuestion(text) {
    return /(?:是什么|介绍|说明|怎么用|有哪些|能干啥|你会|会不会|可以吗|什么意思|为什么|怎么理解|看不懂|问一下|解释)/.test(text) &&
      !/(?:帮我|替我|给我|你来|马上|现在|打开|进入|跳转|导航|点击|执行|开始|设置|修改|改成|处理|导出|下载|播放|听歌|点歌)/.test(text);
  }

  function isContinuationText(text) {
    return CONTINUE_WORDS.test(normalizeText(text));
  }

  function replyPromisesExecution(reply) {
    return PROMISE_WORDS.test(reply || "");
  }

  function isMusicUnlockIntent(text) {
    return /(?:音乐解锁|解锁音乐|加密音乐|ncm|qmc|mflac|mgg|选择音乐文件|上传音乐文件|音乐文件解锁)/i.test(text || "");
  }

  function isMusicPlaybackIntent(text) {
    const value = normalizeText(text);
    if (!value || isMusicUnlockIntent(value)) return false;
    return /(?:听歌|听音乐|播放音乐|放歌|点歌|点播|来首歌|来一首|来一曲|播放歌曲|播放\s*第?\s*\d+\s*首|播放\s*[《“"']?[^。；;，,]{2,}|播放.*歌|听.*歌|放.*歌|播放.*内置音乐|上一首|下一首|下首|上首|换一首|暂停(?:音乐|播放)?|继续播放)/.test(value);
  }

  function extractMusicRequest(text) {
    if (!isMusicPlaybackIntent(text)) return {};
    const req = {};
    const value = normalizeText(text);
    const numberMatch = value.match(/第\s*(\d+)\s*首|(?:播放|听|放|点播)?\s*(\d+)\s*首/);
    if (numberMatch) req.number = Number(numberMatch[1] || numberMatch[2]);
    const query = extractTrackQuery(value);
    if (query) req.query = query;
    return req;
  }

  function extractTrackQuery(text) {
    const value = normalizeText(text)
      .replace(/^(请|麻烦|帮我|给我|替我|你来|你帮我)\s*/, "")
      .replace(/(吧|一下|可以吗|谢谢)$/g, "");
    const quoted = value.match(/[《“"']([^》”"']{1,60})[》”"']/);
    if (quoted && quoted[1]) return normalizeText(quoted[1]);
    const afterVerb = value.match(/(?:播放|听|放|点播|点歌|来一首|来首|放一首)\s*([^。；;，,]{1,80})/);
    let query = afterVerb && afterVerb[1] ? afterVerb[1] : "";
    query = normalizeText(query)
      .replace(/^(音乐|歌曲|歌|一下|一首|首|第\s*\d+\s*首)\s*/g, "")
      .replace(/^(内置|网站|网页|播放器|歌单)里的?/g, "")
      .replace(/^(音乐|歌曲|歌)$/g, "");
    if (/^(音乐|歌曲|歌|一首|随机|随便|下一首|上一首)$/.test(query)) return "";
    return query.length >= 2 ? query : "";
  }

  function inferTargetPage(userText, reply, memory) {
    const user = normalizeText(userText);
    if (isMusicUnlockIntent(user)) return "music";
    if (isMusicPlaybackIntent(user)) return "playlist";
    const text = normalizeText([userText, reply].filter(Boolean).join(" "));
    if (isMusicUnlockIntent(text)) return "music";
    if (isMusicPlaybackIntent(text)) return "playlist";
    for (const item of PAGE_ALIASES) {
      if (item.words.some((word) => text.toLowerCase().includes(String(word).toLowerCase()))) return item.page;
    }
    if (memory && memory.lastTargetPage && isContinuationText(userText)) return memory.lastTargetPage;
    if (memory && memory.activeGoal && PAGE_GUIDE[memory.activeGoal]) return memory.activeGoal;
    return "";
  }

  function continuationActions(memory, text) {
    if (/重试|再来|再试|重新/.test(text) && memory && memory.lastFailure && memory.lastFailure.action) {
      return normalizeActions([memory.lastFailure.action]);
    }
    const pending = normalizeActions(memory && memory.pendingActions);
    if (pending.length) return pending;
    const promised = normalizeActions(memory && memory.lastPromisedActions);
    if (promised.length) return promised;
    const next = normalizeText(memory && memory.nextAction);
    const match = next.match(/^([a-z][\w-]*)\.([a-zA-Z][\w-]*)$/);
    return match ? [{ page: match[1], action: match[2], args: {} }] : [];
  }

  function deriveDefaultActions(text, reply, targetPage, memory) {
    const combined = normalizeText([text, reply].join(" "));
    const actions = [];
    const page = targetPage || routeNow();

    if (isMusicPlaybackIntent(combined) || page === "playlist") {
      const musicActions = deriveMusicPlaybackActions(combined, memory);
      if (musicActions.length) return musicActions;
    }

    if (page === "sokoban") {
      if (/(?:自动完成|自动过|自动解|过一关|玩|演示|自己|你点|点啊)/.test(combined)) return [{ page: "sokoban", action: "auto", args: {} }];
      if (/提示/.test(combined)) return [{ page: "sokoban", action: "hint", args: {} }];
      if (/重置|还原|重新/.test(combined)) return [{ page: "sokoban", action: "reset", args: {} }];
      return navigationAction("sokoban");
    }

    if (page === "home") {
      if (/还原|复原|恢复|重置/.test(combined)) return [{ page: "home", action: "reset", args: {} }];
      if (/打乱|洗牌|乱一下/.test(combined)) return [{ page: "home", action: "scramble", args: { count: 22 } }];
      if (/(?:玩|随便|自己|转几下|演示)/.test(combined)) return [{ page: "home", action: "play", args: { count: 8 } }];
      const turn = inferCubeTurn(combined);
      if (turn) return [{ page: "home", action: "turn", args: { move: turn } }];
      return navigationAction("home");
    }

    if (page === "lottery") {
      const slots = memory.slots || {};
      const names = lotteryNamesFromSlots(slots);
      const prizes = lotteryPrizesFromSlots(slots);
      if (/(?:开始|开抽|抽吧|抽个|抽一个|来吧)/.test(combined) && names.length && prizes.length) {
        actions.push({ page: "lottery", action: "setParticipants", args: { names } });
        actions.push({ page: "lottery", action: "setPrizes", args: { prizes } });
        actions.push({ page: "lottery", action: "draw", args: {} });
        return actions;
      }
      if (routeNow() !== "lottery") return navigationAction("lottery");
      return [];
    }

    if (page === "qr") {
      const style = extractQrStyleArgs(combined);
      if (Object.keys(style).length) return [{ page: "qr", action: "setStyle", args: style }];
      return navigationAction("qr");
    }

    if (FILE_TOOL_PAGES.has(page)) {
      if (routeNow() !== page || /(?:选择|上传|处理|压缩|转换|生成|打开)/.test(combined)) {
        return [{ page, action: "openFilePicker", args: {} }];
      }
      return navigationAction(page);
    }

    if (page && PAGE_GUIDE[page] && /(?:打开|进入|跳转|导航|去)/.test(combined)) return navigationAction(page);
    return [];
  }

  function completeActionPlan(actions, text, reply, targetPage, memory) {
    const combined = normalizeText([text, reply].join(" "));
    const out = normalizeActions(actions);
    const page = targetPage || lastTargetPage(out) || (memory && memory.lastTargetPage) || routeNow();

    if (isMusicPlaybackIntent(combined)) {
      const nonMusic = out.filter((a) => a.page !== "music" && a.page !== "playlist" && !/^player/.test(a.action));
      const musicActions = deriveMusicPlaybackActions(combined, memory);
      if (musicActions.length) return dedupeActions(nonMusic.concat(musicActions));
    }

    if (page === "sokoban" && /(?:玩|过一关|自动完成|自动过|自动解|演示|自己|你点|点啊)/.test(combined) && !hasAction(out, "sokoban", "auto")) {
      out.push({ page: "sokoban", action: "auto", args: {} });
    }

    if (page === "home" && !hasPageAction(out, "home")) {
      if (/还原|复原|恢复|重置/.test(combined)) out.push({ page: "home", action: "reset", args: {} });
      else if (/打乱|洗牌|乱一下/.test(combined)) out.push({ page: "home", action: "scramble", args: { count: 22 } });
      else if (/(?:玩|随便|自己|转几下|演示)/.test(combined)) out.push({ page: "home", action: "play", args: { count: 8 } });
    }

    if (page === "qr" && !hasAction(out, "qr", "setStyle")) {
      const style = extractQrStyleArgs(combined);
      if (Object.keys(style).length) out.push({ page: "qr", action: "setStyle", args: style });
    }

    return dedupeActions(out);
  }

  function deriveMusicPlaybackActions(text, memory) {
    const combined = normalizeText(text);
    const req = Object.assign({}, (memory && memory.slots && memory.slots.musicRequest) || {}, extractMusicRequest(combined));
    if (/(?:暂停|停止播放|停一下)/.test(combined)) return [{ page: "playlist", action: "pause", args: {} }];
    if (/(?:上一首|上首)/.test(combined)) return [{ page: "playlist", action: "prev", args: {} }];
    if (/(?:下一首|下首|换一首)/.test(combined)) return [{ page: "playlist", action: "next", args: {} }];
    if (/(?:播放模式|随机播放|单曲循环|顺序播放|循环模式)/.test(combined)) return [{ page: "playlist", action: "cycleMode", args: {} }];
    const trackArgs = {};
    if (req.number) trackArgs.number = req.number;
    if (req.query) trackArgs.query = req.query;
    const matched = findTrackIndex(trackArgs);
    if (matched >= 0) return [{ page: "playlist", action: "playTrack", args: { index: matched, query: req.query || "" } }];
    if (req.number || req.query) return [{ page: "playlist", action: "playTrack", args: trackArgs }];
    return [{ page: "playlist", action: "play", args: {} }];
  }

  function navigationAction(page) {
    return page && PAGE_GUIDE[page] ? [{ page, action: "navigate", args: { page } }] : [];
  }

  function normalizeActions(actions) {
    if (!Array.isArray(actions)) return [];
    return actions
      .filter((a) => a && typeof a === "object" && typeof a.action === "string")
      .map((a) => ({
        page: typeof a.page === "string" ? a.page : routeNow(),
        action: a.action,
        args: a.args && typeof a.args === "object" ? Object.assign({}, a.args) : {},
      }))
      .slice(0, 10);
  }

  function dedupeActions(actions) {
    const seen = new Set();
    return normalizeActions(actions).filter((action) => {
      const key = actionLabel(action) + ":" + JSON.stringify(action.args || {});
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function hasAction(actions, page, action) {
    return normalizeActions(actions).some((a) => (a.page || routeNow()) === page && a.action === action);
  }

  function hasPageAction(actions, page) {
    return normalizeActions(actions).some((a) => (a.page || routeNow()) === page && a.action !== "navigate");
  }

  function actionLabel(action) {
    if (!action) return "";
    const page = action.action === "navigate" ? (action.args && (action.args.page || action.args.route)) || action.page || routeNow() : action.page || routeNow();
    return page + "." + action.action;
  }

  function lastTargetPage(actions) {
    const list = normalizeActions(actions);
    for (let i = list.length - 1; i >= 0; i--) {
      const action = list[i];
      if (action.action === "navigate") {
        const page = String(action.args.page || action.args.route || "").replace(/^#\//, "");
        if (PAGE_GUIDE[page]) return page;
      }
      if (PAGE_GUIDE[action.page]) return action.page;
    }
    return "";
  }

  function goalFromActions(actions, fallback) {
    const page = lastTargetPage(actions) || fallback;
    return PAGE_GUIDE[page] ? page : "";
  }

  function extractLotterySlots(text, previous) {
    const slots = {};
    const active = previous && (previous.activeGoal === "lottery" || previous.lastTargetPage === "lottery");
    if (!active && !/抽奖|开奖|名单|参与者|人员|奖项|奖品|几名|名额/.test(text)) return slots;

    const explicitNames = text.match(/(?:名单|参与者|人员|名字)(?:是|为|:|：)?\s*([^。；;]+)/);
    if (explicitNames && explicitNames[1]) {
      const segment = explicitNames[1].split(/奖项|奖品|一等奖|二等奖|三等奖|特等奖|幸运奖|安慰奖/)[0];
      const names = namesFromArgs({ text: segment }).filter((name) => !/^\d+$/.test(name) && !/奖|名额|名$/.test(name));
      if (names.length) slots.names = names;
    } else if (active && !/奖项|奖品|等奖|名额|几名|抽|开始|开抽/.test(text)) {
      const names = namesFromArgs({ text }).filter((name) => !/^\d+$/.test(name));
      if (names.length >= 2) slots.names = names;
    }

    const prizes = [];
    const prizeRegex = /([\u4e00-\u9fa5A-Za-z0-9_-]{1,12}奖)\s*(?:名额|人数|数量|是|:|：)?\s*(\d+)?\s*(?:名|个|人|份)?/g;
    let match;
    while ((match = prizeRegex.exec(text))) {
      if (isValidPrizeName(match[1])) prizes.push({ name: match[1], quota: Number(match[2] || 1) || 1 });
    }
    const genericPrize = text.match(/(?:奖项|奖品)(?:是|为|:|：)?\s*([^，,。；;\s]+)\s*(\d+)?\s*(?:名|个|人|份)?/);
    if (genericPrize && genericPrize[1] && isValidPrizeName(genericPrize[1]) && !prizes.some((p) => p.name === genericPrize[1])) {
      prizes.push({ name: genericPrize[1], quota: Number(genericPrize[2] || 1) || 1 });
    }
    if (prizes.length) slots.prizes = prizes;
    return slots;
  }

  function extractQrStyleArgs(text) {
    const args = {};
    const bg = colorAfter(text, /背景(?:颜色|色)?/);
    const main = colorAfter(text, /(?:主题|主|主体|码点|点)(?:颜色|色)?/);
    if (bg) args.bgColor = bg;
    if (main) args.dotsColor = main;
    if (/霓虹|neon/i.test(text)) {
      args.preset = "霓虹渐变";
      args.gradient = true;
    } else if (/蓝色圆点|蓝点/.test(text)) {
      args.preset = "蓝色圆点";
    } else if (/液态玻璃|liquid\s*glass/i.test(text)) {
      args.preset = "Liquid Glass";
    } else if (/soft\s*ui|软拟态|柔和/.test(text)) {
      args.preset = "Soft UI";
    } else if (/粉色|可爱/.test(text)) {
      args.preset = "可爱粉色";
    } else if (/极简|商务/.test(text)) {
      args.preset = "极简商务";
    } else if (/科技|深色/.test(text)) {
      args.preset = "深色科技";
    } else if (/暖色|温馨/.test(text)) {
      args.preset = "暖色温馨";
    }
    if (/渐变/.test(text) && args.gradient == null) args.gradient = true;
    if (/透明背景|背景透明/.test(text)) args.transparentBg = true;
    const size = text.match(/(?:宽高|尺寸|大小|宽度|高度).*?(\d{2,4})/);
    if (size) args.size = Number(size[1]);
    return args;
  }

  function colorAfter(text, prefix) {
    const pattern = new RegExp(prefix.source + "(?:改|换|设|设置|调|变|成|为|到|=|：|:)?\\s*(#[0-9a-fA-F]{3,6}|[\\u4e00-\\u9fa5A-Za-z]{1,8})");
    const match = text.match(pattern);
    if (!match || !match[1]) return "";
    const value = match[1].replace(/^(改|换|设|设置|调|变|成|为|到)$/, "");
    return value && !/^(?:颜色|主题|背景|主色)$/.test(value) ? value : "";
  }

  function lotteryMissingReply(memory) {
    const slots = memory.slots || {};
    const missing = [];
    if (!lotteryNamesFromSlots(slots).length) missing.push("参与者名单");
    if (!lotteryPrizesFromSlots(slots).length) missing.push("奖项和名额");
    return missing.length
      ? "可以，我已经把抽奖任务记住了。还需要你补充：" + missing.join("、") + "。"
      : "信息已经够了，你说“开始吧”我就会执行抽奖。";
  }

  function lotteryNeedsInfo(memory) {
    const slots = (memory && memory.slots) || {};
    return !lotteryNamesFromSlots(slots).length || !lotteryPrizesFromSlots(slots).length;
  }

  function isValidPrizeName(name) {
    name = normalizeText(name);
    return !!name && !/^(?:抽奖|开奖|中奖|帮我抽奖|开始抽奖|幸运抽奖)$/.test(name) && !/帮我|开始|开抽|抽一个|抽个/.test(name);
  }

  function lotteryNamesFromSlots(slots) {
    if (Array.isArray(slots.names)) return slots.names.map(String).filter(Boolean);
    if (Array.isArray(slots.participants)) return slots.participants.map(String).filter(Boolean);
    if (typeof slots.names === "string") return namesFromArgs({ text: slots.names });
    if (typeof slots.participants === "string") return namesFromArgs({ text: slots.participants });
    return [];
  }

  function lotteryPrizesFromSlots(slots) {
    if (Array.isArray(slots.prizes)) {
      return slots.prizes
        .map((p) => typeof p === "string" ? { name: p, quota: 1 } : { name: p.name || p.prize || "奖项", quota: Number(p.quota || p.count || p.slots || 1) || 1 })
        .filter((p) => p.name);
    }
    const name = slots.prizeName || slots.prize || slots.award || slots.awardName;
    if (!name) return [];
    return [{ name: String(name), quota: Number(slots.quota || slots.count || slots.winnerCount || 1) || 1 }];
  }

  function inferCubeTurn(text) {
    const raw = String(text || "").toUpperCase();
    const direct = raw.match(/\b([UDLRFB])('?|PRIME)?\b/);
    if (direct) return direct[1] + (direct[2] ? "'" : "");
    if (/上/.test(text)) return "U";
    if (/下/.test(text)) return "D";
    if (/左/.test(text)) return "L";
    if (/右/.test(text)) return "R";
    if (/前/.test(text)) return "F";
    if (/后|背/.test(text)) return "B";
    return "";
  }

  async function executeActions(actions) {
    const logs = [];
    const normalized = normalizeActions(actions);
    const failures = [];
    if (normalized.length) {
      updateTaskMemory({
        pendingActions: normalized,
        lastPromisedActions: normalized,
        lastTargetPage: lastTargetPage(normalized) || routeNow(),
        activeGoal: goalFromActions(normalized, routeNow()),
      });
    }
    for (const action of normalized) {
      const page = action.page || routeNow();
      const label = actionLabel(action);
      try {
        addMessage("tool", "计划调用 " + label + "\n参数：" + JSON.stringify(action.args || {}));
        const target = action.action === "navigate" ? String(action.args.page || action.args.route || "").replace(/^#\//, "") : page;
        if (target && PAGE_GUIDE[target] && target !== routeNow()) {
          addMessage("tool", "导航到 " + PAGE_GUIDE[target].name + "，等待页面就绪");
        }
        setStatus("正在执行 " + label);
        const result = await runAction(page, action.action, action.args || {});
        const done = "完成 " + label + (result ? "\n结果：" + result : "");
        addMessage("tool", done);
        logs.push("✓ " + label + (result ? "：" + result : ""));
      } catch (err) {
        const message = (err && err.message) || "执行失败";
        addMessage("tool", "失败 " + label + "\n原因：" + message);
        failures.push({ action, error: message, at: Date.now() });
        logs.push("× " + label + "：" + message);
      }
    }
    if (normalized.length) {
      updateTaskMemory(failures.length
        ? { lastFailure: failures[0], pendingActions: failures.map((item) => item.action) }
        : { lastFailure: null, pendingActions: [] });
    }
    return logs;
  }

  async function runAction(page, action, args) {
    if (GLOBAL_ACTIONS[action]) return GLOBAL_ACTIONS[action](args || {});
    if (page && page !== routeNow()) {
      const router = ROUTER();
      if (!router || typeof router.go !== "function") throw new Error("路由器不可用");
      router.go(page);
      if (typeof router.whenReady === "function") await router.whenReady(page);
      await sleep(40);
      refreshRouteLabel();
    }
    const adapter = getAdapter(page || routeNow());
    if ((!adapter || !adapter.actions || typeof adapter.actions[action] !== "function") && GENERIC_ACTIONS[action]) {
      return GENERIC_ACTIONS[action](args || {});
    }
    if (!adapter || !adapter.actions || typeof adapter.actions[action] !== "function") {
      throw new Error("这个动作不在白名单内");
    }
    return adapter.actions[action](args || {});
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  const GLOBAL_ACTIONS = {
    async navigate(args) {
      const page = String(args.page || args.route || "").replace(/^#\//, "");
      if (!PAGE_GUIDE[page]) throw new Error("未知页面：" + page);
      const router = ROUTER();
      router.go(page);
      if (router.whenReady) await router.whenReady(page);
      return "已跳转到 " + PAGE_GUIDE[page].name;
    },
    playerPlay() {
      const p = requirePlayer();
      if (!getPlayerTracks().length) throw new Error("当前歌单为空");
      p.play();
      return "已请求播放";
    },
    playerPause() { requirePlayer().pause(); return "已暂停"; },
    playerToggle() {
      const p = requirePlayer();
      if (!getPlayerTracks().length) throw new Error("当前歌单为空");
      p.toggle();
      return "已切换播放状态";
    },
    playerNext() {
      const p = requirePlayer();
      if (!getPlayerTracks().length) throw new Error("当前歌单为空");
      p.next();
      return "下一首";
    },
    playerPrev() {
      const p = requirePlayer();
      if (!getPlayerTracks().length) throw new Error("当前歌单为空");
      p.prev();
      return "上一首";
    },
    playerCycleMode() { requirePlayer().cycleMode(); return "已切换播放模式"; },
    playerOpenPlaylist() { requirePlayer().openPlaylist(); return "已打开歌单"; },
  };

  function requirePlayer() {
    if (!window.ClaudeOnePlayer) throw new Error("播放器还没准备好");
    return window.ClaudeOnePlayer;
  }

  const GENERIC_ACTIONS = {
    setField(args) {
      const el = findField(args.label || args.name || args.field);
      setValue(el, args.value);
      return "已设置「" + labelForControl(el) + "」为 " + String(args.value);
    },
    setRange(args) {
      const el = findField(args.label || args.name || args.field, "range");
      setValue(el, args.value);
      return "已把「" + labelForControl(el) + "」调到 " + String(args.value);
    },
    toggleSwitch(args) {
      const el = findSwitch(args.label || args.name || args.switch);
      setChecked(el, args.checked != null ? !!args.checked : !el.checked);
      return "已" + (el.checked ? "开启" : "关闭") + "「" + labelForControl(el) + "」";
    },
    chooseOption(args) {
      chooseOptionByLabel(args.group || args.name || args.label, args.option || args.value || args.label);
      return "已选择选项";
    },
    clickControl(args) {
      const btn = findButton(args.label || args.name || args.text);
      btn.click();
      return "已点击「" + normalizeText(btn.textContent || btn.getAttribute("aria-label") || "") + "」";
    },
  };

  function getAdapter(page) {
    attachLifecycleAssistant(page);
    const direct = pageAssistant(page);
    const generic = ADAPTERS[page];
    if (!direct) return generic;
    if (!generic) return direct;
    return {
      describe: direct.describe || generic.describe,
      getState: direct.getState || generic.getState,
      actions: Object.assign({}, generic.actions || {}, direct.actions || {}),
    };
  }

  function q(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }

  function qa(sel, ctx) {
    return Array.from((ctx || document).querySelectorAll(sel));
  }

  function mainRoot() {
    return q("[data-content-slot]") || document;
  }

  function click(sel, ctx) {
    const el = typeof sel === "string" ? q(sel, ctx || mainRoot()) : sel;
    if (!el) throw new Error("找不到控件");
    el.click();
    return el;
  }

  function setValue(sel, value, ctx) {
    const el = typeof sel === "string" ? q(sel, ctx || mainRoot()) : sel;
    if (!el) throw new Error("找不到输入框");
    el.value = value == null ? "" : String(value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return el;
  }

  function setColorValue(sel, value, ctx) {
    return setValue(sel, normalizeColor(value), ctx);
  }

  function normalizeColor(value) {
    const raw = String(value || "").trim();
    if (!raw) return raw;
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
    if (/^#[0-9a-f]{3}$/i.test(raw)) {
      return "#" + raw.slice(1).split("").map((ch) => ch + ch).join("");
    }
    const compact = raw.toLowerCase().replace(/\s+/g, "");
    const aliases = {
      black: "#111827",
      white: "#ffffff",
      red: "#ef4444",
      orange: "#f97316",
      yellow: "#facc15",
      green: "#22c55e",
      blue: "#3b82f6",
      purple: "#8b5cf6",
      pink: "#ec4899",
      cyan: "#06b6d4",
      gray: "#6b7280",
      grey: "#6b7280",
      黑: "#111827",
      黑色: "#111827",
      白: "#ffffff",
      白色: "#ffffff",
      红: "#ef4444",
      红色: "#ef4444",
      橙: "#f97316",
      橙色: "#f97316",
      黄: "#facc15",
      黄色: "#facc15",
      绿: "#22c55e",
      绿色: "#22c55e",
      蓝: "#3b82f6",
      蓝色: "#3b82f6",
      紫: "#8b5cf6",
      紫色: "#8b5cf6",
      粉: "#ec4899",
      粉色: "#ec4899",
      青: "#06b6d4",
      青色: "#06b6d4",
      灰: "#6b7280",
      灰色: "#6b7280",
    };
    if (aliases[compact]) return aliases[compact];
    const hit = Object.keys(aliases).find((key) => compact.includes(key));
    return hit ? aliases[hit] : raw;
  }

  function setChecked(sel, checked, ctx) {
    const el = typeof sel === "string" ? q(sel, ctx || mainRoot()) : sel;
    if (!el) throw new Error("找不到开关");
    el.checked = !!checked;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return el;
  }

  function chooseRadio(name, value, ctx) {
    if (value == null) return;
    const el = q('input[name="' + name + '"][value="' + String(value) + '"]', ctx || mainRoot());
    if (!el) throw new Error("找不到选项：" + name + "=" + value);
    el.checked = true;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function chooseRadioAlias(name, value, aliases, ctx) {
    if (value == null) return;
    const raw = String(value);
    const mapped = aliases && aliases[raw] ? aliases[raw] : raw;
    chooseRadio(name, mapped, ctx);
  }

  function sameLabel(a, b) {
    a = normalizeText(a).toLowerCase();
    b = normalizeText(b).toLowerCase();
    return !!a && !!b && (a === b || a.includes(b) || b.includes(a));
  }

  function findField(label, type) {
    const fields = qa("input, textarea, select", mainRoot())
      .filter((el) => el.type !== "hidden" && el.type !== "radio" && !el.hidden);
    const found = fields.find((el) => {
      if (type && el.type !== type) return false;
      return sameLabel(labelForControl(el), label);
    });
    if (!found) throw new Error("找不到字段：" + label);
    return found;
  }

  function findSwitch(label) {
    const switches = qa('input[type="checkbox"]', mainRoot()).filter((el) => !el.hidden);
    const found = switches.find((el) => sameLabel(labelForControl(el), label));
    if (!found) throw new Error("找不到开关：" + label);
    return found;
  }

  function findButton(label) {
    const buttons = qa("button, [role='button'], .pill", mainRoot()).filter((el) => !el.disabled && !el.hidden);
    const found = buttons.find((el) => sameLabel(el.getAttribute("aria-label") || el.textContent || el.title, label));
    if (!found) throw new Error("找不到按钮：" + label);
    return found;
  }

  function chooseOptionByLabel(groupLabel, optionValue) {
    const radios = qa('input[type="radio"]', mainRoot());
    const groups = {};
    radios.forEach((radio) => {
      const key = radio.name || "radio";
      if (!groups[key]) groups[key] = [];
      groups[key].push(radio);
    });
    const candidates = Object.keys(groups).map((name) => {
      const first = groups[name][0];
      const group = first.closest('[role="radiogroup"]') || first.closest(".segmented") || first.closest(".qr-field");
      return { name, group, label: group ? labelForControl(group) : name, radios: groups[name] };
    });
    const group = candidates.find((g) => sameLabel(g.label, groupLabel) || sameLabel(g.name, groupLabel)) ||
      candidates.find((g) => g.radios.some((r) => sameLabel(labelForControl(r), optionValue) || sameLabel(r.value, optionValue)));
    if (!group) throw new Error("找不到选项组：" + groupLabel);
    const option = group.radios.find((r) => sameLabel(r.value, optionValue) || sameLabel(labelForControl(r), optionValue));
    if (!option) throw new Error("找不到选项：" + optionValue);
    option.checked = true;
    option.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function selectPill(attr, value, ctx) {
    if (value == null) return;
    const root = ctx || mainRoot();
    const raw = String(value);
    const items = qa("[" + attr + "]", root);
    const el = items.find((item) => String(item.getAttribute(attr)) === raw) ||
      items.find((item) => sameLabel(item.getAttribute(attr), raw) || sameLabel(item.textContent, raw));
    if (!el) throw new Error("找不到选项：" + value);
    el.click();
  }

  function setStepper(el, target) {
    if (!el || target == null) return;
    const valEl = q(".stepper__value", el);
    const plus = q('[data-op="plus"]', el);
    const minus = q('[data-op="minus"]', el);
    let current = parseInt(valEl && valEl.textContent, 10);
    target = parseInt(target, 10);
    if (!Number.isFinite(current) || !Number.isFinite(target)) return;
    let guard = 30;
    while (current !== target && guard-- > 0) {
      (current < target ? plus : minus).click();
      current = parseInt(valEl && valEl.textContent, 10);
    }
  }

  function namesFromArgs(args) {
    if (Array.isArray(args.names)) return args.names.map(String).filter(Boolean);
    if (typeof args.text === "string") return args.text.split(/[\n,，、\s]+/).map((s) => s.trim()).filter(Boolean);
    return [];
  }

  function visibleSummary() {
    const guide = PAGE_GUIDE[routeNow()];
    return {
      route: routeNow(),
      page: guide ? guide.name : routeNow(),
      summary: guide ? guide.summary : "",
      text: currentPageText().slice(0, 600),
    };
  }

  const ADAPTERS = {
    home: {
      getState: visibleSummary,
      actions: {
        turn(args) {
          const move = String(args.move || args.face || "U").toUpperCase().replace("PRIME", "'");
          click('[data-cube-turn="' + move.replace(/"/g, "") + '"]');
          return "已转动 " + move;
        },
        scramble() { click("[data-cube-scramble]"); return "已打乱魔方"; },
        reset() { click("[data-cube-reset]"); return "已还原魔方"; },
        play(args) {
          click("[data-cube-scramble]");
          return "我让魔方自己转了 " + (Number(args.count || 22) || 22) + " 步";
        },
      },
    },
    games: listAdapter(),
    tools: listAdapter(),
    game: {
      getState: () => ({
        page: "俄罗斯转盘",
        phase: q("[data-view-play]:not(.hidden)") ? "playing" : q("[data-view-end]:not(.hidden)") ? "ended" : "setup",
        currentPlayer: normalizeText(q("[data-current-player]")?.textContent),
        chamberInfo: normalizeText(q("[data-chamber-info]")?.textContent),
        result: normalizeText(q("[data-result]")?.textContent),
      }),
      actions: {
        setPlayers(args) {
          const names = namesFromArgs(args);
          if (!names.length) throw new Error("缺少玩家名单");
          const root = mainRoot();
          while (qa(".player-row", root).length < names.length) click("[data-add-player]", root);
          while (qa(".player-row", root).length > names.length) {
            const rows = qa(".player-row", root);
            const btn = q(".player-row__remove", rows[rows.length - 1]);
            if (!btn || btn.disabled) break;
            btn.click();
          }
          qa(".player-row input", root).forEach((input, i) => {
            if (names[i]) setValue(input, names[i]);
          });
          return "已设置 " + names.length + " 名玩家";
        },
        setSettings(args) {
          const root = mainRoot();
          setStepper(q("[data-stepper-chamber]", root), args.chamberSize);
          setStepper(q("[data-stepper-bullets]", root), args.bulletCount);
          chooseRadio("endCondition", args.endCondition, root);
          chooseRadio("turnOrder", args.turnOrder, root);
          if (args.autoSpin != null) setChecked("[data-toggle-autospin]", !!args.autoSpin, root);
          if (args.revealAfterMiss != null) setChecked("[data-toggle-reveal]", !!args.revealAfterMiss, root);
          return "设置已更新";
        },
        start() { click("[data-start]"); return "已开始游戏"; },
        fire() { click("[data-fire]"); return "已扣扳机"; },
        newGame() { click("[data-new-game]"); return "已开启新局"; },
        sameSettings() { click("[data-same-settings]"); return "已沿用设置"; },
      },
    },
    sokoban: {
      getState: () => ({
        page: "推箱子",
        level: normalizeText(q("[data-level-name]")?.textContent),
        mode: normalizeText(q("[data-level-mode]")?.textContent),
        moves: normalizeText(q("[data-move-count]")?.textContent),
        pushes: normalizeText(q("[data-push-count]")?.textContent),
        status: normalizeText(q("[data-status]")?.textContent),
      }),
      actions: {
        move(args) {
          const map = { up: "U", down: "D", left: "L", right: "R", u: "U", d: "D", l: "L", r: "R", 上: "U", 下: "D", 左: "L", 右: "R" };
          const dir = map[String(args.dir || args.direction || "").toLowerCase()] || args.dir;
          click('[data-move="' + dir + '"]');
          return "已移动 " + dir;
        },
        reset() { click("[data-reset]"); return "已重置关卡"; },
        hint() { click("[data-hint]"); return "已请求提示"; },
        auto() { click("[data-auto]"); return "已切换自动完成"; },
        selectLevel(args) {
          const id = args.id || args.level || args.name;
          const buttons = qa("[data-level-id]", mainRoot());
          const btn = buttons.find((b) => b.dataset.levelId === String(id) || normalizeText(b.textContent).includes(String(id)));
          if (!btn) throw new Error("找不到关卡");
          btn.click();
          return "已选择关卡";
        },
        random(args) {
          if (args.difficulty) {
            const sel = q("[data-random-difficulty]");
            if (sel) setValue(sel, args.difficulty);
          }
          click("[data-generate-random]");
          return "已生成随机关卡";
        },
        brutal() { click("[data-brutal-challenge]"); return "已生成深渊挑战"; },
      },
    },
    minesweeper: {
      getState: () => {
        if (window.MinesweeperAPI && typeof window.MinesweeperAPI.getState === "function") {
          return window.MinesweeperAPI.getState();
        }
        return {
          page: "扫雷",
          board: normalizeText(q("[data-mine-title]")?.textContent),
          remainingBombs: normalizeText(q("[data-mine-left]")?.textContent),
          opened: normalizeText(q("[data-mine-opened]")?.textContent),
          status: normalizeText(q("[data-mine-state]")?.textContent),
          time: normalizeText(q("[data-mine-time]")?.textContent),
          hint: normalizeText(q("[data-mine-hint-text]")?.textContent),
        };
      },
      actions: {
        newGame(args) {
          args = args || {};
          if (window.MinesweeperAPI && typeof window.MinesweeperAPI.newGame === "function") {
            window.MinesweeperAPI.newGame(args);
            return "已新开扫雷";
          }
          if (args.preset) click('[data-mine-preset="' + String(args.preset).replace(/"/g, "") + '"]');
          click("[data-mine-new]");
          return "已新开扫雷";
        },
        setBoard(args) {
          args = args || {};
          if (window.MinesweeperAPI && typeof window.MinesweeperAPI.newGame === "function") {
            window.MinesweeperAPI.newGame(args);
            return "已设置扫雷棋盘";
          }
          if (args.cols || args.width) setValue("[data-mine-cols]", args.cols || args.width);
          if (args.rows || args.height) setValue("[data-mine-rows]", args.rows || args.height);
          if (args.bombs) setValue("[data-mine-bombs]", args.bombs);
          click("[data-mine-apply]");
          return "已设置扫雷棋盘";
        },
        hint() {
          if (window.MinesweeperAPI && typeof window.MinesweeperAPI.hint === "function") window.MinesweeperAPI.hint();
          else click("[data-mine-hint]");
          return "已请求扫雷提示";
        },
        answer() {
          if (window.MinesweeperAPI && typeof window.MinesweeperAPI.answer === "function") window.MinesweeperAPI.answer();
          else click("[data-mine-reveal-answer]");
          return "已给出扫雷答案";
        },
        reveal(args) {
          if (window.MinesweeperAPI && typeof window.MinesweeperAPI.reveal === "function") {
            window.MinesweeperAPI.reveal(args || {});
            return "已翻开扫雷格子";
          }
          const row = Number(args && args.row) || 1;
          const col = Number(args && args.col) || 1;
          const title = normalizeText(q("[data-mine-title]")?.textContent);
          const cols = Number((title.match(/(\d+)\s*[×x]/) || [])[1]) || 9;
          const index = (row - 1) * cols + (col - 1);
          click('[data-index="' + index + '"]');
          return "已翻开扫雷格子";
        },
        flag(args) {
          if (window.MinesweeperAPI && typeof window.MinesweeperAPI.flag === "function") {
            window.MinesweeperAPI.flag(args || {});
            return "已标旗扫雷格子";
          }
          throw new Error("扫雷页面尚未准备好");
        },
      },
    },
    lottery: {
      getState: () => ({
        page: "幸运抽奖",
        currentPrize: normalizeText(q("[data-current-prize]")?.textContent),
        progress: normalizeText(q("[data-prize-progress]")?.textContent),
        activeCount: normalizeText(q("[data-active-count]")?.textContent),
        winnerCount: normalizeText(q("[data-winner-count]")?.textContent),
        prizeCount: normalizeText(q("[data-prize-count]")?.textContent),
      }),
      actions: {
        setParticipants(args) {
          const names = namesFromArgs(args);
          if (!names.length) throw new Error("缺少参与者名单");
          const clear = q("[data-clear-participants]");
          if (clear) { clear.click(); clear.click(); }
          setValue("[data-bulk-input]", names.join("\n"));
          click("[data-import-participants]");
          return "已导入 " + names.length + " 人";
        },
        addParticipant(args) {
          setValue("[data-participant-name]", args.name || "");
          click("[data-participant-submit]");
          return "已添加参与者";
        },
        setPrizes(args) {
          const prizes = Array.isArray(args.prizes) ? args.prizes : [];
          if (!prizes.length) throw new Error("缺少奖项");
          const reset = q("[data-reset-all]");
          if (reset) { reset.click(); reset.click(); }
          prizes.forEach((p) => {
            setValue("[data-prize-name]", p.name || "奖项");
            setValue("[data-prize-quota]", p.quota || 1);
            click("[data-prize-submit]");
          });
          return "已设置 " + prizes.length + " 个奖项";
        },
        addPrize(args) {
          setValue("[data-prize-name]", args.name || "奖项");
          setValue("[data-prize-quota]", args.quota || 1);
          click("[data-prize-submit]");
          return "已添加奖项";
        },
        selectPrize(args) {
          const name = String(args.name || args.prize || "");
          const item = qa(".prize-item").find((el) => normalizeText(el.textContent).includes(name));
          if (!item) throw new Error("找不到奖项");
          click("[data-select-prize]", item);
          return "已选择奖项";
        },
        draw() { click("[data-spin-btn]"); return "已开始抽奖"; },
        resetWinners() { click("[data-reset-winners]"); return "已重置中奖记录"; },
        resetAll() { const btn = q("[data-reset-all]"); btn.click(); btn.click(); return "已重置全部"; },
        copyWinners() { click("[data-copy-winners]"); return "已复制中奖名单"; },
        clearParticipants() { const btn = q("[data-clear-participants]"); btn.click(); btn.click(); return "已清空参与者"; },
      },
    },
    music: fileToolAdapter("音乐解锁", {
      setNaming(args) { chooseRadio("naming", args.format || args.naming || "2"); return "已设置命名格式"; },
      playFirst() { const btn = q('[data-action="play"]'); if (!btn) throw new Error("没有可试听文件"); btn.click(); return "已试听第一个文件"; },
      downloadAll() { click("[data-download-all]"); return "已请求下载全部"; },
      clear() { click("[data-clear-all]"); return "已清空列表"; },
    }),
    playlist: {
      getState: () => {
        const p = window.ClaudeOnePlayer;
        const base = p && p.getState ? p.getState() : {};
        const tracks = getPlayerTracks();
        return Object.assign({}, base, {
          builtInCount: Array.isArray(window.__MUSIC_PLAYLIST) ? window.__MUSIC_PLAYLIST.length : 0,
          playlistLength: tracks.length,
          tracks: tracks.slice(0, 12).map((track) => ({
            index: track.index,
            number: track.index + 1,
            title: track.title,
            artist: track.artist,
            duration: track.duration,
          })),
        });
      },
      actions: {
        playTrack(args) {
          const tracks = getPlayerTracks();
          if (!tracks.length) throw new Error("当前歌单为空");
          const idx = findTrackIndex(args || {});
          if (idx < 0) throw new Error("找不到这首歌。当前内置歌单有 " + tracks.length + " 首，可以说“播放第 1 首”或直接说歌名。");
          const track = tracks.find((item) => item.index === idx) || tracks[idx];
          if (!window.ClaudeOnePlayer || !window.ClaudeOnePlayer.skipTo) throw new Error("播放器还没准备好");
          window.ClaudeOnePlayer.skipTo(idx);
          return "已播放 " + (track ? (track.artist + " - " + track.title) : "曲目 " + (idx + 1));
        },
        play(args) {
          const tracks = getPlayerTracks();
          if (!tracks.length) throw new Error("当前歌单为空");
          const req = args && (args.query || args.title || args.name || args.number) ? args : extractMusicRequest("");
          const idx = findTrackIndex(req || {});
          if (idx >= 0 && window.ClaudeOnePlayer && window.ClaudeOnePlayer.skipTo) {
            window.ClaudeOnePlayer.skipTo(idx);
            const track = tracks.find((item) => item.index === idx) || tracks[idx];
            return "已播放 " + (track ? (track.artist + " - " + track.title) : "曲目 " + (idx + 1));
          }
          return GLOBAL_ACTIONS.playerPlay();
        },
        pause: GLOBAL_ACTIONS.playerPause,
        next: GLOBAL_ACTIONS.playerNext,
        prev: GLOBAL_ACTIONS.playerPrev,
        cycleMode: GLOBAL_ACTIONS.playerCycleMode,
        openPlaylist: GLOBAL_ACTIONS.playerOpenPlaylist,
      },
    },
    ascii: fileToolAdapter("ASCII 艺术", {
      setParams(args) {
        chooseRadio("mode", args.mode);
        chooseRadio("widthPreset", args.widthPreset);
        if (args.width != null) setValue("[data-width-custom]", args.width);
        chooseRadio("heightMode", args.heightMode);
        if (args.height != null) setValue("[data-height-custom]", args.height);
        chooseRadio("charSet", args.charSet);
        if (args.customMap) setValue("[data-custom-map]", args.customMap);
        if (args.colored != null) setChecked('[data-toggle="colored"] input', !!args.colored);
        if (args.negative != null) setChecked('[data-toggle="negative"] input', !!args.negative);
        if (args.grayscale != null) setChecked('[data-toggle="grayscale"] input', !!args.grayscale);
        return "ASCII 参数已更新";
      },
      convert() { click("[data-convert-btn]"); return "已开始转换"; },
      copy() { click("[data-action-copy]"); return "已复制文本"; },
      downloadText() { click("[data-action-download-txt]"); return "已下载文本"; },
      downloadPng() { click("[data-action-download-png]"); return "已下载 PNG"; },
      clear() { click("[data-action-clear]"); return "已清空"; },
      loadHistory(args) {
        const items = qa("[data-history-id]");
        const item = items[Math.max(0, Number(args.index || 0))];
        if (!item) throw new Error("没有历史记录");
        item.click();
        return "已载入历史记录";
      },
    }),
    pixel: fileToolAdapter("图片像素化", {
      setParams(args) {
        if (args.blockSize != null) setValue("[data-block-size]", args.blockSize);
        chooseRadio("maxW", args.maxW);
        chooseRadio("maxH", args.maxH);
        chooseRadio("colorMode", args.colorMode);
        chooseRadio("palette", args.palette);
        chooseRadio("dither", args.dither);
        if (args.saturation != null) setValue("[data-saturation]", args.saturation);
        if (args.brightness != null) setValue("[data-brightness]", args.brightness);
        if (args.contrast != null) setValue("[data-contrast]", args.contrast);
        ["pixelStroke", "gridLines", "rounded", "crt", "noise", "transparentBg"].forEach((key) => {
          if (args[key] != null) setChecked('[data-toggle="' + key + '"] input', !!args[key]);
        });
        return "像素化参数已更新";
      },
      exportPng() { click("[data-export-png]"); return "已导出 PNG"; },
      copyConfig() { click("[data-copy-config]"); return "已复制配置"; },
      reset() { click("[data-reset-defaults]"); return "已恢复默认"; },
      clear() { click("[data-clear-all]"); return "已清空"; },
    }),
    compress: fileToolAdapter("图片压缩", {
      setParams(args) {
        if (args.quality != null) setValue("[data-quality]", args.quality);
        selectPill("data-format", args.format);
        selectPill("data-maxdim", args.maxDim);
        selectPill("data-maxsize", args.maxSize);
        selectPill("data-concurrency", args.concurrency);
        selectPill("data-naming", args.naming);
        if (args.manualWidth != null) setValue("[data-manual-width]", args.manualWidth);
        if (args.manualHeight != null) setValue("[data-manual-height]", args.manualHeight);
        return "压缩参数已更新";
      },
      start() { click("[data-start-compress]"); return "已开始压缩"; },
      cancel() { click("[data-cancel-compress]"); return "已取消压缩"; },
      downloadAll() { click("[data-download-all]"); return "已下载全部"; },
      downloadZip() { click("[data-download-zip]"); return "已打包 ZIP"; },
      recompress() { click("[data-recompress]"); return "已重新压缩"; },
      clear() { click("[data-clear-all]"); return "已清空"; },
    }),
    qr: {
      getState: () => ({
        page: "二维码美化",
        contentType: q('input[name="contentType"]:checked')?.value,
        content: q("[data-content-input]")?.value,
        size: (q("[data-width]")?.value || "?") + "x" + (q("[data-height]")?.value || "?"),
        margin: q("[data-margin]")?.value,
        backgroundColor: q("[data-bg-color]")?.value,
        mainColor: q("[data-dots-color]")?.value,
        dotsType: q('input[name="dotsType"]:checked')?.value,
        cornersSquareType: q('input[name="cornersSquareType"]:checked')?.value,
        cornersDotType: q('input[name="cornersDotType"]:checked')?.value,
        errorCorrection: q('input[name="eccl"]:checked')?.value,
      }),
      actions: {
        setContent(args) {
          const type = args.type || "url";
          chooseRadio("contentType", type);
          if (type === "wifi") {
            setValue("[data-wifi-ssid]", args.ssid || args.value || "");
            if (args.password != null) setValue("[data-wifi-pass]", args.password);
            chooseRadio("wifiEnc", args.encryption || args.enc);
          } else if (type === "email") {
            setValue("[data-email-to]", args.to || args.value || "");
            setValue("[data-email-subject]", args.subject || "");
            setValue("[data-email-body]", args.body || "");
          } else if (type === "phone") {
            setValue("[data-phone-num]", args.value || args.phone || "");
          } else if (type === "sms") {
            setValue("[data-sms-num]", args.phone || args.value || "");
            setValue("[data-sms-body]", args.body || "");
          } else {
            setValue("[data-content-input]", args.value || args.text || args.url || "");
          }
          return "二维码内容已更新";
        },
        applyPreset(args) {
          const preset = args.preset || args.name || args.theme;
          selectPill("data-preset", preset);
          return "已应用二维码预设 " + preset;
        },
        setStyle(args) {
          if (args.width != null) setValue("[data-width]", args.width);
          if (args.height != null) setValue("[data-height]", args.height);
          if (args.margin != null) setValue("[data-margin]", args.margin);
          if (args.size != null) {
            setValue("[data-width]", args.size);
            setValue("[data-height]", args.size);
          }
          if (args.preset || args.theme) selectPill("data-preset", args.preset || args.theme);
          chooseRadioAlias("dotsType", args.dotsType || args.dotType, {
            dot: "dots",
            circle: "dots",
            circular: "dots",
            round: "rounded",
            classyRounded: "classy-rounded",
            extraRounded: "extra-rounded",
          });
          chooseRadioAlias("cornersSquareType", args.cornersSquareType || args.cornerSquareType, {
            dots: "dot",
            rounded: "extra-rounded",
            extraRounded: "extra-rounded",
          });
          chooseRadioAlias("cornersDotType", args.cornersDotType || args.cornerDotType, {
            dots: "dot",
            rounded: "dot",
          });
          chooseRadioAlias("eccl", args.errorCorrection || args.eccl || args.errorCorrectionLevel, {
            low: "L",
            medium: "M",
            quartile: "Q",
            high: "H",
            l: "L",
            m: "M",
            q: "Q",
            h: "H",
          });
          if (args.dotsColor || args.mainColor || args.themeColor) setColorValue("[data-dots-color]", args.dotsColor || args.mainColor || args.themeColor);
          if (args.bgColor || args.backgroundColor) setColorValue("[data-bg-color]", args.bgColor || args.backgroundColor);
          if (args.transparentBg != null) setChecked('[data-toggle="transparentBg"] input', !!args.transparentBg);
          if (args.gradient != null || args.gradientColor1 || args.gradientColor2 || args.dotsGrad1 || args.dotsGrad2) {
            setChecked('[data-toggle="dotsGradient"] input', args.gradient == null ? true : !!args.gradient);
          }
          if (args.gradientType || args.dotsGradType) chooseRadioAlias("dotsGradType", args.gradientType || args.dotsGradType, { radialGradient: "radial", linearGradient: "linear" });
          if (args.gradientColor1 || args.dotsGrad1) setColorValue("[data-dots-grad1]", args.gradientColor1 || args.dotsGrad1);
          if (args.gradientColor2 || args.dotsGrad2) setColorValue("[data-dots-grad2]", args.gradientColor2 || args.dotsGrad2);
          if (args.gradientRotation != null || args.dotsGradRotation != null) setValue("[data-dots-grad-rotation]", args.gradientRotation ?? args.dotsGradRotation);
          if (args.cornersSquareFollowDots != null) setChecked('[data-toggle="cornersSquareFollowDots"] input', !!args.cornersSquareFollowDots);
          if (args.cornersSquareColor) {
            setChecked('[data-toggle="cornersSquareFollowDots"] input', false);
            setColorValue("[data-corners-square-color]", args.cornersSquareColor);
          }
          if (args.cornersDotFollowDots != null) setChecked('[data-toggle="cornersDotFollowDots"] input', !!args.cornersDotFollowDots);
          if (args.cornersDotColor) {
            setChecked('[data-toggle="cornersDotFollowDots"] input', false);
            setColorValue("[data-corners-dot-color]", args.cornersDotColor);
          }
          if (args.logoSize != null) setValue("[data-logo-size]", Number(args.logoSize) > 1 ? Number(args.logoSize) / 100 : args.logoSize);
          if (args.logoMargin != null) setValue("[data-logo-margin]", args.logoMargin);
          if (args.logoHideBg != null) setChecked('[data-toggle="logoHideBg"] input', !!args.logoHideBg);
          if (args.exportName) setValue("[data-export-name]", args.exportName);
          if (args.exportScale != null) chooseRadio("exportScale", args.exportScale);
          return "二维码样式已更新";
        },
        openLogoPicker() { click("[data-logo-input]"); return "已打开 Logo 文件选择器；需要你手动选择本地文件"; },
        removeLogo() { click("[data-remove-logo]"); return "已移除 Logo"; },
        exportPng() { click("[data-export-png]"); return "已导出 PNG"; },
        exportSvg() { click("[data-export-svg]"); return "已导出 SVG"; },
        copyConfig() { click("[data-copy-config]"); return "已复制配置"; },
        importConfig(args) {
          click("[data-import-config]");
          setValue("[data-config-json]", typeof args.config === "string" ? args.config : JSON.stringify(args.config || {}));
          click("[data-apply-config]");
          return "已导入配置";
        },
        reset() { click("[data-reset-defaults]"); return "已恢复默认"; },
        clear() { click("[data-clear-content]"); return "已清空内容"; },
      },
    },
    ai: {
      getState: () => ({
        page: "DeepSeek 聊天",
        topic: normalizeText(q("[data-topic-name]")?.textContent),
        status: normalizeText(q("[data-status]")?.textContent),
        model: q("[data-model]")?.value,
        thinking: q("[data-thinking]")?.checked,
      }),
      actions: {
        newTopic() { click("[data-newtopic]"); return "已新建话题"; },
        clearTopic() { click("[data-clear]"); return "已清空当前话题"; },
        openApiKey() { click("[data-apikey-open]"); return "已打开 Key 设置"; },
        openPrompt() { click("[data-prompt-open]"); return "已打开提示词设置"; },
      },
    },
  };

  function listAdapter() {
    return {
      getState: visibleSummary,
      actions: {
        async openPage(args) {
          const target = String(args.page || args.route || args.name || "");
          const match = Object.keys(PAGE_GUIDE).find((key) => key === target || PAGE_GUIDE[key].name.includes(target) || target.includes(PAGE_GUIDE[key].name));
          if (!match) throw new Error("找不到页面：" + target);
          const router = ROUTER();
          router.go(match);
          if (router.whenReady) await router.whenReady(match);
          return "已打开 " + PAGE_GUIDE[match].name;
        },
      },
    };
  }

  function fileToolAdapter(name, extraActions) {
    return {
      getState: () => ({
        page: name,
        text: currentPageText().slice(0, 600),
      }),
      actions: Object.assign({
        openFilePicker() {
          const input = q("[data-file-input]");
          if (!input) throw new Error("找不到文件选择器");
          input.click();
          return "已打开文件选择器；浏览器需要你手动选择本地文件";
        },
      }, extraActions || {}),
    };
  }

  window.ClaudeOneAssistant = Object.freeze({
    collectContext: collectContext,
    runAction: runAction,
    open: function() { setOpen(true); },
    close: function() { setOpen(false); },
    getAdapter: getAdapter,
    debugResolve: function(text, modelIntent) {
      return resolveUserIntent(String(text || ""), normalizeIntent(modelIntent || { reply: "", actions: [] }));
    },
  });

  window.addEventListener("claudeone:router-ready", refreshRouteLabel);
  window.addEventListener("claudeone:router-ready", (event) => {
    attachLifecycleAssistant(event.detail && event.detail.page);
  });
  document.addEventListener("DOMContentLoaded", renderShell);
  if (document.readyState !== "loading") renderShell();
})();
