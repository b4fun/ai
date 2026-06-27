import assert from "node:assert/strict";
import test from "node:test";
import {
  getAliasMap,
  resolveConfiguredModel,
  splitThinkingSuffix,
  validateThinkingLevel,
} from "../src/model-config.js";

test("merges legacy aliases and modelAliases with modelAliases taking precedence", () => {
  assert.deepEqual(getAliasMap({
    aliases: { fast: "provider/old", cheap: "provider/cheap" },
    modelAliases: { fast: "provider/new" },
  }), {
    cheap: "provider/cheap",
    fast: "provider/new",
  });
});

test("splits model:thinking shorthand only for valid thinking suffixes", () => {
  assert.deepEqual(splitThinkingSuffix("smart:high"), {
    modelSpec: "smart",
    thinkingLevel: "high",
  });
  assert.deepEqual(splitThinkingSuffix("provider/model:medium"), {
    modelSpec: "provider/model",
    thinkingLevel: "medium",
  });
  assert.deepEqual(splitThinkingSuffix("provider:model"), {
    modelSpec: "provider:model",
    thinkingLevel: undefined,
  });
});

test("resolves default model aliases from config", () => {
  assert.deepEqual(resolveConfiguredModel({
    model: "fast",
    modelAliases: {
      fast: "github-copilot/gpt-5.4-mini",
    },
  }), {
    modelSpec: "github-copilot/gpt-5.4-mini",
    thinkingLevel: undefined,
  });
});

test("resolves object aliases with thinking level", () => {
  assert.deepEqual(resolveConfiguredModel({
    modelAliases: {
      smart: {
        model: "anthropic/claude-sonnet-4-5",
        thinking: "high",
      },
    },
  }, "smart"), {
    modelSpec: "anthropic/claude-sonnet-4-5",
    thinkingLevel: "high",
  });
});

test("supports alias chains", () => {
  assert.deepEqual(resolveConfiguredModel({
    modelAliases: {
      fast: "cheap",
      cheap: "github-copilot/gpt-5.4-mini",
    },
  }, "fast"), {
    modelSpec: "github-copilot/gpt-5.4-mini",
    thinkingLevel: undefined,
  });
});

test("thinking precedence is config, alias, shorthand, then CLI", () => {
  const config = {
    thinking: "low",
    modelAliases: {
      smart: {
        model: "anthropic/claude-sonnet-4-5",
        thinking: "high",
      },
    },
  };

  assert.equal(resolveConfiguredModel(config, "smart").thinkingLevel, "high");
  assert.equal(resolveConfiguredModel(config, "smart:medium").thinkingLevel, "medium");
  assert.equal(resolveConfiguredModel(config, "smart:medium", "xhigh").thinkingLevel, "xhigh");
});

test("detects alias cycles", () => {
  assert.throws(() => resolveConfiguredModel({
    modelAliases: {
      a: "b",
      b: "a",
    },
  }, "a"), /Model alias cycle detected: a -> b -> a/);
});

test("validates thinking levels", () => {
  assert.equal(validateThinkingLevel("minimal", "test"), "minimal");
  assert.equal(validateThinkingLevel(undefined, "test"), undefined);
  assert.throws(() => validateThinkingLevel("huge", "test"), /Invalid thinking level "huge"/);
});
