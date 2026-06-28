import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { VERSION } from "../src/version.js";

const node = process.execPath;
const cli = new URL("../bin/ai.js", import.meta.url).pathname;

function runCli(args, options = {}) {
  return execFileSync(node, [cli, ...args], { encoding: "utf8", ...options });
}

test("prints package version with version command", () => {
  assert.equal(runCli(["version"]), `${VERSION}\n`);
});

test("prints package version with --version flag", () => {
  assert.equal(runCli(["--version"]), `${VERSION}\n`);
});

test("config commands write and read model aliases", () => {
  const xdgHome = fs.mkdtempSync(path.join(os.tmpdir(), "ai-config-"));
  const env = { ...process.env, XDG_HOME: xdgHome };

  runCli(["config", "set", "model", "fast"], { env });
  runCli(["config", "alias", "fast", "github-copilot/gpt-5.4-mini"], { env });
  runCli(["config", "alias", "smart", "anthropic/claude-sonnet-4-5", "--thinking", "high"], { env });

  assert.equal(runCli(["config", "get", "model"], { env }), "fast\n");
  assert.deepEqual(JSON.parse(runCli(["config", "get"], { env })), {
    model: "fast",
    modelAliases: {
      fast: "github-copilot/gpt-5.4-mini",
      smart: { model: "anthropic/claude-sonnet-4-5", thinking: "high" },
    },
  });
});

test("rejects prompt-only flags for upgrade command", () => {
  const result = spawnSync(node, [cli, "--thinking", "high", "upgrade"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /model, thinking, and profile flags are only supported in prompt and pi modes/i);
});

test("pi command requires an interactive terminal", () => {
  const result = spawnSync(node, [cli, "pi"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Starting pi requires an interactive terminal/);
});

test("bash shell wrapper forwards model and thinking flags", () => {
  const snippet = runCli(["shell", "init", "bash", "--name", "ai"]);

  assert.match(snippet, /auth\|config\|models\|setup\|pi\|upgrade\|version\|shell/);
  assert.match(snippet, /local model=/);
  assert.match(snippet, /local thinking=/);
  assert.match(snippet, /local profile=/);
  assert.match(snippet, /--thinking\)/);
  assert.match(snippet, /--profile\)/);
  assert.match(snippet, /set -- --thinking "\$thinking" "\$@"/);
  assert.match(snippet, /set -- --profile "\$profile" "\$@"/);
  assert.match(snippet, /set -- -m "\$model" "\$@"/);
});

test("zsh shell wrapper installs apostrophe accept-line helper", () => {
  const snippet = runCli(["shell", "init", "zsh", "--name", "ai"]);

  assert.match(snippet, /_escape_apostrophes\(\)/);
  assert.match(snippet, /_accept_line\(\)/);
  assert.match(snippet, /zle -A .* accept-line/);
});

test("fish shell wrapper forwards model and thinking flags", () => {
  const snippet = runCli(["shell", "init", "fish", "--name", "ai"]);

  assert.match(snippet, /case auth config models setup pi upgrade version shell/);
  assert.match(snippet, /set -l model/);
  assert.match(snippet, /set -l thinking/);
  assert.match(snippet, /set -l profile/);
  assert.match(snippet, /case --thinking/);
  assert.match(snippet, /case -P --profile/);
  assert.match(snippet, /_escape_apostrophes/);
  assert.match(snippet, /bind \\r .*_accept_line/);
  assert.match(snippet, /set ai_args --thinking "\$thinking" \$ai_args/);
  assert.match(snippet, /set ai_args -m "\$model" \$ai_args/);
});
