# openai Model Matrix

Generated: 2026-06-02T06:36:46.582Z

Prompt: Reply with exactly: OK

| provider | model | status | latency | error | note |
|---|---|---|---:|---|---|
| openai | openai/codex-mini-latest | fail | 2.9s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5-codex | fail | 2.7s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.1-codex | fail | 3.2s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.1-codex-max | fail | 3.0s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.1-codex-mini | fail | 3.6s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.2 | fail | 3.7s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.2-codex | fail | 3.1s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.3-codex | fail | 2.9s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.3-codex-spark | fail | 3.0s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.4 | pass | 6.9s | - | general-purpose passing candidate |
| openai | openai/gpt-5.4-fast | pass | 6.4s | - | fast general-purpose candidate |
| openai | openai/gpt-5.4-mini | pass | 7.5s | - | strong helper-cheap candidate |
| openai | openai/gpt-5.4-mini-fast | pass | 7.2s | - | strong helper-cheap candidate |
| openai | openai/gpt-5.4-nano | fail | 3.1s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.4-pro | fail | 3.1s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.5 | pass | 5.4s | - | general-purpose passing candidate |
| openai | openai/gpt-5.5-fast | pass | 6.8s | - | fast general-purpose candidate |
| openai | openai/gpt-5.5-pro | fail | 3.0s | unexpected-response | Unexpected response: (empty) |

## Recommended Tiers

- Flagship: openai/gpt-5.5 (5.4s, general-purpose passing candidate)
- Coding default: openai/gpt-5.4 (6.9s, general-purpose passing candidate)
- Helper cheap: openai/gpt-5.4-mini-fast (7.2s, strong helper-cheap candidate)

## Suggested Routing

- Use openai/gpt-5.5 for flagship reasoning roles like plan/oracle/ultrabrain.
- Use openai/gpt-5.4 for OpenCode default implementation work and coding-heavy roles.
- Use openai/gpt-5.4-mini-fast for small_model, quick, unspecified-low, and documentation-style helper work.
