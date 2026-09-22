---
name: joyful-code-review
description: Review a diff, pull request, or work-in-progress for correctness, security, scope, and maintainability.
disable-model-invocation: true
---

# Joyful Code Review

Review code for concrete risks and useful improvements. If you also invoke
`/skill:joyful-principles`, use it for the shared Pragmatic Programmer, XP/TDD,
Tidy First, CUPID, and Fowler vocabulary.

Prefer evidence over opinion, simple solutions over speculative design, and
small actionable feedback over exhaustive commentary. Review code changes, not
commit history. This skill must not modify code, create commits, amend history,
or change configuration unless explicitly asked.

## Workflow

1. Identify the review target and intended behavior.
2. Read relevant repository instructions and conventions.
3. Inspect the complete diff and affected callers, tests, and error paths.
4. Review correctness, security, data integrity, and compatibility first.
5. Check scope, root-cause coverage, seams, and feedback evidence.
6. Apply Tidy First, CUPID, XP/TDD, and Fowler only where they expose a
   concrete consequence.
7. Run safe, relevant checks when practical.
8. Report only actionable findings and an explicit verdict.

Ask for clarification if the target, expected behavior, or comparison range is
ambiguous.

## Review Questions

- Does the change implement the requested observable behavior at the right
  seam?
- Does it fix the root cause across shared callers, or only the named symptom?
- Is the smallest understandable design used, without speculative generality?
- Are tests behavior-focused, independent of private implementation details,
  and backed by a useful feedback loop?
- Are structural tidy and behavior changes distinguishable?
- Are interfaces composable, Unix-like, predictable, idiomatic, and
  domain-based?
- Does a Fowler smell point to a concrete maintenance or correctness risk?
- Are validation, error handling, security, accessibility, data integrity, and
  compatibility preserved?

Do not request cleanup merely because it is possible. A tidy belongs in the
review only when it makes this change easier to understand, test, verify, or
safely evolve.

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

Rules:

- Report only findings with a concrete consequence.
- Pair issues with the smallest useful fix when possible.
- Use `question` when the concern is not proven.
- Use `nitpick` only for genuinely trivial preferences.
- Do not report personal style preferences without explaining their impact.
- Do not duplicate multiple comments for the same root cause.

When using Hunk, put the label, decorations, and subject in the comment summary.
Put the explanation, evidence, and smallest useful fix in the comment rationale.

## Conventional Commits

Do not review, score, or block on existing commit messages. This skill does not
create commits. When a new commit is explicitly requested, it should be
reviewable and use Conventional Commits:

- keep it atomic and focused on one coherent change
- separate structural cleanup from behavior changes when practical
- include only verified changes within the requested scope
- use `!` or `BREAKING CHANGE:` for breaking changes

When useful, include a short practice note showing how the change could be
organized using:

```text
<type>[optional scope][!]: <description>
```

Practice notes are optional, teach at most two lessons, never block a merge,
and must not suggest rewriting history unless explicitly asked.

## Verification

Run safe, relevant repository checks when practical. Prefer:

1. formatter or lint
2. focused tests
3. broader tests
4. typecheck
5. build or package validation

Report the exact commands run and their outcomes. Never invent verification
results. If a check was skipped, say why.

## Output

Return:

```markdown
## Verdict

Approve | Approve with non-blocking suggestions | Request changes | Needs clarification

Short reason.

## Comments

<Conventional Comments findings, highest impact first>

## Practice Note

Optional. Include only when there is a useful lesson about the shared
principles, review technique, or Conventional Commits.

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
