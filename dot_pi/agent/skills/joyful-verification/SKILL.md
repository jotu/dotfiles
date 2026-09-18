---
name: joyful-verification
description: Verifies an implemented change against its acceptance criteria using objective checks and evidence, then decides whether to review, replan, finish, or stop. Use after implementation and before final completion.
---

# Joyful Verification

## Purpose

Determine whether an implemented change works as intended and is ready for
review or completion.

Verification is an evidence gate, not a second implementation phase or a design
review. It must not modify code, create commits, amend history, or claim checks
that were not run.

Conventional Commits are not part of this verification workflow.

## Workflow

1. Identify the implementation goal, acceptance criteria, scope, and non-goals.
2. Read repository instructions and inspect the complete diff.
3. Confirm that each acceptance criterion has an objective check or explicit
   manual verification step.
4. Run the smallest relevant checks first.
5. Run broader checks when the change or repository risk requires them.
6. Record exact commands, outcomes, failures, and skipped checks.
7. Decide whether to hand off to review, replan, finish, or stop.
8. Ask before changing scope, weakening a criterion, or choosing a risky bypass.

If the goal, acceptance criteria, or expected behavior is materially ambiguous,
stop and ask for clarification instead of guessing.

## Verification Order

Prefer the project’s documented commands. Otherwise use the smallest relevant
sequence:

1. focused unit tests, plus approval tests only when they add distinct whole-output evidence
2. formatter or lint
3. typecheck
4. broader tests
5. build or package validation
6. manual checks for behavior not covered by automation

Do not run expensive or unrelated checks without a reason. Do not report a
check as passed when it was skipped, unavailable, or only inferred.

## Lean Verification

- verify the smallest useful increment first
- fail fast on the first meaningful blocker
- avoid duplicate checks that provide no new evidence
- use existing project commands and tooling
- keep feedback fast while matching the risk of the change
- make failures and uncertainty visible

## CUPID Verification Questions

Use these questions to identify missing evidence:

- **Composable** — Do focused checks cover the changed interface and its callers?
- **Unix-like** — Can the changed unit be verified independently?
- **Predictable** — Are success, failure, side effects, and boundaries checked?
- **Idiomatic** — Do the checks match project and language conventions?
- **Domain-based** — Do assertions and scenarios express real domain behavior?

## Tidy First and XP

- Do not mix verification with unrelated cleanup.
- Treat a failing check as information, not as a reason to hide the failure.
- Keep one behavior increment and its feedback together where possible.
- Verify only the focused tests that add evidence; never duplicate assertions.
- Review approval-test baseline changes as part of the behavior diff.
- If verification reveals a structural problem, record it for replanning instead
  of expanding the current change without agreement.
- Preserve the distinction between a behavior failure and a code-review concern.

## Decision Gate

Use one of these outcomes:

- **Review** — acceptance criteria pass and the diff is ready for
  `joyful-code-review`.
- **Replan** — a failure, missing requirement, or design issue requires a
  changed approach or additional scope.
- **Done** — verification and review are complete with no remaining work.
- **Break** — progress is blocked by an external dependency, missing decision,
  unavailable environment, or an explicit request to stop.

Ask before moving from a failed or blocked result to a changed scope, skipped
check, weakened acceptance criterion, or risky workaround.

When running under `joyful-workflow`, mark verification passed with `/joyful
verified` or the `joyful_workflow` tool only after reporting the evidence and
receiving confirmation. Never mark verification passed for a failed or skipped
required check.

## Output

Return:

```markdown
## Scope

<goal, acceptance criteria, changed paths, and non-goals>

## Checks Run

- `<command or manual check>` — passed
- `<command or manual check>` — failed: <brief consequence>
- Skipped: <check and reason>

## Evidence

<what the results prove and what remains uncertain>

## Decision

Review | Replan | Done | Break

<short reason and required next step>

## Handoff

<review target, replan input, completion note, or blocker>
```

Never invent verification output. Include exact commands and their outcomes.
Keep the result concise and make the next decision explicit.
