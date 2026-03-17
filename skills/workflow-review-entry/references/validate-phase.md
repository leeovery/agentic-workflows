# Validate Phase

*Reference for **[workflow-review-entry](../SKILL.md)***

---

Check if plan and implementation exist and are ready via manifest CLI.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} status
```

#### If plan doesn't exist

> *Output the next fenced block as a code block:*

```
Plan Missing

No plan found for "{topic:(titlecase)}".

A completed plan and completed implementation are required for review.
```

**STOP.** Do not proceed — terminal condition.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.implementation.{topic} status
```

#### If implementation doesn't exist

> *Output the next fenced block as a code block:*

```
Implementation Missing

No implementation found for "{topic:(titlecase)}".

A completed implementation is required for review.
```

**STOP.** Do not proceed — terminal condition.

#### If implementation status is not `completed`

> *Output the next fenced block as a code block:*

```
Implementation Not Complete

The implementation for "{topic:(titlecase)}" is not yet completed.
```

**STOP.** Do not proceed — terminal condition.

#### If plan and implementation are both ready

Check if review phase entry exists:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.review.{topic}
```

**If not exists (`false`):**

→ Return to caller.

**If exists and status is `completed`:**

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.review.{topic} status
```

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.review.{topic} status in-progress
```

→ Return to caller.

**If exists and status is `in-progress`:**

→ Return to caller.
