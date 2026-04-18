(function deepSeekPage() {
  const root = document.querySelector("[data-ai-page]");
  if (!root) return;

  const els = {
    form: document.querySelector("#chatComposer"),
    prompt: document.querySelector("#chatPrompt"),
    messages: document.querySelector("#chatMessages"),
    sendBtn: document.querySelector("#sendPromptBtn"),
    clearBtn: document.querySelector("#clearChatBtn"),
    modelSelect: document.querySelector("#modelSelect"),
    searchToggle: document.querySelector("#webSearchToggle"),
    reasoningToggle: document.querySelector("#reasoningModeToggle"),
    showReasoningToggle: document.querySelector("#showReasoningToggle"),
    configHint: document.querySelector("#configHint"),
    status: document.querySelector("#chatStatus"),
  };

  const state = {
    sending: false,
    apiMessages: [],
    uiMessages: [],
  };

  function normalizeBaseUrl(url) {
    return (url || "https://api.deepseek.com").replace(/\/+$/, "");
  }

  function hasApiKey() {
    const apiKey = window.APP_CONFIG?.deepseek?.apiKey || "";
    return apiKey && !apiKey.startsWith("REPLACE_WITH_");
  }

  function setStatus(text, type = "muted") {
    if (!els.status) return;
    els.status.textContent = text;
    els.status.dataset.tone = type;
  }

  function setComposerState(isSending) {
    state.sending = isSending;
    els.sendBtn.disabled = isSending;
    els.prompt.disabled = isSending;
    els.modelSelect.disabled = isSending;
    els.searchToggle.disabled = isSending;
    els.reasoningToggle.disabled = isSending;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatText(value) {
    return escapeHtml(value).replace(/\n/g, "<br />");
  }

  function createMessageNode(message) {
    const article = document.createElement("article");
    article.className = `chat-message ${message.role}`;

    const meta = document.createElement("div");
    meta.className = "chat-message-meta";
    meta.textContent =
      message.role === "user"
        ? "你"
        : message.role === "assistant"
          ? (message.modelLabel || "DeepSeek")
          : "系统";

    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    bubble.innerHTML = formatText(message.content || "");

    article.append(meta, bubble);

    if (message.reasoningContent) {
      const reasoning = document.createElement("details");
      reasoning.className = "reasoning-panel";
      reasoning.open = Boolean(els.showReasoningToggle.checked);

      const summary = document.createElement("summary");
      summary.textContent = "深度思考轨迹";

      const content = document.createElement("div");
      content.className = "reasoning-body";
      content.innerHTML = formatText(message.reasoningContent);
      reasoning.append(summary, content);
      article.appendChild(reasoning);
    }

    return article;
  }

  function renderMessages() {
    els.messages.innerHTML = "";

    if (!state.uiMessages.length) {
      const empty = document.createElement("article");
      empty.className = "chat-empty";
      empty.innerHTML =
        "<strong>准备好了。</strong><span>先在 config.js 里填写 API key，然后就可以直接在这里和 DeepSeek 对话。</span>";
      els.messages.appendChild(empty);
      return;
    }

    state.uiMessages.forEach((message) => {
      els.messages.appendChild(createMessageNode(message));
    });
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function syncReasoningVisibility() {
    root.dataset.showReasoning = String(els.showReasoningToggle.checked);
    document.querySelectorAll(".reasoning-panel").forEach((panel) => {
      panel.open = Boolean(els.showReasoningToggle.checked);
    });
  }

  function syncModelSelection() {
    if (els.reasoningToggle.checked) {
      els.modelSelect.value = window.APP_CONFIG?.deepseek?.reasoningModel || "deepseek-reasoner";
      els.modelSelect.disabled = true;
    } else {
      els.modelSelect.disabled = state.sending;
      if (els.modelSelect.value === (window.APP_CONFIG?.deepseek?.reasoningModel || "deepseek-reasoner")) {
        els.modelSelect.value = window.APP_CONFIG?.deepseek?.chatModel || "deepseek-chat";
      }
    }
  }

  async function searchWeb(query) {
    const endpoint = window.APP_CONFIG?.webSearch?.endpoint?.trim();
    const apiKey = window.APP_CONFIG?.webSearch?.apiKey?.trim();

    if (!endpoint) {
      throw new Error("网页搜索尚未配置。请在 config.js 里填写 APP_CONFIG.webSearch.endpoint。");
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}`, "X-API-Key": apiKey } : {}),
      },
      body: JSON.stringify({
        query,
        limit: window.APP_CONFIG?.webSearch?.resultLimit || 5,
      }),
    });

    if (!response.ok) {
      throw new Error(`网页搜索请求失败：${response.status}`);
    }

    const payload = await response.json();
    const rawResults = Array.isArray(payload)
      ? payload
      : payload.results || payload.items || payload.data || [];

    return rawResults
      .map((item, index) => ({
        title: item.title || item.name || `Result ${index + 1}`,
        url: item.url || item.link || item.href || "",
        snippet: item.snippet || item.description || item.summary || "",
      }))
      .filter((item) => item.title || item.snippet);
  }

  async function requestDeepSeek() {
    const prompt = els.prompt.value.trim();
    if (!prompt || state.sending) return;

    if (!hasApiKey()) {
      setStatus("请先去 config.js 填写 APP_CONFIG.deepseek.apiKey。", "danger");
      els.configHint.hidden = false;
      return;
    }

    const userMessage = { role: "user", content: prompt };
    state.apiMessages.push(userMessage);
    state.uiMessages.push(userMessage);
    renderMessages();
    els.prompt.value = "";
    els.configHint.hidden = false;

    const baseUrl = normalizeBaseUrl(window.APP_CONFIG?.deepseek?.baseUrl);
    const apiKey = window.APP_CONFIG?.deepseek?.apiKey;
    const useReasoning = els.reasoningToggle.checked;
    const selectedModel = useReasoning
      ? window.APP_CONFIG?.deepseek?.reasoningModel || "deepseek-reasoner"
      : els.modelSelect.value;

    const messages = [];
    const systemPrompt = window.APP_CONFIG?.deepseek?.systemPrompt?.trim();
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    state.apiMessages.forEach((message) => {
      messages.push({ role: message.role, content: message.content });
    });

    if (els.searchToggle.checked) {
      setStatus("正在准备网页搜索上下文…", "info");
      try {
        const results = await searchWeb(prompt);
        const searchSummary = results.length
          ? results
              .map((item, index) => `${index + 1}. ${item.title}\nURL: ${item.url}\n摘要: ${item.snippet}`)
              .join("\n\n")
          : "未获得有效搜索结果。";

        messages.push({
          role: "system",
          content:
            "The user asked for web-aware help. Use the following search digest as external context, and cite URLs in plain text when useful.\n\n" +
            searchSummary,
        });
      } catch (error) {
        setStatus(error.message, "danger");
        state.apiMessages.pop();
        state.uiMessages.push({
          role: "system",
          content: error.message,
        });
        renderMessages();
        els.prompt.value = prompt;
        return;
      }
    }

    setComposerState(true);
    setStatus(useReasoning ? "DeepSeek 正在深度思考…" : "DeepSeek 正在回复…", "info");

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek 请求失败：${response.status} ${errorText}`.slice(0, 400));
      }

      const payload = await response.json();
      const message = payload?.choices?.[0]?.message;
      if (!message) {
        throw new Error("DeepSeek 没有返回有效消息。");
      }

      const assistantMessage = {
        role: "assistant",
        content: message.content || "模型没有返回正文。",
        reasoningContent: message.reasoning_content || "",
        modelLabel: selectedModel,
      };

      state.apiMessages.push({ role: "assistant", content: assistantMessage.content });
      state.uiMessages.push(assistantMessage);
      renderMessages();
      setStatus("本轮对话已完成。", "success");
    } catch (error) {
      state.apiMessages = state.apiMessages.filter((item) => item !== userMessage);
      els.prompt.value = prompt;
      setStatus(error.message, "danger");
      state.uiMessages.push({
        role: "system",
        content: error.message,
      });
      renderMessages();
    } finally {
      setComposerState(false);
      syncModelSelection();
    }
  }

  function clearChat() {
    state.apiMessages = [];
    state.uiMessages = [];
    renderMessages();
    setStatus("对话已清空。", "muted");
  }

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    requestDeepSeek();
  });

  els.clearBtn.addEventListener("click", clearChat);
  els.reasoningToggle.addEventListener("change", () => {
    syncModelSelection();
    setStatus(
      els.reasoningToggle.checked ? "深度思考已开启，将优先使用 deepseek-reasoner。" : "已切回普通聊天模式。",
      "muted",
    );
  });
  els.showReasoningToggle.addEventListener("change", syncReasoningVisibility);

  syncModelSelection();
  syncReasoningVisibility();
  renderMessages();
  setStatus("在 config.js 填写 APP_CONFIG.deepseek.apiKey 后即可开始对话。", "muted");
})();
