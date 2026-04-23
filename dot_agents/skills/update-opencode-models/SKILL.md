---
name: update-opencode-models
description: Update OpenCode model routing for work (OpenAI), personal (GitHub Copilot), or both across opencode and oh-my-openagent template/profile files. Use when refreshing model catalogs, changing default model mix, or syncing role/category model assignments.
---

# Update OpenCode Models

Update model configuration with explicit scope control.

## Required Input

Accept one scope:
- `work` -> update only OpenAI work-mode routing
- `personal` -> update only GitHub Copilot personal-mode routing
- `both` -> update both trees

Default scope: `both`.

## Target Files

- `dot_config/opencode/opencode.json.tmpl`
- `dot_config/opencode/oh-my-openagent.json.tmpl`
- `dot_config/opencode/profiles/oh-my-openagent.copilot.json.tmpl`
- `dot_config/opencode/profiles/oh-my-openagent.openai.json.tmpl`
- `dot_config/opencode/profiles/opencode.copilot.json.tmpl`
- `dot_config/opencode/profiles/opencode.openai.json.tmpl`

## Procedure

1. Read all target files.
2. Build available model catalogs per provider from `provider.*.models` keys in:
   - `dot_config/opencode/opencode.json.tmpl`
   - `dot_config/opencode/profiles/opencode.openai.json.tmpl`
   - `dot_config/opencode/profiles/opencode.copilot.json.tmpl`
3. Assign only models that exist in each provider catalog.
4. Apply requested scope:
   - `work`: update only OpenAI branch values (`{{- if .work.enable }}`) and OpenAI profile files
   - `personal`: update only Copilot branch values (`{{- else }}`) and Copilot profile files
   - `both`: update both branches and both profile sets
5. Keep mirrored routing consistent:
- `dot_config/opencode/oh-my-openagent.json.tmpl` <-> `dot_config/opencode/profiles/oh-my-openagent.openai.json.tmpl` and `dot_config/opencode/profiles/oh-my-openagent.copilot.json.tmpl`
   - `dot_config/opencode/opencode.json.tmpl` <-> `dot_config/opencode/profiles/opencode.openai.json.tmpl` and `dot_config/opencode/profiles/opencode.copilot.json.tmpl`

## Optimization Target

Use a quality-first, cost-aware mix (never max-cost everywhere, never cheapest everywhere):

- Flagship models for high-risk reasoning/planning roles
- Strong coding models for implementation-heavy roles
- Cost-efficient models for high-throughput helper roles
- Mid-tier defaults for general routing

## Baseline Routing

### Work (OpenAI)

- Default: `model = openai/gpt-5.3-codex`
- Small: `small_model = openai/gpt-5.3-codex`
- Keep `plan`, `oracle`, `ultrabrain`, `visual-engineering`, `multimodal`, `frontend-ui-ux-engineer`, `multimodal-looker` on `openai/gpt-5.4`
- Keep OpenCode `model` and `small_model` on `openai/gpt-5.3-codex`
- Use `openai/gpt-5.4` for `sisyphus`, `build`, `explore`, `librarian`, `document-writer`, `ultrabrain`, `deep`, `quick`, `unspecified-low`, `documentation`, `visual-engineering`, and `multimodal` in `oh-my-openagent`

### Personal (GitHub Copilot)

- Default: `model = github-copilot/gpt-5.3-codex`
- Small: `small_model = github-copilot/claude-haiku-4.5`
- Keep `ultrabrain` on `github-copilot/claude-opus-4.6`
- Keep visual/multimodal roles on `github-copilot/gemini-3.1-pro-preview`
- Keep `plan`, `oracle`, `explore`, `documentation`, `unspecified-low` on `github-copilot/claude-sonnet-4.6`
- Keep `sisyphus`, `build`, `deep` on `github-copilot/gpt-5.3-codex`
- Keep `quick`, `librarian` on `github-copilot/claude-haiku-4.5`

## Guardrails

- Do not remove model entries unless explicitly asked.
- Do not change permissions, plugins, schema URLs, or unrelated keys.
- Preserve existing template conditionals and formatting style.

## Validation (Mise-Based)

Run repository task:

- `mise run opencode:models:validate`

Then show scoped changes:

- `git diff -- dot_config/opencode/opencode.json.tmpl dot_config/opencode/oh-my-openagent.json.tmpl dot_config/opencode/profiles/oh-my-openagent.copilot.json.tmpl dot_config/opencode/profiles/oh-my-openagent.openai.json.tmpl dot_config/opencode/profiles/opencode.copilot.json.tmpl dot_config/opencode/profiles/opencode.openai.json.tmpl`
