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
    status: root.querySelector("[data-status]"),
  };

  const state = {
    history: [], // {role: "user"|"assistant", content, reasoning?}
    apiMessages: [], // trimmed payload we send (system + user/assistant pairs)
    streaming: false,
    abortCtrl: null,
    model: CFG.defaultModel,
    thinking: false,
    effort: "high",
  };

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
      });
    }
    // Thinking toggle
    if (els.thinkingToggle) {
      els.thinkingToggle.checked = state.thinking;
      els.thinkingToggle.addEventListener("change", (e) => {
        state.thinking = e.target.checked;
        updateEffortVisibility();
      });
    }
    // Effort radio group
    if (els.effortGroup) {
      els.effortGroup.querySelectorAll('input[name="effort"]').forEach((r) => {
        if (r.value === state.effort) r.checked = true;
        r.addEventListener("change", (e) => {
          if (e.target.checked) state.effort = e.target.value;
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
        state.history = [];
        state.apiMessages = [];
        els.messages.innerHTML = "";
        setStatus("已清空对话");
      });
    }
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
  }

  function updateEffortVisibility() {
    if (!els.effortGroup) return;
    els.effortGroup.toggleAttribute("hidden", !state.thinking);
  }

  function updateKeyHint() {
    const hasKey = !!(storage.get(CFG.storageKey) || "").trim();
    if (els.apiKeyBtn) {
      els.apiKeyBtn.textContent = hasKey ? "API Key" : "添加 Key";
    }
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

    // Record history (trim oversized histories to keep requests reasonable)
    state.history.push({ role: "user", content: text });
    state.apiMessages = buildApiMessages();

    // Render assistant placeholder
    const assistant = addMessage("assistant", "", { withReasoning: state.thinking });
    assistant.showTyping();

    streamCompletion(apiKey, assistant).catch((err) => {
      if (err && err.name === "AbortError") {
        setStatus("已中止", "muted");
      } else {
        console.error("[claudeOne] chat failed:", err);
        assistant.markError();
        assistant.setContent((err && err.message) || "请求失败");
        setStatus("请求失败", "err");
      }
    }).finally(() => {
      state.streaming = false;
      state.abortCtrl = null;
      toggleStreamingUi(false);
    });
  }

  function buildApiMessages() {
    const msgs = [{ role: "system", content: CFG.systemPrompt }];
    // Trim to last N turns to keep payload modest
    const maxTurns = 16;
    const tail = state.history.slice(-maxTurns * 2);
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
    if (on) setStatus("正在接收…", "muted");
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

  // --- Boot ----------------------------------------------------------------
  wire();
  updateKeyHint();
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
