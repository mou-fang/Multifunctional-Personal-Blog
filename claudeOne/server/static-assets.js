const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const fingerprint = bytes => createHash("sha256").update(bytes).digest("hex").slice(0, 20);
const REWRITTEN_JS = new Set(["js/page-registry.js", "js/startup.js"]);

function createStaticAssets(root) {
  const base = path.resolve(root);
  const cache = new Map();

  function read(relative) {
    const filename = path.resolve(base, relative);
    if (!filename.startsWith(base + path.sep)) return null;
    let stat;
    try { stat = fs.statSync(filename); } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
      throw error;
    }
    if (!stat.isFile()) return null;
    const key = [stat.size, stat.mtimeMs, stat.ctimeMs].join(":");
    const prior = cache.get(relative);
    if (prior && prior.key === key) return prior;
    const bytes = fs.readFileSync(filename);
    const current = { key, bytes, version: fingerprint(bytes) };
    cache.set(relative, current);
    return current;
  }

  function served(relative) {
    const source = read(relative);
    if (!source) return null;
    if (!REWRITTEN_JS.has(relative)) return source;
    const bytes = Buffer.from(source.bytes.toString("utf8").replace(/(['"])((?:\.\/)?(?:css|js|logo)\/[^'"\s]+)\1/g,
      (_match, quote, url) => quote + versionURL(url) + quote));
    return { bytes, version: fingerprint(bytes) };
  }

  function versionURL(url) {
    let parsed;
    try { parsed = new URL(url, "http://assets.invalid/"); } catch (_) { return url; }
    if (parsed.origin !== "http://assets.invalid") return url;
    const relative = parsed.pathname.slice(1);
    if (!/^(css|js|logo)\/[^?#]+\.(css|js|png|webp|svg|ico)$/.test(relative)) return url;
    const asset = served(relative);
    if (!asset) return url;
    parsed.searchParams.set("v", asset.version);
    // Keep relative URLs working for ordinary static hosting and Hash routes.
    return url.split(/[?#]/)[0] + parsed.search + parsed.hash;
  }

  function setCacheHeaders(res, version) {
    const requested = new URL(res.req.originalUrl, "http://assets.invalid").searchParams.get("v");
    const policy = version && requested === version
      ? "public, max-age=31536000, immutable"
      : "public, no-cache";
    res.setHeader("Cache-Control", policy);
    res.setHeader("Cloudflare-CDN-Cache-Control", policy);
  }

  function sendIndex(_req, res, next) {
    try {
      const source = read("index.html");
      if (!source) return next();
      const html = source.bytes.toString("utf8").replace(/((?:href|src)\s*=\s*["'])([^"']+)(["'])/g,
        (_match, prefix, url, suffix) => prefix + versionURL(url) + suffix);
      setCacheHeaders(res, null);
      res.type("html").send(html);
    } catch (error) { next(error); }
  }

  function middleware(req, res, next) {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path === "/" || req.path === "/index.html") return sendIndex(req, res, next);
    const relative = req.path.slice(1);
    if (!REWRITTEN_JS.has(relative)) return next();
    try {
      const asset = served(relative);
      if (!asset) return next();
      setCacheHeaders(res, asset.version);
      res.type("application/javascript").send(asset.bytes);
    } catch (error) { next(error); }
  }

  function setHeaders(res, filename) {
    const relative = path.relative(base, filename).split(path.sep).join("/");
    if (!/^(css|js|logo)\//.test(relative)) return;
    const asset = served(relative);
    if (asset) setCacheHeaders(res, asset.version);
  }

  return { middleware, sendIndex, setHeaders, versionURL };
}

module.exports = { createStaticAssets };
