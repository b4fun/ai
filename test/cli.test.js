import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";

const node = process.execPath;
const cli = new URL("../bin/ai.js", import.meta.url).pathname;

function runCli(args) {
  return execFileSync(node, [cli, ...args], { encoding: "utf8" });
}

test("prints package version with version command", () => {
  assert.match(runCli(["version"]), /^0\.1\.0-alpha\.7\n$/);
});

test("prints package version with --version flag", () => {
  assert.match(runCli(["--version"]), /^0\.1\.0-alpha\.7\n$/);
});

test("rejects prompt-only flags for upgrade command", () => {
  const result = spawnSync(node, [cli, "--thinking", "high", "upgrade"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /model and thinking flags are only supported in prompt mode/i);
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

  assert.match(snippet, /auth\|pi\|upgrade\|version\|shell/);
  assert.match(snippet, /local model=/);
  assert.match(snippet, /local thinking=/);
  assert.match(snippet, /--thinking\)/);
  assert.match(snippet, /set -- --thinking "\$thinking" "\$@"/);
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

  assert.match(snippet, /case auth pi upgrade version shell/);
  assert.match(snippet, /set -l model/);
  assert.match(snippet, /set -l thinking/);
  assert.match(snippet, /case --thinking/);
  assert.match(snippet, /_escape_apostrophes/);
  assert.match(snippet, /bind \\r .*_accept_line/);
  assert.match(snippet, /set ai_args --thinking "\$thinking" \$ai_args/);
  assert.match(snippet, /set ai_args -m "\$model" \$ai_args/);
});
