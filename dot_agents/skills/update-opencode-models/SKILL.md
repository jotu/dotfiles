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

1. Refresh the verified matrix first:
   - `mise run opencode:models:refresh:matrix:openai`
   - `mise run opencode:models:refresh:matrix:github-copilot`
   - or `mise run opencode:models:refresh:matrix:all` when updating both trees
2. Read the matrix artifacts and recommendations from:
   - `dot_agents/skills/verify-opencode-models/references/model-matrix.openai.json`
   - `dot_agents/skills/verify-opencode-models/references/model-matrix.github-copilot.json`
3. Read all target files.
4. Build available model catalogs per provider from `provider.*.models` keys in:
   - `dot_config/opencode/opencode.json.tmpl`
   - `dot_config/opencode/profiles/opencode.openai.json.tmpl`
   - `dot_config/opencode/profiles/opencode.copilot.json.tmpl`
5. Assign only models that both exist in each provider catalog and pass in the refreshed verified matrix.
6. Apply requested scope:
   - `work`: update only OpenAI branch values (`{{- if .work.enable }}`) and OpenAI profile files
   - `personal`: update only Copilot branch values (`{{- else }}`) and Copilot profile files
   - `both`: update both branches and both profile sets
7. Keep mirrored routing consistent:
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
- Small: `small_model = openai/gpt-5.4-mini`
- Keep flagship reasoning roles like `plan`, `oracle`, `architect`, `reviewer`, and `ultrabrain` on `openai/gpt-5.5`
- Keep OpenCode `model` on `openai/gpt-5.3-codex` and `small_model` on `openai/gpt-5.4-mini`
- Use `openai/gpt-5.3-codex` for coding-heavy OpenAI routes like `sisyphus`, `build`, `platform-engineer`, `developer-platform-engineer`, `builder`, `delivery-engineer`, `observability-engineer`, `explore`, and `deep`
- Use `openai/gpt-5.4-mini` for helper OpenAI routes like `quick`, `unspecified-low`, `documentation`, `document-writer`, and lightweight `librarian`
- Keep `openai/gpt-5.4` for OpenAI visual and multimodal routes like `frontend-ui-ux-engineer`, `visual-engineering`, `multimodal`, and `multimodal-looker`

### Personal (GitHub Copilot)

- Default: `model = github-copilot/gpt-5.3-codex`
- Small: `small_model = github-copilot/claude-haiku-4.5`
- Keep `ultrabrain` on `github-copilot/claude-opus-4.7`
- Keep visual/multimodal roles on `github-copilot/gemini-3.1-pro-preview`
- Keep `plan`, `oracle`, `explore`, `documentation`, `unspecified-low` on `github-copilot/claude-sonnet-4.6`
- Keep `sisyphus`, `build`, `deep` on `github-copilot/gpt-5.3-codex`
- Keep `quick`, `librarian` on `github-copilot/claude-haiku-4.5`

## Profile Defaults and Switching

- Work machines (`work.enable = true`) default to the OpenAI/Codex profile.
- Personal machines (`work.enable = false`) default to the GitHub Copilot profile.
- On work machines, switch to Copilot at any time: `mise run opencode:profile:copilot`
- Switch back to OpenAI: `mise run opencode:profile:openai`
- Check the active profile: `mise run opencode:profile:current`

When updating routing, apply the correct scope (`work`, `personal`, or `both`) to match the target machine type.

## Guardrails

- Do not remove model entries unless explicitly asked.
- Do not change permissions, plugins, schema URLs, or unrelated keys.
- Preserve existing template conditionals and formatting style.

## Validation (Mise-Based)

Run repository task:

- `mise run opencode:models:validate`

Then show scoped changes:

- `git diff -- dot_config/opencode/opencode.json.tmpl dot_config/opencode/oh-my-openagent.json.tmpl dot_config/opencode/profiles/oh-my-openagent.copilot.json.tmpl dot_config/opencode/profiles/oh-my-openagent.openai.json.tmpl dot_config/opencode/profiles/opencode.copilot.json.tmpl dot_config/opencode/profiles/opencode.openai.json.tmpl`
