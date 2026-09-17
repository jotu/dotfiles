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

## Worktrunk Boundary

Use Worktrunk for every joyful workflow:

1. Unless the user names an existing worktree or explicitly asks to use the
   current checkout, default to a new Worktrunk branch and worktree from the
   fresh latest `main`.
2. Confirm the base branch and remote. Unless the user specifies otherwise,
   fetch `origin/main` before creating the worktree.
3. Derive a concise, descriptive kebab-case name from the goal, such as
   `fix-auth-timeout`, `add-invoice-export`, or `refactor-cache-boundary`.
4. Show the proposed base, fetch, and branch name. Ask for confirmation before
   running the network operation or creating/switching worktrees. Then run
   `git fetch origin main` followed by `wt switch --create <name> --base origin/main`.
5. Start or relaunch Pi in the new worktree, run `/joyful start <goal>`, and
   then run `/joyful prepare` (or the `joyful_workflow` tool with `action:
   "prepare"`). The extension must verify the clean worktree, non-main branch,
   fresh base commit, and Worktrunk.
6. Before planning or implementation, confirm that Pi is running in the new
   worktree. Do not continue in the base checkout after creating one. If the
   user explicitly chose an existing worktree, use `/joyful prepare existing`;
   it still must be a clean, dedicated, non-main Worktrunk.
7. Keep Plan, Implement, Verify, and Review in the same worktree.
8. Include the selected base, branch, and worktree in phase handoffs and the
   final review.

If Worktrunk is unavailable, the name is ambiguous, or the current directory
is not the agreed worktree, stop at Ask or Break rather than silently using the
base checkout. The existing Worktrunk Pi extension may show 🤖/💬 activity
markers, but those markers do not replace selecting the correct worktree.

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
Do not modify code. Worktrunk preflight must already be recorded as passed.

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
