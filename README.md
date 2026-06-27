# @b4fun/ai-cli

A small Node.js CLI wrapper around `@earendil-works/pi-coding-agent`.

## What it does

- runs prompts through the pi coding agent
- streams assistant output to your terminal
- mirrors command output from tools like `bash`
- exposes a `foreground` tool for interactive programs like `vim`
- keeps per-shell sessions and a default model config

## Install

```bash
npm install
npm link
```

## Usage

```bash
ai "Say hello"
ai "What files are in this directory?"
ai -m anthropic/claude-sonnet-4-5 "Explain this project"
```

You can also use a model from config:

```json
{
  "model": "github-copilot/gpt-5.4-mini"
}
```

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

## Interactive tools

If you want to run an interactive terminal app, ask for the `foreground` tool:

```bash
ai "use the foreground tool to run vim"
```

## Sessions

Sessions are stored under:

```text
$XDG_HOME/@b4fun-ai
```

or the same fallback paths listed above.

To reuse a stable session across shells, set:

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
