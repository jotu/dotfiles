---
name: joyful-planning
description: Creates small, implementation-ready plans for features, bug fixes, and refactors using Lean software development, CUPID, Tidy First, and XP. Use before non-trivial implementation work.
---

# Joyful Planning

## Purpose

Turn an outcome into the smallest useful implementation plan.

Prefer evidence over speculation, existing patterns over new abstractions, and
fast feedback over large batches of work.

This skill plans work. It must not modify code, create commits, or claim that
verification has passed.

Conventional Commits are not part of this planning workflow.

## Workflow

1. Establish the desired outcome and user value.
2. Read repository instructions and identify the planning scope.
3. Inspect the current implementation, callers, tests, and relevant error paths.
4. Define acceptance criteria and explicit non-goals.
5. Consider the smallest viable implementation and reject unnecessary options.
6. Apply the Lean, CUPID, Tidy First, and XP lenses.
7. Break the work into small implementation increments.
8. Define the TDD and verification sequence.
9. Report risks, assumptions, and unresolved decisions.

Ask for clarification when the target, expected behavior, scope, or constraints
are materially ambiguous.

## Lean Software Development

Use Lean as an agile software-development approach:

- deliver the smallest valuable increment
- eliminate unnecessary work and speculative flexibility
- reduce work in progress and batch size
- shorten feedback loops
- build quality in rather than postponing it
- defer decisions until they are needed
- make problems and uncertainty visible

Prefer existing code, repository conventions, standard-library features, and
simple designs before introducing new abstractions or dependencies.

## CUPID

Use CUPID as design questions, not rigid rules:

- **Composable** — Can the change be used without unnecessary coupling?
- **Unix-like** — Does each component do one clear thing well?
- **Predictable** — Are behavior, side effects, errors, and boundaries explicit?
- **Idiomatic** — Does the plan follow language and repository conventions?
- **Domain-based** — Do names, types, and boundaries express the domain?

## Tidy First

Plan tidying only when it makes the requested change easier to understand,
test, or verify.

Prefer:

- behavior-preserving cleanup before or around the change
- clearer names and simpler control flow
- local duplication removal that hides the real change
- separating structural and behavioral changes when practical

Do not include unrelated cleanup or speculative refactoring.

## XP

Use XP practices to keep the feedback loop short:

- make one behavior increment at a time
- use TDD: Red -> Green -> Refactor
- choose focused unit tests for isolated behavior and approval tests only for stable whole-output contracts
- keep the smallest test set; do not duplicate assertions or accept baselines blindly
- prefer simple design and executable examples
- expose failures instead of hiding them
- use the fastest useful feedback available

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

## Lean Considerations

<unnecessary work removed, smallest useful increment, and feedback strategy>

## Recommended Approach

<short explanation of the selected approach and rejected alternatives>

## Implementation Plan

1. `<path>` — <change and expected behavior>
2. `<path>` — <change and expected behavior>

## Tidy + TDD Sequence

1. <behavior-preserving structural preparation, if needed>
2. <smallest failing unit or approval test>
3. <smallest implementation>
4. <review any baseline change and tidy>

## Verification Plan

- <focused unit tests>
- <approval tests and deliberate review of any baseline changes, when applicable>
- <broader check, if needed>

## Risks and Open Decisions

- <risk, assumption, or decision>
```

For each implementation step, identify the relevant file or module, intended
behavior, test or verification, and dependency on earlier steps. Keep the plan
ordered for execution and stop at the smallest plan that safely achieves the
goal.

Never report checks as passed unless they are actually run during execution.
