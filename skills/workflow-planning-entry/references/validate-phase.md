# Validate Phase

*Reference for **[workflow-planning-entry](../SKILL.md)***

---

Check whether a plan already exists for this topic.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.planning.{topic}
```

#### If exists (`true`)

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} status
```

**If status is `completed`:**

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} status in-progress
```

> *Output the next fenced block as a code block:*

```
Reopening plan: {topic:(titlecase)}
```

Set source="existing".

→ Return to **[the skill](../SKILL.md)**.

**If status is `in-progress`:**

Set source="existing".

→ Return to **[the skill](../SKILL.md)**.

#### If not exists (`false` — fresh start)

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Any additional context since the specification was completed?

- **`c`/`continue`** — Continue with the specification as-is
- Or provide additional context (priorities, constraints, new considerations)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

Set source="fresh".

→ Return to **[the skill](../SKILL.md)**.
