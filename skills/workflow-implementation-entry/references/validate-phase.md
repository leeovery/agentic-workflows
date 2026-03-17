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

#### If plan exists (`true`)

Check its status:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} status
```

**If status is not `completed`:**

> *Output the next fenced block as a code block:*

```
Plan Not Completed

The plan for "{topic:(titlecase)}" is not yet completed.
```

**STOP.** Do not proceed — terminal condition.

**If status is `completed`:**

Check if implementation phase entry exists:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.implementation.{topic}
```

**If exists (`true`):**

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.implementation.{topic} status
```

**If status is `completed`:**

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} status in-progress
```

> *Output the next fenced block as a code block:*

```
Reopening implementation: {topic:(titlecase)}
```

→ Return to caller.

**If status is `in-progress`:**

Proceed normally.

→ Return to caller.

**If not exists (`false`):**

Proceed normally (new entry).

→ Return to caller.
