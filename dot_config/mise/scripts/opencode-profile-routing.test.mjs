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

test('home-copilot renders distinct routing defaults and work profiles stay unchanged', () => {
  const home = renderProfile('home-copilot');
  const workCopilot = renderProfile('work-copilot');
  const workOpenAI = renderProfile('work-openai');

  assert.equal(home.model, 'github-copilot/gpt-5.3-codex');
  assert.equal(home.small_model, 'github-copilot/gemini-3.5-flash');
  assert.equal(home.agent.plan.model, 'github-copilot/gemini-2.5-pro');

  assert.equal(workCopilot.model, 'github-copilot/gpt-5.4');
  assert.equal(workCopilot.small_model, 'github-copilot/gpt-5.4-mini');
  assert.equal(workCopilot.agent.plan.model, 'github-copilot/gemini-3.1-pro-preview');

  assert.equal(workOpenAI.model, 'openai/gpt-5.4');
  assert.equal(workOpenAI.small_model, 'openai/gpt-5.4-mini');
  assert.equal(workOpenAI.agent.plan.model, 'openai/gpt-5.5');
});
