# Home Copilot Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `home-copilot` its own verified high-quality routing defaults without changing `work-copilot` or `work-openai` behavior.

**Architecture:** Keep the single canonical `chezmoi` template and localize the change to profile-specific variable assignment near the top of `dot_config/opencode/opencode.json.tmpl`. Add a focused regression test that renders each supported profile, parses JSON, asserts the intended `home-copilot` routing, and confirms sentinel values remain unchanged for `work-copilot` and `work-openai`, then validate all supported renders with the existing mise task.

**Tech Stack:** chezmoi templates, Node.js test runner, OpenCode config JSON, mise tasks

---

### Task 1: Confirm verification source before implementation

**Files:**
- Read: `dot_agents/skills/verify-opencode-models/references/model-matrix.github-copilot.md`

- [ ] **Step 1: Check the current GitHub Copilot verification artifact**

Read `dot_agents/skills/verify-opencode-models/references/model-matrix.github-copilot.md` and confirm these models still show `pass`:

- `github-copilot/claude-opus-4.7`
- `github-copilot/gpt-5.3-codex`
- `github-copilot/gpt-5.4-mini`

- [ ] **Step 2: Refresh only if the artifact is stale or missing the chosen models**

Run: `mise run opencode:models:refresh:matrix:github-copilot`

Expected: updated managed matrix artifact with the chosen models still passing.

- [ ] **Step 3: Stop if the chosen models are not verified passing**

If any selected model is not passing, do not edit config. Re-run recommendation and revisit the tier choice first.

### Task 2: Add regression coverage for profile routing

**Files:**
- Create: `dot_config/mise/scripts/opencode-profile-routing.test.mjs`
- Modify: `dot_config/mise/conf.d/00-opencode.toml.tmpl`
- Test: `dot_config/mise/scripts/opencode-profile-routing.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

function renderProfile(profile) {
  const input = fs.readFileSync('dot_config/opencode/opencode.json.tmpl');
  const result = spawnSync('chezmoi', ['execute-template', '--override-data', JSON.stringify({ opencode: { profile } })], {
    input,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('home-copilot renders distinct routing defaults and work profiles stay unchanged', () => {
  const home = renderProfile('home-copilot');
  const workCopilot = renderProfile('work-copilot');
  const workOpenAI = renderProfile('work-openai');

  assert.equal(home.model, 'github-copilot/gpt-5.3-codex');
  assert.equal(home.small_model, 'github-copilot/gpt-5.4-mini');
  assert.equal(home.agent.plan.model, 'github-copilot/claude-opus-4.7');

  assert.equal(workCopilot.model, 'github-copilot/gpt-5.4');
  assert.equal(workCopilot.small_model, 'github-copilot/gpt-5.4-mini');
  assert.equal(workCopilot.agent.plan.model, 'github-copilot/gemini-3.1-pro-preview');

  assert.equal(workOpenAI.model, 'openai/gpt-5.4');
  assert.equal(workOpenAI.small_model, 'openai/gpt-5.4-mini');
  assert.equal(workOpenAI.agent.plan.model, 'openai/gpt-5.5');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test dot_config/mise/scripts/opencode-profile-routing.test.mjs`
Expected: FAIL because the current template does not yet render the home-specific defaults.

- [ ] **Step 3: Add the test task wiring**

```toml
[tasks."opencode:models:test"]
run = "node --test dot_agents/skills/verify-opencode-models/scripts/verify-models.test.mjs dot_agents/skills/verify-opencode-models/scripts/verify-models-cli.test.mjs dot_config/mise/scripts/opencode-profile-routing.test.mjs"
```

- [ ] **Step 4: Run test again to keep failure focused**

Run: `node --test dot_config/mise/scripts/opencode-profile-routing.test.mjs`
Expected: FAIL only on the intended home-copilot assertions.

### Task 3: Implement the profile-specific routing change

**Files:**
- Modify: `dot_config/opencode/opencode.json.tmpl`
- Test: `dot_config/mise/scripts/opencode-profile-routing.test.mjs`

- [ ] **Step 1: Change the profile assignment block minimally**

```tmpl
{{- $copilotFlagship := "github-copilot/claude-opus-4.6" -}}
{{- $copilotCoding := "github-copilot/gpt-5.4" -}}
{{- $copilotHelper := "github-copilot/gpt-5.4-mini" -}}
{{- if eq $profile "work-copilot" -}}
  {{- $copilotFlagship = "github-copilot/gemini-3.1-pro-preview" -}}
{{- else if eq $profile "home-copilot" -}}
  {{- $copilotFlagship = "github-copilot/claude-opus-4.7" -}}
  {{- $copilotCoding = "github-copilot/gpt-5.3-codex" -}}
{{- end -}}
```

- [ ] **Step 2: Run the focused test to verify it passes**

Run: `node --test dot_config/mise/scripts/opencode-profile-routing.test.mjs`
Expected: PASS

- [ ] **Step 3: Refactor only if needed**

Keep the branch easy to read; do not broaden the change beyond the variable-selection block.

### Task 4: Validate supported renders and regression coverage

**Files:**
- Test: `dot_config/mise/scripts/opencode-profile-routing.test.mjs`

- [ ] **Step 1: Run the full model test task**

Run: `mise run opencode:models:test`
Expected: PASS

- [ ] **Step 2: Run config validation for all supported profiles**

Run: `mise run opencode:models:validate`
Expected: PASS with valid JSON for `work-openai`, `work-copilot`, and `home-copilot`.

- [ ] **Step 3: Capture render evidence for unchanged work profiles**

Run:
`chezmoi execute-template --file --override-data '{"opencode":{"profile":"work-copilot"}}' dot_config/opencode/opencode.json.tmpl`

and

`chezmoi execute-template --file --override-data '{"opencode":{"profile":"work-openai"}}' dot_config/opencode/opencode.json.tmpl`

Expected: rendered `model`, `small_model`, and representative `agent.plan.model` values remain unchanged for both work profiles.
