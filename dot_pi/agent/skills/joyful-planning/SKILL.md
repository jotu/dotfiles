---
name: joyful-planning
description: Create an implementation-ready plan for a feature, bug fix, refactor, or configuration change.
disable-model-invocation: true
---

# Joyful Planning

Turn an outcome into the smallest useful implementation plan. If you also
invoke `/skill:joyful-principles`, use it for the shared Pragmatic Programmer,
XP/TDD, Tidy First, CUPID, and Fowler vocabulary.

This skill plans work. It must not modify code, create commits, or claim that
verification has passed.

## Workflow

1. Establish the desired outcome and user value.
2. Read repository instructions and identify the planning scope.
3. Inspect the current implementation, callers, tests, and relevant error paths.
4. Define acceptance criteria and explicit non-goals.
5. Find the highest useful test seam and the shortest feedback loop.
6. Choose the smallest tracer bullet or vertical slice; reject speculative work.
7. Decide whether a behavior-preserving tidy makes the change clearer.
8. Define the Red -> Green -> Refactor sequence and verification checks.
9. Report risks, assumptions, and unresolved decisions.

Ask for clarification when the target, expected behavior, scope, seam, or
constraints are materially ambiguous.

## Planning Discipline

- Start from observable behavior, not an implementation shape.
- Reuse existing vocabulary, helpers, seams, conventions, and dependencies.
- Prefer one thin working path over horizontal batches of tests or modules.
- Keep structural tidy separate from behavior changes when practical.
- Use domain-based names and a small interface; apply CUPID as questions, not
  a scorecard.
- Use Fowler's refactoring catalog only when a real smell makes the current
  change harder to understand or verify.
- Define one objective done check per implementation step.

## Planning Output

Return:

```markdown
## Goal

<desired outcome and user value>

## Acceptance Criteria

<observable conditions that define success>

## Current Understanding

<relevant behavior, implementation, callers, and constraints>

## Scope and Non-goals

<what changes and what deliberately does not>

## Engineering Considerations

<smallest slice, seam, feedback loop, tidy decision, and relevant design risks>

## Recommended Approach

<short explanation of the selected approach and rejected alternatives>

## Implementation Plan

1. `<path>` — <change, dependency, and expected behavior>
2. `<path>` — <change, dependency, and expected behavior>

## Tidy + TDD Sequence

1. <behavior-preserving structural preparation, if needed>
2. <smallest failing behavior test at the agreed seam>
3. <smallest implementation that turns red green>
4. <deliberate refactor and diff review>

## Verification Plan

- <focused unit or integration checks>
- <approval checks only for stable whole-output contracts>
- <broader check, if needed>

## Risks and Open Decisions

- <risk, assumption, or decision>
```

For each implementation step, identify the relevant file or module, intended
behavior, test or verification, and dependency on earlier steps. Keep the plan
ordered for execution and stop at the smallest plan that safely achieves the
goal.

Never report checks as passed unless they are actually run during execution.
