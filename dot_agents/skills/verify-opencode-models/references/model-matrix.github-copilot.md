# github-copilot Model Matrix

Generated: 2026-04-27T19:22:10.122Z

Prompt: Reply with exactly: OK

| provider | model | status | latency | error | note |
|---|---|---|---:|---|---|
| github-copilot | github-copilot/claude-haiku-4.5 | pass | 7.0s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-opus-4.5 | pass | 6.1s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-opus-4.6 | pass | 7.7s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-opus-4.7 | pass | 6.3s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-sonnet-4.5 | pass | 7.1s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-sonnet-4.6 | pass | 7.3s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gemini-3-flash-preview | pass | 5.9s | - | strong helper-cheap candidate |
| github-copilot | github-copilot/gemini-3.1-pro-preview | pass | 9.3s | - | strong flagship candidate |
| github-copilot | github-copilot/gpt-4.1 | pass | 8.4s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gpt-4o | pass | 5.9s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gpt-5-mini | fail | 41.7s | unexpected-response | Unexpected response: I detect trivial intent - the user requested a specific short reply. My approach: answer directly. OK |
| github-copilot | github-copilot/gpt-5.2 | pass | 6.8s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gpt-5.2-codex | pass | 7.2s | - | strong coding-default candidate |
| github-copilot | github-copilot/gpt-5.3-codex | pass | 8.2s | - | strong coding-default candidate |
| github-copilot | github-copilot/gpt-5.4 | pass | 9.4s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gpt-5.4-mini | pass | 7.5s | - | strong helper-cheap candidate |

## Recommended Tiers

- Flagship: github-copilot/gemini-3.1-pro-preview (9.3s, strong flagship candidate)
- Coding default: github-copilot/gpt-5.3-codex (8.2s, strong coding-default candidate)
- Helper cheap: github-copilot/gemini-3-flash-preview (5.9s, strong helper-cheap candidate)

## Suggested Routing

- Use github-copilot/gemini-3.1-pro-preview for flagship reasoning roles like plan/oracle/ultrabrain.
- Use github-copilot/gpt-5.3-codex for OpenCode default implementation work and coding-heavy roles.
- Use github-copilot/gemini-3-flash-preview for small_model, quick, unspecified-low, and documentation-style helper work.
