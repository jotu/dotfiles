---
name: joyful-workflow
description: Explicitly coordinate the joyful Ask -> Plan -> Implement -> Verify -> Review -> Done workflow.
disable-model-invocation: true
---

# Joyful Workflow

Keep non-trivial work moving through explicit stages without skipping decisions
or hiding failures. When you also invoke `/skill:joyful-principles`, use it as
the shared vocabulary and engineering reference.

```text
Ask -> Plan -> Implement -> Verify -> Review -> Done
              ^             |         |
              +-- Replan <--+---------+

Any stage -> Break
```

For non-trivial work, Ask and Plan produce a small issue tree: one root goal,
small independently verifiable leaves, dependencies, and a done check per leaf.
Work one leaf through Implement -> Verify -> Review before starting the next.
Skip the tree for a one-slice change.

The `joyful-workflow` Pi extension provides the phase guardrail, state, and
status command. Joyful is opt-in: normal Pi sessions leave the guardrail
inactive so standalone Matt skills can work normally. Run `/joyful start
<goal>` to activate it; `/joyful finish` and `/joyful break` deactivate it.
The guardrail is not a sandbox; shell commands can still have side effects and
remain subject to the normal safety gates.

## Shared Engineering Discipline

When `/skill:joyful-principles` was explicitly invoked, use it for decisions
involving design, testing, refactoring, or review. Its keywords are the working
language for this workflow:
**shared language, seam, tracer bullet, vertical slice, feedback loop, root
cause, behavior-preserving tidy, and small batch**.

XP's test-first practice is TDD: Red -> Green -> Refactor. Use it when a
behavior change benefits from a test seam; do not create tests or process for
ceremony alone.

## Workspace Boundary

Worktrunk is optional. Do not force a branch, worktree, fetch, or network
operation when the user has not chosen one. First establish where the user
wants to work:

- **main** — work in the current `main`/`master` checkout when the user says
  `work on main`.
- **branch** — use the current non-main branch. This is the default when the
  current checkout is already on a branch other than `main`/`master`.
- **worktree** — use a linked Git worktree when the user asks for one.
- **worktrunk** — use Worktrunk only when the user asks for it.
- **existing** — use the explicitly selected current checkout as-is.

Use `/joyful prepare main|branch|worktree|worktrunk|existing` to record the
choice. `/joyful prepare` auto-selects `branch` on a non-main branch and asks
for an explicit choice on `main`. Preparation only verifies the selected
checkout is a clean Git checkout; it does not create or switch workspaces.

If the user asks to create a branch or worktree, explain the proposed command,
ask for confirmation before changing Git state, perform that change, then run
`/joyful prepare branch` or `/joyful prepare worktree`. Keep Plan, Implement,
Verify, and Review in the selected checkout. Include the selected workspace,
branch, and path in phase handoffs and the final review.

The Worktrunk activity extension may still show robot/chat markers, but those
markers are optional convenience only and never determine where work happens.

## Required User Checkpoints

Ask instead of guessing when:

- the goal, expected behavior, or acceptance criteria are unclear
- the scope or affected paths are materially uncertain
- a plan requires a new design decision
- verification fails and the fix may change scope
- review finds a blocking issue
- a check would be skipped, weakened, or replaced by a risky workaround
- a destructive, cluster, credential, branch/worktree, or external-write gate
  is reached

Use the `joyful_workflow` tool or `/joyful` command to record phase changes.
Routine phase changes and evidence recording do not require an extra
confirmation; safety gates and Ask decisions remain authoritative.

## Phase Rules

### Ask

Clarify the goal, value, constraints, acceptance criteria, and non-goals. Do
not implement.

### Plan

Have the user invoke `/skill:joyful-planning`. That skill inspects the repository
and produces the smallest implementation-ready plan for the next issue-tree
leaf, including its done check and only the tests that add distinct evidence.
Workspace preparation must already be recorded as passed.

### Implement

Have the user invoke `/skill:joyful-implementation`. That skill implements one
issue-tree leaf at a time with TDD when behavior changes: Red -> Green ->
Refactor. Keep the change within the accepted scope and stop for a new decision
instead of silently adding another leaf.

### Verify

Have the user invoke `/skill:joyful-verification`. That skill runs the smallest
relevant unit and approval checks, records exact evidence, and reviews any
baseline changes deliberately. Do not fix failures in this phase; replan first.
After reporting evidence, mark verification passed with `/joyful verified` or
the workflow tool.

### Review

Have the user invoke `/skill:joyful-code-review`. That skill reviews
correctness, security, data integrity, compatibility, focused test evidence,
CUPID boundaries, Tidy First separation, XP feedback, and Fowler refactoring
smells. Report only actionable findings. After review reports no blocking
findings, mark review passed with `/joyful reviewed` or the workflow tool.

### Done

Finish only when the workflow has recorded both verification and review as
passed. Report remaining non-blocking work explicitly.

### Replan

Return to Plan when verification or review changes the approach, scope,
acceptance criteria, or required work. Ask before accepting the changed plan.

### Break

Stop when blocked by an external dependency, unavailable environment, missing
decision, unsafe request, or explicit user instruction to stop.

## Loop Contract

At every transition, report:

```markdown
## Phase

<current phase> -> <requested next phase>

## Evidence

<what completed the current phase>

## Ask

<decision required from the user, or “none”>
```

Never silently jump from Implement to Done. Verification and Review are
separate gates, even when the same check is useful to both. The extension must
have recorded both evidence gates before allowing Done.

## Commit Gate

Commits are never created automatically. When a commit is explicitly requested,
it must use Conventional Commits and be suitable for review:

- use `<type>[optional scope][!]: <description>`
- keep each commit atomic and focused on one coherent change
- separate structural and behavioral changes when practical
- commit only verified and reviewed changes
- use `!` or `BREAKING CHANGE:` for breaking changes
- do not rewrite existing history unless explicitly asked

The normal commit point is after Verify and Review. If the user explicitly
requests commit, push, PR creation, or a similar delivery batch, execute the
whole batch together, compose the commit message and PR description, and ask
only when its scope, destination, or breaking-change status is unclear. Keep
merge, deletion, and unrelated risky actions as separate gates.
