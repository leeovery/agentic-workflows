# Invoke the Skill

*Reference for **[workflow-planning-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill.

---

## Handoff

#### If creating fresh plan (no existing plan)

```
Planning session for: {topic}
Work unit: {work_unit}

Specification: .workflows/{work_unit}/specification/{topic}/specification.md
Additional context: {summary of user's additional context, or "none"}
Cross-cutting references: {list of applicable cross-cutting specs with brief summaries, or "none"}

Invoke the workflow-planning-process skill.
```

Invoke the [workflow-planning-process](../../workflow-planning-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.

#### If continuing or reviewing existing plan

```
Planning session for: {topic}
Work unit: {work_unit}

Specification: .workflows/{work_unit}/specification/{topic}/specification.md
Existing plan: .workflows/{work_unit}/planning/{topic}/planning.md

Invoke the workflow-planning-process skill.
```

Invoke the [workflow-planning-process](../../workflow-planning-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.
