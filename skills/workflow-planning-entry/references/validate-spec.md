# Validate Specification

*Reference for **[workflow-planning-entry](../SKILL.md)***

---

Check if specification exists and is ready using the manifest CLI.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.specification.{topic}
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

#### If specification exists and status is `proposed`

> *Output the next fenced block as a code block:*

```
Specification Not Started

"{topic:(titlecase)}" is a proposed grouping — the specification
hasn't been started yet.

Start the specification first, then return to planning once it
completes.
```

**STOP.** Do not proceed — terminal condition.

#### If specification exists and status is `completed`

→ Return to caller.
