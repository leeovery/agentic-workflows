# Validate Phase

*Reference for **[workflow-review-entry](../SKILL.md)***

---

Check if plan and implementation exist and are ready via manifest CLI.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase planning --topic {topic} status
```

#### If plan doesn't exist

> *Output the next fenced block as a code block:*

```
Plan Missing

No plan found for "{topic:(titlecase)}".

A concluded plan and completed implementation are required for review.
```

**STOP.** Do not proceed — terminal condition.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase implementation --topic {topic} status
```

#### If implementation doesn't exist

> *Output the next fenced block as a code block:*

```
Implementation Missing

No implementation found for "{topic:(titlecase)}".

A completed implementation is required for review.
```

**STOP.** Do not proceed — terminal condition.

#### If implementation status is not `completed`

> *Output the next fenced block as a code block:*

```
Implementation Not Complete

The implementation for "{topic:(titlecase)}" is not yet completed.
```

**STOP.** Do not proceed — terminal condition.

#### If plan and implementation are both ready

Check review's own phase status:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase review --topic {topic} status
```

**If status is `concluded`:**

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase review --topic {topic} status in-progress
```

> *Output the next fenced block as a code block:*

```
Reopening review: {topic:(titlecase)}
```

→ Return to **[the skill](../SKILL.md)**.

**If status is `in-progress` or not found:**

Proceed normally.

→ Return to **[the skill](../SKILL.md)**.
