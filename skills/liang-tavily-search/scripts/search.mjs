#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function usage() {
  console.error(`Usage: search.mjs "query" [options]

Options:
  -n <count>              Number of results (1-20, default: 10)
  --depth <mode>           Search depth: ultra-fast, fast, basic, advanced (default: basic)
  --topic <topic>          Topic: general or news (default: general)
  --time-range <range>      Time range: day, week, month, year
  --include-domains <list>  Comma-separated domains to include
  --exclude-domains <list>  Comma-separated domains to exclude
  --raw-content            Include full page content
  --json                   Output raw JSON

Auth:
  Reads keys from TAVILY_API_KEYS, TAVILY_API_KEY, or ~/.openclaw/openclaw.json
  and automatically rotates to the next key when one is unavailable or exhausted.

Examples:
  search.mjs "python async patterns"
  search.mjs "React hooks tutorial" -n 10
  search.mjs "AI news" --topic news --time-range week
  search.mjs "Python docs" --include-domains docs.python.org,realpython.com`);
  process.exit(2);
}

const OPENCLAW_CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH?.trim() || path.join(os.homedir(), ".openclaw", "openclaw.json");
const TAVILY_STATE_PATH = process.env.TAVILY_KEY_STATE_PATH?.trim() || path.join(os.homedir(), ".openclaw", "state", "tavily-key-pool.json");
const TAVILY_SKILL_IDS = ["liang-tavily-search", "tavily-search"];

function parseKeyList(value) {
  return String(value ?? "")
    .split(/[\n,\r]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function dedupeKeys(keys) {
  const seen = new Set();
  return keys.filter((key) => {
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function keyFingerprint(apiKey) {
  return crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
}

function clampIndex(index, length) {
  if (!Number.isInteger(index) || length <= 0) return 0;
  return ((index % length) + length) % length;
}

async function readJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function loadOpenClawKeys() {
  const config = await readJsonFile(OPENCLAW_CONFIG_PATH);
  const entries = config?.skills?.entries;
  if (!entries || typeof entries !== "object") {
    return [];
  }

  const keys = [];
  for (const skillId of TAVILY_SKILL_IDS) {
    const entry = entries[skillId];
    if (!entry || typeof entry !== "object") continue;
    keys.push(...parseKeyList(entry.apiKeys));
    if (typeof entry.apiKey === "string" && entry.apiKey.trim()) {
      keys.push(entry.apiKey.trim());
    }
  }
  return dedupeKeys(keys);
}

async function loadTavilyKeys() {
  const envMulti = parseKeyList(process.env.TAVILY_API_KEYS);
  if (envMulti.length > 0) {
    return envMulti;
  }

  const envSingle = parseKeyList(process.env.TAVILY_API_KEY);
  if (envSingle.length > 0) {
    return envSingle;
  }

  return loadOpenClawKeys();
}

async function loadKeyState(keys) {
  const next = (await readJsonFile(TAVILY_STATE_PATH)) ?? {};
  const knownFingerprints = new Set(keys.map((apiKey) => keyFingerprint(apiKey)));
  const keyStates = {};
  const existing = next.keyStates && typeof next.keyStates === "object" ? next.keyStates : {};

  for (const [fingerprint, state] of Object.entries(existing)) {
    if (!knownFingerprints.has(fingerprint)) continue;
    if (!state || typeof state !== "object") continue;
    keyStates[fingerprint] = state;
  }

  return {
    version: 1,
    activeIndex: clampIndex(next.activeIndex, keys.length),
    keyStates,
  };
}

async function saveKeyState(state) {
  await writeJsonFile(TAVILY_STATE_PATH, state);
}

function nextMonthStartTs() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
}

function classifyKeyFailure(status, message) {
  const text = String(message ?? "").toLowerCase();
  const mentionsQuota =
    text.includes("quota") ||
    text.includes("credit") ||
    text.includes("monthly") ||
    text.includes("limit exceeded") ||
    text.includes("usage limit") ||
    text.includes("exhaust");
  const mentionsRateLimit = text.includes("rate limit") || text.includes("too many requests");
  const mentionsAuth =
    text.includes("unauthorized") ||
    text.includes("invalid api key") ||
    text.includes("invalid key") ||
    text.includes("forbidden");

  if (status === 400 || status === 422) {
    return { rotate: false, reason: "request_invalid", disabledUntil: null };
  }

  if (mentionsQuota || status === 402) {
    return { rotate: true, reason: "quota_exhausted", disabledUntil: nextMonthStartTs() };
  }

  if (mentionsAuth || status === 401 || status === 403) {
    return { rotate: true, reason: "auth_error", disabledUntil: Date.now() + 24 * 60 * 60 * 1000 };
  }

  if (mentionsRateLimit || status === 429) {
    return { rotate: true, reason: "rate_limited", disabledUntil: Date.now() + 10 * 60 * 1000 };
  }

  if (status >= 500) {
    return { rotate: true, reason: "server_error", disabledUntil: Date.now() + 2 * 60 * 1000 };
  }

  return { rotate: false, reason: "request_failed", disabledUntil: null };
}

function buildCandidateOrder(length, activeIndex) {
  return Array.from({ length }, (_, offset) => clampIndex(activeIndex + offset, length));
}

async function searchWithKey(body, apiKey) {
  const resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const error = new Error(`Tavily Search failed (${resp.status}): ${text}`);
    error.status = resp.status;
    error.responseText = text;
    throw error;
  }

  return resp.json();
}

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === "-h" || args[0] === "--help") usage();

const query = args[0];
let maxResults = 10;
let searchDepth = "basic";
let topic = "general";
let timeRange = null;
let includeDomains = [];
let excludeDomains = [];
let includeRawContent = false;
let outputJson = false;

for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a === "-n") {
    maxResults = Number.parseInt(args[i + 1] ?? "10", 10);
    i++;
    continue;
  }
  if (a === "--depth") {
    searchDepth = args[i + 1] ?? "basic";
    i++;
    continue;
  }
  if (a === "--topic") {
    topic = args[i + 1] ?? "general";
    i++;
    continue;
  }
  if (a === "--time-range") {
    timeRange = args[i + 1];
    i++;
    continue;
  }
  if (a === "--include-domains") {
    includeDomains = (args[i + 1] ?? "").split(",").map(d => d.trim()).filter(Boolean);
    i++;
    continue;
  }
  if (a === "--exclude-domains") {
    excludeDomains = (args[i + 1] ?? "").split(",").map(d => d.trim()).filter(Boolean);
    i++;
    continue;
  }
  if (a === "--raw-content") {
    includeRawContent = true;
    continue;
  }
  if (a === "--json") {
    outputJson = true;
    continue;
  }
  console.error(`Unknown arg: ${a}`);
  usage();
}

