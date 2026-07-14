"use strict";

const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");

const DEFAULT_ONLINE_WINDOW_MS = 70 * 1000;
const VISITOR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BOT_USER_AGENT_PATTERN = /bot\b|crawl|spider|slurp|bingpreview|facebookexternalhit|twitterbot|linkedinbot|discordbot|telegrambot|whatsapp|headless|lighthouse|pagespeed|google-inspectiontool|curl\b|wget\b|python-requests|postmanruntime|insomnia|node-fetch|axios\//i;

function isLikelyBot(userAgent) {
  const value = String(userAgent || "").trim();
  return !value || BOT_USER_AGENT_PATTERN.test(value);
}

function hasValidHumanSignals(signals) {
  if (!signals || typeof signals !== "object") return false;
  const width = Number(signals.screen?.width);
  const height = Number(signals.screen?.height);
  return signals.interaction === true &&
    signals.visibility === "visible" &&
    signals.webdriver === false &&
    Number(signals.languages) > 0 &&
    Number.isFinite(width) && width >= 200 && width <= 20000 &&
    Number.isFinite(height) && height >= 200 && height <= 20000;
}

function isSameSiteBrowserRequest(req) {
  const fetchSite = String(req.get("sec-fetch-site") || "").toLowerCase();
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) return false;

  const origin = req.get("origin");
  if (!origin) return true;
  try {
    const forwardedHost = String(req.get("x-forwarded-host") || "").split(",")[0].trim();
    const requestHost = forwardedHost || req.get("host");
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

function isLikelyHumanRequest(req) {
  if (isLikelyBot(req.get("user-agent"))) return false;
  if (!String(req.get("accept-language") || "").trim()) return false;
  if (!isSameSiteBrowserRequest(req)) return false;
  return hasValidHumanSignals(req.body?.signals);
}

class VisitorStore {
  constructor({ dataFile, onlineWindowMs = DEFAULT_ONLINE_WINDOW_MS, now = () => Date.now() }) {
    if (!dataFile) throw new Error("VisitorStore requires a dataFile");
    this.dataFile = dataFile;
    this.onlineWindowMs = onlineWindowMs;
    this.now = now;
    this.onlineVisitors = new Map();
    this.data = this.load();
    this.uniqueVisitors = new Set(this.data.uniqueVisitors);
  }

  createEmptyData() {
    return {
      version: 1,
      salt: crypto.randomBytes(32).toString("hex"),
      uniqueVisitors: [],
    };
  }

  load() {
    fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });
    if (!fs.existsSync(this.dataFile)) {
      const data = this.createEmptyData();
      this.save(data);
      return data;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.dataFile, "utf8"));
      if (!parsed || parsed.version !== 1 || !/^[0-9a-f]{64}$/i.test(parsed.salt || "") || !Array.isArray(parsed.uniqueVisitors)) {
        throw new Error("invalid visitor statistics data");
      }
      parsed.uniqueVisitors = parsed.uniqueVisitors.filter(function (value) {
        return /^[0-9a-f]{64}$/i.test(String(value));
      });
      return parsed;
    } catch (error) {
      const backup = `${this.dataFile}.invalid-${Date.now()}`;
      fs.renameSync(this.dataFile, backup);
      const data = this.createEmptyData();
      this.save(data);
      console.warn(`[visitors] Invalid data moved to ${backup}: ${error.message}`);
      return data;
    }
  }

  save(data = this.data) {
    const temporaryFile = `${this.dataFile}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryFile, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    try {
      fs.renameSync(temporaryFile, this.dataFile);
    } catch (error) {
      if (error.code !== "EEXIST" && error.code !== "EPERM") throw error;
      fs.rmSync(this.dataFile, { force: true });
      fs.renameSync(temporaryFile, this.dataFile);
    }
  }

  hashVisitorId(visitorId) {
    return crypto.createHmac("sha256", this.data.salt).update(visitorId).digest("hex");
  }

  pruneOnline(now = this.now()) {
    for (const [visitorHash, lastSeen] of this.onlineVisitors) {
      if (now - lastSeen > this.onlineWindowMs) this.onlineVisitors.delete(visitorHash);
    }
  }

  record(visitorId) {
    if (!VISITOR_ID_PATTERN.test(String(visitorId || ""))) {
      const error = new Error("invalid anonymous visitor id");
      error.code = "INVALID_VISITOR_ID";
      throw error;
    }

    const visitorHash = this.hashVisitorId(visitorId);
    const now = this.now();
    this.pruneOnline(now);

    if (!this.uniqueVisitors.has(visitorHash)) {
      this.uniqueVisitors.add(visitorHash);
      this.data.uniqueVisitors = Array.from(this.uniqueVisitors);
      this.save();
    }

    this.onlineVisitors.set(visitorHash, now);
    return this.snapshot(now);
  }

  snapshot(now = this.now()) {
    this.pruneOnline(now);
    return {
      totalVisitors: this.uniqueVisitors.size,
      onlineVisitors: this.onlineVisitors.size,
      updatedAt: new Date(now).toISOString(),
    };
  }
}

function createVisitorStatsRouter({ dataFile, onlineWindowMs, now } = {}) {
  const router = express.Router();
  const store = new VisitorStore({ dataFile, onlineWindowMs, now });

  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    next();
  });

  router.get("/", (_req, res) => {
    res.json({ success: true, ...store.snapshot() });
  });

  router.post("/heartbeat", (req, res) => {
    if (!isLikelyHumanRequest(req)) {
      return res.status(202).json({ success: true, counted: false, ...store.snapshot() });
    }

    try {
      const stats = store.record(String(req.body?.visitorId || ""));
      return res.json({ success: true, counted: true, ...stats });
    } catch (error) {
      if (error.code === "INVALID_VISITOR_ID") {
        return res.status(400).json({ success: false, error: "无效的匿名访客标识" });
      }
      throw error;
    }
  });

  return { router, store };
}

module.exports = {
  BOT_USER_AGENT_PATTERN,
  DEFAULT_ONLINE_WINDOW_MS,
  VISITOR_ID_PATTERN,
  VisitorStore,
  createVisitorStatsRouter,
  hasValidHumanSignals,
  isLikelyBot,
  isLikelyHumanRequest,
};
