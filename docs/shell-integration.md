# Shell integration

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

On zsh, the installed wrapper uses `noglob`, so prompts like `??`, `*`, or `[abc]` can be passed through unquoted instead of being expanded by the shell. The zsh and fish integrations also install Enter-key hooks for the wrapper command so common apostrophes in contractions are escaped before the shell parses the line.

Shell wrappers pass through management commands such as `ai auth`, `ai config`, `ai models`, `ai setup`, `ai pi`, `ai upgrade`, `ai version`, and `ai shell`; the real binary remains available with `command ai ...`.
