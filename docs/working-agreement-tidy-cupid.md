# Working Agreement: Tidy First + CUPID

## Purpose

Ship correct changes with a small safe diff and clear design boundaries.

## Scope

Apply this agreement during implementation. Give reasoning and review tasks the depth they need.

## Guardrails

- Never weaken security, input validation, accessibility, or data-safety paths.
- Fix root causes in shared flows, not only symptoms at individual callers.
- Keep behavior changes small and rollback-friendly.

## Tidy First + CUPID checks

- Separate behavior-preserving cleanup from behavior changes when practical.
- Give each unit one clear job with explicit inputs and outputs.
- Prefer predictable, idiomatic behavior over custom cleverness.
- Use components that combine cleanly, Unix-like interfaces, and domain-based naming.

## Verification

- Run relevant checks before completion.
- Verify behavior before and after structural cleanup.
- Keep the diff readable, reversible, and within the accepted scope.

## Pull request checklist

- [ ] The change fixes the root cause.
- [ ] Keep cleanup separate from behavior changes where practical.
- [ ] Preserve security and data-safety guardrails.
- [ ] Attach verification evidence.
