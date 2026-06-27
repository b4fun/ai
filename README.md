# @b4fun/ai-cli

A small Node.js CLI wrapper around `@earendil-works/pi-coding-agent`.

## What it does

- runs prompts through the pi coding agent
- streams assistant output to your terminal
- mirrors command output from tools like `bash`
- exposes a `foreground` tool for interactive programs like `vim`
- keeps per-shell sessions and a default model config

## Install

Install a prebuilt binary for the current platform and add shell integration:

```bash
curl -fsSL https://raw.githubusercontent.com/b4fun/ai/main/install.sh | sh
```

Install a specific release:

```bash
curl -fsSL https://raw.githubusercontent.com/b4fun/ai/main/install.sh | sh -s -- v0.1.0-alpha.3
```

Customize the shell wrapper name or skip shell integration:

```bash
curl -fsSL https://raw.githubusercontent.com/b4fun/ai/main/install.sh | AI_SHELL_NAME=a sh
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
command ai version
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

## SEA build

There is a standalone binary build path:

```bash
npm run build:sea
```

This requires Node 25 or newer. It bundles the CLI as ESM for SEA, generates a SEA blob, copies the current Node executable, removes the original macOS signature when needed, injects the blob with the required `NODE_SEA` Mach-O segment, then re-signs the executable. The output lands in `dist/sea/ai` on Unix-like systems. Release builds currently use Node 25.

GitHub Releases can build and upload compressed prebuilt binaries plus `.sha256` digest files automatically from `.github/workflows/release.yml` when a release is created or published.

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
