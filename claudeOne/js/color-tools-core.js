/* Color tools: opaque sRGB values, palette interchange and display previews.
 * Image extraction is provided separately by the vendored Color Thief library.
 */
(function (scope) {
  "use strict";
  const MAX_COLORS = 40;
  const clamp = (n, low = 0, high = 1) => Math.min(high, Math.max(low, n));
  const hue = n => ((n % 360) + 360) % 360;
  function toHex(rgb) {
    return "#" + rgb.map(n => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  function rgb(hex) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
  function hsl(hex) {
    const [r, g, b] = rgb(hex).map(n => n / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
    let h = 0;
    if (d) {
      h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    }
    return [hue(h * 60), d ? d / (1 - Math.abs(2 * l - 1)) * 100 : 0, l * 100];
  }
  function fromHsl(h, s, l) {
    h = hue(h); s = clamp(s / 100); l = clamp(l / 100);
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const values = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return toHex(values.map(n => (n + m) * 255));
  }
  function parse(value) {
    if (typeof value !== "string") return null;
    const text = value.trim();
    const hex = text.match(/^#?([\da-f]{3}|[\da-f]{6})$/i);
    if (hex) return "#" + (hex[1].length === 3 ? [...hex[1]].map(c => c + c).join("") : hex[1]).toUpperCase();
    const components = text.match(/^(rgb|hsl)\(\s*([^()]+)\s*\)$/i);
    if (!components || /[/]/.test(components[2])) return null;
    const parts = components[2].trim().split(/\s*,\s*|\s+/);
    if (parts.length !== 3) return null;
    if (components[1].toLowerCase() === "rgb") {
      if (!parts.every(p => /^\d+(?:\.\d+)?%?$/.test(p))) return null;
      const percentages = parts.every(p => p.endsWith("%"));
      if (!percentages && parts.some(p => p.endsWith("%"))) return null;
      const values = parts.map(p => parseFloat(p));
      if (values.some(n => !Number.isFinite(n) || n > (percentages ? 100 : 255))) return null;
      return toHex(percentages ? values.map(n => n * 255 / 100) : values);
    }
    if (!/^-?\d+(?:\.\d+)?(?:deg)?$/.test(parts[0]) || !parts.slice(1).every(p => /^\d+(?:\.\d+)?%$/.test(p))) return null;
    const values = parts.map(p => parseFloat(p));
    return values.some(n => !Number.isFinite(n)) || values.slice(1).some(n => n > 100) ? null : fromHsl(...values);
  }
  const linear = n => { n /= 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; };
  const encode = n => { n = clamp(n); return 255 * (n <= .0031308 ? n * 12.92 : 1.055 * n ** (1 / 2.4) - .055); };
  function luminance(hex) { const [r, g, b] = rgb(hex).map(linear); return .2126 * r + .7152 * g + .0722 * b; }
  function contrast(a, b) { const l = [luminance(a), luminance(b)].sort((x, y) => y - x); return (l[0] + .05) / (l[1] + .05); }
  function ink(hex) { return contrast(hex, "#FFFFFF") >= contrast(hex, "#000000") ? "#FFFFFF" : "#000000"; }
  function formats(hex) {
    const [h, s, l] = hsl(hex).map(n => Math.round(n));
    return { hex, rgb: `rgb(${rgb(hex).join(", ")})`, hsl: `hsl(${h % 360}, ${s}%, ${l}%)` };
  }
  function harmony(hex, type) {
    const [h, s, l] = hsl(hex);
    let colors;
    if (type === "mono") colors = [fromHsl(h, s, 18), fromHsl(h, s, 34), hex, fromHsl(h, s, 70), fromHsl(h, s, 86)];
    else if (type === "complement") colors = [hex, fromHsl(h, s * .65, 82), fromHsl(h + 180, s, l), fromHsl(h + 180, s * .7, 76), fromHsl(h, s * .6, 22)];
    else if (type === "triad") colors = [hex, fromHsl(h + 120, s, l), fromHsl(h + 240, s, l), fromHsl(h, s * .45, 84), fromHsl(h, s * .45, 20)];
    else colors = [-35, -17, 0, 17, 35].map(offset => offset === 0 ? hex : fromHsl(h + offset, s, l));
    return [...new Set(colors)];
  }
  // Machado, Oliveira & Fernandes (2009), published severity 1.0 matrices.
  // Apply in LINEAR sRGB, then encode and clip for screen display.
  const VISION = Object.freeze({
    protan: [.152286, 1.052583, -.204868, .114503, .786281, .099216, -.003882, -.048116, 1.051998],
    deutan: [.367322, .860646, -.227968, .280085, .672501, .047413, -.011820, .042940, .968881],
    tritan: [1.255528, -.076749, -.178779, -.078411, .930809, .147602, .004733, .691367, .303900]
  });
  function simulate(hex, type) {
    if (type === "gray") { const v = encode(luminance(hex)); return toHex([v, v, v]); }
    const matrix = VISION[type];
    if (!matrix) return hex;
    const values = rgb(hex).map(linear);
    return toHex([0, 3, 6].map(row => encode(values.reduce((sum, v, i) => sum + v * matrix[row + i], 0))));
  }
  function normalizePalette(value) {
    if (!value || typeof value !== "object" || !Array.isArray(value.colors) || value.colors.length > MAX_COLORS) throw new Error("色卡格式不正确，最多支持 40 个颜色。");
    if (value.version !== undefined && value.version !== 1) throw new Error("暂不支持这个版本的色卡文件。");
    if (value.format !== undefined && value.format !== "claudeOne.color-palette") throw new Error("请选择从颜色工具导出的 JSON 色卡。");
    const name = typeof value.name === "string" ? value.name.trim().slice(0, 80) : "未命名配色";
    const colors = value.colors.map(color => {
      const hex = parse(typeof color === "string" ? color : color?.hex);
      if (!hex) throw new Error("色卡包含无效颜色，请检查 JSON 文件。");
      return { hex, label: typeof color?.label === "string" ? color.label.slice(0, 80) : "" };
    });
    return { format: "claudeOne.color-palette", version: 1, name: name || "未命名配色", colors };
  }
  function gradient(stops, type = "linear", angle = 90) {
    if (!Array.isArray(stops) || stops.length < 2 || stops.length > 8) throw new Error("渐变需要 2–8 个颜色节点。");
    const sorted = stops.map(stop => {
      const hex = parse(stop.hex), pos = Number(stop.pos);
      if (!hex || !Number.isFinite(pos) || pos < 0 || pos > 100) throw new Error("节点位置应为 0–100%。");
      return { hex, pos: Math.round(pos * 10) / 10 };
    }).sort((a, b) => a.pos - b.pos);
    const direction = type === "radial" ? "circle" : `${hue(Number.isFinite(Number(angle)) ? Number(angle) : 90)}deg`;
    return `${type === "radial" ? "radial" : "linear"}-gradient(${direction}, ${sorted.map(s => `${s.hex} ${s.pos}%`).join(", ")})`;
  }
  function cssPalette(value) {
    const palette = normalizePalette(value);
    return `:root {\n${palette.colors.map((c, i) => `  --color-${String(i + 1).padStart(2, "0")}: ${c.hex};`).join("\n")}\n}\n`;
  }
  function xml(text) { return String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]); }
  function exportLayout(count) {
    const columns = Math.min(Math.max(count, 1), 5), rows = Math.ceil(count / columns);
    return { columns, width: 1200, height: 150 + rows * 260, cellWidth: 1120 / columns };
  }
  function svgPalette(value) {
    const palette = normalizePalette(value), layout = exportLayout(palette.colors.length);
    const shorten = (text, limit) => [...text].length > limit ? [...text].slice(0, limit - 1).join("") + "…" : text;
    const cards = palette.colors.map((c, i) => {
      const x = 40 + (i % layout.columns) * layout.cellWidth, y = 135 + Math.floor(i / layout.columns) * 260;
      const label = shorten(c.label || `颜色 ${i + 1}`, Math.floor((layout.cellWidth - 40) / 18));
      return `<g><rect x="${x}" y="${y}" width="${layout.cellWidth - 16}" height="164" rx="12" fill="${c.hex}"/><text x="${x + 12}" y="${y + 197}" font-size="18">${xml(label)}</text><text x="${x + 12}" y="${y + 225}" font-size="16" fill="#475569">${c.hex}</text></g>`;
    }).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}"><title>${xml(palette.name)}</title><rect width="100%" height="100%" fill="#FFFFFF"/><g font-family="Arial, sans-serif" fill="#1E293B"><text x="40" y="65" font-size="32" font-weight="700">${xml(shorten(palette.name, 34))}</text><text x="40" y="100" font-size="16" fill="#475569">${palette.colors.length} 色 · sRGB · 魔方的妙妙工具</text>${cards}</g></svg>`;
  }
  function region(a, b) {
    const x = clamp(Math.min(a.x, b.x)), y = clamp(Math.min(a.y, b.y));
    return { x, y, width: clamp(Math.max(a.x, b.x)) - x, height: clamp(Math.max(a.y, b.y)) - y };
  }
  const api = Object.freeze({ MAX_COLORS, clamp, toHex, rgb, hsl, fromHsl, parse, formats, contrast, ink, harmony, simulate, normalizePalette, gradient, cssPalette, svgPalette, exportLayout, region });
  if (typeof module === "object" && module.exports) module.exports = api;
  else scope.ColorToolsCore = api;
})(typeof window === "object" ? window : globalThis);
