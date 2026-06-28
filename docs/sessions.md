# Sessions

Sessions are stored under the same `@b4fun-ai` config root:

```text
$XDG_HOME/@b4fun-ai/sessions
```

or one of the fallback roots listed in [`models-and-config.md`](models-and-config.md).

By default, sessions are grouped by parent shell process. To reuse a stable session across shells, set:

```bash
export AI_SESSION_ID=my-session
```
