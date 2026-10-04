#!/usr/bin/env node
"use strict";
const { publish } = require("../server/game-releases-store");
const options = { "--input": "inputFile", "--card-data": "cardFile", "--image": "imageFile", "--covers-dir": "coversDir", "--data-dir": "dataDir", "--timezone": "timeZone" };
async function main() {
  const args = process.argv.slice(2), config = {};
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--dry-run") { config.dryRun = true; continue; }
    if (args[index] === "--help") {
      process.stdout.write("Usage: node publish-game-releases.js --input SITE.json --card-data CARD.json --image POSTER.png --covers-dir COVERS [--data-dir PRIVATE_DIR] [--timezone Asia/Shanghai] [--dry-run]\n"); return;
    }
    const key = options[args[index]];
    if (!key || config[key] !== undefined || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error("未知、重复或缺少参数；使用 --help 查看用法");
    config[key] = args[++index];
  }
  for (const key of ["inputFile", "cardFile", "imageFile", "coversDir"]) if (!config[key]) throw new Error("缺少必需参数；使用 --help 查看用法");
  process.stdout.write(JSON.stringify(await publish(config)) + "\n");
}
main().catch(error => { process.stderr.write("发布失败：" + error.message + "\n"); process.exitCode = 1; });
