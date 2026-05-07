# openai Model Matrix

Generated: 2026-05-07T19:28:44.005Z

Prompt: Reply with exactly: OK

| provider | model | status | latency | error | note |
|---|---|---|---:|---|---|
| openai | openai/codex-mini-latest | fail | 4.8s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5-codex | fail | 81.5s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.1-codex | fail | 4.9s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.1-codex-max | fail | 4.5s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.1-codex-mini | fail | 4.5s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.2 | pass | 7.0s | - | general-purpose passing candidate |
| openai | openai/gpt-5.2-codex | fail | 4.5s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.3-codex | pass | 9.0s | - | strong coding-default candidate |
| openai | openai/gpt-5.3-codex-spark | fail | 4.7s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.4 | pass | 9.1s | - | general-purpose passing candidate |
| openai | openai/gpt-5.4-fast | pass | 6.3s | - | fast general-purpose candidate |
| openai | openai/gpt-5.4-mini | pass | 7.1s | - | strong helper-cheap candidate |
| openai | openai/gpt-5.4-mini-fast | pass | 7.0s | - | strong helper-cheap candidate |
| openai | openai/gpt-5.4-nano | fail | 4.7s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.4-pro | fail | 4.5s | unexpected-response | Unexpected response: (empty) |
| openai | openai/gpt-5.5 | pass | 9.8s | - | general-purpose passing candidate |
| openai | openai/gpt-5.5-fast | pass | 10.9s | - | fast general-purpose candidate |
| openai | openai/gpt-5.5-pro | fail | 4.5s | unexpected-response | Unexpected response: (empty) |

## Recommended Tiers

- Flagship: openai/gpt-5.5 (9.8s, general-purpose passing candidate)
- Coding default: openai/gpt-5.3-codex (9.0s, strong coding-default candidate)
- Helper cheap: openai/gpt-5.4-mini-fast (7.0s, strong helper-cheap candidate)

## Suggested Routing

- Use openai/gpt-5.5 for flagship reasoning roles like plan/oracle/ultrabrain.
- Use openai/gpt-5.3-codex for OpenCode default implementation work and coding-heavy roles.
- Use openai/gpt-5.4-mini-fast for small_model, quick, unspecified-low, and documentation-style helper work.
