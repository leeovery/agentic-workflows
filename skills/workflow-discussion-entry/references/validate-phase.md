# Validate Phase

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

Check if a discussion already exists for this work unit and topic.

Use the manifest CLI to check discussion phase state:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discussion.{topic}
```

#### If discussion exists and status is `in-progress`

> *Output the next fenced block as a code block:*

```
Resuming discussion: {topic:(titlecase)}
```

Set source="continue".

→ Return to caller.

#### If discussion exists and status is `pending`

Set status to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discussion.{topic} status in-progress
```

> *Output the next fenced block as a code block:*

```
Starting discussion: {topic:(titlecase)}
```

Set source="pending-start".

→ Return to caller.

#### If discussion exists and status is `completed`

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discussion.{topic} status in-progress
```

> *Output the next fenced block as a code block:*

```
Reopening discussion: {topic:(titlecase)}
```

Set source="continue".

→ Return to caller.

#### If discussion exists and status is `skipped`

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discussion.{topic} status in-progress
```

> *Output the next fenced block as a code block:*

```
Reopening skipped discussion: {topic:(titlecase)}
```

Set source="pending-start".

→ Return to caller.
