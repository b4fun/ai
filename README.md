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
curl -fsSL https://raw.githubusercontent.com/b4fun/ai/main/install.sh | sh -s -- v0.1.0-alpha.8
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

Upgrade the installed binary to the latest release:

```bash
command ai upgrade
```

Upgrade to a specific release:

```bash
command ai upgrade v0.1.0-alpha.8
```

The upgrade helper reinstalls into the current binary's directory and skips shell integration changes.

If you already have shell integration installed and a release changes the wrapper snippet, refresh it after upgrading:

```bash
command ai upgrade
command ai shell install zsh --name ai   # or bash/fish
```

To try a new wrapper in the current shell without editing your rc file, use `eval`/`source` with `shell init`:

```bash
# zsh/bash: current shell only
source <(command ai shell init zsh --name ai)

# fish: current shell only
command ai shell init fish --name ai | source
```

Use `shell install` when you want the change to persist for future shells; use `shell init` + `source`/`eval` when you only want to refresh or test the current shell.

## Auth

`ai` uses the same pi credentials. If credentials are missing or a provider rejects them, the CLI can prompt you to log in and retry.

Log in explicitly:

```bash
command ai auth login
command ai auth login github-copilot
command ai auth login anthropic
```

Check configured auth:

```bash
command ai auth status
command ai auth status github-copilot
```

OAuth providers open the browser or show a device code. API-key providers prompt for a key and save it to pi's `auth.json`.

## Usage

The direct CLI entry point is `ai prompt`:

```bash
command ai prompt Say hello
command ai prompt What files are in this directory?
command ai -m anthropic/claude-sonnet-4-5 prompt Explain this project
command ai -m smart --thinking high prompt Plan this refactor
command ai version
command ai --version
command ai pi
command ai auth login github-copilot
command ai upgrade
```

If you install the shell wrapper, you can use the shorter form:

```bash
ai Say hello
ai What files are in this directory?
ai -m anthropic/claude-sonnet-4-5 Explain this project
ai -m smart --thinking high Plan this refactor
```

The CLI joins the remaining arguments into the prompt, so quotes are optional for most plain-language prompts. In zsh, the installed wrapper is also a `noglob` alias, which means prompts containing glob-looking text like `??`, `*`, or `[abc]` can usually be passed unquoted too. The zsh and fish integrations also install small Enter-key hooks that escape apostrophes inside contractions before the shell parses the command, so prompts like `ai what's wrong` and `ai don't change files yet` work naturally. Use quotes when you need normal shell quoting behavior, such as preserving extra whitespace, pipes, redirects, variables, or other shell syntax as literal text.

Pipe stdin to include it as extra prompt context:

```bash
another-command | ai check what is going on
```

For interactive terminal programs, ask the agent to use the `foreground` tool:

```bash
ai use the foreground tool to run vim README.md
```

To switch from the lightweight wrapper into full interactive pi, use:

```bash
ai pi
```

This requires the `pi` command to be installed locally and available on `PATH`. It starts pi with the same session directory used by `ai` and continues the most recent session for the current working directory. Model aliases and thinking settings from `ai` config are resolved before launching pi, and `-m/--model` or `--thinking` overrides are forwarded too:

```bash
ai -m smart --thinking high pi
```

## Profiles

Profiles are personal presets stored in the same `config.json`. They are useful for ad hoc modes like review, exploration, or focused editing.

```json
{
  "defaultProfile": "explore",
  "profiles": {
    "explore": {
      "model": "fast",
      "thinking": "low",
      "promptFile": "profiles/explore.md",
      "appendSystemPrompt": [
        "Prefer discovery over edits.",
        "Be concise."
      ],
      "tools": ["read", "bash"]
    },
    "review": {
      "model": "smart",
      "thinking": "high",
      "promptFile": "profiles/review.md",
      "appendSystemPrompt": [
        "Focus on correctness, regressions, and maintainability.",
        "Do not edit files unless explicitly asked."
      ],
      "tools": ["read", "bash"]
    }
  }
}
```

Use a profile with:

```bash
ai --profile review check current changes
ai -P explore explain this repository
```

You can also set the active profile for the current shell session without sending a prompt:

```bash
ai -P read-only
ai what files are here
```

The active profile is remembered under this shell's session directory. Passing `-P/--profile` with a prompt updates the active shell profile and uses it for that prompt.

If `defaultProfile` is set, it is used when no active shell profile or `--profile` is provided. CLI flags override profile model and thinking settings:

```bash
ai -P review -m fast --thinking low quick pass only
```

Supported profile fields:

- `model`: model spec or alias
- `thinking`: `off`, `minimal`, `low`, `medium`, `high`, or `xhigh`
- `promptFile`: user prompt prefix loaded from a file
- `appendSystemPrompt`: string or array of system instructions
- `tools`: enabled tool names, such as `["read", "bash"]`

Relative `promptFile` paths are resolved relative to the directory containing `config.json`. For example, if config is at:

```text
~/Library/Application Support/@b4fun-ai/config.json
```

then this profile field:

```json
{ "promptFile": "profiles/review.md" }
```

resolves to:

```text
~/Library/Application Support/@b4fun-ai/profiles/review.md
```

For `ai pi`, profiles currently apply `model`, `thinking`, `appendSystemPrompt`, and `tools`. `promptFile` is only used for `ai` prompt requests.

## Models and config

Use `-m` or `--model` to override the model for one invocation. Use `--thinking` to override the thinking level:

```bash
ai -m github-copilot/gpt-5.4-mini summarize this repository
ai -m anthropic/claude-sonnet-4-5 --thinking high think through this migration
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
ai -m fast quickly explain this error
ai -m smart design a safer approach
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

Shell wrapper support status:

| Shell | Short prompt wrapper | Model/thinking flags | Management command passthrough | Glob-friendly prompts | Apostrophes in contractions |
| --- | --- | --- | --- | --- | --- |
| zsh | yes | yes | yes | yes, via `noglob` alias | yes, via an `accept-line` widget |
| fish | yes | yes | yes | normal fish behavior | yes, via an Enter-key binding |
| bash | yes | yes | yes | normal bash behavior | no; use `what\'s`, double quotes, or stdin |

On zsh, the installed wrapper uses `noglob`, so prompts like `??`, `*`, or `[abc]` can be passed through unquoted instead of being expanded by the shell. The zsh and fish integrations also install Enter-key hooks for the wrapper command so common apostrophes in contractions are escaped before the shell parses the line. Shell wrappers pass through management commands such as `ai auth`, `ai pi`, `ai upgrade`, `ai version`, and `ai shell`; the real binary remains available with `command ai ...`.

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
