# Invoke the Skill

*Reference for **[workflow-experiment-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill. The handoff carries session identity plus the record's location — the durable inputs (the problem file, the spawning conversation's document, briefs, seeds) are read by the processing skill at initialisation, never added to the handoff.

---

## Handoff

Invoke the **workflow-experiment-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Experiment session for: {topic}
Work unit: {work_unit}
Work type: {work_type}
Experiment: {id}

Record: .workflows/{work_unit}/experiment/{topic}/{id}-{slug}
```
