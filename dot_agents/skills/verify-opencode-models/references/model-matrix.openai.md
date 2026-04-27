# openai Model Matrix

Generated: 2026-04-27T19:02:38.389Z

Prompt: Reply with exactly: OK

| provider | model | status | latency | error | note |
|---|---|---|---:|---|---|
| openai | openai/codex-mini-latest | fail | 4.4s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5-codex | fail | 4.7s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.1-codex | fail | 4.6s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.1-codex-max | fail | 4.7s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.1-codex-mini | fail | 4.5s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.2 | pass | 8.3s | - | general-purpose passing candidate |
| openai | openai/gpt-5.2-codex | fail | 4.5s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.3-codex | pass | 6.6s | - | strong coding-default candidate |
| openai | openai/gpt-5.3-codex-spark | fail | 4.5s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.4 | pass | 9.7s | - | general-purpose passing candidate |
| openai | openai/gpt-5.4-fast | pass | 6.8s | - | fast general-purpose candidate |
| openai | openai/gpt-5.4-mini | pass | 8.1s | - | strong helper-cheap candidate |
| openai | openai/gpt-5.4-mini-fast | pass | 5.8s | - | strong helper-cheap candidate |
| openai | openai/gpt-5.5 | pass | 7.2s | - | general-purpose passing candidate |
| openai | openai/gpt-5.5-fast | pass | 6.6s | - | fast general-purpose candidate |
| openai | openai/gpt-5.5-pro | fail | 4.4s | unexpected-response | Unexpected response: (empty) |

## Recommended Tiers

- Flagship: openai/gpt-5.5 (7.2s, general-purpose passing candidate)
- Coding default: openai/gpt-5.3-codex (6.6s, strong coding-default candidate)
- Helper cheap: openai/gpt-5.4-mini-fast (5.8s, strong helper-cheap candidate)

## Suggested Routing

- Use openai/gpt-5.5 for flagship reasoning roles like plan/oracle/ultrabrain.
- Use openai/gpt-5.3-codex for OpenCode default implementation work and coding-heavy roles.
- Use openai/gpt-5.4-mini-fast for small_model, quick, unspecified-low, and documentation-style helper work.
