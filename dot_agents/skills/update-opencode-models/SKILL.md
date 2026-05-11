---
name: update-opencode-models
description: Update the single native OpenCode template for work and personal defaults. Use when refreshing model catalogs, changing the default model mix, or keeping the chezmoi-rendered config aligned.
---

# Update OpenCode Models

Update model configuration with explicit scope control.

## Required Input

Accept one scope:
- `work` -> update only work-machine defaults and provider catalogs
- `personal` -> update only personal-machine defaults and provider catalogs
- `both` -> update both trees

Default scope: `both`.

## Target Files

- `dot_config/opencode/opencode.json.tmpl`

## Procedure

1. Refresh the verified matrix first:
   - `mise run opencode:models:refresh:matrix:openai`
   - `mise run opencode:models:refresh:matrix:github-copilot`
   - or `mise run opencode:models:refresh:matrix:all` when updating both trees
2. Read the matrix artifacts and recommendations from:
   - `dot_agents/skills/verify-opencode-models/references/model-matrix.openai.json`
   - `dot_agents/skills/verify-opencode-models/references/model-matrix.github-copilot.json`
3. Read the target file.
4. Build available model catalogs per provider from `provider.*.models` keys in `dot_config/opencode/opencode.json.tmpl`.
5. Assign only models that both exist in each provider catalog and pass in the refreshed verified matrix.
6. Apply requested scope:
   - `work`: update only work-machine branch values (`{{- if .work.enable }}`)
   - `personal`: update only personal-machine branch values (`{{- else }}`)
   - `both`: update both branches in the single template

## Optimization Target

Use a quality-first, cost-aware mix (never max-cost everywhere, never cheapest everywhere):

- Strong default model for the main coding flow
- Cost-efficient small model for lightweight tasks
- Provider catalogs that retain verified usable options without forcing them as defaults

## Baseline Routing

### Work

- Default: `model = openai/gpt-5.3-codex`
- Small: `small_model = openai/gpt-5.4-mini`
- Keep both `openai` and `github-copilot` providers available on work machines.
- Keep OpenCode `model` on `openai/gpt-5.3-codex` and `small_model` on `openai/gpt-5.4-mini` unless refreshed verification proves a better default.
- Keep verified OpenAI catalog entries available for explicit selection without promoting unverified options to defaults.

### Personal

- Default: `model = github-copilot/gpt-5.3-codex`
- Small: `small_model = github-copilot/gemini-3-flash-preview`
- Keep GitHub Copilot as the only managed provider on personal/home machines.
- Keep OpenCode `model` on `github-copilot/gpt-5.3-codex` and `small_model` on `github-copilot/gemini-3-flash-preview` unless refreshed verification proves a better default.
- Keep verified Copilot catalog entries available for explicit selection without promoting unverified options to defaults.

## Rendered Machine Defaults

- Work machines (`work.enable = true`) render an OpenAI/Codex-default config and keep both OpenAI and GitHub Copilot available.
- Personal machines (`work.enable = false`) render a GitHub Copilot-default config and keep GitHub Copilot as the only managed provider.
- Check the active rendered config: `mise run opencode:config:current`
- Do not reintroduce manual profile switching or separate rendered profile files unless the user explicitly asks for that operating model.

When updating defaults, apply the correct scope (`work`, `personal`, or `both`) to match the target machine type.

## Guardrails

- Do not remove model entries unless explicitly asked.
- Do not change permissions, plugins, schema URLs, or unrelated keys.
- Preserve existing template conditionals and formatting style.

## Validation (Mise-Based)

Run repository task:

- `mise run opencode:models:validate`

Then show scoped changes:

- `git diff -- dot_config/opencode/opencode.json.tmpl`
