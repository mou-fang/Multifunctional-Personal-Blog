/* QR payload classification. Never interpret scanned content as HTML. */
(function (root) {
  "use strict";
  function classify(raw) {
    const text = String(raw ?? "");
    const value = text.trim();
    const result = { text, type: "text", label: "文本", detail: "二维码中的原始文字", fields: [], href: null };
    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        if (url.hostname && !url.username && !url.password) {
          return { ...result, type: "url", label: "网页链接", detail: url.hostname, href: url.href };
        }
      } catch (_) { /* Preserve malformed URLs as plain text. */ }
    }
    if (/^WIFI:/i.test(value)) {
      const fields = {};
      // A backslash escapes the following character, including separators.
      for (const match of value.slice(5).matchAll(/(?:^|;)([A-Z]+):((?:\\.|[^;\\])*)/gi)) {
        fields[match[1].toUpperCase()] = match[2].replace(/\\(.)/g, "$1");
      }
      return { ...result, type: "wifi", label: "Wi-Fi 网络", detail: "网络名称与连接信息", fields: [
        ["网络名称", fields.S || "未提供"], ["密码", fields.P || "无"],
        ["加密方式", fields.T || "未提供"], ["隐藏网络", fields.H === "true" ? "是" : "否"]
      ] };
    }
    const types = [
      [/^mailto:/i, "email", "电子邮件", "邮件地址及预填内容"],
      [/^tel:/i, "phone", "电话号码", "二维码中保存的电话号码"],
      [/^(sms:|smsto:)/i, "sms", "短信", "收件号码及短信内容"],
      [/^(BEGIN:VCARD|MECARD:)/i, "contact", "联系人名片", "姓名、电话等名片信息"],
      [/^geo:/i, "location", "地理位置", "经纬度及位置描述"],
      [/^BEGIN:VEVENT/i, "event", "日程", "二维码中保存的日程信息"],
      [/^[a-z][a-z0-9+.-]*:/i, "app", "应用或其他协议", "保留完整内容，可复制到对应应用使用"]
    ];
    for (const [pattern, type, label, detail] of types) {
      if (pattern.test(value)) return { ...result, type, label, detail };
    }
    return result;
  }
  const api = { classify };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QRReaderCore = api;
})(typeof window !== "undefined" ? window : globalThis);
