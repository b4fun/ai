# @b4fun/ai-cli

Minimal Node.js CLI/module that imports `@earendil-works/pi-coding-agent` and exposes:

```bash
ai [-m <model>] <ask llm>
```

## Install

```bash
npm install
npm link
```

## CLI usage

```bash
ai "What files are in this directory?"
ai -m anthropic/claude-sonnet-4-5 "What files are in this directory?"
ai --model=openai/gpt-5.1 "Say hello"
```

In zsh, unquoted `?` is treated as a glob before `ai` starts. Use quotes, escape `?`, or add a `noglob` alias:

```zsh
ai 'what is inside?'
ai what is inside\?
alias ai='noglob ai'
```

While waiting for the first LLM text, `ai` shows a spinner on stderr with the selected model once resolved. If the agent runs a bash command, `ai` mirrors the command and its live output to stderr while pi still captures it for the LLM.

`ai` also exposes a `foreground` tool for interactive terminal programs. Ask for it explicitly when needed:

```bash
ai 'use the foreground tool to run vim'
ai 'open nvim in the foreground'
```

Foreground commands inherit stdin/stdout/stderr, so you can interact with full-screen tools. The LLM only receives the exit code, not the full terminal transcript.

The CLI uses your existing pi authentication/configuration. If needed, authenticate with pi first:

```bash
pi /login
```

## Config

`ai` reads its config from:

```text
$XDG_HOME/@b4fun-ai/config.json
```

If `XDG_HOME` is not set, it falls back to `$XDG_STATE_HOME/@b4fun-ai/config.json`, then `~/.local/state/@b4fun-ai/config.json`.

Set the default model with either `model` or `defaultModel`:

```json
{
  "model": "anthropic/claude-sonnet-4-5"
}
```

The CLI flag overrides the config file:

```bash
ai -m openai/gpt-5.1 "Say hello"
```

Model values can be exact `provider/model-id` strings. Bare model substrings are allowed when they match exactly one model.

These paths and settings are also injected into the agent's base prompt, so you can ask things like:

```bash
ai 'open my ai config in vim'
ai 'set my default ai model to anthropic/claude-sonnet-4-5'
```

When opening config/settings in an editor, the agent is instructed to use the `foreground` tool.

## Sessions

`ai` persists pi session logs under:

```text
$XDG_HOME/@b4fun-ai
```

If `XDG_HOME` is not set, it falls back to `$XDG_STATE_HOME/@b4fun-ai`, then `~/.local/state/@b4fun-ai`.

Invocations from the same parent shell process reuse the most recent session for the current working directory. To force a stable session id across wrappers or shells, set:

```bash
export AI_SESSION_ID=my-session
```

## Module usage

```js
import { ask } from "@b4fun/ai-cli";

const answer = await ask("Say hello", {
  model: "anthropic/claude-sonnet-4-5",
  write: (chunk) => process.stdout.write(chunk),
});
```
