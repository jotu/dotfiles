# github-copilot Model Matrix

Generated: 2026-05-12T11:36:16.648Z

Prompt: Reply with exactly: OK

| provider | model | status | latency | error | note |
|---|---|---|---:|---|---|
| github-copilot | github-copilot/claude-haiku-4.5 | pass | 3.5s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-opus-4.5 | pass | 3.7s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-opus-4.6 | pass | 4.3s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-opus-4.7 | pass | 5.7s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-sonnet-4.5 | pass | 4.9s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-sonnet-4.6 | pass | 4.6s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gemini-3-flash-preview | pass | 3.5s | - | strong helper-cheap candidate |
| github-copilot | github-copilot/gemini-3.1-pro-preview | pass | 6.1s | - | strong flagship candidate |
| github-copilot | github-copilot/gpt-4.1 | fail | 2.4s | unexpected-response | Unexpected response: (empty) |
| github-copilot | github-copilot/gpt-4o | pass | 4.0s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gpt-5-mini | pass | 12.5s | - | strong helper-cheap candidate |
| github-copilot | github-copilot/gpt-5.2 | pass | 6.2s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gpt-5.2-codex | fail | 2.8s | unexpected-response | Unexpected response: (empty) |
| github-copilot | github-copilot/gpt-5.3-codex | pass | 5.3s | - | strong coding-default candidate |
| github-copilot | github-copilot/gpt-5.4 | pass | 6.4s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gpt-5.4-mini | pass | 6.6s | - | strong helper-cheap candidate |

## Recommended Tiers

- Flagship: github-copilot/gemini-3.1-pro-preview (6.1s, strong flagship candidate)
- Coding default: github-copilot/gpt-5.3-codex (5.3s, strong coding-default candidate)
- Helper cheap: github-copilot/gemini-3-flash-preview (3.5s, strong helper-cheap candidate)

## Suggested Routing

- Use github-copilot/gemini-3.1-pro-preview for flagship reasoning roles like plan/oracle/ultrabrain.
- Use github-copilot/gpt-5.3-codex for OpenCode default implementation work and coding-heavy roles.
- Use github-copilot/gemini-3-flash-preview for small_model, quick, unspecified-low, and documentation-style helper work.
