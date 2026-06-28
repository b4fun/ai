#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { clearShellProfileFork, getShellSessionDir, readConfig, readShellProfileState, writeShellProfile } from "../src/config.js";
import { VERSION } from "../src/version.js";

function parseGlobalOptions(argv) {
  let model;
  let thinkingLevel;
  let profile;
  const rest = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      rest.push(...argv.slice(index + 1));
      return { model, thinkingLevel, profile, rest };
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

    if (arg === "--thinking") {
      thinkingLevel = argv[index + 1];
      if (!thinkingLevel) throw new Error("--thinking requires a level value");
      index += 1;
      continue;
    }

    if (arg.startsWith("--thinking=")) {
      thinkingLevel = arg.slice("--thinking=".length);
      if (!thinkingLevel) throw new Error("--thinking requires a level value");
      continue;
    }

    if (arg === "-P" || arg === "--profile") {
      profile = argv[index + 1];
      if (!profile) throw new Error(`${arg} requires a profile name`);
      index += 1;
      continue;
    }

    if (arg.startsWith("--profile=")) {
      profile = arg.slice("--profile=".length);
      if (!profile) throw new Error("--profile requires a profile name");
      continue;
    }

    rest.push(...argv.slice(index));
    return { model, thinkingLevel, profile, rest };
  }

  return { model, thinkingLevel, profile, rest };
}

