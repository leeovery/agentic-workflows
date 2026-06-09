# Validate Phase

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Read the specification item's status from the manifest — not the file on disk. A `proposed` grouping has no file yet but is a real item:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.specification.{topic} status
```

#### If the output is empty

The item does not exist. Set verb = "Creating".

→ Return to caller.

#### If the status is `proposed`

The grouping exists as a proposed item; the process skill flips it to in-progress on entry. Set verb = "Creating".

→ Return to caller.

#### If the status is `in-progress`

> *Output the next fenced block as a code block:*

```
Resuming specification: {work_unit:(titlecase)}
```

Set verb = "Continuing".

→ Return to caller.

#### If the status is `completed`

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.specification.{topic} status in-progress
```

> *Output the next fenced block as a code block:*

```
Reopening specification: {work_unit:(titlecase)}
```

Set verb = "Continuing".

→ Return to caller.
