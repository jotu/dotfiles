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
  for (const role of ['librarian', 'document-writer', 'quick', 'unspecified-low', 'documentation']) {
    assert.equal(config.agent[role].model, config.small_model, `${role} must use small_model`);
  }
}

function assertVariantReasoningPolicy(config) {
  for (const [role, agent] of Object.entries(config.agent)) {
    if (agent.model.includes('claude-sonnet-4.6')) continue;
    assert.ok(['low', 'medium', 'high'].includes(agent.variant), `${role} must define a reasoning variant`);
    const [provider, model] = agent.model.split('/');
    assert.ok(config.provider[provider].models[model].variants?.[agent.variant], `${role} variant must exist`);
  }
}

function assertFixedReasoningModel(config, model, upstream, effort) {
  const entry = config.provider.openai.models[model];
  assert.equal(entry.id, upstream);
  assert.equal(entry.options.reasoningEffort, effort);
  assert.ok(Object.values(entry.variants).every((variant) => variant.disabled), `${model} variants must be disabled`);
}

function assertOpenAIModelPolicy(config) {
  assert.equal(config.model, 'openai/gpt-5.6-luna-medium');
  assert.equal(config.small_model, 'openai/gpt-5.6-luna-low');

  assertFixedReasoningModel(config, 'gpt-5.6-luna-low', 'gpt-5.6-luna', 'low');
  assertFixedReasoningModel(config, 'gpt-5.6-luna-medium', 'gpt-5.6-luna', 'medium');
  assertFixedReasoningModel(config, 'gpt-5.6-luna-high', 'gpt-5.6-luna', 'high');
  assertFixedReasoningModel(config, 'gpt-5.6-sol-high', 'gpt-5.6-sol', 'high');

  for (const role of ['plan', 'orchestrator', 'reviewer', 'architect', 'ai-workflow-engineer', 'oracle', 'security-engineer']) {
    assert.equal(config.agent[role].model, 'openai/gpt-5.6-luna-high');
  }

  assert.equal(config.agent.ultrabrain.model, 'openai/gpt-5.6-sol-high');

  for (const role of ['build', 'platform-engineer', 'developer-platform-engineer', 'builder', 'delivery-engineer', 'observability-engineer', 'explore', 'deep', 'frontend-ui-ux-engineer', 'multimodal-looker', 'visual-engineering', 'multimodal']) {
    assert.equal(config.agent[role].model, 'openai/gpt-5.6-luna-medium');
  }

  for (const [role, agent] of Object.entries(config.agent)) {
    assert.equal(agent.variant, undefined, `${role} must not use a shared session variant`);
    assert.equal(agent.reasoningEffort, undefined, `${role} must get reasoning from its fixed model`);
    if (role !== 'ultrabrain') assert.notEqual(agent.model, 'openai/gpt-5.6-sol-high', `${role} must not use Sol`);
  }
}

function assertCopilotModelPolicy(config, flagshipModel, codingModel, helperModel) {
  for (const role of ['plan', 'orchestrator', 'reviewer', 'architect', 'ai-workflow-engineer', 'oracle', 'security-engineer', 'ultrabrain']) {
    assert.equal(config.agent[role].model, flagshipModel);
    assert.equal(config.agent[role].variant, 'high');
  }

  for (const role of ['build', 'platform-engineer', 'developer-platform-engineer', 'builder', 'delivery-engineer', 'observability-engineer', 'explore', 'deep']) {
    assert.equal(config.agent[role].model, codingModel);
    assert.equal(config.agent[role].variant, 'medium');
  }

  for (const role of ['librarian', 'document-writer', 'quick', 'unspecified-low', 'documentation']) {
    assert.equal(config.agent[role].model, helperModel);
    assert.equal(config.agent[role].variant, 'low');
  }
}

test('home-copilot renders distinct routing defaults and work profiles stay unchanged', () => {
  const home = renderProfile('home-copilot');
  const workCopilot = renderProfile('work-copilot');
  const workOpenAI = renderProfile('work-openai');

  assert.equal(home.model, 'github-copilot/gpt-5.3-codex');
  assert.equal(home.small_model, 'github-copilot/gpt-5.4-mini');
  assert.equal(home.agent.plan.model, 'github-copilot/gpt-5.6-terra');
  assertCopilotModelPolicy(home, 'github-copilot/gpt-5.6-terra', 'github-copilot/gpt-5.3-codex', 'github-copilot/gpt-5.4-mini');

  assert.equal(workCopilot.model, 'github-copilot/gpt-5.3-codex');
  assert.equal(workCopilot.small_model, 'github-copilot/gpt-5-mini');
  assert.equal(workCopilot.agent.plan.model, 'github-copilot/gpt-5.6-luna');
  assertCopilotModelPolicy(workCopilot, 'github-copilot/gpt-5.6-luna', 'github-copilot/gpt-5.3-codex', 'github-copilot/gpt-5-mini');

  assert.equal(workOpenAI.model, 'openai/gpt-5.6-luna-medium');
  assert.equal(workOpenAI.small_model, 'openai/gpt-5.6-luna-low');
  assert.equal(workOpenAI.agent.plan.model, 'openai/gpt-5.6-luna-high');
  assertOpenAIModelPolicy(workOpenAI);

  assertRoutesExistInCatalog(home);
  assertRoutesExistInCatalog(workCopilot);
  assertRoutesExistInCatalog(workOpenAI);
  assertTieredRouting(home);
  assertTieredRouting(workCopilot);
  assertTieredRouting(workOpenAI);
  assertVariantReasoningPolicy(home);
  assertVariantReasoningPolicy(workCopilot);
});
