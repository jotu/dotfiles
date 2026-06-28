---
name: update-opencode-models
description: Update the single native OpenCode template for work and personal defaults. Use when refreshing model catalogs, changing the default model mix, or keeping the chezmoi-rendered config aligned.
---

# Update OpenCode Models

Update model configuration with explicit scope control.

## Required Input

Accept one profile scope:
- `work-openai`
- `work-copilot`
- `home-copilot`
- `all` (default)

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
6. Build and document a role-tier mapping for the target scope:
   - flagship reasoning roles
   - coding-default roles
   - helper-cheap roles
   Ensure profile defaults (`model`, `small_model`) align with this role-tier mapping.
7. Apply requested scope:
   - `work-openai`: update only OpenAI-default profile values
   - `work-copilot`: update only Copilot-default work profile values
   - `home-copilot`: update only Copilot-default home profile values
   - `all`: update all supported profiles in the single template

## Optimization Target

Use a quality-first, cost-aware mix (never max-cost everywhere, never cheapest everywhere):

- Strong default model for the main coding flow
- Cost-efficient small model for lightweight tasks
- Strongest reliable flagship model for high-risk reasoning/review roles
- Provider catalogs that retain verified usable options without forcing them as defaults

## Baseline Routing

### Work OpenAI

- Default: `model = openai/gpt-5.4`
- Small: `small_model = openai/gpt-5.4-mini`
- Keep both `openai` and `github-copilot` providers available on work machines.
- Keep OpenCode `model` on `openai/gpt-5.4` and `small_model` on `openai/gpt-5.4-mini` unless refreshed verification proves a better default.
- Keep verified OpenAI catalog entries available for explicit selection without promoting unverified options to defaults.

### Work/Home Copilot

- Default: `model = github-copilot/gpt-5.3-codex`
- Small: `small_model = github-copilot/gemini-3.5-flash`
- Keep GitHub Copilot defaults for home and optional Copilot profile on work.
- Keep OpenCode `model` on `github-copilot/gpt-5.3-codex` and `small_model` on `github-copilot/gemini-3.5-flash` unless refreshed verification proves a better default.
- Keep verified Copilot catalog entries available for explicit selection without promoting unverified options to defaults.

## Rendered Profile Defaults

- Supported profiles: `work-openai`, `work-copilot`, `home-copilot`.
- Check active rendered config: `mise run opencode:profile:current`.
- Validate profile renders: `mise run opencode:profile:validate` and `mise run opencode:models:validate`.
- Keep a single canonical template and avoid separate rendered profile files.

## Guardrails

- Do not remove model entries unless explicitly asked.
- Do not change permissions, plugins, schema URLs, or unrelated keys.
- Preserve existing template conditionals and formatting style.

## Validation (Mise-Based)

Run repository task:

- `mise run opencode:models:validate`

Then show scoped changes:

- `git diff -- dot_config/opencode/opencode.json.tmpl`
