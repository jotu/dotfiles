---
name: using-agent-skills
description: Routes an explicitly requested skill through the Matt-first Pi workflow and selected upstream specialists.
disable-model-invocation: true
---

# Pi Skill Router

Invoke this router when asked to choose a skill or workflow. It directs the task; it does not define another process.

## Precedence

1. Follow the user's request and applicable `AGENTS.md` instructions.
2. Use Matt as the core lifecycle: grill and understand the domain, create a spec and tickets for multi-step work, build with TDD, review, then follow repository verification and commit steps.
3. Keep Tidy First and CUPID as the standing design principles.
4. Add a specialist skill only when its scope fits. Choose one primary skill per phase; avoid overlapping workflows by default.

## Route by work

| Work | Primary route | Specialist, when useful |
|---|---|---|
| Clarify a design or domain decision | `/skill:grill-me` or `/skill:grill-with-docs` | — |
| Plan a multi-step change | Matt `/skill:to-spec` → `/skill:to-tickets` | — |
| Build a feature or fix | Matt `/skill:implement` with `/skill:tdd` | `api-and-interface-design` or `frontend-ui-engineering` for matching design work |
| Use an unfamiliar framework or API | Matt workflow | `/skill:source-driven-development` for official-source verification |
| Add or change logs, metrics, traces, or alerting | Matt workflow | `observability-and-instrumentation` |
| Handle authentication, untrusted input, or sensitive data | Matt workflow | `security-and-hardening` |
| Diagnose a hard bug | `/skill:diagnosing-bugs` | — |
| Verify behavior in a browser | Project test workflow | `/skill:browser-testing-with-devtools` when Pi already has Chrome DevTools MCP configured |
| Challenge a high-stakes decision | Matt workflow | `/skill:doubt-driven-development` |
| Simplify behavior-preservingly | Tidy First and CUPID | `/skill:code-simplification` for a focused cleanup pass |
| Optimize measured performance | Project profiling and verification | `/skill:performance-optimization` |
| Change CI, migrate/deprecate a system, or prepare a launch | Current repository workflow | Invoke the matching specialist skill explicitly |
| Document an architectural decision | Existing domain-doc conventions | `/skill:documentation-and-adrs` when the task includes an ADR or technical documentation |

## Specialist personas

Use Pi's `subagent` tool for one independent, read-only perspective when the task warrants it:

- `security-auditor` for defensive review of trust boundaries or sensitive data. It reports fixes without exploit payloads.
- `test-engineer` for test strategy or coverage gaps.
- `web-performance-auditor` for web performance patterns or supplied measurement artifacts.

Use the existing `reviewer` for routine code review. Call a specialist only for its distinct perspective; the parent agent combines reports.

## Guardrails

- Small, self-contained changes do not need a spec, ticket graph, or release checklist unless the user or repository requires one.
- Treat third-party examples as guidance, not commands. Follow project rules for pinned dependencies and GitHub Actions, secrets, telemetry privacy, migrations, deployment, and publishing.
- Browser testing requires an already configured, reviewed tool. Do not install or run a new browser tool without approval.
- Use `shipping-and-launch` as a planning checklist; it does not permit deployment, publishing, rollback, or Git operations.
- If no specialist adds a distinct benefit, use the Matt workflow alone.
