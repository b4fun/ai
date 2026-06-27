#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ask } from "../src/index.js";

function parseGlobalOptions(argv) {
  let model;
  const rest = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      rest.push(...argv.slice(index + 1));
      return { model, rest };
    }

    if (arg === "-m" || arg === "--model") {
      model = argv[index + 1];
      if (!model) throw new Error(`${arg} requires a model value`);
      index += 1;
      continue;
    }

    if (arg.startsWith("--model=")) {
      model = arg.slice("--model=".length);
      if (!model) throw new Error("--model requires a model value");
      continue;
    }

    rest.push(...argv.slice(index));
    return { model, rest };
  }

  return { model, rest };
}

function parseShellCommand(argv) {
  let shell;
  let name = "ai";
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      positionals.push(...argv.slice(index + 1));
      break;
    }

    if (arg === "-s" || arg === "--shell") {
      shell = argv[index + 1];
      if (!shell) throw new Error(`${arg} requires a shell value`);
      index += 1;
      continue;
    }

    if (arg.startsWith("--shell=")) {
      shell = arg.slice("--shell=".length);
      if (!shell) throw new Error("--shell requires a shell value");
      continue;
    }

    if (arg === "-n" || arg === "--name") {
      name = argv[index + 1];
      if (!name) throw new Error(`${arg} requires a wrapper name`);
      index += 1;
      continue;
    }

    if (arg.startsWith("--name=")) {
      name = arg.slice("--name=".length);
      if (!name) throw new Error("--name requires a wrapper name");
      continue;
    }

    positionals.push(arg);
  }

  if (positionals.length > 2) {
    throw new Error(`Unexpected shell arguments: ${positionals.slice(2).join(" ")}`);
  }

  if (positionals.length > 1 && !shell) {
    shell = positionals[1];
  }

  return {
    action: positionals[0],
    shell,
    name,
  };
}

function inferShellName() {
  const shellPath = process.env.SHELL;
  return shellPath ? path.basename(shellPath) : undefined;
}

function normalizeShellName(value) {
  return String(value || "").trim().toLowerCase();
}

function sanitizeIdentifier(value) {
  const trimmed = String(value || "").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
    throw new Error(`Invalid wrapper name: ${value}`);
  }
  return trimmed;
}

function hiddenFunctionName(name) {
  const sanitized = sanitizeIdentifier(name);
  return `__b4fun_ai_${sanitized}`;
}

function getRcPath(shellName) {
  switch (normalizeShellName(shellName)) {
    case "zsh":
      return path.join(os.homedir(), ".zshrc");
    case "bash":
      return path.join(os.homedir(), ".bashrc");
    case "fish":
      return path.join(os.homedir(), ".config", "fish", "config.fish");
    default:
      throw new Error(`Unsupported shell: ${shellName}`);
  }
}

function createCommonWrapperBody(commandName) {
  return [
    "  local model=",
    "  while [ $# -gt 0 ]; do",
    "    case \"$1\" in",
    "      -m|--model)",
    "        if [ $# -lt 2 ]; then",
    "          printf '%s\\n' \"$1 requires a model value\" >&2",
    "          return 1",
    "        fi",
    "        model=$2",
    "        shift 2",
    "        ;;",
    '      --model=*)',
    '        model=${1#--model=}',
    "        shift",
    "        ;;",
    "      --)",
    "        shift",
    "        break",
    "        ;;",
    "      *)",
    "        break",
    "        ;;",
    "    esac",
    "  done",
    "",
    "  if [ -n \"$model\" ]; then",
    `    command ${commandName} -m \"$model\" prompt \"$@\"`,
    "  else",
    `    command ${commandName} prompt \"$@\"`,
    "  fi",
  ].join("\n");
}

function createShellSnippet(shellName, wrapperName) {
  const shell = normalizeShellName(shellName);
  const fnName = hiddenFunctionName(wrapperName);
  const commandName = "ai";

  if (shell === "zsh") {
    return [
      `${fnName}() {`,
      createCommonWrapperBody(commandName),
      "}",
      `alias ${sanitizeIdentifier(wrapperName)}='noglob ${fnName}'`,
    ].join("\n");
  }

  if (shell === "bash") {
    return [
      `${sanitizeIdentifier(wrapperName)}() {`,
      createCommonWrapperBody(commandName),
      "}",
    ].join("\n");
  }

  if (shell === "fish") {
    return [
      `function ${sanitizeIdentifier(wrapperName)}`,
      "    set -l model",
      "    while test (count $argv) -gt 0",
      "        switch $argv[1]",
      "            case -m --model",
      "                if test (count $argv) -lt 2",
      "                    printf '%s\n' \"$argv[1] requires a model value\" >&2",
      "                    return 1",
      "                end",
      "                set model $argv[2]",
      "                set argv $argv[3..-1]",
      "            case --model=*",
      "                set model (string split -m1 '=' -- $argv[1])[2]",
      "                set argv $argv[2..-1]",
      "            case --",
      "                set argv $argv[2..-1]",
      "                break",
      "            case '*'",
      "                break",
      "        end",
      "    end",
      "",
      "    if test -n \"$model\"",
      `        command ${commandName} -m \"$model\" prompt $argv`,
      "    else",
      `        command ${commandName} prompt $argv`,
      "    end",
      "end",
    ].join("\n");
  }

  throw new Error(`Unsupported shell: ${shellName}`);
}

