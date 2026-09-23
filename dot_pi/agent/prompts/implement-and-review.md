---
description: Implement a change, review it, then apply the review
---

Use the subagent tool with this chain:

1. Ask `worker` to implement: $@
2. Ask `reviewer` to review the implementation using `{previous}`.
3. Ask `worker` to apply the review using `{previous}`.
4. Re-run the relevant verification and inspect the final diff.
5. Create one atomic local Conventional Commit after verification and review. Do not push or create a PR unless the user explicitly requested it.

Return the final worker result, verification notes, review result, and commit details.
