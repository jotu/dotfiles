---
name: joyful-implementation
description: Implement an approved plan or small feature, bug fix, refactor, or configuration change.
disable-model-invocation: true
---

# Joyful Implementation

Turn an understood goal or approved plan into the smallest safe working change.
If you also invoke `/skill:joyful-principles`, use it for the shared Pragmatic
Programmer, XP/TDD, Tidy First, CUPID, and Fowler vocabulary.

This skill may modify code when implementation is requested. It must not create
commits during implementation, amend history, or change configuration unless
explicitly asked. After verification and review, a local Conventional Commit
is the normal delivery step unless the user opts out; publishing remains a
separate explicit request.

## Workflow

1. Establish the goal, expected behavior, constraints, and acceptance criteria.
2. Read repository instructions and inspect the relevant implementation, callers,
   tests, and error paths.
3. Confirm or create the smallest implementation plan for non-trivial work.
4. Identify the highest useful seam and the shortest reliable feedback loop.
5. Tidy only what makes the requested change safer or easier to verify.
6. Implement one vertical slice at a time using Red -> Green -> Refactor.
7. Run focused checks, then broader project checks when appropriate.
8. Review the diff against the goal, scope, and acceptance criteria.
9. Report the changes, verification evidence, and anything intentionally skipped.

Ask for clarification when the target, expected behavior, scope, or constraints
are materially ambiguous. Do not start implementation while a material
decision is unresolved.

## Implementation Discipline

- Fix root causes in shared paths rather than patching individual callers.
- Reuse existing helpers, types, seams, vocabulary, and conventions before
  adding new ones.
- Write one behavior test at the agreed seam, make the smallest change that
  turns red green, then refactor deliberately.
- Keep tests coupled to observable behavior, not private methods or incidental
  implementation calls.
- Preserve public behavior unless the request explicitly changes the contract.
- Keep interfaces small, outcomes predictable, and names domain-based.
- Separate behavior-preserving tidy from behavior changes when practical.
- Use Fowler's smell names to guide a focused refactoring, not to justify a
  rewrite.
- Preserve validation, error handling, security, accessibility, and data
  integrity; do not simplify them away.
- Separate unrelated refactors from the requested behavior change.
- Never claim a check passed unless it was actually run.
- Do not create commits during implementation.

## Commit Rules

After verification and review, create a local commit by default unless the user
opts out:

- use `<type>[optional scope][!]: <description>`
- keep the commit atomic and easy to review
- separate structural cleanup from behavior changes when practical
- include only verified changes within the requested scope
- use `!` or `BREAKING CHANGE:` for breaking changes
- do not rewrite existing history unless explicitly asked

Pushes and PR creation are external delivery actions and require an explicit
user request. If the user requests `commit, push, create PR/draft`, execute
that batch only after verification and review.

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

## Commit

<Conventional Commit message and why the commit is atomic>
```

Keep the report concise. Include exact commands and outcomes. If verification
was skipped, say why and what should be run next.
