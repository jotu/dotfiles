---
name: grill-with-docs
description: A relentless interview to sharpen a plan or design, while creating domain docs and ADRs as decisions land.
disable-model-invocation: true
---

This is the Pi adaptation of Matt Pocock's stable `grill-with-docs` skill.

Use the `grilling` skill first to interview the user in rounds. Then use the `domain-modeling` skill to maintain the project's terminology, `CONTEXT.md`, and ADRs as decisions land.

In Pi, when another skill says to call the generic `Skill` tool, read and follow the corresponding `/skill:<name>` skill instead. Do not invent a separate Skill tool.
