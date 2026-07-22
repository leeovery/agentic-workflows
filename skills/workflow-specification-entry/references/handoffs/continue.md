# Handoff: Continue Specification

*Reference for **[confirm-continue.md](../confirm-continue.md)** and **[confirm-refine.md](../confirm-refine.md)***

---

This skill's purpose is now fulfilled.

Omit the `Consult references` block when the grouping owes none.

Invoke the **workflow-specification-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Specification session for: {Title Case Name}

Continuing existing: .workflows/{work_unit}/specification/{topic}/specification.md

Sources for reference:
- .workflows/{work_unit}/discussion/{discussion-name}.md
- .workflows/{work_unit}/discussion/{discussion-name}.md

Consult references (read narrowly — do not extract):
- .workflows/{work_unit}/discussion/{ref-topic}.md — {slice hint}

Context: This specification already exists. Review and refine it based on the source discussions.
```
