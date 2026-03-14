# Validate Specification

*Reference for **[workflow-planning-entry](../SKILL.md)***

---

Check if specification exists and is ready using the manifest CLI.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.specification.{topic}
```

#### If specification phase doesn't exist or has no status

> *Output the next fenced block as a code block:*

```
Specification Missing

No specification found for "{topic:(titlecase)}".

The specification must be completed before planning can begin.
```

**STOP.** Do not proceed — terminal condition.

#### If specification exists but status is `in-progress`

> *Output the next fenced block as a code block:*

```
Specification In Progress

The specification for "{topic:(titlecase)}" is not yet completed.

The specification must be completed before planning can begin.
```

**STOP.** Do not proceed — terminal condition.

#### If specification exists and status is `completed`

**If work_type is `epic`:**

Query all specification entries to identify cross-cutting specs:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.specification
```

Parse the output to identify any items with `type: cross-cutting`. Store these for the cross-cutting context step.

→ Return to **[the skill](../SKILL.md)**.
