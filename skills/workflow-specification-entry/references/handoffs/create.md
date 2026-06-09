# Handoff: Create Specification

*Reference for **[confirm-create.md](../confirm-create.md)***

---

This skill's purpose is now fulfilled. Invoke the [workflow-specification-process](../../../workflow-specification-process/SKILL.md) skill for your next instructions. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed.

```
Specification session for: {Title Case Name}

Sources:
- .workflows/{work_unit}/discussion/{discussion-name}.md
- .workflows/{work_unit}/discussion/{discussion-name}.md

Consult references (read narrowly — do not extract):
- .workflows/{work_unit}/discussion/{ref-topic}.md — {slice hint}

Output: .workflows/{work_unit}/specification/{topic}/specification.md

---
Invoke the workflow-specification-process skill.
```

Omit the `Consult references` block when the grouping owes none.
