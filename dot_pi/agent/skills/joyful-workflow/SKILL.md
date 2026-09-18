---
name: joyful-workflow
description: Orchestrates the joyful development loop of Ask, Plan, Implement, Verify, Review, Done, Replan, or Break. Use to coordinate the joyful planning, implementation, verification, and review skills.
---

# Joyful Workflow

## Purpose

Keep non-trivial work moving through explicit stages without skipping decisions
or hiding failures.

The workflow is:

```text
Ask → Plan → Implement → Verify → Review → Done
              ↑             │         │
              └── Replan ←──┴─────────┘

Any stage → Break
```

The `joyful-workflow` Pi extension provides the phase guardrail, state, status
command, and user confirmation. The skill provides the behavior the agent must
follow. The guardrail is not a sandbox; shell commands can still have side
effects and remain subject to the normal safety gates.

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

The Worktrunk activity extension may still show 🤖/💬 markers, but those markers
are optional convenience only and never determine where work happens.

## Required User Checkpoints

Ask instead of guessing when:

- the goal, expected behavior, or acceptance criteria are unclear
- the scope or affected paths are materially uncertain
- a plan requires a new design decision
- verification fails and the fix may change scope
- review finds a blocking issue
- a check would be skipped, weakened, or replaced by a risky workaround
- the work is ready to move to the next phase

Use the `joyful_workflow` tool or `/joyful` command to record phase changes.
Phase changes always require user confirmation. Explicit commands select the
requested transition but do not bypass confirmation.

## Phase Rules

### Ask

Clarify the goal, value, constraints, acceptance criteria, and non-goals.
Do not implement.

### Plan

Use `/skill:joyful-planning`.
Inspect the repository and produce the smallest implementation-ready plan.
Do not modify code. Workspace preparation must already be recorded as passed.

### Implement

Use `/skill:joyful-implementation`.
Implement one behavior increment at a time with Red → Green → Refactor.
Keep the change within the accepted scope.

### Verify

Use `/skill:joyful-verification`.
Run objective checks against the acceptance criteria and record exact evidence.
Do not fix failures in this phase; replan first. After the evidence is reported,
mark verification passed with `/joyful verified` or the workflow tool.

### Review

Use `/skill:joyful-code-review`.
Review correctness, security, data integrity, compatibility, CUPID, Tidy First,
and XP concerns. Report only actionable findings. After review reports no
blocking findings, mark review passed with `/joyful reviewed` or the workflow
tool.

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

<current phase> → <requested next phase>

## Evidence

<what completed the current phase>

## Ask

<decision required from the user, or “none”>
```

Never silently jump from Implement to Done. Verification and review are
separate gates, even when the same check is useful to both. The extension must
have recorded both evidence gates before allowing Done.

## Commit Gate

Commits are never created automatically. When a commit is explicitly requested,
it must use Conventional Commits and be suitable for review:

- use `<type>[optional scope][!]: <description>`
- keep each commit atomic and focused on one coherent change
- separate structural cleanup from behavior changes when practical
- commit only verified and reviewed changes
- use `!` or `BREAKING CHANGE:` for breaking changes
- do not rewrite existing history unless explicitly asked

The normal commit point is after Verify and Review. Ask before committing if the
scope, commit split, or breaking-change status is unclear.
