import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Type } from "typebox";
import { resolveConfiguredModel } from "./model-config.js";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  defineTool,
  getAgentDir,
  ModelRegistry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

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

function resolveModel(modelRegistry, spec) {
  if (!spec) return undefined;

  const exactSeparator = spec.includes("/") ? "/" : spec.includes(":") ? ":" : undefined;
  if (exactSeparator) {
    const [provider, ...modelParts] = spec.split(exactSeparator);
    const modelId = modelParts.join(exactSeparator);
    const exact = modelRegistry.find(provider, modelId);
    if (exact) return exact;
    throw new Error(`Model not found: ${spec}`);
  }

  const matches = modelRegistry
    .getAll()
    .filter((model) => model.id === spec || model.id.includes(spec) || `${model.provider}/${model.id}`.includes(spec));

  if (matches.length === 1) return matches[0];
  if (matches.length === 0) throw new Error(`Model not found: ${spec}`);

  const choices = matches.slice(0, 10).map((model) => `${model.provider}/${model.id}`).join("\n  ");
  throw new Error(`Model is ambiguous: ${spec}\nMatching models:\n  ${choices}`);
}

function createB4funSystemPrompt({ configRoot, configPath, sessionDir }) {
  return `You are running inside @b4fun/ai-cli.

CLI/runtime facts:
- The direct CLI entry point is: ai prompt <ask llm>.
- Shell wrappers may forward to the real binary with command ai prompt <ask llm>.
- The CLI model flag (-m/--model) overrides the default model config for that invocation.
- The CLI thinking flag (--thinking) overrides config or alias thinking for that invocation.
- The shell integration helpers are available as: ai shell init <shell> and ai shell install <shell>.
- Auth helpers are available as: ai auth login [provider] and ai auth status [provider].
- The upgrade helper is available as: ai upgrade [version].
- The @b4fun/ai-cli config root is: ${configRoot}
- The default model config file is: ${configPath}
- The default model config JSON shape is: { "model": "provider/model-id" }. The legacy key { "defaultModel": "provider/model-id" } is also accepted.
- Model aliases can be configured with { "modelAliases": { "fast": "provider/model-id", "smart": { "model": "provider/model-id", "thinking": "high" } } }.
- Session logs for this shell are stored under: ${sessionDir}

Operational guidance:
- If the user asks to view, open, or edit ai settings/config/default model, use the paths above.
- If the user asks to set or change the default model, update ${configPath}, creating the parent directory if needed.
- If the user asks to add a model alias, update the modelAliases object in ${configPath}.
- If the user asks to open settings/config in an editor or asks to run an interactive/full-screen terminal program, use the foreground tool so the program attaches to the user's terminal.
- Use the normal bash tool for non-interactive commands whose output you need to inspect.
- Use the foreground tool for interactive commands such as vim, nvim, less, top, ssh, REPLs, or anything that needs direct stdin/stdout/stderr. The foreground tool only returns the exit code to you.`;
}

function createForegroundTool(cwd) {
  return defineTool({
    name: "foreground",
    label: "foreground",
    description:
      "Run an interactive command attached to the user's terminal in the foreground. Use this for terminal UI programs or commands that need stdin/stdout/stderr directly, such as vim, nvim, less, top, ssh, REPLs, or other interactive commands. The command runs in the current working directory. Because stdio is attached to the terminal, only the exit code is returned to the LLM.",
    promptSnippet:
      "Run interactive foreground commands attached to the user's terminal (vim, nvim, less, top, ssh, REPLs).",
    parameters: Type.Object({
      command: Type.String({ description: "Command to run in the foreground" }),
    }),
    execute: async (_toolCallId, { command }, signal) => {
      if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stderr.isTTY) {
        throw new Error("Foreground commands require an interactive TTY.");
      }

      const shell = process.env.SHELL || "/bin/sh";
      const child = spawn(shell, ["-lc", command], {
        cwd,
        env: process.env,
        stdio: "inherit",
      });

      const onAbort = () => child.kill("SIGTERM");
      signal?.addEventListener("abort", onAbort, { once: true });

      try {
        const exitCode = await new Promise((resolve, reject) => {
          child.once("error", reject);
          child.once("exit", (code) => resolve(code));
        });

        if (signal?.aborted) throw new Error("Foreground command aborted");
        if (exitCode !== 0 && exitCode !== null) {
          throw new Error(`Foreground command exited with code ${exitCode}`);
        }

        return {
          content: [{ type: "text", text: `Foreground command exited with code ${exitCode ?? 0}` }],
          details: { exitCode },
        };
      } finally {
        signal?.removeEventListener("abort", onAbort);
      }
    },
  });
}

