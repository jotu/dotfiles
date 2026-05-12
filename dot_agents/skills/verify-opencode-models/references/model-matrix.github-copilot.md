# github-copilot Model Matrix

Generated: 2026-05-12T18:40:33.570Z

Prompt: Reply with exactly: OK

| provider | model | status | latency | error | note |
|---|---|---|---:|---|---|
| github-copilot | github-copilot/claude-haiku-4.5 | pass | 3.7s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-opus-4.5 | fail | 2.1s | unexpected-response | Unexpected response: (empty) |
| github-copilot | github-copilot/claude-opus-4.6 | fail | 2.1s | unexpected-response | Unexpected response: (empty) |
| github-copilot | github-copilot/claude-opus-4.7 | fail | 2.2s | unexpected-response | Unexpected response: (empty) |
| github-copilot | github-copilot/claude-sonnet-4.5 | pass | 4.2s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-sonnet-4.6 | pass | 3.1s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gemini-2.5-pro | pass | 3.6s | - | strong flagship candidate |
| github-copilot | github-copilot/gemini-3-flash-preview | pass | 3.1s | - | strong helper-cheap candidate |
| github-copilot | github-copilot/gemini-3.1-pro-preview | pass | 5.4s | - | strong flagship candidate |
| github-copilot | github-copilot/gpt-4.1 | fail | 2.0s | unexpected-response | Unexpected response: (empty) |
| github-copilot | github-copilot/gpt-4o | pass | 3.4s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gpt-5-mini | pass | 8.0s | - | strong helper-cheap candidate |
| github-copilot | github-copilot/gpt-5.2 | pass | 6.1s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gpt-5.2-codex | fail | 2.3s | unexpected-response | Unexpected response: (empty) |
| github-copilot | github-copilot/gpt-5.3-codex | pass | 5.6s | - | strong coding-default candidate |
| github-copilot | github-copilot/gpt-5.4 | pass | 4.6s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gpt-5.4-mini | pass | 5.5s | - | strong helper-cheap candidate |
| github-copilot | github-copilot/grok-code-fast-1 | pass | 6.4s | - | fast general-purpose candidate |

## Recommended Tiers

- Flagship: github-copilot/gemini-2.5-pro (3.6s, strong flagship candidate)
- Coding default: github-copilot/gpt-5.3-codex (5.6s, strong coding-default candidate)
- Helper cheap: github-copilot/gemini-3-flash-preview (3.1s, strong helper-cheap candidate)

## Suggested Routing

- Use github-copilot/gemini-2.5-pro for flagship reasoning roles like plan/oracle/ultrabrain.
- Use github-copilot/gpt-5.3-codex for OpenCode default implementation work and coding-heavy roles.
- Use github-copilot/gemini-3-flash-preview for small_model, quick, unspecified-low, and documentation-style helper work.
