export const VALID_THINKING_LEVELS = new Set(["off", "minimal", "low", "medium", "high", "xhigh"]);

export function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function validateThinkingLevel(value, source) {
  if (value === undefined || value === null || value === "") return undefined;
  const level = String(value);
  if (!VALID_THINKING_LEVELS.has(level)) {
    throw new Error(`Invalid thinking level ${JSON.stringify(level)} in ${source}. Valid values: ${Array.from(VALID_THINKING_LEVELS).join(", ")}`);
  }
  return level;
}

export function getAliasMap(config) {
  return {
    ...(isPlainObject(config.aliases) ? config.aliases : {}),
    ...(isPlainObject(config.modelAliases) ? config.modelAliases : {}),
  };
}

export function splitThinkingSuffix(spec) {
  const value = String(spec);
  const separatorIndex = value.lastIndexOf(":");
  if (separatorIndex <= 0) return { modelSpec: value, thinkingLevel: undefined };

  const suffix = value.slice(separatorIndex + 1);
  if (!VALID_THINKING_LEVELS.has(suffix)) return { modelSpec: value, thinkingLevel: undefined };

  return {
    modelSpec: value.slice(0, separatorIndex),
    thinkingLevel: suffix,
  };
}

export function resolveConfiguredModel(config, requestedModel, requestedThinkingLevel) {
  const aliases = getAliasMap(config);
  const seenAliases = new Set();
  let thinkingLevel = validateThinkingLevel(config.thinking ?? config.defaultThinkingLevel, "config");
  let thinkingPriority = 0;

  const cliThinkingLevel = validateThinkingLevel(requestedThinkingLevel, "CLI --thinking");
  if (cliThinkingLevel !== undefined) {
    thinkingLevel = cliThinkingLevel;
    thinkingPriority = 3;
  }

  function setThinking(nextLevel, priority, source) {
    const validated = validateThinkingLevel(nextLevel, source);
    if (validated !== undefined && thinkingPriority < priority) {
      thinkingLevel = validated;
      thinkingPriority = priority;
    }
  }

  function resolveSpec(spec) {
    if (spec === undefined || spec === null || spec === "") return undefined;

    if (isPlainObject(spec)) {
      setThinking(spec.thinking ?? spec.thinkingLevel, 1, "model config");
      return resolveSpec(spec.model);
    }

    const { modelSpec, thinkingLevel: suffixThinkingLevel } = splitThinkingSuffix(spec);
    setThinking(suffixThinkingLevel, 2, `model spec ${JSON.stringify(String(spec))}`);

    const alias = aliases[modelSpec];
    if (alias === undefined) return modelSpec;

    if (seenAliases.has(modelSpec)) {
      throw new Error(`Model alias cycle detected: ${Array.from(seenAliases).concat(modelSpec).join(" -> ")}`);
    }

    seenAliases.add(modelSpec);
    const resolved = resolveSpec(alias);
    seenAliases.delete(modelSpec);
    return resolved;
  }

  return {
    modelSpec: resolveSpec(requestedModel ?? config.model ?? config.defaultModel),
    thinkingLevel,
  };
}
