# Validate Phase

*Reference for **[start-investigation](../SKILL.md)***

---

Check if a work unit already exists for this name by querying the manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase investigation --topic {topic}
```

#### If work unit exists with investigation phase

Read the investigation status from the manifest output.

**If status is `in-progress`:**

> *Output the next fenced block as a code block:*

```
Resuming investigation: {work_unit:(titlecase)}
```

Set source="continue".

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

**If status is `concluded`:**

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase investigation --topic {topic} status in-progress
```

> *Output the next fenced block as a code block:*

```
Reopening investigation: {work_unit:(titlecase)}
```

Set source="continue".

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

#### If no collision

Set source="bridge".

→ Return to **[the skill](../SKILL.md)**.
