# Validate Phase

*Reference for **[workflow-implementation-entry](../SKILL.md)***

---

Check if plan exists and is ready.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.planning.{topic}
```

#### If plan doesn't exist (`false`)

> *Output the next fenced block as a code block:*

```
Plan Missing

No plan found for "{topic:(titlecase)}".

A completed plan is required for implementation.
```

**STOP.** Do not proceed — terminal condition.

#### If plan exists (`true`) and status is not `completed`

Check status:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} status
```

> *Output the next fenced block as a code block:*

```
Plan Not Completed

The plan for "{topic:(titlecase)}" is not yet completed.
```

**STOP.** Do not proceed — terminal condition.

#### If plan exists (`true`) and status is `completed` and implementation exists and status is `completed`

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.implementation.{topic}
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.implementation.{topic} status
```

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} status in-progress
```

> *Output the next fenced block as a code block:*

```
Reopening implementation: {topic:(titlecase)}
```

→ Return to caller.

#### If plan exists (`true`) and status is `completed` and implementation exists and status is `in-progress`

Proceed normally.

→ Return to caller.

#### If plan exists (`true`) and status is `completed` and implementation does not exist

Proceed normally (new entry).

→ Return to caller.
