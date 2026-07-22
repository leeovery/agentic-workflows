# Handoff: Create Specification

*Reference for **[confirm-create.md](../confirm-create.md)***

---

This skill's purpose is now fulfilled.

Omit the `Consult references` block when the grouping owes none.

Invoke the **workflow-specification-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Specification session for: {Title Case Name}

Sources:
- .workflows/{work_unit}/discussion/{discussion-name}.md
- .workflows/{work_unit}/discussion/{discussion-name}.md

Consult references (read narrowly — do not extract):
- .workflows/{work_unit}/discussion/{ref-topic}.md — {slice hint}

Output: .workflows/{work_unit}/specification/{topic}/specification.md
```
