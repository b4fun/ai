import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getB4funAiHome } from "./config.js";

const CATALOG_REF = "main";
const CATALOG_URL = "https://raw.githubusercontent.com/earendil-works/pi-mono";
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const REFRESH_LOCK_TTL_MS = 5 * 60 * 1000;

export function getCatalogPath() {
  return path.join(getB4funAiHome(), "catalog", "models.json");
}

function getPiModelsPath() {
  return path.join(process.env.PI_CODING_AGENT_DIR || os.homedir(), process.env.PI_CODING_AGENT_DIR ? "models.json" : ".pi/agent/models.json");
}

function stripJsonComments(input) {
  return input
    .replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*/g, (match) => (match[0] === '"' ? match : ""))
    .replace(/"(?:\\.|[^"\\])*"|,(\s*[}\]])/g, (match, tail) => tail ?? (match[0] === '"' ? match : ""));
}

function writeJsonAtomically(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporaryPath, filePath);
}

/**
 * Combine the cached catalog with pi's existing custom models without changing
 * pi's files. Custom provider settings and duplicate model IDs take precedence.
 */
export function getRegistryCatalogPath() {
  const catalogPath = getCatalogPath();
  const registryPath = path.join(path.dirname(catalogPath), "registry-models.json");
  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  } catch {
    return getPiModelsPath();
  }

  let custom = {};
  try {
    custom = JSON.parse(stripJsonComments(fs.readFileSync(getPiModelsPath(), "utf8")));
  } catch {
    // pi will continue to report malformed custom configuration when used directly.
  }
  const customProviders = custom?.providers && typeof custom.providers === "object" ? custom.providers : {};
  const providers = { ...catalog.providers };
  for (const [provider, customConfig] of Object.entries(customProviders)) {
    const catalogConfig = providers[provider] ?? {};
    const customModels = Array.isArray(customConfig.models) ? customConfig.models : [];
    const customIds = new Set(customModels.map((model) => model?.id));
    providers[provider] = {
      ...catalogConfig,
      ...customConfig,
      models: [...(catalogConfig.models ?? []).filter((model) => !customIds.has(model.id)), ...customModels],
    };
  }
  writeJsonAtomically(registryPath, { providers });
  return registryPath;
}

function getRefreshStampPath() {
  return path.join(getB4funAiHome(), "catalog", "last-refresh");
}

function findObjectEnd(source, start) {
  let depth = 0;
  let quote;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = undefined;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  throw new Error("Unterminated model catalog object");
}

function parseJsonLikeObject(source) {
  const withoutAssertions = source
    .replace(/\s+satisfies\s+Model<[^>]+>/g, "")
    .replace(/,\s*([}\]])/g, "$1");
  let normalized = "";
  let quote;
  let escaped = false;
  for (let index = 0; index < withoutAssertions.length; index += 1) {
    const char = withoutAssertions[index];
    if (quote) {
      normalized += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = undefined;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      normalized += char;
      continue;
    }
    if (char === "{" || char === ",") {
      const key = /^(\s*)([A-Za-z_$][A-Za-z0-9_$]*)(\s*:)/.exec(withoutAssertions.slice(index + 1));
      if (key) {
        normalized += `${char}${key[1]}"${key[2]}"${key[3]}`;
        index += key[0].length;
        continue;
      }
    }
    normalized += char;
  }
  return JSON.parse(normalized);
}

/** Parse the generated catalog index into provider source paths. */
export function parseCatalogIndex(source) {
  const imports = new Map();
  for (const match of source.matchAll(/import\s*\{\s*(\w+)\s*\}\s*from\s*"\.\/(providers\/[^"\n]+)";/g)) {
    imports.set(match[1], match[2]);
  }

  const modelsMatch = /export const MODELS\s*=\s*\{([\s\S]*?)\}\s*as const/.exec(source);
  if (!modelsMatch) throw new Error("Could not find MODELS in generated catalog");

  return [...modelsMatch[1].matchAll(/"([^"]+)"\s*:\s*(\w+)/g)].map(([, provider, identifier]) => {
    const sourcePath = imports.get(identifier);
    if (!sourcePath) throw new Error(`Missing source import for provider ${provider}`);
    return { provider, sourcePath };
  });
}

