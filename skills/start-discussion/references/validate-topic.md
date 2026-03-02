# Validate Topic

*Reference for **[start-discussion](../SKILL.md)***

---

Check if a discussion already exists for this work unit and topic.

Use the manifest CLI to check discussion phase state:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.phases.discussion
```

#### If work_type is `epic`

Check for an existing item matching the topic:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.phases.discussion.items.{topic}
```

#### If work_type is `feature` or `bugfix`

The topic is the work unit name itself. Check the discussion phase status.

#### If discussion exists and status is `in-progress`

> *Output the next fenced block as a code block:*

```
Resuming discussion: {topic:(titlecase)}
```

Set source="continue".

→ Return to **[the skill](../SKILL.md)** for **Step 8**.

#### If discussion exists and status is `concluded`

> *Output the next fenced block as a code block:*

```
Discussion Concluded

The discussion for "{topic:(titlecase)}" has already concluded.
Run /start-specification to continue to spec.
```

**STOP.** Do not proceed — terminal condition.

#### If no collision

Set source="bridge".

→ Return to **[the skill](../SKILL.md)**.
