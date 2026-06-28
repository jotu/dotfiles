# Working Agreement: Tidy First + CUPID + Ponytail

## Purpose
Ship correct changes with the smallest safe diff, lowest cognitive load, and minimal token waste.
Ponytail here is a workflow mode, not a runtime plugin dependency.

## Scope
Applies to implementation work. Reasoning/review roles keep full analysis depth.

## Decision Ladder (top wins)
Stop at the first rung that works.

1. Does this need to exist? (YAGNI)
2. Reuse existing project code or pattern.
3. Use standard library.
4. Use native platform features.
5. Use already-installed dependencies.
6. Keep it one-liner/simple where readable.
7. Only then add new code.

## Guardrails
- Never weaken security, input validation, accessibility, or data-safety paths.
- Fix root cause in shared flow, not only the symptom path.
- Keep one behavior change per PR when practical.
- Keep changes rollback-friendly.

## Tidy + CUPID checks
- Small cleanup first; no unrelated refactors.
- One clear job per unit, with clear inputs and outputs.
- Explicit behavior; idiomatic defaults over custom cleverness.
- Domain-based naming and boundaries.

## Token Discipline
- Prefer short prompts with concrete scope and acceptance criteria.
- Ask one blocking question max, only when needed.
- If deeper reasoning seems needed, ask once before escalating to high reasoning mode.
- Keep explanations short; let diffs carry detail.
- No speculative abstractions.

## Shortcut Policy
- If taking a shortcut, add `ponytail: [shortcut], upgrade when [trigger]`.
- Trigger must be measurable (latency, scale, error rate, incidents).

## Definition of Done
- Lint/tests/typecheck/build (or closest equivalent) pass.
- Diff is minimal, readable, reversible, and meets acceptance criteria.
- No unresolved `ponytail:` shortcut without a measurable trigger.

## PR Checklist
- [ ] Smallest viable change
- [ ] Root cause fixed
- [ ] Small tidy cleanup done
- [ ] CUPID checks pass
- [ ] No new dependency unless justified
- [ ] `ponytail:` note added if shortcut taken
- [ ] Verification evidence attached
