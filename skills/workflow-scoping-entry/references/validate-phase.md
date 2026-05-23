# Validate Phase

*Reference for **[workflow-scoping-entry](../SKILL.md)***

---

Check if scoping entry exists and determine entry state.

## A. Scoping Check

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.scoping.{topic} status
```

#### If output is empty (scoping doesn't exist)

Proceed normally (new entry).

→ Return to caller.

#### If status is `completed`

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.scoping.{topic} status in-progress
```

> *Output the next fenced block as a code block:*

```
Reopening scoping: {topic:(titlecase)}
```

→ Return to caller.

#### If status is `in-progress`

Proceed normally.

→ Return to caller.
