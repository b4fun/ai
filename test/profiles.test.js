import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildProfiledPrompt,
  getProfileAppendSystemPrompt,
  getProfileTools,
  resolveConfigRelativePath,
  resolveProfile,
} from "../src/profiles.js";

test("resolves explicit and default profiles", () => {
  const config = {
    defaultProfile: "review",
    profiles: {
      review: { tools: ["read", "bash"] },
      edit: { tools: ["read", "edit"] },
    },
  };

  assert.equal(resolveProfile(config).name, "review");
  assert.equal(resolveProfile(config, "edit").name, "edit");
  assert.throws(() => resolveProfile(config, "missing"), /Profile not found: missing/);
});

test("resolves profile paths relative to config file", () => {
  assert.equal(
    resolveConfigRelativePath("profiles/review.md", "/tmp/b4fun/config.json"),
    path.resolve("/tmp/b4fun/profiles/review.md"),
  );
  assert.equal(resolveConfigRelativePath("/abs/review.md", "/tmp/b4fun/config.json"), "/abs/review.md");
});

test("builds prompt from promptFile and user prompt", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-profile-"));
  const configPath = path.join(dir, "config.json");
  fs.mkdirSync(path.join(dir, "profiles"));
  fs.writeFileSync(path.join(dir, "profiles", "review.md"), "Review carefully.\n", "utf8");

  assert.equal(
    buildProfiledPrompt("check this diff", { promptFile: "profiles/review.md" }, configPath),
    "Review carefully.\n\ncheck this diff",
  );
  assert.equal(buildProfiledPrompt("", { promptFile: "profiles/review.md" }, configPath), "Review carefully.");
});

test("normalizes appendSystemPrompt and tools", () => {
  assert.deepEqual(getProfileAppendSystemPrompt({ appendSystemPrompt: "Be concise." }), ["Be concise."]);
  assert.deepEqual(getProfileAppendSystemPrompt({ appendSystemPrompt: ["A", "B"] }), ["A", "B"]);
  assert.deepEqual(getProfileTools({ tools: ["read", "bash"] }), ["read", "bash"]);
  assert.throws(() => getProfileTools({ tools: "read" }), /profile.tools must be an array/);
});
