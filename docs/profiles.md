# Profiles

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

Relative `promptFile` paths are resolved relative to the directory containing `config.json`.
For example, if config is at `~/Library/Application Support/@b4fun-ai/config.json`, then `profiles/review.md` resolves to `~/Library/Application Support/@b4fun-ai/profiles/review.md`.

For `ai pi`, profiles currently apply `model`, `thinking`, `appendSystemPrompt`, and `tools`. `promptFile` is only used for `ai` prompt requests.
