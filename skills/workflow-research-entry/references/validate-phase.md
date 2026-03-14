# Validate Phase

*Reference for **[workflow-research-entry](../SKILL.md)***

---

Check research status via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.research.{topic} status
```

#### If status is `completed`

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.research.{topic} status in-progress
```

> *Output the next fenced block as a code block:*

```
Reopening research: {topic:(titlecase)}
```

Set source="continue".

→ Return to **[the skill](../SKILL.md)**.

#### If status is `in-progress`

> *Output the next fenced block as a code block:*

```
Resuming research: {topic:(titlecase)}
```

Set source="continue".

→ Return to **[the skill](../SKILL.md)**.
