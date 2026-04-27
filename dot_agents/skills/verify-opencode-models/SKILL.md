---
name: verify-opencode-models
description: Verify provider model availability for OpenCode and oh-my-openagent by enumerating models through mise tasks, smoke-testing each model with a tiny prompt, building a pass/fail matrix, and recommending safe routing before updating config. Use when selecting OpenAI or GitHub Copilot models, debugging unsupported-model errors, refreshing model settings, or replacing failing model routes.
---

# Verify OpenCode Models

Verify live model usability before assigning provider models to OpenCode or oh-my-openagent.

## Required Input

Accept:

- `provider`: `openai` or `github-copilot`

Optional:

- `scope`: `work`, `personal`, or `both` when the verification will feed directly into `update-opencode-models`
- `model_filter`: limit testing to one or more models when the user asks for a partial run or when cost should be capped.

If the user wants to apply routing changes after verification, hand off to `update-opencode-models`.

## Public Interface

Use mise tasks as the public interface.

- `mise run opencode:models:refresh:matrix:openai`
- `mise run opencode:models:refresh:matrix:github-copilot`
- `mise run opencode:models:refresh:matrix:all`
- `mise run opencode:models:list:openai`
- `mise run opencode:models:list:github-copilot`
- `mise run opencode:models:verify:openai`
- `mise run opencode:models:verify:github-copilot`
- `mise run opencode:models:verify:all`
- `mise run opencode:models:recommend:openai`
- `mise run opencode:models:recommend:github-copilot`
- `mise run opencode:models:recommend:all`
- `mise run opencode:models:validate`

Treat the Node.js verifier as private implementation behind those tasks.

## Procedure

1. Refresh the provider matrix first through `opencode:models:refresh:matrix:<provider>` or `opencode:models:refresh:matrix:all`.
2. Warn the user that live smoke tests incur provider usage and may hit rate limits.
3. Enumerate candidate models through the provider list task when explaining scope or filters.
4. Capture a compact matrix with provider, model, pass/fail, latency, failure class, and a short note.
5. Persist the verified matrix as managed reference artifacts:
   - `dot_agents/skills/verify-opencode-models/references/model-matrix.<provider>.json`
   - `dot_agents/skills/verify-opencode-models/references/model-matrix.<provider>.md`
6. Exclude failing or uncertain models from default routing recommendations.
7. Use the provider recommend task to group passing models into flagship, coding-default, and helper-cheap tiers. Recommendation may still succeed when some tested models fail, as long as at least one safe passing model remains.
8. Read `references/routing-guidance.md` when several passing models are close or provider-specific tradeoffs need explanation.
9. If the user approves changes, hand off the verified tier mapping plus the refreshed matrix artifact to `update-opencode-models`.

## Selection Heuristics

Prioritize in this order:

1. Live usability on the current auth path.
2. Role fit for reasoning, coding, or helper throughput.
3. Stability over novelty.
4. Cost and latency balance.
5. Provider-specific pragmatism over forced symmetry.

Use the strongest reliable model for flagship reasoning and review roles, the best coding-oriented reliable model for implementation-heavy defaults, and the cheapest reliable fast model for helper work.

## Guardrails

- Do not assume a local catalog entry is usable just because it exists in `provider.*.models`.
- Do not recommend models that fail with unsupported, access, auth, or ambiguous errors.
- Do not treat a single tiny prompt as proof of overall quality; it only proves baseline usability.
- Do not bypass mise tasks for routine verification.
- Do not change config files during verification unless the user explicitly asks.

## Runtime Controls

Use environment variables when the user wants a narrower run:

- `OPENCODE_MODEL_FILTER` — comma-separated provider/model IDs
- `OPENCODE_VERIFY_PROMPT` — override the tiny smoke-test prompt
- `OPENCODE_VERIFY_TIMEOUT_MS` — override per-model timeout
- `OPENCODE_VERIFY_DIR` — override the working directory for `opencode run`

## Validation

Run repository task:

- `mise run opencode:models:validate`

Then refresh the smallest useful matrix for the requested provider, for example:

- `OPENCODE_MODEL_FILTER=openai/gpt-5.4 mise run opencode:models:refresh:matrix:openai`

If routing changes are applied afterward, re-run:

- `mise run opencode:models:validate`

## Output Contract

Return sections in this order:

1. Provider
2. Matrix
3. Recommended tiers
4. Suggested routing
5. Risks / caveats
6. Next step
