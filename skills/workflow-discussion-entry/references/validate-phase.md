# Validate Phase

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

Check if a discussion already exists for this work unit and topic.

Use the manifest CLI to check discussion phase state:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase discussion --topic {topic}
```

#### If discussion exists and status is `in-progress`

> *Output the next fenced block as a code block:*

```
Resuming discussion: {topic:(titlecase)}
```

Set source="continue".

→ Return to **[the skill](../SKILL.md)**.

#### If discussion exists and status is `concluded`

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase discussion --topic {topic} status in-progress
```

> *Output the next fenced block as a code block:*

```
Reopening discussion: {topic:(titlecase)}
```

Set source="continue".

→ Return to **[the skill](../SKILL.md)**.
