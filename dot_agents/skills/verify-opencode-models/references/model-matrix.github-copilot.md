# github-copilot Model Matrix

Generated: 2026-05-08T05:57:27.672Z

Prompt: Reply with exactly: OK

| provider | model | status | latency | error | note |
|---|---|---|---:|---|---|
| github-copilot | github-copilot/claude-haiku-4.5 | pass | 6.9s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-opus-4.5 | pass | 7.2s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-opus-4.6 | pass | 8.4s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-opus-4.7 | pass | 8.8s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-sonnet-4.5 | pass | 7.7s | - | general-purpose passing candidate |
| github-copilot | github-copilot/claude-sonnet-4.6 | pass | 6.8s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gemini-3-flash-preview | pass | 5.8s | - | strong helper-cheap candidate |
| github-copilot | github-copilot/gemini-3.1-pro-preview | pass | 8.9s | - | strong flagship candidate |
| github-copilot | github-copilot/gpt-4.1 | pass | 6.8s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gpt-4o | pass | 7.0s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gpt-5-mini | fail | 20.8s | unexpected-response | Unexpected response: I detect implementation intent - user requested an exact literal reply. My approach: Trivial → direct reply. OK |
| github-copilot | github-copilot/gpt-5.2 | pass | 7.1s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gpt-5.2-codex | pass | 6.7s | - | strong coding-default candidate |
| github-copilot | github-copilot/gpt-5.3-codex | pass | 8.0s | - | strong coding-default candidate |
| github-copilot | github-copilot/gpt-5.4 | pass | 10.6s | - | general-purpose passing candidate |
| github-copilot | github-copilot/gpt-5.4-mini | pass | 7.7s | - | strong helper-cheap candidate |

## Recommended Tiers

- Flagship: github-copilot/gemini-3.1-pro-preview (8.9s, strong flagship candidate)
- Coding default: github-copilot/gpt-5.3-codex (8.0s, strong coding-default candidate)
- Helper cheap: github-copilot/gemini-3-flash-preview (5.8s, strong helper-cheap candidate)

## Suggested Routing

- Use github-copilot/gemini-3.1-pro-preview for flagship reasoning roles like plan/oracle/ultrabrain.
- Use github-copilot/gpt-5.3-codex for OpenCode default implementation work and coding-heavy roles.
- Use github-copilot/gemini-3-flash-preview for small_model, quick, unspecified-low, and documentation-style helper work.