const apiKeys = dedupeKeys(await loadTavilyKeys());
if (apiKeys.length === 0) {
  console.error("Error: no Tavily API key configured");
  console.error("Get your API key at https://tavily.com");
  console.error(`Expected one of: TAVILY_API_KEYS, TAVILY_API_KEY, or ${OPENCLAW_CONFIG_PATH}`);
  process.exit(1);
}

const body = {
  query: query,
  max_results: Math.max(1, Math.min(maxResults, 20)),
  search_depth: searchDepth,
  topic: topic,
  include_raw_content: includeRawContent,
};

if (timeRange) body.time_range = timeRange;
if (includeDomains.length > 0) body.include_domains = includeDomains;
if (excludeDomains.length > 0) body.exclude_domains = excludeDomains;

const keyState = await loadKeyState(apiKeys);
const attempts = [];
let data = null;
let lastError = null;

for (const index of buildCandidateOrder(apiKeys.length, keyState.activeIndex)) {
  const apiKey = apiKeys[index];
  const fingerprint = keyFingerprint(apiKey);
  const existingState = keyState.keyStates[fingerprint];
  if (existingState?.disabledUntil && Number(existingState.disabledUntil) > Date.now()) {
    attempts.push(`${fingerprint}:blocked:${existingState.reason ?? "unknown"}`);
    continue;
  }

  try {
    data = await searchWithKey(body, apiKey);
    keyState.activeIndex = index;
    delete keyState.keyStates[fingerprint];
    await saveKeyState(keyState);
    break;
  } catch (error) {
    lastError = error;
    const status = Number(error?.status ?? 0);
    const responseText = String(error?.responseText ?? error?.message ?? "");
    const failure = classifyKeyFailure(status, responseText);
    attempts.push(`${fingerprint}:${failure.reason}`);

    if (!failure.rotate) {
      throw error;
    }

    keyState.keyStates[fingerprint] = {
      reason: failure.reason,
      disabledUntil: failure.disabledUntil,
      lastFailedAt: Date.now(),
      lastStatus: status || null,
    };
    await saveKeyState(keyState);
  }
}

if (!data) {
  const summary = attempts.length > 0 ? ` Tried keys: ${attempts.join(", ")}.` : "";
  if (lastError) {
    throw new Error(`${lastError.message}${summary}`);
  }
  throw new Error(`Tavily Search failed: no usable API key available.${summary}`);
}

if (outputJson) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

// Print AI answer if available
if (data.answer) {
  console.log("## Answer\n");
  console.log(data.answer);
  console.log("\n---\n");
}

// Print results
const results = (data.results ?? []).slice(0, maxResults);
console.log(`## Sources (${results.length} results)\n`);

for (const r of results) {
  const title = String(r?.title ?? "").trim();
  const url = String(r?.url ?? "").trim();
  const content = String(r?.content ?? "").trim();
  const score = r?.score ? ` (relevance: ${(r.score * 100).toFixed(0)}%)` : "";

  if (!title || !url) continue;

  console.log(`- **${title}**${score}`);
  console.log(`  ${url}`);
  if (content) {
    console.log(`  ${content.slice(0, 300)}${content.length > 300 ? "..." : ""}`);
  }
  console.log();
}

if (data.response_time) {
  console.log(`\nResponse time: ${data.response_time}s`);
}
