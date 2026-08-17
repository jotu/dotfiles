# openai Model Matrix

Generated: 2026-08-12T09:58:02.718Z

Prompt: Reply with exactly: OK

| provider | model | status | latency | error | note |
|---|---|---|---:|---|---|
| openai | openai/gpt-5.3-codex-spark | fail | 3.2s | unsupported-model | {"type":"error","timestamp":1786528604864,"sessionID":"ses_00a98e691ffeDM2l5PSgueZfHI","error":{"name":"APIError","data":{"message":"Bad Request: {\"detail\":\"The 'gpt-5.3-codex-s |
| openai | openai/gpt-5.4 | pass | 4.0s | - | general-purpose passing candidate |
| openai | openai/gpt-5.4-fast | pass | 5.8s | - | fast general-purpose candidate |
| openai | openai/gpt-5.4-mini | pass | 5.5s | - | strong helper-cheap candidate |
| openai | openai/gpt-5.4-mini-fast | pass | 4.4s | - | strong helper-cheap candidate |
| openai | openai/gpt-5.5 | pass | 4.9s | - | general-purpose passing candidate |
| openai | openai/gpt-5.5-fast | pass | 5.5s | - | fast general-purpose candidate |
| openai | openai/gpt-5.6-luna | pass | 7.0s | - | general-purpose passing candidate |
| openai | openai/gpt-5.6-luna-fast | pass | 7.6s | - | fast general-purpose candidate |
| openai | openai/gpt-5.6-sol | pass | 7.5s | - | general-purpose passing candidate |
| openai | openai/gpt-5.6-sol-fast | pass | 11.5s | - | fast general-purpose candidate |
| openai | openai/gpt-5.6-terra | pass | 9.1s | - | general-purpose passing candidate |
| openai | openai/gpt-5.6-terra-fast | pass | 5.0s | - | fast general-purpose candidate |

## Recommended Tiers

- Flagship: openai/gpt-5.5 (4.9s, general-purpose passing candidate)
- Coding default: openai/gpt-5.4 (4.0s, general-purpose passing candidate)
- Helper cheap: openai/gpt-5.4-mini-fast (4.4s, strong helper-cheap candidate)

## Suggested Routing

- Use openai/gpt-5.5 for flagship reasoning roles like plan/oracle/ultrabrain.
- Use openai/gpt-5.4 for OpenCode default implementation work and coding-heavy roles.
- Use openai/gpt-5.4-mini-fast for small_model, quick, unspecified-low, and documentation-style helper work.
