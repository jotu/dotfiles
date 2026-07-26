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

1. List the provider catalog, then refresh only active routes and concrete replacement candidates. Do not smoke-test every listed model just because it exists:
   - `mise run opencode:models:list:openai`
   - `mise run opencode:models:list:github-copilot`
   - `OPENCODE_MODEL_FILTER=<comma-separated active routes and candidates> mise run opencode:models:refresh:matrix:<provider>`
   - Use the unfiltered refresh only for a deliberate catalog audit.
2. Read the matrix artifacts and recommendations from:
   - `dot_agents/skills/verify-opencode-models/references/model-matrix.openai.json`
   - `dot_agents/skills/verify-opencode-models/references/model-matrix.github-copilot.json`
3. Run the matching `mise run opencode:models:recommend:<provider>` task after the refresh. Treat the recommendation as a shortlist, not an automatic config change.
4. Read the target file.
5. Build available model catalogs per provider from `provider.*.models` keys in `dot_config/opencode/opencode.json.tmpl`.
6. Assign only models that both exist in each provider catalog and pass in the refreshed verified matrix on the auth path for the target profile. Never use a result from one provider login or machine to certify another profile's provider route. Keep the current route when a new passing candidate has only a smoke-test advantage; promote it only for a clear role-fit, stability, cost, or latency benefit.
7. Keep the tier boundary intact: flagship roles must not use `small_model`; lightweight roles (`librarian`, `document-writer`, `quick`, `unspecified-low`, `documentation`) must use it. Do not promote a helper model for routine work merely because it has the lowest latency.
8. Build and document a role-tier mapping for the target scope:
   - flagship reasoning roles
   - coding-default roles
   - helper-cheap roles
   Ensure profile defaults (`model`, `small_model`) align with this role-tier mapping.
9. Apply requested scope:
   - `work-openai`: update only OpenAI-default profile values
   - `work-copilot`: update only Copilot-default work profile values
   - `home-copilot`: update only Copilot-default home profile values
   - `all`: update all supported profiles in the single template

## Optimization Target

Use a quality-first, cost-aware mix (never max-cost everywhere, never cheapest everywhere):

- Optimize for completed, correct work per token, not the lowest token count or fastest smoke-test latency.
- Strong default model for the main coding flow
- Cost-efficient small model for lightweight tasks
- Strongest reliable flagship model for high-risk reasoning/review roles
- Provider catalogs that retain verified usable options without forcing them as defaults

For a candidate that would replace an active default or flagship route, compare it with the incumbent on one representative task for that tier before promotion. A smoke test proves availability only. Keep the incumbent unless the candidate is at least as reliable and materially improves quality, latency, or cost.

## Profile Intent

- `work-openai`: keep both OpenAI and Copilot catalogs available; route defaults through the verified OpenAI tiers.
- `work-copilot`: prefer a balanced verified Copilot mix for shared work capacity.
- `home-copilot`: prefer the strongest verified Copilot flagship and a capable helper when personal capacity permits.
- Keep verified catalog entries available for explicit selection without promoting every new or preview model to a default.
- Keep high-context, multi-step implementation, review, security, architecture, and orchestration on coding-default or flagship routes; use `small_model` only for bounded lookup, drafting, and simple transformations.

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

This validates every rendered `model`, `small_model`, and agent route against its rendered provider catalog. It does not replace the refreshed live matrix; both checks are required before assigning a default.

Then show scoped changes:

- `git diff -- dot_config/opencode/opencode.json.tmpl`
