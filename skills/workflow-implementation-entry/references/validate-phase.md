# Validate Phase

*Reference for **[workflow-implementation-entry](../SKILL.md)***

---

Check if plan exists and is ready.

## A. Plan Check

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

Check status:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} status
```

**If plan status is not `completed`:**

> *Output the next fenced block as a code block:*

```
Plan Not Completed

The plan for "{topic:(titlecase)}" is not yet completed.
```

**STOP.** Do not proceed — terminal condition.

**If plan status is `completed`:**

→ Proceed to **B. Implementation Check**.

## B. Implementation Check

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.implementation.{topic}
```

#### If implementation does not exist

Proceed normally (new entry).

→ Return to caller.

#### If implementation exists

Check status:

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
