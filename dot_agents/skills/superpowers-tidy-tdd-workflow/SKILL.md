---
name: superpowers-tidy-tdd-workflow
description: Repo-agnostic workflow wrapper for Brainstorm/Plan/Tidy+TDD/Execute/Verify/Review.
---

# Superpowers Tidy TDD Workflow

## When to Use

Use this as the default wrapper for non-trivial implementation, bug-fixing, and refactoring tasks.

## Required Inputs

- `task_goal`: the outcome to achieve
- `scope_paths`: primary files or modules likely affected

## Optional Inputs

- `risk_notes`: known constraints or invariants
- `validation_scope`: `fast` | `standard` | `full`

## Mandatory Sequence

1. Brainstorm
2. Plan
3. Tidy + TDD Setup
4. Execute
5. Verify
6. Review

## Must Do

1. Use Red -> Green -> Refactor for behavior changes.
2. Keep one behavior increment at a time.
3. Keep structural cleanup and behavior changes separable when practical.
4. Run project-appropriate checks before claiming completion.
5. Report commands run and pass/fail outcomes.

## Must Not Do

- Do not claim success without verification evidence.
- Do not invent test/build/lint outputs.
- Do not include unrelated refactors.

## Verification Guidance

Unless project conventions say otherwise, verify in this order:

1. lint
2. tests
3. typecheck
4. build

## Output Contract

For non-trivial tasks, return sections in this order:

1. Brainstorm
2. Plan
3. Tidy + TDD Setup
4. Execute
5. Verify
6. Review
