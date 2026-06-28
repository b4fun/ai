# Auth

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

For first-run onboarding:

```bash
command ai auth login
command ai setup
```

`ai setup` shows configured auth providers, offers login when none are configured, lists available models, prompts for a default model, and can create `fast` and `smart` aliases.
