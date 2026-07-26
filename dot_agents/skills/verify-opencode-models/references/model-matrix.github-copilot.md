# github-copilot Model Matrix

Generated: 2026-07-26T14:22:01.992Z

Prompt: Reply with exactly: OK

| provider | model | status | latency | error | note |
|---|---|---|---:|---|---|
| github-copilot | github-copilot/claude-sonnet-4.6 | pass | 6.1s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gpt-5-mini | pass | 5.1s | - | strong helper-cheap candidate |
| github-copilot | github-copilot/gpt-5.3-codex | pass | 3.6s | - | strong coding-default candidate |
| github-copilot | github-copilot/gpt-5.4-mini | pass | 3.8s | - | strong helper-cheap candidate |
| github-copilot | github-copilot/gpt-5.6-luna | pass | 3.4s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gpt-5.6-terra | pass | 3.4s | - | general-purpose passing candidate |

## Recommended Tiers

- Flagship: github-copilot/gpt-5.3-codex (3.6s, strong coding-default candidate)
- Coding default: github-copilot/gpt-5.3-codex (3.6s, strong coding-default candidate)
- Helper cheap: github-copilot/gpt-5.4-mini (3.8s, strong helper-cheap candidate)

## Suggested Routing

- Use github-copilot/gpt-5.3-codex for flagship reasoning roles like plan/oracle/ultrabrain.
- Use github-copilot/gpt-5.3-codex for OpenCode default implementation work and coding-heavy roles.
- Use github-copilot/gpt-5.4-mini for small_model, quick, unspecified-low, and documentation-style helper work.
