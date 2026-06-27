import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function getB4funAiHome() {
  const xdgHome = process.env.XDG_HOME;
  const xdgStateHome = process.env.XDG_STATE_HOME;
  const base =
    xdgHome ||
    xdgStateHome ||
    (process.platform === "darwin"
      ? path.join(os.homedir(), "Library", "Application Support")
      : path.join(os.homedir(), ".local", "state"));
  return path.join(base, "@b4fun-ai");
}

function safeSessionName(value) {
  return value.replace(/[^A-Za-z0-9._-]/g, "-").replace(/^-+|-+$/g, "") || "default";
}

export function getShellSessionDir() {
  const shellId = process.env.AI_SESSION_ID || String(process.ppid || "default");
  return path.join(getB4funAiHome(), "sessions", `shell-${safeSessionName(shellId)}`);
}

export function getConfigPath() {
  return path.join(getB4funAiHome(), "config.json");
}

export function readConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return {};

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to read config at ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
