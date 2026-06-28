import fs from "node:fs";
import path from "node:path";
import { getConfigPath } from "./config.js";
import { isPlainObject } from "./model-config.js";

function asStringArray(value, fieldName) {
  if (value === undefined) return undefined;
  if (typeof value === "string") return [value];
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value;
  throw new Error(`${fieldName} must be a string or an array of strings.`);
}

function asOptionalString(value, fieldName) {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  throw new Error(`${fieldName} must be a string.`);
}

function asOptionalStringArray(value, fieldName) {
  if (value === undefined) return undefined;
  if (Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0)) return value;
  throw new Error(`${fieldName} must be an array of non-empty strings.`);
}

export function getProfileName(config, requestedProfile) {
  return requestedProfile ?? config.profile ?? config.defaultProfile;
}

export function resolveProfile(config, requestedProfile) {
  const name = getProfileName(config, requestedProfile);
  if (!name) return { name: undefined, profile: {} };
  if (typeof name !== "string") throw new Error("Profile name must be a string.");

  const profiles = config.profiles;
  if (!isPlainObject(profiles)) throw new Error(`Profile not found: ${name}`);

  const profile = profiles[name];
  if (!isPlainObject(profile)) throw new Error(`Profile not found: ${name}`);

  // Validate supported fields early so typos in shape fail before launching the agent.
  asOptionalString(profile.promptFile, `profiles.${name}.promptFile`);
  asStringArray(profile.appendSystemPrompt, `profiles.${name}.appendSystemPrompt`);
  asOptionalStringArray(profile.tools, `profiles.${name}.tools`);

  return { name, profile };
}

export function resolveConfigRelativePath(filePath, configPath = getConfigPath()) {
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(path.dirname(configPath), filePath);
}

export function readProfilePromptFile(profile, configPath = getConfigPath()) {
  const promptFile = asOptionalString(profile.promptFile, "profile.promptFile");
  if (!promptFile) return undefined;

  const resolvedPath = resolveConfigRelativePath(promptFile, configPath);
  try {
    return fs.readFileSync(resolvedPath, "utf8").trim();
  } catch (error) {
    throw new Error(`Failed to read profile promptFile at ${resolvedPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function buildProfiledPrompt(userPrompt, profile, configPath = getConfigPath()) {
  const promptParts = [];
  const promptFileText = readProfilePromptFile(profile, configPath);
  if (promptFileText) promptParts.push(promptFileText);

  const trimmedUserPrompt = userPrompt.trim();
  if (trimmedUserPrompt) promptParts.push(trimmedUserPrompt);

  const text = promptParts.join("\n\n").trim();
  if (!text) throw new Error("An <ask llm> prompt is required.");
  return text;
}

export function getProfileAppendSystemPrompt(profile) {
  return asStringArray(profile.appendSystemPrompt, "profile.appendSystemPrompt") ?? [];
}

export function getProfileTools(profile) {
  return asOptionalStringArray(profile.tools, "profile.tools");
}
