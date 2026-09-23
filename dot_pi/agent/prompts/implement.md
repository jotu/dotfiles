---
description: Scout, plan, then implement a change
---

Use the subagent tool with this chain:

1. Ask `scout` to investigate: $@
2. Ask `planner` to create a plan using `{previous}`.
3. Ask `worker` to implement the plan using `{previous}`.
4. Verify and review the resulting diff.
5. After successful verification and review, create one atomic local Conventional Commit. Do not push or create a PR unless the user explicitly requested it.

Return the worker's result, verification notes, review result, and commit details.
