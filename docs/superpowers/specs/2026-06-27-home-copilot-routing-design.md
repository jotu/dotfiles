# Home Copilot Routing Design

**Date:** 2026-06-27

## Goal

Give the `home-copilot` OpenCode profile its own verified, high-quality model routing so home usage prefers the strongest currently passing GitHub Copilot models without inheriting work-oriented defaults.

## Context

- The repo renders OpenCode config from a single canonical template: `dot_config/opencode/opencode.json.tmpl`.
- `home-copilot` and `work-copilot` currently share the same main routing branch.
- The authoritative verification source for this change is `dot_agents/skills/verify-opencode-models/references/model-matrix.github-copilot.md`, or a freshly regenerated equivalent produced by the repo verification tasks immediately before implementation if the current artifact is stale.
- The current verified GitHub Copilot matrix shows passing candidates including:
  - `github-copilot/claude-opus-4.6`
  - `github-copilot/claude-opus-4.7`
  - `github-copilot/gemini-3.1-pro-preview`
  - `github-copilot/gpt-5.3-codex`
  - `github-copilot/gpt-5.4`
  - `github-copilot/gpt-5.4-mini`
- The matrix also shows that some catalog-visible models are not usable on the current auth path, so routing must prefer verified passing models.

## Constraints and Invariants

- Keep the single-template chezmoi rendering model.
- Keep the change small and reversible.
- Do not route home defaults to models currently known to fail.
- Preserve existing role-tier routing structure unless a profile-specific override is needed.
- Validation must use the repo’s existing OpenCode model/config tasks.

## Decision

Create a distinct `home-copilot` routing selection inside `dot_config/opencode/opencode.json.tmpl`.

Selection rule:

- **Flagship reasoning** = strongest verified reasoning model for home use.
- **Coding default** = strongest verified coding-oriented model.
- **Helper cheap** = lean verified helper model suitable for small/default-low-value tasks.

Recommended home tier mapping:

- **Flagship reasoning:** `github-copilot/claude-opus-4.7`
- **Coding default:** `github-copilot/gpt-5.3-codex`
- **Helper cheap:** `github-copilot/gpt-5.4-mini`

Rationale:

- `claude-opus-4.7` is a verified top-end reasoning candidate and better fits the user’s “best quality” preference for home.
- `gpt-5.3-codex` is the strongest verified coding-default candidate in the current matrix.
- `gpt-5.4-mini` keeps helper traffic lean while staying verified and aligned with existing setup patterns.

## Scope

### In scope

- Adjust profile selection logic for `home-copilot` in the OpenCode template.
- Keep `work-copilot` behavior unchanged unless required by shared code extraction.
- Validate rendered config and supported profile outputs.

### Out of scope

- Broader productivity redesign for work OpenAI usage.
- Ponytail evaluation and integration.
- Changes to unrelated agents, commands, or permissions.

## Risks

- Verified matrices can drift as provider access changes over time.
- A strongest-quality model may be slower than the current default.
- Shared-template branching can become harder to maintain if profile logic grows ad hoc.

## Mitigations

- Use only currently verified passing models.
- Keep profile overrides localized to the small variable-selection block.
- Re-run repo validation after the change.
- If any chosen model is not verified as passing at implementation time, stop and re-run the GitHub Copilot recommendation/verification flow before changing routing.

## Acceptance Criteria

1. `home-copilot` renders with its own flagship/coding/helper defaults.
2. The selected home models are verified passing in `dot_agents/skills/verify-opencode-models/references/model-matrix.github-copilot.md`, or in a freshly regenerated equivalent created immediately before implementation.
3. Rendered output or validation evidence shows `work-copilot` and `work-openai` behavior remain unchanged.
4. Repo validation for OpenCode model/config rendering passes.

## Implementation Notes

- Prefer changing the `$copilotFlagship`, `$copilotCoding`, and `$copilotHelper` assignment block near the top of the template.
- Keep downstream role mappings intact so the profile override automatically flows through existing role-tier routing.
- If tests exist for model validation/rendering, update only what is necessary.
- Validation should explicitly cover `home-copilot`, `work-copilot`, and `work-openai` so only the intended profile changes.
