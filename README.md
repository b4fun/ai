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

The direct CLI entry point is `ai prompt`:

```bash
command ai prompt "Say hello"
command ai prompt "What files are in this directory?"
command ai -m anthropic/claude-sonnet-4-5 prompt "Explain this project"
```

If you install the shell wrapper, you can keep using the shorter form:

```bash
ai "Say hello"
ai "What files are in this directory?"
ai -m anthropic/claude-sonnet-4-5 "Explain this project"
```

You can also pipe stdin into the prompt as extra context:

```bash
another-command | ai check what is going on
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

## Shell integration

Generate shell setup for a wrapper name of your choice:

```bash
command ai shell init zsh --name a
command ai shell install zsh --name a
command ai shell init bash --name ai
```

On zsh, the installed wrapper uses `noglob`, so prompts like `??` can be passed through unquoted. The real binary is still available with `command ai ...`.

## Experimental SEA build

There is an experimental build path for a standalone binary:

```bash
npm run build:sea
```

This bundles the CLI, generates a SEA blob, copies the current Node executable, and injects the blob when `postject` is available. The output lands in `dist/sea/ai` on Unix-like systems. Depending on your Node distribution and platform, you may also need to re-sign the copied executable after injection.

GitHub Releases can build and upload prebuilt binaries automatically from `.github/workflows/release.yml` when a release is created or published.

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
