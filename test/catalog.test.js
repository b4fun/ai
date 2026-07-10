import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getRegistryCatalogPath, parseCatalogIndex, parseProviderModels, refreshCatalog } from "../src/catalog.js";
import { AuthStorage, ModelRegistry } from "@earendil-works/pi-coding-agent";

const node = process.execPath;
const cli = new URL("../bin/ai.js", import.meta.url).pathname;

test("parses generated catalog index and provider model objects", () => {
  const index = parseCatalogIndex(`
    import { OPENAI_CODEX_MODELS } from "./providers/openai-codex.models.ts";
    export const MODELS = { "openai-codex": OPENAI_CODEX_MODELS } as const;
  `);
  assert.deepEqual(index, [{ provider: "openai-codex", sourcePath: "providers/openai-codex.models.ts" }]);

  const models = parseProviderModels(`
    export const OPENAI_CODEX_MODELS = {
      "gpt-5.6-terra": {
        id: "gpt-5.6-terra", name: "GPT-5.6 Terra", api: "openai-codex-responses",
        provider: "openai-codex", baseUrl: "https://chatgpt.com/backend-api", compat: { supportsToolSearch: true }, reasoning: true,
        thinkingLevelMap: { "xhigh": "xhigh", "max": "max" }, input: ["text", "image"],
        cost: { input: 2.5, output: 15, cacheRead: 0.25, cacheWrite: 3.125,
          tiers: [{ inputTokensAbove: 272000, input: 5, output: 22.5, cacheRead: 0.5, cacheWrite: 6.25 }] },
        contextWindow: 372000, maxTokens: 128000,
      } satisfies Model<"openai-codex-responses">,
    } as const;
  `);
  assert.equal(models[0].id, "gpt-5.6-terra");
});

test("loads generated compatibility, tiered costs, and future thinking metadata", async () => {
  const previousXdgHome = process.env.XDG_HOME;
  const xdgHome = fs.mkdtempSync(path.join(os.tmpdir(), "ai-catalog-refresh-"));
  process.env.XDG_HOME = xdgHome;
  const indexSource = `
    import { OPENAI_CODEX_MODELS } from "./providers/openai-codex.models.ts";
    export const MODELS = { "openai-codex": OPENAI_CODEX_MODELS } as const;
  `;
  const providerSource = `
    export const OPENAI_CODEX_MODELS = {
      terra: {
        id: "terra", name: "Terra", api: "openai-codex-responses", provider: "openai-codex",
        baseUrl: "https://example.test", compat: { supportsToolSearch: true }, reasoning: true,
        thinkingLevelMap: { xhigh: "xhigh", max: "max" }, input: ["text"],
        cost: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 0.2,
          tiers: [{ inputTokensAbove: 100, input: 2, output: 4, cacheRead: 0.2, cacheWrite: 0.4 }] },
        contextWindow: 200, maxTokens: 100,
      } satisfies Model<"openai-codex-responses">,
    } as const;
  `;
  const fetchImpl = async (url) => ({
    ok: true,
    text: async () => url.endsWith("models.generated.ts") ? indexSource : providerSource,
  });

  try {
    await refreshCatalog({ fetchImpl });
    const registry = ModelRegistry.create(AuthStorage.create(), getRegistryCatalogPath());
    const model = registry.find("openai-codex", "terra");
    assert.equal(registry.getError(), undefined);
    assert.deepEqual(model.compat, { supportsToolSearch: true });
    assert.equal(model.cost.tiers[0].inputTokensAbove, 100);
    assert.equal(model.thinkingLevelMap.max, "max");
  } finally {
    if (previousXdgHome === undefined) delete process.env.XDG_HOME;
    else process.env.XDG_HOME = previousXdgHome;
  }
});

test("lists models from the cached dynamic catalog", () => {
  const xdgHome = fs.mkdtempSync(path.join(os.tmpdir(), "ai-catalog-"));
  const catalogDir = path.join(xdgHome, "@b4fun-ai", "catalog");
  fs.mkdirSync(catalogDir, { recursive: true });
  fs.writeFileSync(path.join(catalogDir, "models.json"), `${JSON.stringify({
    providers: {
      "openai-codex": {
        models: [{
          id: "gpt-5.6-terra", name: "GPT-5.6 Terra", api: "openai-codex-responses",
          baseUrl: "https://chatgpt.com/backend-api", reasoning: true, input: ["text", "image"],
          cost: { input: 2.5, output: 15, cacheRead: 0.25, cacheWrite: 3.125 }, contextWindow: 372000, maxTokens: 128000,
        }],
      },
    },
  })}\n`);
  const piAgentDir = path.join(xdgHome, "pi-agent");
  fs.mkdirSync(piAgentDir, { recursive: true });
  fs.writeFileSync(path.join(piAgentDir, "models.json"), `{
    // pi accepts comments and trailing commas in models.json.
    "providers": {
      "openai-codex": { "models": [{ "id": "gpt-5.6-terra", "name": "My Terra" }], },
    },
  }\n`);

  const output = execFileSync(node, [cli, "models", "--all"], {
    encoding: "utf8",
    env: {
      ...process.env,
      XDG_HOME: xdgHome,
      PI_CODING_AGENT_DIR: piAgentDir,
      B4FUN_AI_CATALOG_REFRESH: "1",
    },
  });
  assert.match(output, /openai-codex\/gpt-5\.6-terra/);
  assert.match(output, /My Terra/);
});
