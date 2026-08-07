# Invoke the Skill

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

The output path is `.workflows/{work_unit}/discussion/{topic}.md`.

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill. The handoff carries session identity and nothing else — the durable inputs (carrier description, discovery brief, completed research) are read by the processing skill at initialisation, never relayed here or forwarded by inference.

---

## Handoff

#### If source is `continue`

Invoke the **workflow-discussion-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Discussion session for: {topic}
Work unit: {work_unit}
Work type: {work_type}
Source: existing discussion
Output: {output_path}
```

#### Otherwise

Invoke the **workflow-discussion-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Discussion session for: {topic}
Work unit: {work_unit}
Work type: {work_type}
Output: {output_path}
```
