# Pi Agent Configuration

This glossary distinguishes reusable Pi instructions from role-focused agents so routing and setup guidance uses each term consistently.

## Language

**Pi skill**: A reusable instruction set that guides Pi through a task or workflow.
_Avoid_: agent, persona

**Specialist agent**: A role-focused agent profile used for an independent perspective, distinct from a Pi skill.
_Avoid_: skill (when referring to an agent profile)

## Safety Gate

**Safety gate**: A best-effort policy check that allows an agent action, requests approval, or blocks it; it is not an operating-system security boundary.
_Avoid_: sandbox

**Approval**: Explicit, action-scoped permission from a person; it does not grant blanket permission for later actions.
_Avoid_: blanket authorization

**Hard denial**: A policy decision that blocks an action regardless of whether a person could approve it.
_Avoid_: rejected approval

**Observer integration**: A tool that displays agent or gate status but cannot approve or change an action’s gate decision.
_Avoid_: approver
