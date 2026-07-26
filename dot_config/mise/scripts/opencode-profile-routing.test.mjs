import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

function renderProfile(profile) {
  const input = fs.readFileSync('dot_config/opencode/opencode.json.tmpl');
  const result = spawnSync(
    'chezmoi',
    ['execute-template', '--override-data', JSON.stringify({ opencode: { profile } })],
    {
      input,
      encoding: 'utf8',
    },
  );

  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function assertRoutesExistInCatalog(config) {
  for (const model of [config.model, config.small_model, ...Object.values(config.agent).map((agent) => agent.model)]) {
    const [provider, id] = model.split('/');
    assert.ok(config.provider[provider]?.models[id], `${model} is not in the rendered provider catalog`);
  }
}

function assertTieredRouting(config) {
  for (const role of ['plan', 'orchestrator', 'reviewer', 'architect', 'ai-workflow-engineer', 'oracle', 'security-engineer', 'ultrabrain']) {
    assert.notEqual(config.agent[role].model, config.small_model, `${role} must not use small_model`);
  }
  for (const role of ['librarian', 'document-writer', 'quick', 'unspecified-low', 'documentation']) {
    assert.equal(config.agent[role].model, config.small_model, `${role} must use small_model`);
  }
}

test('home-copilot renders distinct routing defaults and work profiles stay unchanged', () => {
  const home = renderProfile('home-copilot');
  const workCopilot = renderProfile('work-copilot');
  const workOpenAI = renderProfile('work-openai');

  assert.equal(home.model, 'github-copilot/gpt-5.3-codex');
  assert.equal(home.small_model, 'github-copilot/gpt-5.4-mini');
  assert.equal(home.agent.plan.model, 'github-copilot/gpt-5.6-terra');

  assert.equal(workCopilot.model, 'github-copilot/gpt-5.3-codex');
  assert.equal(workCopilot.small_model, 'github-copilot/gpt-5-mini');
  assert.equal(workCopilot.agent.plan.model, 'github-copilot/gpt-5.6-luna');

  assert.equal(workOpenAI.model, 'openai/gpt-5.4');
  assert.equal(workOpenAI.small_model, 'openai/gpt-5.4-mini');
  assert.equal(workOpenAI.agent.plan.model, 'openai/gpt-5.5');

  assertRoutesExistInCatalog(home);
  assertRoutesExistInCatalog(workCopilot);
  assertRoutesExistInCatalog(workOpenAI);
  assertTieredRouting(home);
  assertTieredRouting(workCopilot);
  assertTieredRouting(workOpenAI);
});
