"use strict";
const { readLimited, sourceUrl, validateSnapshot, MAX_ASSET } = require("./game-releases-store");
async function boundedResponse(url, maximum, fetchFn) {
  const response = await fetchFn(url, { redirect: "error", signal: AbortSignal.timeout(30000), headers: { "Cache-Control": "no-cache" } });
  if (!response.ok) throw new Error("网站读取失败，HTTP " + response.status);
  const buffers = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > maximum) throw new Error("网站响应超过大小限制");
    buffers.push(Buffer.from(chunk));
  }
  return Buffer.concat(buffers);
}
async function verify({ reportFile, inputFile, imageFile, url, fetchFn = fetch }) {
  const base = new URL(sourceUrl(url));
  if (base.pathname !== "/" || base.search || base.hash) throw new Error("--url 必须是网站 HTTPS 根地址");
  const [report, input, image] = await Promise.all([
    readLimited(reportFile).then(value => JSON.parse(value)), readLimited(inputFile).then(value => JSON.parse(value)), readLimited(imageFile, MAX_ASSET)
  ]);
  if (report.ok !== true || report.dryRun || !Array.isArray(input.items)) throw new Error("没有可验证的正式发布结果");
  const snapshot = validateSnapshot(JSON.parse(await boundedResponse(new URL("/api/game-releases", base).href, 256 * 1024, fetchFn)));
  if (snapshot.revision !== report.revision || snapshot.date !== report.date || snapshot.date !== input.date || snapshot.items.length !== report.count || snapshot.items.length !== input.items.length) throw new Error("网站版本、日期或数量与本地发布不一致");
  const fields = ["title", "searchName", "releaseDate", "platforms", "summary"];
  for (let index = 0; index < snapshot.items.length; index++) {
    for (const field of fields) {
      const expected = input.items[index][field];
      if (JSON.stringify(snapshot.items[index][field]) !== JSON.stringify(typeof expected === "string" ? expected.trim() : expected)) throw new Error(`网站第 ${index + 1} 条 ${field} 不一致`);
    }
    if (JSON.stringify(snapshot.items[index].sourceUrls) !== JSON.stringify([...new Set(input.items[index].sourceUrls.map(sourceUrl))])) throw new Error("网站来源链接不一致");
  }
  if (!snapshot.weeklyPoster.endsWith(".png")) throw new Error("网站原图不是 PNG");
  const original = await boundedResponse(new URL(snapshot.weeklyPoster, base).href, MAX_ASSET, fetchFn);
  if (!original.equals(image)) throw new Error("网站速报原图与本地 PNG 字节不一致");
  return { ok: true, verified: true, revision: snapshot.revision, date: snapshot.date, count: snapshot.items.length, posterBytes: image.length };
}
module.exports = { verify };
