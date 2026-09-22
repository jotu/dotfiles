---
description: Run a read-only scout followed by a planner
---

Use the subagent tool with this chain:

1. Ask `scout` to investigate: $@
2. Ask `planner` to create an implementation plan using the scout output as `{previous}`.

Do not implement changes. Return the planner's result.
