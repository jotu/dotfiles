---
name: joyful-implementation
description: Implements approved plans and small feature, bug-fix, and refactoring changes using Lean software development, CUPID, Tidy First, and XP. Use when making code changes and verifying the result.
---

# Joyful Implementation

## Purpose

Turn an understood goal or approved plan into the smallest safe working change.

Prefer evidence over speculation, existing patterns over new abstractions, and
fast feedback over large batches of work.

This skill may modify code when implementation is requested. It must not create
commits, amend history, or change configuration unless explicitly asked.

Commits are never created automatically. When a commit is explicitly requested,
it must use Conventional Commits and satisfy the commit rules below.

## Workflow

1. Establish the goal, expected behavior, constraints, and acceptance criteria.
2. Read repository instructions and inspect the relevant implementation, callers,
   tests, and error paths.
3. Confirm or create the smallest implementation plan for non-trivial work.
4. Tidy only what makes the requested change safer or easier to verify.
5. Implement one behavior increment at a time using Red -> Green -> Refactor.
6. Run focused checks, then broader project checks when appropriate.
7. Review the diff against the goal, scope, and acceptance criteria.
8. Report the changes, verification evidence, and anything intentionally skipped.

Ask for clarification when the target, expected behavior, scope, or constraints
are materially ambiguous. Do not start implementation while a material decision
is unresolved.

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

Use CUPID as design and implementation questions, not rigid rules:

- **Composable** — Is the interface small and easy to use correctly?
- **Unix-like** — Does each component do one clear thing well?
- **Predictable** — Are behavior, side effects, errors, and boundaries explicit?
- **Idiomatic** — Does the code follow language and repository conventions?
- **Domain-based** — Do names, types, and boundaries express the domain?

## Tidy First

Tidy only when it helps the current change.

Prefer:

- behavior-preserving cleanup before the behavior change when practical
- clearer names and simpler control flow
- local duplication removal that hides the requested change
- separating structural and behavioral changes when practical

Do not include unrelated cleanup or speculative refactoring. Keep structural
changes recognizable in the diff and behavior changes independently verifiable.

## XP

Use XP practices to keep the feedback loop short:

- make one behavior increment at a time
- use TDD: write the smallest focused unit or approval test first
- use approval tests only for stable whole-output contracts
- use Red -> Green -> Refactor
- review baseline changes as behavior, not incidental output
- prefer simple design and executable examples
- expose failures instead of hiding them
- use the fastest useful feedback available
- leave the code and tests clearer than they were

## Implementation Rules

- Fix root causes in shared paths rather than patching individual callers.
- Reuse existing helpers, types, and conventions before adding new ones.
- Preserve public behavior unless the request explicitly changes the contract.
- Keep validation, error handling, security, accessibility, and data integrity
  intact; do not simplify them away.
- Separate unrelated refactors from the requested behavior change.
- Never claim a check passed unless it was actually run.
- Do not create commits unless explicitly requested.

## Commit Rules

When a commit is explicitly requested:

- use `<type>[optional scope][!]: <description>`
- keep the commit atomic and easy to review
- separate structural cleanup from behavior changes when practical
- include only verified changes within the requested scope
- use `!` or `BREAKING CHANGE:` for breaking changes
- do not rewrite existing history unless explicitly asked

Create commits only after verification and review, unless the user explicitly
chooses a different checkpoint.

## Output

Return:

```markdown
## Plan

<goal, acceptance criteria, scope, and implementation steps>

## Tidy + TDD

<structural preparation, test-first sequence, and behavior increments>

## Changes

<files changed and what each change does>

## Verification

- `<command>` — passed
- `<command>` — failed: <brief reason>
- Skipped: <reason, if applicable>

## Review

<diff review against the goal, risks, and remaining work>

## Commit (if requested)

<Conventional Commit message and why the commit is atomic>
```

Keep the report concise. Include exact commands and outcomes. If verification
was skipped, say why and what should be run next.
