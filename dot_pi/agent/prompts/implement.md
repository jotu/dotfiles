---
description: Scout, plan, then implement a change
---

Use the subagent tool with this chain:

1. Ask `scout` to investigate: $@
2. Ask `planner` to create a plan using `{previous}`.
3. Ask `worker` to implement the plan using `{previous}`.

Return the worker's result and verification notes.
