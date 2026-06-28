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

export function getShellProfilePath(sessionDir = getShellSessionDir()) {
  return path.join(sessionDir, "active-profile.json");
}

export function readShellProfileState(sessionDir = getShellSessionDir()) {
  const profilePath = getShellProfilePath(sessionDir);
  if (!fs.existsSync(profilePath)) return {};

  try {
    const data = JSON.parse(fs.readFileSync(profilePath, "utf8"));
    return {
      profile: typeof data.profile === "string" && data.profile ? data.profile : undefined,
      forkSession: data.forkSession === true,
    };
  } catch {
    return {};
  }
}

export function readShellProfile(sessionDir = getShellSessionDir()) {
  return readShellProfileState(sessionDir).profile;
}

export function writeShellProfile(profile, optionsOrSessionDir = {}, maybeSessionDir) {
  const options = typeof optionsOrSessionDir === "string" ? {} : optionsOrSessionDir;
  const sessionDir = typeof optionsOrSessionDir === "string" ? optionsOrSessionDir : (maybeSessionDir ?? getShellSessionDir());
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(
    getShellProfilePath(sessionDir),
    `${JSON.stringify({ profile, forkSession: options.forkSession === true }, null, 2)}\n`,
    "utf8",
  );
}

export function clearShellProfileFork(sessionDir = getShellSessionDir()) {
  const state = readShellProfileState(sessionDir);
  if (!state.profile) return;
  writeShellProfile(state.profile, { forkSession: false }, sessionDir);
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