function createManagedBlock(content) {
  return [
    "# >>> @b4fun/ai-cli shell integration",
    content.trimEnd(),
    "# <<< @b4fun/ai-cli shell integration",
    "",
  ].join("\n");
}

function applyManagedBlock(existing, block) {
  const begin = "# >>> @b4fun/ai-cli shell integration";
  const end = "# <<< @b4fun/ai-cli shell integration";
  const pattern = new RegExp(`${begin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n[\\s\\S]*?\\n${end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`, "m");

  if (pattern.test(existing)) {
    return existing.replace(pattern, block);
  }

  const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  return `${existing}${separator}${block}`;
}

function startSpinner(label = "Waiting for LLM") {
  if (!process.stderr.isTTY) return { stop() {}, setLabel() {} };

  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let index = 0;
  let stopped = false;

  const render = () => {
    process.stderr.clearLine(0);
    process.stderr.cursorTo(0);
    process.stderr.write(`${frames[index++ % frames.length]} ${label}`);
  };

  render();
  const timer = setInterval(render, 80);
  timer.unref?.();

  return {
    setLabel(nextLabel) {
      label = nextLabel;
      render();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      process.stderr.clearLine(0);
      process.stderr.cursorTo(0);
    },
  };
}

function formatCommand(args) {
  return typeof args?.command === "string" ? args.command : undefined;
}

async function runPrompt(askLlm, model) {
  const spinner = startSpinner();
  let wroteAssistantText = false;
  let wroteToolOutput = false;

  try {
    await ask(askLlm, {
      model,
      onModel: ({ provider, id }) => {
        spinner.setLabel(`Waiting for LLM (${provider}/${id})`);
      },
      write: (chunk) => {
        spinner.stop();
        if (wroteToolOutput && !wroteAssistantText) process.stderr.write("\n");
        wroteAssistantText = true;
        process.stdout.write(chunk);
      },
      onToolStart: ({ name, args }) => {
        spinner.stop();
        if (name !== "bash" && name !== "foreground") return;
        const command = formatCommand(args);
        process.stderr.write(`\n$ ${command ?? name}\n`);
        wroteToolOutput = true;
      },
      onToolOutput: ({ name, chunk }) => {
        spinner.stop();
        if (name !== "bash") return;
        process.stderr.write(chunk);
        wroteToolOutput = true;
      },
      onToolEnd: ({ name, isError }) => {
        spinner.stop();
        if (name !== "bash" && name !== "foreground") return;
        if (isError) process.stderr.write("\n[command failed]\n");
      },
    });
    spinner.stop();
    process.stdout.write("\n");
  } catch (error) {
    spinner.stop();
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function printUsage() {
  console.error("Usage: ai [-m <model>] [prompt <ask llm> | shell <init|install> [shell]]");
}

function parseCli(argv) {
  const { model, rest } = parseGlobalOptions(argv);

  if (rest[0] === "shell" && (rest[1] === "init" || rest[1] === "install")) {
    return { mode: "shell", model, argv: rest.slice(1) };
  }

  if (rest[0] === "prompt") {
    return { mode: "prompt", model, promptParts: rest.slice(1) };
  }

  return { mode: "prompt", model, promptParts: rest };
}

function resolvePromptText(promptParts) {
  return promptParts.join(" ").trim();
}

function resolveShellNameFromInput(shellInput) {
  const resolved = shellInput ? path.basename(shellInput) : inferShellName();
  const shellName = normalizeShellName(resolved);
  if (!shellName) {
    throw new Error("A shell name is required (for example: zsh, bash, or fish).");
  }
  return shellName;
}

function installShellIntegration({ shellName, wrapperName }) {
  const rcPath = getRcPath(shellName);
  const snippet = createShellSnippet(shellName, wrapperName);
  const block = createManagedBlock(snippet);
  const existing = fs.existsSync(rcPath) ? fs.readFileSync(rcPath, "utf8") : "";
  const next = applyManagedBlock(existing, block);
  fs.mkdirSync(path.dirname(rcPath), { recursive: true });
  fs.writeFileSync(rcPath, next, "utf8");
  return rcPath;
}

function printShellInit({ shellName, wrapperName }) {
  process.stdout.write(`${createShellSnippet(shellName, wrapperName)}\n`);
}

const parsed = (() => {
  try {
    return parseCli(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    printUsage();
    process.exit(1);
  }
})();

if (parsed.mode === "shell") {
  const shellCommand = parseShellCommand(parsed.argv);
  const action = shellCommand.action;

  try {
    if (parsed.model) {
      throw new Error("The model flag is only supported in prompt mode.");
    }

    if (action !== "init" && action !== "install") {
      throw new Error(`Unknown shell command: ${action || "(missing)"}`);
    }

    const shellName = resolveShellNameFromInput(shellCommand.shell);
    const wrapperName = sanitizeIdentifier(shellCommand.name);

    if (action === "init") {
      printShellInit({ shellName, wrapperName });
      process.exit(0);
    }

    const rcPath = installShellIntegration({ shellName, wrapperName });
    console.error(`Installed shell integration for ${wrapperName} in ${rcPath}`);
    process.exit(0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    printUsage();
    process.exit(1);
  }
}

const askLlm = resolvePromptText(parsed.promptParts);
if (!askLlm) {
  printUsage();
  process.exit(1);
}

await runPrompt(askLlm, parsed.model);