function parseShellCommand(argv) {
  let shell;
  let name = "ai";
  let commandName = "ai";
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

    if (arg === "--command" || arg === "--binary") {
      commandName = argv[index + 1];
      if (!commandName) throw new Error(`${arg} requires a command value`);
      index += 1;
      continue;
    }

    if (arg.startsWith("--command=")) {
      commandName = arg.slice("--command=".length);
      if (!commandName) throw new Error("--command requires a command value");
      continue;
    }

    if (arg.startsWith("--binary=")) {
      commandName = arg.slice("--binary=".length);
      if (!commandName) throw new Error("--binary requires a command value");
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
    commandName,
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

function shellSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
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
  const quotedCommand = shellSingleQuote(commandName);
  return [
    "  case \"${1-}\" in",
    "    auth|pi|upgrade|version|shell)",
    `      command ${quotedCommand} \"$@\"`,
    "      return $?",
    "      ;;",
    "  esac",
    "",
    "  local model=",
    "  local thinking=",
    "  local profile=",
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
    "      --thinking)",
    "        if [ $# -lt 2 ]; then",
    "          printf '%s\\n' \"$1 requires a level value\" >&2",
    "          return 1",
    "        fi",
    "        thinking=$2",
    "        shift 2",
    "        ;;",
    '      --thinking=*)',
    '        thinking=${1#--thinking=}',
    "        shift",
    "        ;;",
    "      -P|--profile)",
    "        if [ $# -lt 2 ]; then",
    "          printf '%s\\n' \"$1 requires a profile name\" >&2",
    "          return 1",
    "        fi",
    "        profile=$2",
    "        shift 2",
    "        ;;",
    '      --profile=*)',
    '        profile=${1#--profile=}',
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
    "  set -- prompt \"$@\"",
    "  if [ -n \"$thinking\" ]; then",
    "    set -- --thinking \"$thinking\" \"$@\"",
    "  fi",
    "  if [ -n \"$profile\" ]; then",
    "    set -- --profile \"$profile\" \"$@\"",
    "  fi",
    "  if [ -n \"$model\" ]; then",
    "    set -- -m \"$model\" \"$@\"",
    "  fi",
    `    command ${quotedCommand} \"$@\"`,
  ].join("\n");
}

function createZshApostropheWidget(wrapperName, fnName) {
  const wrapper = sanitizeIdentifier(wrapperName);
  const escapeFn = `${fnName}_escape_apostrophes`;
  const acceptFn = `${fnName}_accept_line`;
  const originalAcceptWidget = `${fnName}_orig_accept_line`;

  return [
    `${escapeFn}() {`,
    "  emulate -L zsh",
    "  local input=\"$1\"",
    "  local output=\"\" char prev next",
    "  local -i i escaped=0 in_single=0 in_double=0",
    "",
    "  for (( i = 1; i <= ${#input}; i++ )); do",
    "    char=\"${input[i]}\"",
    "",
    "    if (( escaped )); then",
    "      output+=\"$char\"",
    "      escaped=0",
    "      continue",
    "    fi",
    "",
    "    if (( ! in_single )) && [[ \"$char\" == \\\\ ]]; then",
    "      output+=\"$char\"",
    "      escaped=1",
    "      continue",
    "    fi",
    "",
    "    if (( ! in_single )) && [[ \"$char\" == '\"' ]]; then",
    "      output+=\"$char\"",
    "      (( in_double = 1 - in_double ))",
    "      continue",
    "    fi",
    "",
    "    if (( ! in_double )) && [[ \"$char\" == \"'\" ]]; then",
    "      prev=\"\"",
    "      next=\"\"",
    "      (( i > 1 )) && prev=\"${input[i - 1]}\"",
    "      (( i < ${#input} )) && next=\"${input[i + 1]}\"",
    "",
    "      if (( ! in_single )) && [[ \"$prev\" == [[:alnum:]_] && \"$next\" == [[:alnum:]_] ]]; then",
    "        output+=\"\\\\'\"",
    "        continue",
    "      fi",
    "",
    "      (( in_single = 1 - in_single ))",
    "      output+=\"$char\"",
    "      continue",
    "    fi",
    "",
    "    output+=\"$char\"",
    "  done",
    "",
    "  REPLY=\"$output\"",
    "}",
    "",
    `${acceptFn}() {`,
    "  emulate -L zsh",
    "  setopt extendedglob",
    `  if [[ \"$BUFFER\" == (#b)([[:space:]]#)${wrapper}([[:space:]]##)(*) ]]; then`,
    "    local prefix=\"$match[1]\"",
    "    local rest=\"$match[3]\"",
    "    local first=\"${rest%%[[:space:]]*}\"",
    "    case \"$first\" in",
    "      auth|pi|upgrade|version|shell) ;;",
    "      *)",
    `        ${escapeFn} \"$rest\"`,
    `        BUFFER=\"\${prefix}${wrapper} $REPLY\"`,
    "        ;;",
    "    esac",
    "  fi",
    `  zle ${originalAcceptWidget}`,
    "}",
    "",
    "if [[ -o interactive ]]; then",
    `  if ! zle -l | command grep -qx ${shellSingleQuote(originalAcceptWidget)}; then`,
    `    zle -A accept-line ${originalAcceptWidget}`,
    "  fi",
    `  zle -N ${acceptFn}`,
    `  zle -A ${acceptFn} accept-line`,
    "fi",
  ].join("\n");
}

function createFishApostropheBindings(wrapperName) {
  const wrapper = sanitizeIdentifier(wrapperName);
  const prefix = `__b4fun_ai_${wrapper}`;
  const escapeFn = `${prefix}_escape_apostrophes`;
  const acceptFn = `${prefix}_accept_line`;

  return [
    `function ${escapeFn} --argument-names input`,
    "    set -l output",
    "    set -l escaped 0",
    "    set -l in_single 0",
    "    set -l in_double 0",
    "    set -l len (string length -- $input)",
    "",
    "    for i in (seq 1 $len)",
    "        set -l char (string sub -s $i -l 1 -- $input)",
    "",
    "        if test $escaped -eq 1",
    "            set output \"$output$char\"",
    "            set escaped 0",
    "            continue",
    "        end",
    "",
    "        if test $in_single -eq 0; and test \"$char\" = \\\\",
    "            set output \"$output$char\"",
    "            set escaped 1",
    "            continue",
    "        end",
    "",
    "        if test $in_single -eq 0; and test \"$char\" = '\"'",
    "            set output \"$output$char\"",
    "            set in_double (math 1 - $in_double)",
    "            continue",
    "        end",
    "",
    "        if test $in_double -eq 0; and test \"$char\" = \"'\"",
    "            set -l prev",
    "            set -l next",
    "            if test $i -gt 1",
    "                set prev (string sub -s (math $i - 1) -l 1 -- $input)",
    "            end",
    "            if test $i -lt $len",
    "                set next (string sub -s (math $i + 1) -l 1 -- $input)",
    "            end",
    "",
    "            if test $in_single -eq 0; and string match -qr '^[[:alnum:]_]$' -- $prev; and string match -qr '^[[:alnum:]_]$' -- $next",
    "                set output \"$output\\\\'\"",
    "                continue",
    "            end",
    "",
    "            set in_single (math 1 - $in_single)",
    "            set output \"$output$char\"",
    "            continue",
    "        end",
    "",
    "        set output \"$output$char\"",
    "    end",
    "",
    "    printf '%s\\n' $output",
    "end",
    "",
    `function ${acceptFn}`,
    "    set -l buffer (commandline -b)",
    `    set -l matches (string match -r '^([[:space:]]*)${wrapper}[[:space:]]+(.*)$' -- $buffer)`,
    "    if test (count $matches) -ge 3",
    "        set -l prefix $matches[2]",
    "        set -l rest $matches[3]",
    "        set -l first (string match -r '^[^[:space:]]+' -- $rest)",
    "        switch $first",
    "            case auth pi upgrade version shell",
    "            case '*'",
    `                set -l escaped (${escapeFn} "$rest")`,
    `                commandline -r \"$prefix${wrapper} $escaped\"`,
    "        end",
    "    end",
    "    commandline -f execute",
    "end",
    "",
    `if status is-interactive`,
    `    bind \\r ${acceptFn}`,
    `    bind \\n ${acceptFn}`,
    "end",
  ].join("\n");
}

function createShellSnippet(shellName, wrapperName, commandName = "ai") {
  const shell = normalizeShellName(shellName);
  const fnName = hiddenFunctionName(wrapperName);

  if (shell === "zsh") {
    return [
      `${fnName}() {`,
      createCommonWrapperBody(commandName),
      "}",
      `alias ${sanitizeIdentifier(wrapperName)}='noglob ${fnName}'`,
      createZshApostropheWidget(wrapperName, fnName),
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
      "    switch $argv[1]",
      "        case auth pi upgrade version shell",
      `            command ${shellSingleQuote(commandName)} $argv`,
      "            return $status",
      "    end",
      "",
      "    set -l model",
      "    set -l thinking",
      "    set -l profile",
      "    while test (count $argv) -gt 0",
      "        switch $argv[1]",
      "            case -m --model",
      "                if test (count $argv) -lt 2",
      "                    printf '%s\\n' \"$argv[1] requires a model value\" >&2",
      "                    return 1",
      "                end",
      "                set model $argv[2]",
      "                set argv $argv[3..-1]",
      "            case --model=*",
      "                set model (string split -m1 '=' -- $argv[1])[2]",
      "                set argv $argv[2..-1]",
      "            case --thinking",
      "                if test (count $argv) -lt 2",
      "                    printf '%s\\n' \"$argv[1] requires a level value\" >&2",
      "                    return 1",
      "                end",
      "                set thinking $argv[2]",
      "                set argv $argv[3..-1]",
      "            case --thinking=*",
      "                set thinking (string split -m1 '=' -- $argv[1])[2]",
      "                set argv $argv[2..-1]",
      "            case -P --profile",
      "                if test (count $argv) -lt 2",
      "                    printf '%s\\n' \"$argv[1] requires a profile name\" >&2",
      "                    return 1",
      "                end",
      "                set profile $argv[2]",
      "                set argv $argv[3..-1]",
      "            case --profile=*",
      "                set profile (string split -m1 '=' -- $argv[1])[2]",
      "                set argv $argv[2..-1]",
      "            case --",
      "                set argv $argv[2..-1]",
      "                break",
      "            case '*'",
      "                break",
      "        end",
      "    end",
      "",
      "    set -l ai_args prompt $argv",
      "    if test -n \"$thinking\"",
      "        set ai_args --thinking \"$thinking\" $ai_args",
      "    end",
      "    if test -n \"$profile\"",
      "        set ai_args --profile \"$profile\" $ai_args",
      "    end",
      "    if test -n \"$model\"",
      "        set ai_args -m \"$model\" $ai_args",
      "    end",
      `    command ${shellSingleQuote(commandName)} $ai_args`,
      "end",
      createFishApostropheBindings(wrapperName),
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

function getDefaultInstallDir() {
  return path.join(os.homedir(), ".local", "bin");
}

function getUpgradeInstallDir() {
  if (process.env.AI_INSTALL_DIR) return process.env.AI_INSTALL_DIR;

  const execBasename = path.basename(process.execPath).toLowerCase();
  if (execBasename === "ai" || execBasename === "ai.exe") {
    return path.dirname(process.execPath);
  }

  return getDefaultInstallDir();
}

function runUpgrade(version = "latest") {
  const installDir = getUpgradeInstallDir();
  const installScriptUrl = "https://raw.githubusercontent.com/b4fun/ai/main/install.sh";
  const command = [
    `curl -fsSL ${shellSingleQuote(installScriptUrl)}`,
    `AI_INSTALL_DIR=${shellSingleQuote(installDir)} AI_INSTALL_SHELL=0 sh -s -- ${shellSingleQuote(version)}`,
  ].join(" | ");

  console.error(`Upgrading ai to ${version} in ${installDir}`);
  const result = spawnSync("/bin/sh", ["-c", command], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Upgrade failed with exit code ${result.status ?? 1}`);
  }
}

const ANSI_DIM = "\x1b[2m";
const ANSI_RESET = "\x1b[0m";

function startSpinner(label = "Waiting for LLM") {
  if (!process.stderr.isTTY) return { stop() {}, setLabel() {}, pause() {}, resume() {} };

  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let index = 0;
  let stopped = false;
  let paused = false;
  let visible = false;

  const clear = () => {
    if (!visible) return;
    process.stderr.clearLine(0);
    process.stderr.cursorTo(0);
    visible = false;
  };

  const render = () => {
    if (stopped || paused) return;
    if (visible) {
      process.stderr.clearLine(0);
      process.stderr.cursorTo(0);
    }
    process.stderr.write(`${ANSI_DIM}${frames[index++ % frames.length]} ${label}${ANSI_RESET}`);
    visible = true;
  };

  render();
  const timer = setInterval(render, 80);
  timer.unref?.();

  return {
    setLabel(nextLabel) {
      label = nextLabel;
      render();
    },
    pause() {
      if (stopped || paused) return;
      paused = true;
      clear();
    },
    resume() {
      if (stopped || !paused) return;
      paused = false;
      render();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      clear();
    },
  };
}

function startInputGuard() {
  if (!process.stdin.isTTY) return { pause() {}, resume() {}, stop() {} };

  const wasRaw = process.stdin.isRaw;
  let stopped = false;
  let paused = false;

  const onData = (chunk) => {
    if (paused) return;

    // Raw mode prevents cursor/control escape sequences from being echoed while
    // the agent is running. Preserve Ctrl+C as the expected way to cancel.
    if (chunk.includes(3)) {
      stop();
      process.kill(process.pid, "SIGINT");
    }
  };

  const start = () => {
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.on("data", onData);
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    process.stdin.off("data", onData);
    process.stdin.setRawMode?.(wasRaw ?? false);
    process.stdin.pause();
  };

  start();

  return {
    pause() {
      if (stopped || paused) return;
      paused = true;
      process.stdin.off("data", onData);
      process.stdin.setRawMode?.(wasRaw ?? false);
      process.stdin.pause();
    },
    resume() {
      if (stopped || !paused) return;
      paused = false;
      process.stdin.setRawMode?.(true);
      process.stdin.resume();
      process.stdin.on("data", onData);
    },
    stop,
  };
}

function formatCommand(args) {
  return typeof args?.command === "string" ? args.command : undefined;
}

async function readStdin() {
  if (process.stdin.isTTY) return "";

  process.stdin.setEncoding("utf8");
  return await new Promise((resolve, reject) => {
    let data = "";
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function runPrompt(askLlm, model, thinkingLevel, profile, forkSession) {
  const { ask } = await import("../src/index.js");
  const { confirmLoginAfterAuthError } = await import("../src/auth.js");
  let activeProvider;
  let attemptedLoginRetry = false;

  const runOnce = async () => {
    const spinner = startSpinner();
    const inputGuard = startInputGuard();
    let wroteAssistantText = false;
    let wroteToolOutput = false;

    try {
      await ask(askLlm, {
        model,
        thinkingLevel,
        profile,
        forkSession,
        onModel: ({ provider, id, thinkingLevel: activeThinkingLevel }) => {
          activeProvider = provider;
          const thinkingLabel = activeThinkingLevel ? `, thinking ${activeThinkingLevel}` : "";
          spinner.setLabel(`Waiting for LLM (${provider}/${id}${thinkingLabel})`);
        },
        write: (chunk) => {
          spinner.pause();
          if (wroteToolOutput && !wroteAssistantText) process.stderr.write("\n");
          wroteAssistantText = true;
          process.stdout.write(chunk);
          if (chunk.endsWith("\n")) spinner.resume();
        },
        onToolStart: ({ name, args }) => {
          if (name !== "bash" && name !== "foreground") return;
          if (name === "foreground") inputGuard.pause();
          spinner.pause();
          const command = formatCommand(args);
          process.stderr.write(`\n$ ${command ?? name}\n`);
          spinner.resume();
          wroteToolOutput = true;
        },
        onToolOutput: ({ name, chunk }) => {
          if (name !== "bash") return;
          spinner.pause();
          process.stderr.write(chunk);
          if (chunk.endsWith("\n")) spinner.resume();
          wroteToolOutput = true;
        },
        onToolEnd: ({ name, isError }) => {
          if (name !== "bash" && name !== "foreground") return;
          spinner.pause();
          if (isError) process.stderr.write("\n[command failed]\n");
          spinner.resume();
          if (name === "foreground") inputGuard.resume();
        },
      });
      inputGuard.stop();
      spinner.stop();
      process.stdout.write("\n");
    } catch (error) {
      inputGuard.stop();
      spinner.stop();
      throw error;
    }
  };

  try {
    await runOnce();
  } catch (error) {
    if (!attemptedLoginRetry && await confirmLoginAfterAuthError(activeProvider, error)) {
      attemptedLoginRetry = true;
      await runOnce();
      return;
    }

    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function runPi(argv, model, thinkingLevel, profileName) {
  if (argv.length > 0) {
    throw new Error(`Unexpected pi arguments: ${argv.join(" ")}`);
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stderr.isTTY) {
    throw new Error("Starting pi requires an interactive terminal.");
  }

  const config = readConfig();
  const { resolveConfiguredModel } = await import("../src/model-config.js");
  const { getProfileAppendSystemPrompt, getProfileTools, resolveProfile } = await import("../src/profiles.js");
  const { profile } = resolveProfile(config, profileName);
  const resolved = resolveConfiguredModel(config, model ?? profile.model, thinkingLevel ?? profile.thinking);
  const appendSystemPrompt = getProfileAppendSystemPrompt(profile);
  const tools = getProfileTools(profile);
  const args = ["--session-dir", getShellSessionDir(), "--continue"];
  if (resolved.modelSpec) args.push("--model", resolved.modelSpec);
  if (resolved.thinkingLevel) args.push("--thinking", resolved.thinkingLevel);
  for (const item of appendSystemPrompt) args.push("--append-system-prompt", item);
  if (tools) args.push("--tools", tools.join(","));

  const result = spawnSync("pi", args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error?.code === "ENOENT") {
    throw new Error("pi is not installed or is not on PATH. Install @earendil-works/pi-coding-agent locally to use 'ai pi'.");
  }
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`pi exited with code ${result.status ?? 1}`);
  }
}

async function activateProfile(profile, { quiet = false, forkSession = false } = {}) {
  const { resolveProfile } = await import("../src/profiles.js");
  const { name } = resolveProfile(readConfig(), profile);
  writeShellProfile(name, { forkSession });
  if (!quiet) console.log(`Active profile for this shell session: ${name}`);
  return name;
}

async function runAuth(argv) {
  const action = argv[0];
  const provider = argv[1];

  if (action !== "login" && action !== "status") {
    throw new Error(`Unknown auth command: ${action || "(missing)"}`);
  }

  if (argv.length > 2) {
    throw new Error(`Unexpected auth arguments: ${argv.slice(2).join(" ")}`);
  }

  const { loginProvider, printAuthStatus } = await import("../src/auth.js");
  if (action === "login") {
    await loginProvider(provider);
  } else {
    printAuthStatus(provider);
  }
}

function printUsage() {
  console.error("Usage: ai [-m <model>] [--thinking <level>] [-P|--profile <name>] [prompt <ask llm> | pi | auth <login|status> [provider] | version | upgrade [version] | shell <init|install> [shell]]");
}

function parseCli(argv) {
  if (argv.length === 1 && (argv[0] === "--version" || argv[0] === "-v")) {
    return { mode: "version", model: undefined, thinkingLevel: undefined, profile: undefined };
  }

  const { model, thinkingLevel, profile, rest } = parseGlobalOptions(argv);

  if (rest[0] === "shell" && (rest[1] === "init" || rest[1] === "install")) {
    return { mode: "shell", model, thinkingLevel, profile, argv: rest.slice(1) };
  }

  if (rest[0] === "version") {
    return { mode: "version", model, thinkingLevel, profile };
  }

  if (rest[0] === "upgrade") {
    return { mode: "upgrade", model, thinkingLevel, profile, argv: rest.slice(1) };
  }

  if (rest[0] === "auth") {
    return { mode: "auth", model, thinkingLevel, profile, argv: rest.slice(1) };
  }

  if (rest[0] === "pi") {
    return { mode: "pi", model, thinkingLevel, profile, argv: rest.slice(1) };
  }

  if (rest[0] === "prompt") {
    return { mode: "prompt", model, thinkingLevel, profile, promptParts: rest.slice(1) };
  }

  return { mode: "prompt", model, thinkingLevel, profile, promptParts: rest };
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

function installShellIntegration({ shellName, wrapperName, commandName = "ai" }) {
  const rcPath = getRcPath(shellName);
  const snippet = createShellSnippet(shellName, wrapperName, commandName);
  const block = createManagedBlock(snippet);
  const existing = fs.existsSync(rcPath) ? fs.readFileSync(rcPath, "utf8") : "";
  const next = applyManagedBlock(existing, block);
  fs.mkdirSync(path.dirname(rcPath), { recursive: true });
  fs.writeFileSync(rcPath, next, "utf8");
  return rcPath;
}

function printShellInit({ shellName, wrapperName, commandName = "ai" }) {
  process.stdout.write(`${createShellSnippet(shellName, wrapperName, commandName)}\n`);
}

async function main() {
  let parsed;

  try {
    parsed = parseCli(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    printUsage();
    process.exit(1);
  }

  if (parsed.mode === "version") {
    if (parsed.model || parsed.thinkingLevel || parsed.profile) {
      console.error("The model, thinking, and profile flags are only supported in prompt and pi modes.");
      process.exit(1);
    }
    console.log(VERSION);
    return;
  }

  if (parsed.mode === "upgrade") {
    if (parsed.model || parsed.thinkingLevel || parsed.profile) {
      console.error("The model, thinking, and profile flags are only supported in prompt and pi modes.");
      process.exit(1);
    }

    if (parsed.argv.length > 1) {
      console.error(`Unexpected upgrade arguments: ${parsed.argv.slice(1).join(" ")}`);
      printUsage();
      process.exit(1);
    }

    try {
      runUpgrade(parsed.argv[0] || "latest");
      return;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  if (parsed.mode === "pi") {
    try {
      await runPi(parsed.argv, parsed.model, parsed.thinkingLevel, parsed.profile);
      return;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      printUsage();
      process.exit(1);
    }
  }

  if (parsed.mode === "auth") {
    if (parsed.model || parsed.thinkingLevel || parsed.profile) {
      console.error("The model, thinking, and profile flags are only supported in prompt and pi modes.");
      process.exit(1);
    }

    try {
      await runAuth(parsed.argv);
      return;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      printUsage();
      process.exit(1);
    }
  }

  if (parsed.mode === "shell") {
    const shellCommand = parseShellCommand(parsed.argv);
    const action = shellCommand.action;

    try {
      if (parsed.model || parsed.thinkingLevel || parsed.profile) {
        throw new Error("The model, thinking, and profile flags are only supported in prompt and pi modes.");
      }

      if (action !== "init" && action !== "install") {
        throw new Error(`Unknown shell command: ${action || "(missing)"}`);
      }

      const shellName = resolveShellNameFromInput(shellCommand.shell);
      const wrapperName = sanitizeIdentifier(shellCommand.name);
      const commandName = shellCommand.commandName;

      if (action === "init") {
        printShellInit({ shellName, wrapperName, commandName });
        return;
      }

      const rcPath = installShellIntegration({ shellName, wrapperName, commandName });
      console.error(`Installed shell integration for ${wrapperName} in ${rcPath}`);
      return;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      printUsage();
      process.exit(1);
    }
  }

  const askLlm = resolvePromptText(parsed.promptParts);
  const stdinText = await readStdin();
  const hasPrompt = !!askLlm || !!stdinText.trim();
  const shellProfileState = readShellProfileState();

  if (parsed.profile) {
    await activateProfile(parsed.profile, { quiet: hasPrompt, forkSession: true });
  }

  if (!hasPrompt && parsed.profile) return;

  const effectiveProfile = parsed.profile ?? shellProfileState.profile;
  const shouldForkSession = !!parsed.profile || shellProfileState.forkSession;
  const combinedPrompt = stdinText.trim()
    ? `${askLlm}\n\nAdditional context from stdin:\n\n\`\`\`\n${stdinText.trimEnd()}\n\`\`\``
    : askLlm;

  await runPrompt(combinedPrompt, parsed.model, parsed.thinkingLevel, effectiveProfile, shouldForkSession);
  if (shouldForkSession) clearShellProfileFork();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
