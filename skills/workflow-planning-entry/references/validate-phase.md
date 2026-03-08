# Validate Phase

*Reference for **[workflow-planning-entry](../SKILL.md)***

---

Check whether a plan already exists for this topic.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase planning --topic {topic} status
```

#### If existing plan (continue or review)

**If status is `concluded`:**

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase planning --topic {topic} status in-progress
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

#### If no existing plan (fresh start)

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Any additional context since the specification was concluded?

- **`c`/`continue`** — Continue with the specification as-is
- Or provide additional context (priorities, constraints, new considerations)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

Set source="fresh".

→ Return to **[the skill](../SKILL.md)**.
