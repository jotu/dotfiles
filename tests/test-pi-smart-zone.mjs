import assert from "node:assert/strict";
import test from "node:test";
import smartZoneExtension from "../dot_pi/agent/extensions/smart-zone.ts";

function createExtension() {
  const handlers = new Map();
  smartZoneExtension({
    on(event, handler) {
      handlers.set(event, handler);
    },
  });
  return handlers;
}

function createContext(tokens, contextWindow = 200_000) {
  let currentTokens = tokens;
  let currentWindow = contextWindow;
  let widget;
  return {
    context: {
      hasUI: true,
      ui: {
        setWidget(key, content, options) {
          widget = { key, content, options };
        },
      },
      getContextUsage() {
        return currentTokens === undefined
          ? undefined
          : { tokens: currentTokens, contextWindow: currentWindow, percent: currentTokens / currentWindow * 100 };
      },
    },
    getWidget: () => widget,
    setTokens: (nextTokens) => {
      currentTokens = nextTokens;
    },
    setWindow: (nextWindow) => {
      currentWindow = nextWindow;
    },
  };
}

test("shows the smart-zone label and current context count below 125k", async () => {
  const handlers = createExtension();
  const { context, getWidget } = createContext(124_999);

  await handlers.get("turn_end")({}, context);

  assert.deepEqual(getWidget(), {
    key: "smart-zone",
    content: ["SMART ZONE · 124,999 tokens"],
    options: { placement: "aboveEditor" },
  });
});

test("marks the transition band through 150k and recommends a reset above it", async () => {
  const handlers = createExtension();
  const cases = [
    [125_000, "FOCUS DRIFT · 125,000 tokens"],
    [150_000, "FOCUS DRIFT · 150,000 tokens"],
    [150_001, "REFOCUS · 150,001 tokens — /compact or /new"],
  ];

  for (const [tokens, expected] of cases) {
    const { context, getWidget } = createContext(tokens);
    await handlers.get("turn_end")({}, context);
    assert.equal(getWidget()?.content[0], expected);
  }
});

test("shows small-model capacity and warns from half the context window", async () => {
  const handlers = createExtension();
  const { context, getWidget, setTokens } = createContext(20_479, 40_960);

  await handlers.get("turn_end")({}, context);
  assert.equal(getWidget()?.content[0], "CONTEXT CAPACITY (estimate) · 20,479 / 40,960 tokens (49%)");

  setTokens(20_480);
  await handlers.get("turn_end")({}, context);
  assert.equal(getWidget()?.content[0], "CONTEXT CAPACITY (estimate) · 20,480 / 40,960 tokens (50%) — consider /compact or /new");
});

test("model selection updates the capacity display for the reported context window", async () => {
  const handlers = createExtension();
  const { context, getWidget, setWindow } = createContext(30_000);
  await handlers.get("session_start")({}, context);
  assert.match(getWidget()?.content[0], /^SMART ZONE/);

  setWindow(40_960);
  await handlers.get("model_select")({}, context);
  assert.equal(getWidget()?.content[0], "CONTEXT CAPACITY (estimate) · 30,000 / 40,960 tokens (73%) — consider /compact or /new");

  setWindow(1_000_000);
  await handlers.get("model_select")({}, context);
  assert.match(getWidget()?.content[0], /^SMART ZONE/);
});

test("switches from capacity to the original zone at a 200k context window", async () => {
  const handlers = createExtension();
  const { context, getWidget, setWindow } = createContext(100_000, 199_999);
  await handlers.get("turn_end")({}, context);
  assert.match(getWidget()?.content[0], /^CONTEXT CAPACITY/);

  setWindow(200_000);
  await handlers.get("model_select")({}, context);
  assert.match(getWidget()?.content[0], /^SMART ZONE/);
});

test("missing or invalid context information does not claim a zone", async () => {
  const handlers = createExtension();
  for (const window of [undefined, 0, -1, NaN, Infinity]) {
    const { context, getWidget, setWindow } = createContext(123);
    setWindow(window);
    await handlers.get("turn_end")({}, context);
    assert.equal(getWidget()?.content[0], "CONTEXT LIMIT UNKNOWN · 123 tokens");
  }
  for (const tokens of [undefined, null, -1, NaN, Infinity]) {
    const { context, getWidget } = createContext(tokens, 40_960);
    await handlers.get("turn_end")({}, context);
    assert.equal(getWidget()?.content[0], "CONTEXT USAGE PENDING");
  }
});

test("clears stale context usage after compaction until fresh usage arrives", async () => {
  const handlers = createExtension();
  const { context, getWidget, setTokens } = createContext(160_000);

  await handlers.get("turn_end")({}, context);
  assert.match(getWidget()?.content[0], /^REFOCUS/);

  setTokens(null);
  await handlers.get("session_compact")({}, context);

  assert.deepEqual(getWidget(), {
    key: "smart-zone",
    content: ["CONTEXT USAGE PENDING"],
    options: { placement: "aboveEditor" },
  });
});

test("refreshes the widget on session start and model selection, then clears it on shutdown", async () => {
  const handlers = createExtension();
  const { context, getWidget, setTokens } = createContext(100_000);

  await handlers.get("session_start")({}, context);
  assert.match(getWidget()?.content[0], /^SMART ZONE/);

  setTokens(130_000);
  await handlers.get("model_select")({}, context);
  assert.match(getWidget()?.content[0], /^FOCUS DRIFT/);

  await handlers.get("session_shutdown")({}, context);
  assert.deepEqual(getWidget(), { key: "smart-zone", content: undefined, options: undefined });
});

test("refreshes the widget when the active session branch changes", async () => {
  const handlers = createExtension();
  const { context, getWidget, setTokens } = createContext(160_000);

  await handlers.get("turn_end")({}, context);
  assert.match(getWidget()?.content[0], /^REFOCUS/);

  setTokens(100_000);
  await handlers.get("session_tree")?.({}, context);

  assert.match(getWidget()?.content[0], /^SMART ZONE/);
});
