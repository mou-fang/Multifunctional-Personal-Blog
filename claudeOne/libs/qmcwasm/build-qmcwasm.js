// build-qmcwasm.js - one-shot bundler that wraps the upstream
// @clamber_l/crypto loader-inline.js (CommonJS) into a browser-friendly
// IIFE that exposes the bindings on globalThis.ClaudeOneQQWasm.
//
// Run once after updating the upstream package.  The output is committed so
// the page itself doesn't need a build step at deploy time.
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "loader-inline.js");
const DST = path.join(__dirname, "qmcwasm.js");

const inline = fs.readFileSync(SRC, "utf8");

const HEADER = `/* eslint-disable */
// AUTO-GENERATED — do not edit by hand.
// Source: @clamber_l/crypto / @unlock-music/crypto loader-inline.js
// License: MIT + Apache-2.0 (see LICENSE_MIT, LICENSE_APACHE)
//
// This file wraps the upstream CommonJS loader so the unlock-music WASM
// bindings (QMC2 / QMCFooter / NCMFile / KWMDecipher / etc.) are reachable
// from regular <script> tags as window.ClaudeOneQQWasm.<class>.
//
// Used by qq-music-decrypt.js as a fallback when our native cipher pipeline
// can't recover a known audio header from a musicex / mflac / mgg file.
(function (global) {
  "use strict";
  var module = { exports: {} };
  var exports = module.exports;

`;

const FOOTER = `

  global.ClaudeOneQQWasm = module.exports;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
`;

fs.writeFileSync(DST, HEADER + inline + FOOTER, "utf8");
console.log("wrote", DST, "(" + fs.statSync(DST).size + " bytes)");