function textFromToolResult(result) {
  const content = result?.content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((item) => item?.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n");
}

/**
 * Send one ask-LLM prompt to pi coding agent and stream the assistant text.
 *
 * Sessions are persisted under XDG_HOME/@b4fun-ai when XDG_HOME is set,
 * otherwise XDG_STATE_HOME/@b4fun-ai or ~/.local/state/@b4fun-ai. Invocations
 * from the same parent shell process continue the most recent session for the
 * current working directory.
 *
 * Note: pi's bash tool is still captured so the LLM can read command output.
 * The tool events can be mirrored to the terminal with the onTool* callbacks.
 *
 * @param {string} askLlm
 * @param {{
 *   write?: (chunk: string) => void,
 *   sessionDir?: string,
 *   cwd?: string,
 *   model?: string,
 *   thinkingLevel?: string,
 *   onModel?: (model: { provider: string, id: string, thinkingLevel?: string }) => void,
 *   onToolStart?: (tool: { id: string, name: string, args: unknown }) => void,
 *   onToolOutput?: (tool: { id: string, name: string, chunk: string }) => void,
 *   onToolEnd?: (tool: { id: string, name: string, isError: boolean }) => void,
 * }} [options]
 * @returns {Promise<string>} full assistant response text
 */
export async function ask(askLlm, options = {}) {
  const text = askLlm.trim();
  if (!text) throw new Error("An <ask llm> prompt is required.");

  const write = options.write ?? (() => {});
  const cwd = options.cwd ?? process.cwd();
  const sessionDir = options.sessionDir ?? getShellSessionDir();
  const configPath = getConfigPath();
  const configRoot = getB4funAiHome();
  const config = readConfig();
  const { modelSpec, thinkingLevel } = resolveConfiguredModel(config, options.model, options.thinkingLevel);
  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);
  const model = resolveModel(modelRegistry, modelSpec);
  const sessionManager = SessionManager.continueRecent(cwd, sessionDir);
  const hadExistingSession = sessionManager.buildSessionContext().messages.length > 0;
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir: getAgentDir(),
    appendSystemPrompt: [createB4funSystemPrompt({ configRoot, configPath, sessionDir })],
  });
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    cwd,
    sessionManager,
    authStorage,
    modelRegistry,
    model,
    thinkingLevel,
    resourceLoader,
    customTools: [createForegroundTool(cwd)],
    tools: ["read", "bash", "edit", "write", "foreground"],
  });

  if (model && hadExistingSession) {
    sessionManager.appendModelChange(model.provider, model.id);
  }

  if (thinkingLevel !== undefined && hadExistingSession) {
    sessionManager.appendThinkingLevelChange(session.thinkingLevel);
  }

  if (session.model) {
    options.onModel?.({ provider: session.model.provider, id: session.model.id, thinkingLevel: session.thinkingLevel });
  }

  let response = "";
  const toolOutputById = new Map();
  const unsubscribe = session.subscribe((event) => {
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent?.type === "text_delta"
    ) {
      response += event.assistantMessageEvent.delta;
      write(event.assistantMessageEvent.delta);
      return;
    }

    if (event.type === "tool_execution_start") {
      toolOutputById.set(event.toolCallId, "");
      options.onToolStart?.({
        id: event.toolCallId,
        name: event.toolName,
        args: event.args,
      });
      return;
    }

    if (event.type === "tool_execution_update") {
      const next = textFromToolResult(event.partialResult);
      const previous = toolOutputById.get(event.toolCallId) ?? "";
      const chunk = next.startsWith(previous) ? next.slice(previous.length) : next;
      toolOutputById.set(event.toolCallId, next);
      if (chunk) {
        options.onToolOutput?.({
          id: event.toolCallId,
          name: event.toolName,
          chunk,
        });
      }
      return;
    }

    if (event.type === "tool_execution_end") {
      const previous = toolOutputById.get(event.toolCallId) ?? "";
      const finalText = textFromToolResult(event.result);
      const chunk = finalText.startsWith(previous) ? finalText.slice(previous.length) : "";
      if (chunk) {
        options.onToolOutput?.({
          id: event.toolCallId,
          name: event.toolName,
          chunk,
        });
      }
      toolOutputById.delete(event.toolCallId);
      options.onToolEnd?.({
        id: event.toolCallId,
        name: event.toolName,
        isError: event.isError,
      });
    }
  });

  try {
    await session.prompt(text);
    return response;
  } finally {
    unsubscribe();
    session.dispose();
  }
}
