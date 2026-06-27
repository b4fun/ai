# @b4fun/ai-cli

A small Node.js CLI wrapper around [`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent).

`@b4fun/ai-cli` gives you a short `ai` command for asking a coding agent questions from your terminal, while preserving pi's file, shell, and edit tools.

## Why

Sometimes the nicest coding-agent UI is just the shell you already have open. Ask a question, let the agent look around, run a command, edit a file, or jump into an interactive tool when that is the easiest path.

Smart base models can usually follow a few local rules and knock out focused tasks without much ceremony. Keeping everything close to the terminal makes `ai` handy for ad hoc work: quick fixes, repo spelunking, debugging, tiny automations, and other exploratory tasks where a heavier workflow would be overkill.

## Features

- Runs prompts through the pi coding agent
- Streams assistant responses as they are generated
- Mirrors `bash` tool output to your terminal
- Adds a `foreground` tool for interactive programs such as `vim`, `less`, `top`, and REPLs
- Persists sessions per shell, with an optional stable `AI_SESSION_ID`
- Supports default models, model aliases, thinking levels, and per-command overrides
- Installs optional shell wrappers for zsh, bash, and fish

## Install

Install the latest prebuilt binary for your platform and add shell integration:

```bash
curl -fsSL https://raw.githubusercontent.com/b4fun/ai/main/install.sh | sh
```

Install a specific release:

```bash
curl -fsSL https://raw.githubusercontent.com/b4fun/ai/main/install.sh | sh -s -- v0.1.0-alpha.6
```

Customize the shell wrapper name:

```bash
curl -fsSL https://raw.githubusercontent.com/b4fun/ai/main/install.sh | AI_SHELL_NAME=a sh
```

Skip shell integration:

```bash
curl -fsSL https://raw.githubusercontent.com/b4fun/ai/main/install.sh | AI_INSTALL_SHELL=0 sh
```

Developer install:

```bash
npm install
npm link
```

## Usage

The direct CLI entry point is `ai prompt`:

```bash
command ai prompt "Say hello"
command ai prompt "What files are in this directory?"
command ai -m anthropic/claude-sonnet-4-5 prompt "Explain this project"
command ai -m smart --thinking high prompt "Plan this refactor"
command ai version
```

If you install the shell wrapper, you can use the shorter form:

```bash
ai "Say hello"
ai "What files are in this directory?"
ai -m anthropic/claude-sonnet-4-5 "Explain this project"
ai -m smart --thinking high "Plan this refactor"
```

Pipe stdin to include it as extra prompt context:

```bash
another-command | ai "check what is going on"
```

For interactive terminal programs, ask the agent to use the `foreground` tool:

```bash
ai "use the foreground tool to run vim README.md"
```

## Models and config

Use `-m` or `--model` to override the model for one invocation. Use `--thinking` to override the thinking level:

```bash
ai -m github-copilot/gpt-5.4-mini "summarize this repository"
ai -m anthropic/claude-sonnet-4-5 --thinking high "think through this migration"
```

Set a default model in `config.json`:

```json
{
  "model": "github-copilot/gpt-5.4-mini"
}
```

The legacy key `defaultModel` is also accepted.

You can also define aliases for the names you actually want to type:

```json
{
  "model": "fast",
  "modelAliases": {
    "fast": "github-copilot/gpt-5.4-mini",
    "smart": {
      "model": "anthropic/claude-sonnet-4-5",
      "thinking": "high"
    }
  }
}
```

Then use them from the CLI:

```bash
ai -m fast "quickly explain this error"
ai -m smart "design a safer approach"
```

Valid thinking levels are `off`, `minimal`, `low`, `medium`, `high`, and `xhigh`. You can also use the shorthand `model:thinking`, for example `ai -m smart:medium ...`.

The config file lives at:

```text
$XDG_HOME/@b4fun-ai/config.json
```

If `XDG_HOME` is not set, the CLI falls back to:

```text
$XDG_STATE_HOME/@b4fun-ai/config.json
~/Library/Application Support/@b4fun-ai/config.json   (macOS)
~/.local/state/@b4fun-ai/config.json                  (other platforms)
```

## Shell integration

Generate shell setup for a wrapper name of your choice:

```bash
command ai shell init zsh --name a
command ai shell init bash --name ai
command ai shell init fish --name ai
```

Install shell setup into your rc file:

```bash
command ai shell install zsh --name a
command ai shell install bash --name ai
command ai shell install fish --name ai
```

On zsh, the installed wrapper uses `noglob`, so prompts like `??` can be passed through unquoted. The real binary remains available with `command ai ...`.

## Sessions

Sessions are stored under the same `@b4fun-ai` config root:

```text
$XDG_HOME/@b4fun-ai/sessions
```

or one of the fallback roots listed above.

By default, sessions are grouped by parent shell process. To reuse a stable session across shells, set:

```bash
export AI_SESSION_ID=my-session
```

## JavaScript API

```js
import { ask } from "@b4fun/ai-cli";

const answer = await ask("Say hello", {
  model: "github-copilot/gpt-5.4-mini",
  write: (chunk) => process.stdout.write(chunk),
});
```

## Build a standalone binary

There is a standalone executable build path based on Node SEA:

```bash
npm run build:sea
```

This requires Node 25 or newer. It bundles the CLI as ESM, generates a SEA blob, copies the current Node executable, injects the blob, and re-signs the executable when needed on macOS. The output lands in:

```text
dist/sea/ai
```

Release builds are produced by `.github/workflows/release.yml` and uploaded as compressed prebuilt binaries with `.sha256` digest files.
