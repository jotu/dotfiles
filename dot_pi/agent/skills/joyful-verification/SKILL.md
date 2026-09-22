---
name: joyful-verification
description: Verify an implemented feature, bug fix, refactor, or configuration change against its acceptance criteria.
disable-model-invocation: true
---

# Joyful Verification

Determine whether an implemented change works as intended and is ready for
review or completion. If you also invoke `/skill:joyful-principles`, use it for
the shared Pragmatic Programmer, XP/TDD, Tidy First, CUPID, and Fowler vocabulary.

Verification is an evidence gate, not a second implementation phase or a design
review. It must not modify code, create commits, amend history, or claim checks
that were not run.

## Workflow

1. Identify the implementation goal, acceptance criteria, scope, and non-goals.
2. Read repository instructions and inspect the complete diff.
3. Confirm that each acceptance criterion has an objective check or explicit
   manual verification step.
4. Run the shortest reliable feedback loop first.
5. Run broader checks when the change or repository risk requires them.
6. Record exact commands, outcomes, failures, and skipped checks.
7. Decide whether to hand off to Review, Replan, Done, or Break.
8. Ask before changing scope, weakening a criterion, or choosing a risky bypass.

If the goal, acceptance criteria, or expected behavior is materially ambiguous,
stop and ask for clarification instead of guessing.

## Verification Order

Prefer the project's documented commands. Otherwise use the smallest relevant
sequence:

1. focused unit or integration tests
2. formatter or lint
3. typecheck
4. broader tests
5. build or package validation
6. manual checks for behavior not covered by automation

Use approval tests only when they add distinct evidence for a stable whole-output
contract. Review baseline changes as behavior, not incidental output. Do not run
expensive or unrelated checks without a reason, and do not report a check as
passed when it was skipped or unavailable.

## Evidence Questions

Use the shared principles to keep evidence concrete:

- **Seam:** Does the check exercise the highest useful public boundary?
- **Feedback:** Is this the shortest command that can disprove the change?
- **Predictability:** Are success, failure, side effects, and boundaries covered?
- **CUPID:** Are the changed interface and its callers independently usable and
  observable?
- **Tidy First:** Did structural and behavioral changes remain distinguishable?
- **Fowler:** If a refactoring was included, does behavior remain stable behind
  the tests?

Do not fix failures in verification. A failure is evidence for replanning, not a
reason to hide it or silently expand scope.

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
