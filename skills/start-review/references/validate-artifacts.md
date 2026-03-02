# Validate Plan and Implementation

*Reference for **[start-review](../SKILL.md)***

---

Check if plan and implementation exist and are ready via manifest CLI.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.phases.planning.status
```

#### If plan doesn't exist

> *Output the next fenced block as a code block:*

```
Plan Missing

No plan found for "{work_unit:(titlecase)}".

A concluded plan and implementation are required for review.
Run /start-planning {work_type} {work_unit} to create one.
```

**STOP.** Do not proceed — terminal condition.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.phases.implementation.status
```

#### If implementation doesn't exist

> *Output the next fenced block as a code block:*

```
Implementation Missing

No implementation found for "{work_unit:(titlecase)}".

A completed implementation is required for review.
Run /start-implementation {work_type} {work_unit} to start one.
```

**STOP.** Do not proceed — terminal condition.

#### If implementation status is not `completed`

> *Output the next fenced block as a code block:*

```
Implementation Not Complete

The implementation for "{work_unit:(titlecase)}" is not yet completed.
Run /start-implementation {work_type} {work_unit} to continue.
```

**STOP.** Do not proceed — terminal condition.

#### If plan and implementation are both ready

→ Return to **[the skill](../SKILL.md)**.
