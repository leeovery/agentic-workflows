# Validate Specification

*Reference for **[start-planning](../SKILL.md)***

---

Check if specification exists and is ready using the manifest CLI.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.phases.specification
```

#### If specification phase doesn't exist or has no status

> *Output the next fenced block as a code block:*

```
Specification Missing

No specification found for "{work_unit:(titlecase)}".

A concluded specification is required for planning.
Run /start-specification {work_type} {work_unit} to create one.
```

**STOP.** Do not proceed — terminal condition.

#### If specification exists but status is `in-progress`

> *Output the next fenced block as a code block:*

```
Specification In Progress

The specification for "{work_unit:(titlecase)}" is not yet concluded.
Run /start-specification {work_type} {work_unit} to continue.
```

**STOP.** Do not proceed — terminal condition.

#### If specification exists and status is `concluded`

Parse cross-cutting specs from `specifications.crosscutting` in the discovery output.

→ Return to **[the skill](../SKILL.md)**.
