---
name: joyful-code-review
description: Reviews diffs and pull requests for correctness, clarity, and maintainability using CUPID, Tidy First, XP, and Conventional Comments, with optional Conventional Commit learning notes.
---

# Joyful Code Review

## Purpose

Review code for concrete risks and useful improvements.

Prefer evidence over opinion, simple solutions over speculative design, and
small actionable feedback over exhaustive commentary.

This skill reviews code changes, not commit history. It must not modify code,
create commits, amend history, or change configuration unless explicitly asked.

## Workflow

1. Identify the review target and intended behavior.
2. Read relevant repository instructions and conventions.
3. Inspect the complete diff and affected callers, tests, and error paths.
4. Review correctness, security, data integrity, and compatibility first.
5. Apply the Tidy First, CUPID, and XP lenses.
6. Run safe, relevant checks when practical.
7. Report only actionable findings.
8. Add an optional practice note when there is something useful to learn.

Ask for clarification if the target, expected behavior, or comparison range is
ambiguous.

## Review Lenses

### Tidy First

Suggest a tidy only when it makes the current change easier to understand,
test, or verify.

Prefer:

- small, behavior-preserving cleanup
- separation of structural and behavioral changes
- clearer names and simpler control flow
- removal of duplication that hides the real change

Do not request unrelated cleanup or speculative refactoring.

### CUPID

Use these as questions, not rigid rules:

- **Composable** — Is the interface small, clear, and easy to use?
- **Unix** — Does each component do one useful thing well?
- **Predictable** — Are behavior, side effects, errors, and boundaries clear?
- **Idiomatic** — Does the code follow language and repository conventions?
- **Domain-based** — Do names, types, and boundaries express the domain?

### XP

Look for:

- clear communication through names, tests, and contracts
- focused TDD evidence: no duplicated assertions; approval tests only for stable whole-output contracts, with baseline changes reviewed deliberately
- the simplest design that solves the current problem
- fast feedback through focused tests and verification
- courage to expose failures instead of hiding them
- respect for users, operators, domain experts, and future maintainers

Value small changes, continuous integration, automated tests, collaboration,
and collective ownership. Do not enforce these practices mechanically.

## Conventional Comments

Every actionable review comment must use:

```text
<label> [decorations]: <subject>

<discussion>
```

Use:

- `issue (blocking)` — must be fixed before merge
- `issue (non-blocking)` — real problem that can safely wait
- `suggestion (non-blocking)` — concrete improvement
- `question (non-blocking)` — uncertain concern
- `todo (non-blocking)` — small necessary task
- `nitpick (non-blocking)` — trivial preference
- `praise` — sincere, specific positive feedback

Useful decorations include `security`, `test`, `performance`, `api`, and
`maintainability`.

When using Hunk, put the label, decorations, and subject in the comment
summary. Put the explanation, evidence, and smallest useful fix in the
comment rationale.

Rules:

- Report only findings with a concrete consequence.
- Pair issues with the smallest useful fix when possible.
- Use `question` when the concern is not proven.
- Use `nitpick` only for genuinely trivial preferences.
- Do not use invented prefixes such as `P0` or `P1`.
- Do not report personal style preferences without explaining their impact.
- Do not duplicate multiple comments for the same root cause.

## Conventional Commits

Do not review, score, or block on existing commit messages. This skill does not
create commits. When a new commit is explicitly requested, it should be
reviewable and use Conventional Commits:

- keep it atomic and focused on one coherent change
- separate structural cleanup from behavior changes when practical
- include only verified changes within the requested scope
- use `!` or `BREAKING CHANGE:` for breaking changes

When useful, include a short practice note showing how the change could be
organized using Conventional Commits:

```text
<type>[optional scope][!]: <description>
```

Common types include `feat`, `fix`, `refactor`, `test`, `docs`, `build`, `ci`,
`perf`, `style`, `chore`, and `revert`.

Use:

- `refactor` for behavior-preserving structural changes
- `fix` for defect corrections
- `feat` for new behavior
- `test` for test-only changes
- `docs`, `build`, `ci`, or `chore` where appropriate
- `!` or `BREAKING CHANGE:` for breaking changes

Practice notes:

- are optional
- should teach a reusable idea
- should contain at most two lessons
- must never block a merge
- must not require a specific commit split
- must not suggest rewriting history unless explicitly asked

## Verification

Run safe, relevant repository checks when practical.

Prefer:

1. formatter or lint
2. focused tests
3. broader tests
4. typecheck
5. build or package validation

Report the exact commands run and their outcomes.

Never invent verification results. If a check was skipped, say why.

## Output

Return:

```markdown
## Verdict

Approve | Approve with non-blocking suggestions | Request changes | Needs clarification

Short reason.

## Comments

<Conventional Comments findings, highest impact first>

## Practice Note

Optional. Include only when there is a useful lesson about CUPID, Tidy First,
XP, review technique, or Conventional Commits.

## Verification

- `<command>` — passed
- `<command>` — failed
- Skipped: `<reason>`
```

Base `Request changes` only on at least one `issue (blocking)` comment.

When running under `joyful-workflow`, mark review passed with `/joyful reviewed`
or the `joyful_workflow` tool only after reporting the review and receiving
confirmation. Never mark review passed when blocking findings remain.

If there are no findings, write:

```text
No actionable findings found.
```

Do not manufacture criticism to make the review appear thorough.
