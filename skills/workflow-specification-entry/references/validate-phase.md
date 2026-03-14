# Validate Phase

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Check if a specification already exists for this work unit.

Read `.workflows/{work_unit}/specification/{topic}/specification.md` if it exists.

#### If specification doesn't exist

→ Return to **[the skill](../SKILL.md)** with verb="Creating".

#### If specification exists with status `in-progress`

> *Output the next fenced block as a code block:*

```
Specification In Progress

A specification for "{work_unit:(titlecase)}" already exists and is in progress.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`r`/`resume`** — Resume the existing specification
- **`s`/`start-fresh`** — Archive and start fresh
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `resume`

→ Return to **[the skill](../SKILL.md)** with verb="Continuing".

#### If `start-fresh`

Archive the existing spec.

→ Return to **[the skill](../SKILL.md)** with verb="Creating".

#### If specification exists with status `completed`

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.specification.{topic} status in-progress
```

> *Output the next fenced block as a code block:*

```
Reopening specification: {work_unit:(titlecase)}
```

→ Return to **[the skill](../SKILL.md)** with verb="Continuing".
