#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const [command, ...args] = process.argv.slice(2);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readJsonFile(path) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`failed to read JSON from ${path}: ${error.message}`);
  }
}

function parseJsonText(text, context = 'input') {
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`invalid JSON in ${context}: ${error.message}`);
  }
}

function renderTemplate(path) {
  const input = fs.readFileSync(path);
  const result = spawnSync('chezmoi', ['execute-template'], {
    input,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || 'chezmoi execute-template failed\n');
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

async function readStdin() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input;
}

if (command === 'config-current') {
  const [path] = args;
  if (!path) fail('usage: opencode-tasks.mjs config-current <path>');
  if (!fs.existsSync(path)) {
    fail('opencode.json missing; run chezmoi apply ~/.config/opencode/opencode.json');
  }
  const data = readJsonFile(path);
  const providers = Object.keys(data.provider ?? {}).sort().join(', ') || '(none)';
  console.log(`model: ${data.model ?? '(unset)'}`);
  console.log(`small_model: ${data.small_model ?? '(unset)'}`);
  console.log(`providers: ${providers}`);
  process.exit(0);
}

if (command === 'validate-json') {
  const input = await readStdin();
  parseJsonText(input);
  process.exit(0);
}

if (command === 'validate-plugins') {
  const expected = new Map([
    ['.chezmoitemplates/opencode/plugins-openai.json.tmpl', [
      'opencode-openai-codex-auth',
      'superpowers@git+https://github.com/obra/superpowers.git#v5.0.5',
      '@dietrichgebert/ponytail@4.8.3',
    ]],
    ['.chezmoitemplates/opencode/plugins-copilot.json.tmpl', [
      'superpowers@git+https://github.com/obra/superpowers.git#v5.0.5',
      '@dietrichgebert/ponytail@4.8.3',
    ]],
  ]);

  for (const [path, expectedPlugins] of expected.entries()) {
    const actualPlugins = parseJsonText(renderTemplate(path), path);
    if (JSON.stringify(actualPlugins) !== JSON.stringify(expectedPlugins)) {
      fail([
        `plugin allowlist mismatch in ${path}`,
        `expected: ${JSON.stringify(expectedPlugins)}`,
        `actual:   ${JSON.stringify(actualPlugins)}`,
      ].join('\n'));
    }
  }

  console.log('OpenCode plugin allowlists match expected values');
  process.exit(0);
}

fail(`unknown command: ${command ?? '(missing)'}`);
