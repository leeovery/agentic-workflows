# Validate Phase

*Reference for **[workflow-investigation-entry](../SKILL.md)***

---

Check investigation status via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase investigation --topic {topic}
```

#### If status is `in-progress`

> *Output the next fenced block as a code block:*

```
Resuming investigation: {work_unit:(titlecase)}
```

Set source="continue".

→ Return to **[the skill](../SKILL.md)**.

#### If status is `concluded`

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase investigation --topic {topic} status in-progress
```

> *Output the next fenced block as a code block:*

```
Reopening investigation: {work_unit:(titlecase)}
```

Set source="continue".

→ Return to **[the skill](../SKILL.md)**.
