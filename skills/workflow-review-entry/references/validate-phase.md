# Validate Phase

*Reference for **[workflow-review-entry](../SKILL.md)***

---

Check if plan and implementation exist and are ready via manifest CLI.

## A. Existence Checks

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.planning.{topic}
```

#### If plan doesn't exist (`false`)

> *Output the next fenced block as a code block:*

```
Plan Missing

No plan found for "{topic:(titlecase)}".

A completed plan and completed implementation are required for review.
```

**STOP.** Do not proceed — terminal condition.

#### If plan exists (`true`)

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.implementation.{topic}
```

**If implementation doesn't exist (`false`):**

> *Output the next fenced block as a code block:*

```
Implementation Missing

No implementation found for "{topic:(titlecase)}".

A completed implementation is required for review.
```

**STOP.** Do not proceed — terminal condition.

**If implementation exists (`true`):**

→ Proceed to **B. Implementation Status**.

## B. Implementation Status

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.implementation.{topic} status
```

#### If implementation status is not `completed`

> *Output the next fenced block as a code block:*

```
Implementation Not Complete

The implementation for "{topic:(titlecase)}" is not yet completed.
```

**STOP.** Do not proceed — terminal condition.

#### If implementation status is `completed`

→ Proceed to **C. Review State**.

## C. Review State

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.review.{topic}
```

#### If review does not exist

→ Return to caller.

#### If review exists

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.review.{topic} status
```

**If status is `completed`:**

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.review.{topic} status in-progress
```

→ Return to caller.

**If status is `in-progress`:**

→ Return to caller.
