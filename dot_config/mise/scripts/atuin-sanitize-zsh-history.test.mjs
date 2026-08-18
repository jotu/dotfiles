import test from "node:test";
import assert from "node:assert/strict";

import { sanitizeHistory } from "./atuin-sanitize-zsh-history.mjs";

test("keeps safe history and drops secret-bearing commands", () => {
  const history = [
    ": 1700000000:0;git status",
    ": 1700000001:0;export AWS_SECRET_ACCESS_KEY=not-a-real-secret",
    ": 1700000002:0;curl -H Authorization: Bearer fake-token https://example.test",
    ": 1700000003:0;printf safe \\",
    "continuation",
  ].join("\n");

  const result = sanitizeHistory(history);

  assert.equal(result.total, 4);
  assert.equal(result.kept, 2);
  assert.equal(result.dropped, 2);
  assert.match(result.safeText, /git status/);
  assert.match(result.safeText, /printf safe/);
  assert.doesNotMatch(result.safeText, /AWS_SECRET_ACCESS_KEY/);
  assert.doesNotMatch(result.safeText, /Bearer fake-token/);
});

test("drops malformed extended and unterminated records", () => {
  const history = [
    ": not-a-valid-extended-record",
    ": 1700000000:0;echo unfinished \\",
  ].join("\n");

  const result = sanitizeHistory(history);

  assert.equal(result.total, 2);
  assert.equal(result.kept, 0);
  assert.equal(result.dropped, 2);
  assert.equal(result.malformed, 2);
});
