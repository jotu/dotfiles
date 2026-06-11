import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyFailure,
  extractTextResponse,
  filterModels,
  parseVerboseMetadata,
  recommend,
  renderMarkdownMatrix,
} from "./verify-models-lib.mjs";

test("classifyFailure detects unsupported model", () => {
  assert.equal(classifyFailure("model_not_found"), "unsupported-model");
});

test("filterModels matches full and short ids", () => {
  const models = [
    { fullId: "openai/gpt-5.5", id: "gpt-5.5" },
    { fullId: "openai/gpt-5.3-codex", id: "gpt-5.3-codex" },
  ];
  const filtered = filterModels(models, ["gpt-5.3-codex"]);
  assert.deepEqual(filtered, [{ fullId: "openai/gpt-5.3-codex", id: "gpt-5.3-codex" }]);
});

test("recommend chooses codex for coding default", () => {
  const results = [
    { model: "openai/gpt-5.5", status: "pass", latencyMs: 5000, note: "general-purpose" },
    { model: "openai/gpt-5.3-codex", status: "pass", latencyMs: 5500, note: "coding" },
    { model: "openai/gpt-5.4-mini-fast", status: "pass", latencyMs: 4200, note: "helper" },
  ];
  const tiers = recommend(results);
  assert.equal(tiers.codingDefault?.model, "openai/gpt-5.3-codex");
});

test("renderMarkdownMatrix contains recommendation headers", () => {
  const markdown = renderMarkdownMatrix({
    provider: "openai",
    prompt: "Reply with exactly: OK",
    generatedAt: "2026-01-01T00:00:00.000Z",
    results: [],
    recommendations: { flagship: null, codingDefault: null, helperCheap: null },
  });
  assert.match(markdown, /## Recommended Tiers/);
  assert.match(markdown, /## Suggested Routing/);
});

test("parseVerboseMetadata extracts structured model metadata", () => {
  const output = [
    "openai/gpt-5.5",
    '{"family":"gpt"}',
    "openai/gpt-5.3-codex",
    '{"family":"codex"}',
  ].join("\n");

  const metadata = parseVerboseMetadata(output);
  assert.equal(metadata.get("openai/gpt-5.5")?.family, "gpt");
  assert.equal(metadata.get("openai/gpt-5.3-codex")?.family, "codex");
});

test("extractTextResponse returns latest text event", () => {
  const stream = [
    '{"type":"text","part":{"text":"not final"}}',
    "noise",
    '{"type":"text","part":{"text":"OK"}}',
  ].join("\n");

  assert.equal(extractTextResponse(stream), "OK");
});
