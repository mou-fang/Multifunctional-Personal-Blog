/* ===== claudeOne :: deepseek-client.js ===== */
(function initDeepSeekClient() {
  "use strict";

  const CFG = window.CLAUDE_ONE_CONFIG && window.CLAUDE_ONE_CONFIG.deepseek;
  if (!CFG) return;

  function chatUrl() {
    return CFG.baseUrl + CFG.chatPath;
  }

  async function requestChat(apiKey, body, signal) {
    const resp = await fetch(chatUrl(), {
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
      throw new Error("DeepSeek 返回 " + resp.status + ": " + detail.slice(0, 240));
    }
    return resp;
  }

  async function complete(apiKey, body, signal) {
    const resp = await requestChat(apiKey, Object.assign({}, body, { stream: false }), signal);
    return resp.json();
  }

  async function stream(apiKey, body, signal, handlers) {
    handlers = handlers || {};
    const resp = await requestChat(apiKey, Object.assign({}, body, { stream: true }), signal);
    if (!resp.body) throw new Error("响应没有 body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
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
            if (typeof handlers.onDone === "function") handlers.onDone();
            continue;
          }
          try {
            const json = JSON.parse(data);
            const delta = json && json.choices && json.choices[0] && json.choices[0].delta || {};
            if (typeof handlers.onDelta === "function") handlers.onDelta(delta, json);
          } catch (err) {
            if (typeof handlers.onErrorChunk === "function") handlers.onErrorChunk(err, data);
            else console.warn("[claudeOne] bad SSE chunk", err, data.slice(0, 120));
          }
        }
      }
    }
  }

  window.ClaudeOneDeepSeek = Object.freeze({
    requestChat,
    complete,
    stream,
    chatUrl,
  });
})();
