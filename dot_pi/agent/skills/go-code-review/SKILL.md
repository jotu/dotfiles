---
name: go-code-review
description: Review Go code changes for correctness, idiomatic design, concurrency, and test quality. Use alongside the primary review workflow when reviewing Go changes.
---

# Go code review

Apply this lens alongside the primary review workflow, including Matt's Standards and Spec axes. Keep its scope and output format. Inspect changed Go code, affected tests, relevant callers, contracts, and repository guidance before drawing conclusions. Apply repository conventions first; treat general style guidance as heuristics, not requirements. Use Go Code Review Comments (https://go.dev/wiki/CodeReviewComments) as a reference; adopt the Uber Go Style Guide (https://github.com/uber-go/guide/blob/master/style.md) only where appropriate.

## Process

1. Establish the changed behavior, supported Go versions and platforms, and applicable repository standards. If no spec or contract exists, say so rather than inventing one.
2. Examine each applicable risk below, tracing boundaries and lifecycle paths far enough to substantiate potential findings. Check tests against behavior and error cases, not just coverage.
3. Use existing project checks when appropriate and permitted. Report what ran, failures and unverified risks; do not install tools or claim a check passed without running it. Avoid duplicating mechanical findings already enforced by tooling.
4. Report actionable findings at changed locations with a concrete scenario, consequence, evidence, and a proportionate fix. Separate correctness issues from design judgments. If no actionable findings remain, say so and summarize the review and its limits.

When a primary workflow delegates review, give the relevant reviewer this lens or its full instructions, the scope, and the repository standards. Preserve the workflow's separate Standards and Spec reports; do not assume subagents inherit this skill's context.

## Risk lens

- **Contracts and compatibility:** zero values, nil, ownership and mutation, public API behavior, Go version, build constraints and supported platforms. Follow changed data through callers where its contract matters.
- **Errors and resources:** preserve error identity where callers need it; check ignored errors, partial results, cleanup, close and rollback paths. Judge wrapping and logging by the caller's actual needs.
- **Context and concurrency:** trace cancellation and deadlines through blocking work; inspect goroutine lifetimes, channel ownership, synchronization, shared state and shutdown. Identify a concrete race, leak or deadlock scenario before reporting one.
- **Design and simplicity:** apply Tidy First and CUPID as judgment aids: favor readable, maintainable code, cohesive packages and small, well-defined interfaces. Prefer concise code without sacrificing clarity; support extension for demonstrated needs without speculative generality. Question indirection and abstractions that add cost without a present use; do not prescribe polymorphism or extraction solely to address a generic smell.
- **Tests:** check meaningful success, boundary and error cases, cancellation and concurrency where applicable. Look for deterministic behavior, realistic assertions and tests that fail when the intended behavior breaks.
- **Dependencies:** prefer Go's standard library when it meets the requirements. Question new external dependencies when the standard library provides a sufficiently clear, reliable solution; weigh security, maintenance and functionality before recommending a replacement. Respect existing repository decisions and avoid reimplementing complex functionality just to remove a dependency.
- **Operational boundaries:** inspect security, performance and portability when relevant to the change. Connect concerns to an actual trust boundary, workload or supported environment rather than hypothetical micro-optimizations.
