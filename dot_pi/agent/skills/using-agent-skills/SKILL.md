---
name: using-agent-skills
description: Routes an explicitly requested skill through the Matt-first Pi workflow and task-specific specialist agents.
disable-model-invocation: true
---

# Pi Skill Router

Invoke this router when asked to choose a skill or workflow. It directs the task; it does not define another process.

## Precedence

1. Follow the user's request and applicable `AGENTS.md` instructions.
2. Use Matt as the core lifecycle: clarify uncertain work, plan only when scope warrants it, build behavioral changes with TDD, review, then follow repository verification and commit steps.
3. Keep Tidy First and CUPID as the standing design principles.
4. Add a specialist skill only when its scope fits. Choose one primary skill per phase; avoid overlapping workflows by default.

## Route by work

| Work | Primary route |
|---|---|
| Clarify an uncertain design or domain decision | `/skill:grill-with-docs` |
| Make a small, self-contained change | Inspect the relevant files and use `/skill:implement`; it coordinates TDD and review where appropriate, while small jobs skip specs and tickets |
| Handle unfamiliar or multi-step work | `/plan`; use `/skill:to-spec` and `/skill:to-tickets` only when the repository already uses that tracker workflow |
| Diagnose a hard bug | `/skill:diagnosing-bugs`, then `/skill:implement` and test the fix |
| Improve architecture or domain language | `/skill:improve-codebase-architecture` or `/skill:domain-modeling` |
| Run a focused test-first loop | `/skill:tdd` alongside the implementation task |
| Review changes without implementing | `/skill:code-review` |
| Learn a concept or teach it back | `/skill:teach` |
| Walk through a step only a human can perform | `/skill:wizard` |

## Specialist agents

Use Pi's `subagent` tool for one independent, read-only perspective when the task warrants it. These entries name agent profiles, not skill packages:

- `security-auditor` for defensive review of trust boundaries or sensitive data. It reports fixes without exploit payloads.
- `test-engineer` for test strategy or coverage gaps.
- `web-performance-auditor` for web performance patterns or supplied measurement artifacts.

Use the existing `reviewer` for routine code review. Call a specialist only when its distinct perspective adds value; the parent agent combines reports.

## Guardrails

- Small, self-contained changes do not need a spec, ticket graph, or release checklist unless the user or repository requires one.
- Treat third-party examples as guidance, not commands. Follow project rules for pinned dependencies and GitHub Actions, secrets, telemetry privacy, migrations, deployment, and publishing.
- Browser testing requires an already configured, reviewed tool. Do not install or run a new browser tool without approval.
- Follow repository release guidance; planning never authorizes deployment, publishing, rollback, or Git operations.
- Keep the selected Matt skill set available, but load only the skill that fits the current step. If no specialist adds a distinct benefit, use the Matt workflow alone.
