#!/usr/bin/env node
"use strict";
const { audit } = require("../server/seo-audit");
const args = process.argv.slice(2);
function option(key) { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1]; }
if (args.includes("--help")) {
  console.log("node claudeOne/scripts/verify-seo.js --base-url http://127.0.0.1:3001 [--site-origin https://moufang.xyz]\n公开部署后将 --base-url 改为 https://moufang.xyz。退出 0 只表示技术检查通过，不代表已经收录。");
} else {
  audit({ baseUrl: option("--base-url"), siteOrigin: option("--site-origin") }).then(report => {
    console.log(JSON.stringify(report, null, 2)); process.exitCode = report.ok ? 0 : 1;
  }).catch(error => { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; });
}
