---
name: joyful-principles
description: "Shared reference for The Pragmatic Programmer, XP/TDD, Tidy First, CUPID, and Martin Fowler refactoring."
disable-model-invocation: true
---

# Joyful Principles

Use this as a shared reference, not as a ceremony checklist. The principles
reinforce one another:

- **The Pragmatic Programmer** is the default attitude: own the work, keep
  feedback tight, avoid duplication and speculation, and make deliberate trade-
  offs.
- **XP** is the delivery discipline: communicate, work in small releases,
  prefer simple design, and keep a fast feedback loop.
- **TDD** is XP's test-first loop: Red -> Green -> Refactor. Test behavior at a
  public seam, one vertical slice at a time.
- **Tidy First** controls change order: separate behavior-preserving structure
  from behavior changes so each diff stays understandable and reversible.
- **CUPID** is a design lens for boundaries: Composable, Unix-like,
  Predictable, Idiomatic, and Domain-based.
- **Martin Fowler** is the fallback authority for refactoring: use his code
  smells and refactoring catalog when design has started to decay or a cleanup
  needs a name.

Apply the smallest set of ideas that makes the current change safer. Do not
score the same decision against every framework.

## Leading Keywords

Use these words consistently because they compress useful decisions:

- **shared language** — use the project's domain terms in names, tests, and
  conversation.
- **seam** — the highest public boundary where behavior can be observed and
  tested without reaching into implementation details.
- **tracer bullet** — one thin, working path that proves the design and creates
  feedback before more breadth is added.
- **vertical slice** — one user-visible behavior from entry point to outcome.
- **feedback loop** — the shortest reliable command or check that can confirm
  or falsify the current change.
- **root cause** — fix the shared path that creates a failure rather than
  patching each symptom caller.
- **behavior-preserving tidy** — structural cleanup that does not change the
  observable contract.
- **small batch** — a change small enough to understand, verify, and revert.

## The Working Loop

1. Clarify the user value, observable behavior, constraints, and non-goals.
2. Find the existing seam, vocabulary, helper, and feedback loop before adding
   structure.
3. Choose the smallest tracer bullet or vertical slice that proves the path.
4. Use Red -> Green -> Refactor when behavior changes: one failing behavior
   test, the smallest implementation, then a deliberate refactor.
5. Keep behavior-preserving tidy separate from behavior changes where practical.
6. Verify the contract, inspect the diff, and leave the code easier to change.

## Design Questions

### Pragmatic Programmer and XP

- Is this solving a real current need rather than speculative flexibility?
- Is there duplicated knowledge, accidental coupling, or a broken window worth
  fixing in this slice?
- Is the feedback loop short enough to expose a wrong assumption quickly?
- Does the change communicate intent through names, tests, and boundaries?
- Is the design simple enough to change when the next fact arrives?

### TDD

- What is the highest useful seam for this behavior?
- Does the test describe an observable outcome with an independent expected
  value?
- Is the test coupled to behavior rather than private methods, internal calls,
  or incidental output?
- Is the next implementation the smallest one that turns red green?

TDD is not a reason to test every line or to write a batch of imagined tests.
Prefer one red-green slice that teaches the next design decision.

### Tidy First

- Can a small behavior-preserving rename, extraction, or control-flow cleanup
  make the requested change clearer?
- Can structural and behavioral edits be separated in the diff?
- Does the tidy serve the current change, or is it unrelated cleanup?

### CUPID

- **Composable:** Can the unit be used without unnecessary coupling?
- **Unix-like:** Does it do one clear job with a small interface?
- **Predictable:** Are outcomes, errors, side effects, and boundaries explicit?
- **Idiomatic:** Does it fit the language and repository conventions?
- **Domain-based:** Do names and boundaries express the domain rather than
  implementation mechanics?

### Fowler Fallback

When a change exposes design decay, name the smell before reaching for a
refactoring. Common signals include duplicated code, feature envy, data clumps,
primitive obsession, shotgun surgery, divergent change, speculative generality,
message chains, and middle men. Refactor behind tests, keep the behavior stable,
and stop when the current change is clear; do not turn a smell into a rewrite.

## Guardrails

- Prefer existing code, standard-library or platform capabilities, and the
  smallest new abstraction that works.
- Preserve validation, error handling, security, accessibility, and data
  integrity while simplifying.
- Do not mix unrelated cleanup into a behavior change.
- Do not weaken a test or hide a failure to make the loop green.
- Ask when the goal, seam, scope, or acceptance criteria would change the
  design materially.
