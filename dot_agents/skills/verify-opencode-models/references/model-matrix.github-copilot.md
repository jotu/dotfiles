# github-copilot Model Matrix

Generated: 2026-05-22T14:23:00.288Z

Prompt: Reply with exactly: OK

| provider | model | status | latency | error | note |
|---|---|---|---:|---|---|
| github-copilot | github-copilot/claude-haiku-4.5 | pass | 5.0s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-opus-4.5 | pass | 4.2s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-opus-4.6 | pass | 5.6s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-opus-4.7 | pass | 5.3s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-sonnet-4.5 | pass | 5.2s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-sonnet-4.6 | pass | 5.0s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gemini-3-flash-preview | pass | 9.6s | - | strong helper-cheap candidate |
| github-copilot | github-copilot/gemini-3.1-pro-preview | pass | 6.3s | - | strong flagship candidate |
| github-copilot | github-copilot/gpt-4.1 | fail | 2.7s | unexpected-response | Unexpected response: (empty) |
| github-copilot | github-copilot/gpt-4o | pass | 4.3s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gpt-5-mini | pass | 7.3s | - | strong helper-cheap candidate |
| github-copilot | github-copilot/gpt-5.2 | pass | 4.9s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gpt-5.2-codex | fail | 3.1s | unexpected-response | Unexpected response: (empty) |
| github-copilot | github-copilot/gpt-5.3-codex | pass | 11.1s | - | strong coding-default candidate |
| github-copilot | github-copilot/gpt-5.4 | pass | 5.0s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gpt-5.4-mini | pass | 5.5s | - | strong helper-cheap candidate |

## Recommended Tiers

- Flagship: github-copilot/gemini-3.1-pro-preview (6.3s, strong flagship candidate)
- Coding default: github-copilot/gpt-5.3-codex (11.1s, strong coding-default candidate)
- Helper cheap: github-copilot/gemini-3-flash-preview (9.6s, strong helper-cheap candidate)

## Suggested Routing

- Use github-copilot/gemini-3.1-pro-preview for flagship reasoning roles like plan/oracle/ultrabrain.
- Use github-copilot/gpt-5.3-codex for OpenCode default implementation work and coding-heavy roles.
- Use github-copilot/gemini-3-flash-preview for small_model, quick, unspecified-low, and documentation-style helper work.
