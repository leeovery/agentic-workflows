# Invoke the Skill

*Reference for **[workflow-scoping-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill. The handoff carries session identity only — the durable carrier (manifest `description` + session log) is read by the processing skill, never added to the handoff.

Invoke the **workflow-scoping-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Scoping session for: {topic}
Work unit: {work_unit}
```
