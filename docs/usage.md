# Usage

The direct CLI entry point is `ai prompt`:

```bash
ai --help
ai help
```

Use either form to show the top-level command reference.


```bash
command ai prompt Say hello
command ai prompt What files are in this directory?
command ai -m anthropic/claude-sonnet-4-5 prompt Explain this project
command ai -m smart --thinking high prompt Plan this refactor
```

If you install the shell wrapper, you can use the shorter form:

```bash
ai Say hello
ai What files are in this directory?
ai -m anthropic/claude-sonnet-4-5 Explain this project
ai -m smart --thinking high Plan this refactor
```

The CLI joins the remaining arguments into the prompt, so quotes are optional for most plain-language prompts. Use quotes when you need normal shell quoting behavior, such as preserving whitespace, pipes, redirects, variables, or other shell syntax as literal text.

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

This requires the `pi` command to be installed locally and available on `PATH`.
