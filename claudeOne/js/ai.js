/* ===== claudeOne :: ai.js =====
 * DeepSeek V4 chat integration. Uses the /chat/completions SSE streaming
 * API with the new "thinking" parameter object. Renders plain-text messages
 * via textContent to avoid any XSS surface (no markdown in v1).
 */

(function deepseekChat() {
  const root = document.querySelector("[data-ai-root]");
  if (!root) return;

  const CFG = window.CLAUDE_ONE_CONFIG.deepseek;
  const L = window.CLAUDE_ONE_CONFIG.limits;
  const { storage, toast, createApiKeyModal } = window.ClaudeOne;

  const els = {
    messages: root.querySelector("[data-messages]"),
    form: root.querySelector("[data-composer]"),
    input: root.querySelector("[data-input]"),
    sendBtn: root.querySelector("[data-send]"),
    stopBtn: root.querySelector("[data-stop]"),
    clearBtn: root.querySelector("[data-clear]"),
    modelSelect: root.querySelector("[data-model]"),
    thinkingToggle: root.querySelector("[data-thinking]"),
    effortGroup: root.querySelector("[data-effort]"),
    apiKeyBtn: root.querySelector("[data-apikey-open]"),
    promptBtn: root.querySelector("[data-prompt-open]"),
    promptHint: root.querySelector("[data-prompt-hint]"),
    promptHintText: root.querySelector("[data-prompt-hint-text]"),
    status: root.querySelector("[data-status]"),
    count: root.querySelector("[data-count]"),
    newTopicBtn: root.querySelector("[data-newtopic]"),
    topicPicker: root.querySelector("[data-topic-picker]"),
    topicToggle: root.querySelector("[data-topic-toggle]"),
    topicPanel: root.querySelector("[data-topic-panel]"),
    topicList: root.querySelector("[data-topic-list]"),
    topicNewBtn: root.querySelector("[data-topic-newbtn]"),
    topicName: root.querySelector("[data-topic-name]"),
  };

  const prefs = loadPrefs();

  const state = {
    history: [], // {role: "user"|"assistant", content, reasoning?}
    apiMessages: [], // trimmed payload we send (system + user/assistant pairs)
    streaming: false,
    abortCtrl: null,
    model: prefs.model && CFG.models.includes(prefs.model) ? prefs.model : CFG.defaultModel,
    thinking: !!prefs.thinking,
    effort: prefs.effort === "max" ? "max" : "high",
    systemPrompt: loadSystemPrompt(),
    topics: [],
    activeTopicId: null,
  };

  function loadSystemPrompt() {
    const saved = (storage.get(CFG.systemPromptKey) || "").trim();
    return saved || CFG.systemPrompt;
  }

  function isCustomPrompt() {
    return (state.systemPrompt || "").trim() !== (CFG.systemPrompt || "").trim();
  }

  // --- Preferences (persisted across reloads) ------------------------------
  function loadPrefs() {
    try {
      const raw = storage.get(CFG.prefsKey);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch {
      return {};
    }
  }

  function savePrefs() {
    storage.set(CFG.prefsKey, JSON.stringify({
      model: state.model,
      thinking: state.thinking,
      effort: state.effort,
    }));
  }

  // --- Topics (persisted conversation list) --------------------------------
  function newId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return "t_" + crypto.randomUUID();
    }
    return "t_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function makeTopic({ title = "新对话", messages = [] } = {}) {
    const now = Date.now();
    return { id: newId(), title, titleManual: false, messages, createdAt: now, updatedAt: now };
  }

  function loadTopics() {
    try {
      const raw = storage.get(CFG.topicsKey);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.filter((t) => t && typeof t === "object" && Array.isArray(t.messages));
    } catch {
      return [];
    }
  }

  function saveTopics() {
    const trimmed = state.topics.slice(0, CFG.maxTopics);
    storage.set(CFG.topicsKey, JSON.stringify(trimmed));
  }

  function getActiveTopic() {
    return state.topics.find((t) => t.id === state.activeTopicId) || null;
  }

  function deriveTitle(messages) {
    const firstUser = messages.find((m) => m.role === "user");
    if (!firstUser) return "新对话";
    const text = (firstUser.content || "").trim().replace(/\s+/g, " ");
    if (!text) return "新对话";
    return text.length > 24 ? text.slice(0, 24) + "…" : text;
  }

  function commitActiveTopic() {
    const t = getActiveTopic();
    if (!t) return;
    t.messages = state.history.slice();
    t.updatedAt = Date.now();
    if (!t.titleManual) t.title = deriveTitle(state.history);
    // Keep most-recently-updated first
    state.topics.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    saveTopics();
    refreshTopicUi();
  }

  function ensureActiveTopic() {
    state.topics = loadTopics();
    const savedActive = storage.get(CFG.activeTopicKey);
    if (savedActive && state.topics.find((t) => t.id === savedActive)) {
      state.activeTopicId = savedActive;
    } else if (state.topics.length > 0) {
      state.activeTopicId = state.topics[0].id;
      storage.set(CFG.activeTopicKey, state.activeTopicId);
    } else {
      const fresh = makeTopic();
      state.topics.unshift(fresh);
      state.activeTopicId = fresh.id;
      storage.set(CFG.activeTopicKey, fresh.id);
      saveTopics();
    }
    const active = getActiveTopic();
    state.history = (active && active.messages) ? active.messages.slice() : [];
  }

  function switchToTopic(id) {
    if (id === state.activeTopicId) {
      closeTopicPanel();
      return;
    }
    if (state.streaming && state.abortCtrl) {
      state.abortCtrl.abort();
    }
    commitActiveTopic();
    const t = state.topics.find((x) => x.id === id);
    if (!t) return;
    state.activeTopicId = id;
    storage.set(CFG.activeTopicKey, id);
    state.history = (t.messages || []).slice();
    renderHistoryFromState();
    refreshTopicUi();
    closeTopicPanel();
    setStatus("已切换话题", "ok");
  }

  function startNewTopic() {
    if (state.streaming && state.abortCtrl) {
      state.abortCtrl.abort();
    }
    commitActiveTopic();
    const fresh = makeTopic();
    state.topics.unshift(fresh);
    state.activeTopicId = fresh.id;
    storage.set(CFG.activeTopicKey, fresh.id);
    state.history = [];
    saveTopics();
    renderHistoryFromState();
    refreshTopicUi();
    closeTopicPanel();
    if (els.input) els.input.focus();
    setStatus("已创建新话题", "ok");
  }

  function deleteTopic(id) {
    const idx = state.topics.findIndex((t) => t.id === id);
    if (idx < 0) return;
    state.topics.splice(idx, 1);
    if (state.activeTopicId === id) {
      if (state.topics.length === 0) {
        const fresh = makeTopic();
        state.topics.unshift(fresh);
        state.activeTopicId = fresh.id;
      } else {
        state.activeTopicId = state.topics[0].id;
      }
      storage.set(CFG.activeTopicKey, state.activeTopicId);
      const active = getActiveTopic();
      state.history = (active && active.messages) ? active.messages.slice() : [];
      renderHistoryFromState();
    }
    saveTopics();
    refreshTopicUi();
  }

  // --- Wire UI --------------------------------------------------------------
  function wire() {
    // Model selector
    if (els.modelSelect) {
      CFG.models.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        els.modelSelect.appendChild(opt);
      });
      els.modelSelect.value = state.model;
      els.modelSelect.addEventListener("change", (e) => {
        state.model = e.target.value;
        savePrefs();
      });
    }
    // Thinking toggle
    if (els.thinkingToggle) {
      els.thinkingToggle.checked = state.thinking;
      els.thinkingToggle.addEventListener("change", (e) => {
        state.thinking = e.target.checked;
        updateEffortVisibility();
        savePrefs();
      });
    }
    // Effort radio group
    if (els.effortGroup) {
      els.effortGroup.querySelectorAll('input[name="effort"]').forEach((r) => {
        if (r.value === state.effort) r.checked = true;
        r.addEventListener("change", (e) => {
          if (e.target.checked) {
            state.effort = e.target.value;
            savePrefs();
          }
        });
      });
      updateEffortVisibility();
    }
    // Form
    els.form.addEventListener("submit", (e) => {
      e.preventDefault();
      send();
    });
    els.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        send();
      }
    });
    els.input.addEventListener("input", () => {
      // Auto-grow
      els.input.style.height = "auto";
      els.input.style.height = Math.min(els.input.scrollHeight, 260) + "px";
      updateCount();
    });
    if (els.stopBtn) {
      els.stopBtn.addEventListener("click", () => {
        if (state.abortCtrl) {
          state.abortCtrl.abort();
        }
      });
    }
    if (els.clearBtn) {
      els.clearBtn.addEventListener("click", () => {
        if (state.streaming && state.abortCtrl) state.abortCtrl.abort();
        state.history = [];
        state.apiMessages = [];
        els.messages.innerHTML = "";
        const t = getActiveTopic();
        if (t) {
          t.messages = [];
          t.title = "新对话";
          t.titleManual = false;
          t.updatedAt = Date.now();
          saveTopics();
          refreshTopicUi();
        }
        setStatus("已清空对话");
      });
    }
    if (els.newTopicBtn) {
      els.newTopicBtn.addEventListener("click", () => {
        startNewTopic();
      });
    }
    if (els.topicToggle) {
      els.topicToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleTopicPanel();
      });
    }
    if (els.topicNewBtn) {
      els.topicNewBtn.addEventListener("click", () => {
        startNewTopic();
      });
    }
    if (els.topicList) {
      els.topicList.addEventListener("click", (e) => {
        const delBtn = e.target.closest("[data-topic-del]");
        if (delBtn) {
          e.stopPropagation();
          const id = delBtn.dataset.topicDel;
          deleteTopic(id);
          return;
        }
        const item = e.target.closest("[data-topic-id]");
        if (item) {
          switchToTopic(item.dataset.topicId);
        }
      });
    }
    document.addEventListener("click", (e) => {
      if (!els.topicPicker) return;
      if (!els.topicPicker.contains(e.target)) closeTopicPanel();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeTopicPanel();
    });
    if (els.apiKeyBtn) {
      els.apiKeyBtn.addEventListener("click", () => {
        createApiKeyModal({
          onSave: () => {
            toast("Key 已更新", "ok");
            updateKeyHint();
          },
        });
      });
    }
    if (els.promptBtn) {
      els.promptBtn.addEventListener("click", () => {
        createPromptModal({
          onSave: (next) => {
            state.systemPrompt = next;
            updatePromptHint();
            toast("提示词已更新", "ok");
          },
          onReset: () => {
            state.systemPrompt = CFG.systemPrompt;
            updatePromptHint();
            toast("已恢复默认提示词", "ok");
          },
        });
      });
    }
  }

  function updateCount() {
    if (!els.count) return;
    const n = (els.input.value || "").length;
    els.count.textContent = `${n} / ${L.chatInputMax}`;
    els.count.toggleAttribute("data-warning", n > L.chatInputMax * 0.92);
  }

  function updatePromptHint() {
    if (!els.promptHint || !els.promptHintText) return;
    const custom = isCustomPrompt();
    els.promptHint.setAttribute("data-tone", custom ? "custom" : "default");
    els.promptHintText.textContent = custom ? "自定义提示词" : "默认提示词";
  }

  // --- Topic picker UI ----------------------------------------------------
  function openTopicPanel() {
    if (!els.topicPanel || !els.topicToggle) return;
    renderTopicList();
    els.topicPanel.removeAttribute("hidden");
    els.topicToggle.setAttribute("aria-expanded", "true");
  }

  function closeTopicPanel() {
    if (!els.topicPanel || !els.topicToggle) return;
    els.topicPanel.setAttribute("hidden", "");
    els.topicToggle.setAttribute("aria-expanded", "false");
  }

  function toggleTopicPanel() {
    if (!els.topicPanel) return;
    if (els.topicPanel.hasAttribute("hidden")) openTopicPanel();
    else closeTopicPanel();
  }

  function refreshTopicUi() {
    const t = getActiveTopic();
    if (els.topicName) els.topicName.textContent = (t && t.title) || "新对话";
    if (els.topicPanel && !els.topicPanel.hasAttribute("hidden")) {
      renderTopicList();
    }
  }

  function formatTopicMeta(t) {
    const count = (t.messages || []).filter((m) => m.role === "user").length;
    const ts = t.updatedAt || t.createdAt || Date.now();
    const diff = Date.now() - ts;
    let timeText;
    if (diff < 60_000) timeText = "刚刚";
    else if (diff < 3600_000) timeText = Math.floor(diff / 60_000) + " 分钟前";
    else if (diff < 86_400_000) timeText = Math.floor(diff / 3600_000) + " 小时前";
    else if (diff < 7 * 86_400_000) timeText = Math.floor(diff / 86_400_000) + " 天前";
    else {
      const d = new Date(ts);
      timeText = `${d.getMonth() + 1}/${d.getDate()}`;
    }
    return `${count} 条 · ${timeText}`;
  }

  function renderTopicList() {
    if (!els.topicList) return;
    els.topicList.innerHTML = "";
    if (state.topics.length === 0) {
      const empty = document.createElement("div");
      empty.className = "chat-topicpicker__empty";
      empty.textContent = "还没有话题，点下面新建一个吧。";
      els.topicList.appendChild(empty);
      return;
    }
    state.topics.forEach((t) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "chat-topicpicker__item";
      item.dataset.topicId = t.id;
      if (t.id === state.activeTopicId) item.setAttribute("data-active", "true");

      const text = document.createElement("span");
      text.className = "chat-topicpicker__item-text";
      const title = document.createElement("span");
      title.className = "chat-topicpicker__item-title";
      title.textContent = t.title || "新对话";
      const meta = document.createElement("span");
      meta.className = "chat-topicpicker__item-meta";
      meta.textContent = formatTopicMeta(t);
      text.appendChild(title);
      text.appendChild(meta);

      const del = document.createElement("span");
      del.className = "chat-topicpicker__item-del";
      del.setAttribute("role", "button");
      del.setAttribute("aria-label", "删除话题");
      del.dataset.topicDel = t.id;
      del.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6"/><path d="M6 6l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg>`;

      item.appendChild(text);
      item.appendChild(del);
      els.topicList.appendChild(item);
    });
  }

  // Re-render the chat-messages list from state.history (used on topic switch)
  function renderHistoryFromState() {
    els.messages.innerHTML = "";
    state.history.forEach((msg) => {
      if (msg.role === "user") {
        addMessage("user", msg.content || "");
      } else if (msg.role === "assistant") {
        const view = addMessage("assistant", msg.content || "", { withReasoning: !!msg.reasoning });
        if (msg.reasoning) view.setReasoning(msg.reasoning);
        if (msg.error) view.markError();
      }
    });
  }

  function updateEffortVisibility() {
    if (!els.effortGroup) return;
    els.effortGroup.toggleAttribute("hidden", !state.thinking);
  }

  function updateKeyHint() {
    const hasKey = !!(storage.get(CFG.storageKey) || "").trim();
    if (!els.apiKeyBtn) return;
    const labelEl = els.apiKeyBtn.querySelector("[data-apikey-label]");
    if (labelEl) labelEl.textContent = hasKey ? "API Key" : "添加 Key";
    els.apiKeyBtn.toggleAttribute("data-missing", !hasKey);
  }

  function setStatus(text, tone = "muted") {
    if (!els.status) return;
    els.status.textContent = text;
    els.status.dataset.tone = tone;
  }

  // --- Message rendering ---------------------------------------------------
  function addMessage(role, text = "", opts = {}) {
    const row = document.createElement("article");
    row.className = `msg msg--${role}`;
    const bubble = document.createElement("div");
    bubble.className = "msg__bubble";
    const content = document.createElement("div");
    content.className = "msg__content";
    content.textContent = text;

    let reasoningEl = null;
    if (role === "assistant" && opts.withReasoning) {
      reasoningEl = document.createElement("details");
      reasoningEl.className = "msg__reasoning";
      reasoningEl.open = true;
      const summary = document.createElement("summary");
      summary.textContent = "思维链";
      const reasoningBody = document.createElement("div");
      reasoningBody.className = "msg__reasoning-body";
      reasoningBody.textContent = "";
      reasoningEl.appendChild(summary);
      reasoningEl.appendChild(reasoningBody);
      bubble.appendChild(reasoningEl);
    }

    bubble.appendChild(content);
    row.appendChild(bubble);
    els.messages.appendChild(row);
    els.messages.scrollTop = els.messages.scrollHeight;

    return {
      row,
      setContent(s) { content.textContent = s; els.messages.scrollTop = els.messages.scrollHeight; },
      appendContent(s) { content.textContent += s; els.messages.scrollTop = els.messages.scrollHeight; },
      setReasoning(s) {
        if (!reasoningEl) return;
        const body = reasoningEl.querySelector(".msg__reasoning-body");
        if (body) body.textContent = s;
      },
      appendReasoning(s) {
        if (!reasoningEl) return;
        const body = reasoningEl.querySelector(".msg__reasoning-body");
        if (body) body.textContent += s;
      },
      markError() {
        row.setAttribute("data-error", "true");
      },
      showTyping() {
        content.innerHTML = "";
        const typing = document.createElement("span");
        typing.className = "typing";
        typing.innerHTML = "<span></span><span></span><span></span>";
        content.appendChild(typing);
      },
    };
  }

  // --- Send ----------------------------------------------------------------
  function send() {
    if (state.streaming) {
      toast("正在回答，请稍候", "err");
      return;
    }
    const text = (els.input.value || "").trim();
    if (!text) return;
    if (text.length > L.chatInputMax) {
      toast(`单次最多 ${L.chatInputMax} 字`, "err");
      return;
    }
    const apiKey = (storage.get(CFG.storageKey) || "").trim();
    if (!apiKey) {
      createApiKeyModal({
        forceOpen: true,
        onSave: () => {
          updateKeyHint();
          send(); // retry
        },
      });
      return;
    }

    // Render user message
    addMessage("user", text);
    els.input.value = "";
    els.input.style.height = "auto";
    updateCount();

    // Record history (trim oversized histories to keep requests reasonable)
    state.history.push({ role: "user", content: text });
    state.apiMessages = buildApiMessages();
    commitActiveTopic();

    // Render assistant placeholder
    const assistant = addMessage("assistant", "", { withReasoning: state.thinking });
    assistant.showTyping();

    streamCompletion(apiKey, assistant).catch((err) => {
      if (err && err.name === "AbortError") {
        setStatus("已中止", "muted");
      } else {
        console.error("[claudeOne] chat failed:", err);
        assistant.markError();
        const msg = (err && err.message) || "请求失败";
        assistant.setContent(msg);
        // Save the error as a soft assistant entry so the topic isn't lost
        state.history.push({ role: "assistant", content: msg, error: true });
        setStatus("请求失败", "err");
      }
    }).finally(() => {
      state.streaming = false;
      state.abortCtrl = null;
      toggleStreamingUi(false);
      commitActiveTopic();
    });
  }

  function buildApiMessages() {
    const sys = (state.systemPrompt || CFG.systemPrompt || "").trim();
    const msgs = [];
    if (sys) msgs.push({ role: "system", content: sys });
    // Trim to last N turns to keep payload modest, skip error entries
    const maxTurns = 16;
    const clean = state.history.filter((t) => !t.error);
    const tail = clean.slice(-maxTurns * 2);
    tail.forEach((t) => {
      msgs.push({ role: t.role, content: t.content });
    });
    return msgs;
  }

  function toggleStreamingUi(on) {
    state.streaming = on;
    if (els.sendBtn) els.sendBtn.disabled = on;
    if (els.stopBtn) els.stopBtn.toggleAttribute("hidden", !on);
    if (els.input) els.input.disabled = on;
    if (els.status) els.status.toggleAttribute("data-active", on);
    if (on) setStatus("正在接收", "muted");
    else setStatus("就绪", "muted");
  }

  // --- Streaming -----------------------------------------------------------
  async function streamCompletion(apiKey, assistantView) {
    state.abortCtrl = new AbortController();
    toggleStreamingUi(true);

    const url = CFG.baseUrl + CFG.chatPath;
    const body = {
      model: state.model,
      messages: state.apiMessages,
      stream: true,
      temperature: CFG.defaultTemperature,
      max_tokens: CFG.defaultMaxTokens,
      thinking: {
        type: state.thinking ? "enabled" : "disabled",
        reasoning_effort: state.effort,
      },
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify(body),
      signal: state.abortCtrl.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      // Strip any accidental key echoing
      throw new Error(`DeepSeek 返回 ${resp.status}: ${errText.slice(0, 240)}`);
    }
    if (!resp.body) throw new Error("响应没有 body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let fullText = "";
    let fullReasoning = "";
    let started = false;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE chunks are split by blank lines
      let idx;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          if (data === "[DONE]") {
            break;
          }
          try {
            const json = JSON.parse(data);
            const delta = json?.choices?.[0]?.delta || {};
            if (delta.reasoning_content) {
              if (!started) {
                assistantView.setContent("");
                started = true;
              }
              fullReasoning += delta.reasoning_content;
              assistantView.appendReasoning(delta.reasoning_content);
            }
            if (delta.content) {
              if (!started) {
                assistantView.setContent("");
                started = true;
              }
              fullText += delta.content;
              assistantView.appendContent(delta.content);
            }
          } catch (err) {
            console.warn("[claudeOne] bad SSE chunk", err, data.slice(0, 120));
          }
        }
      }
    }

    // Commit to history
    state.history.push({
      role: "assistant",
      content: fullText,
      reasoning: fullReasoning || undefined,
    });

    if (!fullText) {
      assistantView.setContent("（无内容返回）");
    }
  }

  // --- Prompt modal --------------------------------------------------------
  function createPromptModal({ onSave, onReset } = {}) {
    let existing = document.querySelector("[data-prompt-modal]");
    if (!existing) {
      existing = document.createElement("div");
      existing.className = "modal-root";
      existing.setAttribute("data-prompt-modal", "");
      const presets = (CFG.promptPresets || []).map((p) =>
        `<button class="prompt-preset" data-preset="${p.id}" type="button">${p.label}</button>`
      ).join("");
      existing.innerHTML = `
        <div class="modal-card modal-card--wide" role="dialog" aria-modal="true" aria-labelledby="promptTitle">
          <h2 id="promptTitle">自定义提示词</h2>
          <p class="muted" style="color:var(--ink-soft)">
            设置 AI 的角色与风格。提示词只保存在你浏览器本地（localStorage），
            不会上传，也不会写进项目代码。
          </p>

          <div>
            <span class="prompt-presets-label">预设模板</span>
            <div class="prompt-presets" data-prompt-presets>${presets}</div>
          </div>

          <div class="field">
            <label class="field__label" for="promptInput">系统提示词</label>
            <textarea id="promptInput" class="textarea prompt-textarea" data-prompt-input
                      maxlength="${CFG.systemPromptMax}"
                      placeholder="例如：你是一位耐心、严谨的中文写作助手…"></textarea>
            <span class="prompt-counter" data-prompt-count>0 / ${CFG.systemPromptMax}</span>
          </div>

          <div class="modal-actions modal-actions--split">
            <button class="btn btn-ghost btn-sm" data-prompt-reset type="button">恢复默认</button>
            <span style="display:inline-flex; gap: var(--space-3)">
              <button class="btn btn-ghost" data-prompt-cancel type="button">取消</button>
              <button class="btn btn-primary" data-prompt-save type="button">保存</button>
            </span>
          </div>
        </div>
      `;
      document.body.appendChild(existing);

      const input = existing.querySelector("[data-prompt-input]");
      const counter = existing.querySelector("[data-prompt-count]");
      const presetsWrap = existing.querySelector("[data-prompt-presets]");
      const saveBtn = existing.querySelector("[data-prompt-save]");
      const cancelBtn = existing.querySelector("[data-prompt-cancel]");
      const resetBtn = existing.querySelector("[data-prompt-reset]");

      function refreshCounter() {
        const n = (input.value || "").length;
        counter.textContent = `${n} / ${CFG.systemPromptMax}`;
        counter.toggleAttribute("data-warning", n > CFG.systemPromptMax * 0.92);
      }

      function refreshActivePreset() {
        const current = (input.value || "").trim();
        presetsWrap.querySelectorAll(".prompt-preset").forEach((btn) => {
          const id = btn.dataset.preset;
          const def = (CFG.promptPresets || []).find((p) => p.id === id);
          const match = def && def.prompt.trim() === current;
          btn.toggleAttribute("data-active", !!match);
        });
      }

      function close() {
        existing.setAttribute("data-open", "false");
        setTimeout(() => existing.removeAttribute("data-open"), 300);
      }

      input.addEventListener("input", () => {
        refreshCounter();
        refreshActivePreset();
      });

      presetsWrap.addEventListener("click", (e) => {
        const btn = e.target.closest(".prompt-preset");
        if (!btn) return;
        const def = (CFG.promptPresets || []).find((p) => p.id === btn.dataset.preset);
        if (!def) return;
        input.value = def.prompt;
        refreshCounter();
        refreshActivePreset();
        input.focus();
      });

      saveBtn.addEventListener("click", () => {
        const v = (input.value || "").trim();
        if (!v) {
          input.focus();
          toast("提示词不能为空", "err");
          return;
        }
        if (v === CFG.systemPrompt.trim()) {
          storage.remove(CFG.systemPromptKey);
        } else {
          storage.set(CFG.systemPromptKey, v);
        }
        close();
        if (typeof onSave === "function") onSave(v);
      });

      cancelBtn.addEventListener("click", close);

      resetBtn.addEventListener("click", () => {
        input.value = CFG.systemPrompt;
        storage.remove(CFG.systemPromptKey);
        refreshCounter();
        refreshActivePreset();
        if (typeof onReset === "function") onReset();
      });

      existing.addEventListener("click", (e) => {
        if (e.target === existing) close();
      });
      existing.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
      });

      existing._refresh = () => {
        refreshCounter();
        refreshActivePreset();
      };
    }

    // Pre-fill with current value
    const input = existing.querySelector("[data-prompt-input]");
    if (input) input.value = state.systemPrompt || CFG.systemPrompt;
    if (typeof existing._refresh === "function") existing._refresh();

    requestAnimationFrame(() => {
      existing.setAttribute("data-open", "true");
      const i = existing.querySelector("[data-prompt-input]");
      if (i) i.focus();
    });
    return existing;
  }

  // --- Boot ----------------------------------------------------------------
  ensureActiveTopic();
  wire();
  updateKeyHint();
  updatePromptHint();
  updateCount();
  refreshTopicUi();
  renderHistoryFromState();
  setStatus("就绪");

  // If no key set yet, prompt on first visit
  if (!storage.get(CFG.storageKey)) {
    // Delay slightly so the page transition settles first
    setTimeout(() => {
      createApiKeyModal({
        forceOpen: true,
        onSave: () => {
          updateKeyHint();
          toast("Key 已保存到本地", "ok");
        },
      });
    }, 420);
  }
})();
