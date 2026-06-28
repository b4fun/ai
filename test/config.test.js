import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { clearShellProfileFork, readShellProfile, readShellProfileState, writeShellProfile } from "../src/config.js";

test("stores active shell profile in the session directory", () => {
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-session-"));
  assert.equal(readShellProfile(sessionDir), undefined);

  writeShellProfile("read-only", sessionDir);
  assert.equal(readShellProfile(sessionDir), "read-only");
});

test("stores active shell profile fork marker", () => {
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-session-"));
  writeShellProfile("read-only", { forkSession: true }, sessionDir);
  assert.deepEqual(readShellProfileState(sessionDir), { profile: "read-only", forkSession: true });

  clearShellProfileFork(sessionDir);
  assert.deepEqual(readShellProfileState(sessionDir), { profile: "read-only", forkSession: false });
});
