import assert from "node:assert/strict";
import test from "node:test";
import { confirmLoginAfterAuthError, isAuthError } from "../src/auth.js";

test("detects missing local auth errors", () => {
  assert.equal(isAuthError(new Error('No API key found for "github-copilot"')), true);
});

test("detects remote auth failures", () => {
  assert.equal(isAuthError(new Error("401 Unauthorized")), true);
  assert.equal(isAuthError(new Error("invalid token")), true);
  assert.equal(isAuthError(new Error("Authentication failed")), true);
});

test("does not treat unrelated errors as auth failures", () => {
  assert.equal(isAuthError(new Error("Model not found: nope")), false);
  assert.equal(isAuthError(new Error("Foreground command exited with code 1")), false);
});

test("does not prompt for login outside interactive terminals", async () => {
  assert.equal(await confirmLoginAfterAuthError(undefined, new Error('No API key found for "github-copilot"')), false);
});
