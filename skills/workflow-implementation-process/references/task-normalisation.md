# Task Normalisation

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

Normalise task content into this shape before passing to executor and reviewer agents. The plan adapter tells you how to extract the task — this reference tells you what shape to present it in.

---

## Template

```
TASK: {internal_id} — {name}
PHASE: {N} — {phase name}

INSTRUCTIONS:
{all instructional content from the task}
```

## Rules

- **Include** everything instructional: goal, implementation steps, acceptance criteria, tests, edge cases, context, notes
- **Strip** meta fields: status, priority, dependencies, dates, progress markers
- **Preserve** the internal structure of the instructional content as-is from the plan — do not summarise, reorder, or rewrite

## ID Resolution

The `{internal_id}` in the template is always the **internal ID** (format: `{topic}-{phase_id}-{task_id}`).

If the format adapter returns an external ID, read `task_map` from the manifest to find the corresponding internal ID:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} task_map
```
Reverse lookup — match the external ID value to find its internal ID key.
