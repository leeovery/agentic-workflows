# Validate Phase

*Reference for **[workflow-implementation-entry](../SKILL.md)***

---

Check if plan exists and is ready.

## A. Plan Check

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.planning.{topic} status
```

#### If output is empty (plan doesn't exist)

> *Output the next fenced block as a code block:*

```
Plan Missing

No plan found for "{topic:(titlecase)}".

A completed plan is required for implementation.
```

**STOP.** Do not proceed — terminal condition.

#### If plan status is not `completed`

> *Output the next fenced block as a code block:*

```
Plan Not Completed

The plan for "{topic:(titlecase)}" is not yet completed.
```

**STOP.** Do not proceed — terminal condition.

#### If plan status is `completed`

→ Proceed to **B. Implementation Check**.

## B. Implementation Check

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.implementation.{topic} status
```

#### If output is empty (implementation does not exist)

Proceed normally (new entry).

→ Return to caller.

#### If status is `completed`

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.implementation.{topic} status in-progress
```

> *Output the next fenced block as a code block:*

```
Reopening implementation: {topic:(titlecase)}
```

→ Return to caller.

#### If status is `in-progress`

Proceed normally.

→ Return to caller.
