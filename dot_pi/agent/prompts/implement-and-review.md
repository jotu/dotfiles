---
description: Implement a change, review it, then apply the review
---

Use the subagent tool with this chain:

1. Ask `worker` to implement: $@
2. Ask `reviewer` to review the implementation using `{previous}`.
3. Ask `worker` to apply the review using `{previous}`.

Return the final worker result and verification notes.