/** Parse one generated provider module. Its exported object is JSON plus TypeScript assertions. */
export function parseProviderModels(source) {
  const assignment = /export const \w+\s*=\s*\{/.exec(source);
  if (!assignment) throw new Error("Could not find provider model object");
  const start = assignment.index + assignment[0].lastIndexOf("{");
  return Object.values(parseJsonLikeObject(source.slice(start, findObjectEnd(source, start))));
}

function catalogRequestUrl(sourcePath, ref = CATALOG_REF) {
  return `${CATALOG_URL}/${encodeURIComponent(ref)}/packages/ai/src/${sourcePath}`;
}

function toCatalogModel(model) {
  const result = {
    id: model.id,
    name: model.name,
    api: model.api,
    baseUrl: model.baseUrl,
    headers: model.headers,
    compat: model.compat,
    reasoning: model.reasoning,
    input: model.input,
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens,
  };
  if (model.cost) {
    result.cost = {
      input: model.cost.input,
      output: model.cost.output,
      cacheRead: model.cost.cacheRead,
      cacheWrite: model.cost.cacheWrite,
      tiers: model.cost.tiers,
    };
  }
  if (model.thinkingLevelMap) {
    result.thinkingLevelMap = Object.fromEntries(
      Object.entries(model.thinkingLevelMap).filter(([level]) => ["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(level)),
    );
  }
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined && value !== ""));
}

async function fetchText(url, fetchImpl) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Catalog request failed (${response.status}): ${url}`);
  return response.text();
}

export async function refreshCatalog({ fetchImpl = fetch, ref = CATALOG_REF } = {}) {
  const indexUrl = `${CATALOG_URL}/${encodeURIComponent(ref)}/packages/ai/src/models.generated.ts`;
  const index = parseCatalogIndex(await fetchText(indexUrl, fetchImpl));
  const entries = await Promise.all(index.map(async ({ provider, sourcePath }) => ({
    provider,
    models: parseProviderModels(await fetchText(catalogRequestUrl(sourcePath, ref), fetchImpl)).map(toCatalogModel),
  })));
  const providers = Object.fromEntries(entries.map(({ provider, models }) => [provider, { models }]));
  const catalogPath = getCatalogPath();
  writeJsonAtomically(catalogPath, { providers });
  fs.writeFileSync(getRefreshStampPath(), String(Date.now()), { mode: 0o600 });
  return { providers: entries.length, models: entries.reduce((total, entry) => total + entry.models.length, 0) };
}

function shouldRefresh() {
  try {
    const lastRefresh = Number(fs.readFileSync(getRefreshStampPath(), "utf8"));
    return !Number.isFinite(lastRefresh) || Date.now() - lastRefresh >= REFRESH_INTERVAL_MS;
  } catch {
    return true;
  }
}

function getRefreshLockPath() {
  return path.join(getB4funAiHome(), "catalog", "refresh.lock");
}

function acquireRefreshLock() {
  const lockPath = getRefreshLockPath();
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  try {
    const age = Date.now() - fs.statSync(lockPath).mtimeMs;
    if (age < REFRESH_LOCK_TTL_MS) return false;
    fs.unlinkSync(lockPath);
  } catch (error) {
    if (error?.code !== "ENOENT") return false;
  }
  try {
    fs.writeFileSync(lockPath, `${process.pid}\n`, { flag: "wx", mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}

export function releaseCatalogRefreshLock() {
  try {
    fs.unlinkSync(getRefreshLockPath());
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

/** Start an unobserved refresh. The current invocation always uses the last valid cache. */
export function startCatalogRefresh() {
  if (!shouldRefresh() || process.env.B4FUN_AI_CATALOG_REFRESH === "1" || !acquireRefreshLock()) return;
  const isSea = process.versions.sea !== undefined;
  const args = isSea ? ["--refresh-model-catalog"] : [process.argv[1], "--refresh-model-catalog"];
  try {
    const child = spawn(process.execPath, args, {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, B4FUN_AI_CATALOG_REFRESH: "1" },
    });
    child.unref();
  } catch {
    releaseCatalogRefreshLock();
  }
}
