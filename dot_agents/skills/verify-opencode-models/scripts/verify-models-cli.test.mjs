import test from "node:test";
import assert from "node:assert/strict";

import { computeExitCode } from "./verify-models-lib.mjs";

test("verify mode fails when any model fails", () => {
  const results = [
    { status: "pass" },
    { status: "fail" },
  ];
  assert.equal(computeExitCode("verify", results), 1);
});

test("verify mode passes when all models pass", () => {
  const results = [{ status: "pass" }, { status: "pass" }];
  assert.equal(computeExitCode("verify", results), 0);
});

test("recommend mode passes when at least one model passes", () => {
  const results = [{ status: "pass" }, { status: "fail" }];
  assert.equal(computeExitCode("recommend", results), 0);
});

test("recommend mode fails when no models pass", () => {
  const results = [{ status: "fail" }, { status: "fail" }];
  assert.equal(computeExitCode("recommend", results), 1);
});

test("refresh mode shares recommend exit behavior", () => {
  const somePass = [{ status: "pass" }, { status: "fail" }];
  const nonePass = [{ status: "fail" }];
  assert.equal(computeExitCode("refresh", somePass), 0);
  assert.equal(computeExitCode("refresh", nonePass), 1);
});
