#!/usr/bin/env node
"use strict";
const { verify } = require("../server/game-releases-verification");
const options = { "--report": "reportFile", "--input": "inputFile", "--image": "imageFile", "--url": "url" };
async function main() {
  const args = process.argv.slice(2), config = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--help") { process.stdout.write("Usage: node verify-game-releases.js --report PUBLISH_RESULT.json --input SITE.json --image POSTER.png --url https://your-site.example\n"); return; }
    const key = options[args[i]];
    if (!key || config[key] || !args[i + 1] || args[i + 1].startsWith("--")) throw new Error("未知、重复或缺少参数");
    config[key] = args[++i];
  }
  for (const key of Object.values(options)) if (!config[key]) throw new Error("缺少必需参数；使用 --help 查看用法");
  process.stdout.write(JSON.stringify(await verify(config)) + "\n");
}
main().catch(error => { process.stderr.write("网站验证失败：" + error.message + "\n"); process.exitCode = 1; });
