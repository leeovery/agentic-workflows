# Validate Plan

*Reference for **[start-implementation](../SKILL.md)***

---

Check if plan exists and is ready.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.phases.planning.status
```

Also verify the plan file exists at `.workflows/{work_unit}/planning/planning.md`.

#### If plan doesn't exist

> *Output the next fenced block as a code block:*

```
Plan Missing

No plan found for "{work_unit:(titlecase)}".

A concluded plan is required for implementation.
Run /start-planning {work_type} {work_unit} to create one.
```

**STOP.** Do not proceed — terminal condition.

#### If plan exists but status is not `concluded`

> *Output the next fenced block as a code block:*

```
Plan Not Concluded

The plan for "{work_unit:(titlecase)}" is not yet concluded.
Run /start-planning {work_type} {work_unit} to continue.
```

**STOP.** Do not proceed — terminal condition.

#### If plan exists and status is `concluded`

→ Return to **[the skill](../SKILL.md)**.
