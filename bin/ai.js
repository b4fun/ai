#!/usr/bin/env node
import { ask } from "../src/index.js";

function parseArgs(argv) {
  let model;
  let promptStarted = false;
  const promptParts = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!promptStarted) {
      if (arg === "--") {
        promptStarted = true;
        continue;
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

      promptStarted = true;
    }

    promptParts.push(arg);
  }

  return { model, askLlm: promptParts.join(" ") };
}

let parsed;
try {
  parsed = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error("Usage: ai [-m <model>] <ask llm>");
  process.exit(1);
}

const { model, askLlm } = parsed;

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

if (!askLlm.trim()) {
  console.error("Usage: ai [-m <model>] <ask llm>");
  process.exit(1);
}

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
