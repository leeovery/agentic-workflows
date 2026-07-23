# Invoke the Skill

*Reference for **[workflow-review-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill.

Query format from manifest:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} format
```

**Handoff:**
Invoke the **workflow-review-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Review session
Work unit: {work_unit}
Topic: {topic}
Scope: single

Plans to review:
  - work_unit: {work_unit}
    topic: {topic}
    format: {format}
    specification: .workflows/{work_unit}/specification/{topic}/specification.md (exists: {true|false})
