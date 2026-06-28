# Models and config

Use `-m` or `--model` to override the model for one invocation. Use `--thinking` to override the thinking level:

```bash
ai -m github-copilot/gpt-5.4-mini summarize this repository
ai -m anthropic/claude-sonnet-4-5 --thinking high think through this migration
```

Set a default model with the config command:

```bash
ai config set model github-copilot/gpt-5.4-mini
```

The config file is written safely and preserves existing fields. The legacy key `defaultModel` is also accepted.

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

Create those aliases from the CLI with:

```bash
ai config alias fast github-copilot/gpt-5.4-mini
ai config alias smart anthropic/claude-sonnet-4-5 --thinking high
ai config set model fast
```

Then use them from the CLI:

```bash
ai -m fast quickly explain this error
ai -m smart design a safer approach
```

Valid thinking levels are `off`, `minimal`, `low`, `medium`, `high`, and `xhigh`. You can also use the shorthand `model:thinking`, for example `ai -m smart:medium ...`.

Useful config/model commands:

```bash
ai setup
ai models
ai models --all
ai config path
ai config get
ai config get model
ai config set thinking low
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
