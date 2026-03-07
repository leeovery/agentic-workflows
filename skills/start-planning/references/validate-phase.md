# Validate Phase

*Reference for **[start-planning](../SKILL.md)***

---

Check whether the selected specification already has a plan (from `has_plan` in discovery output).

#### If existing plan (continue or review)

Check plan status via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase planning --topic {topic} status
```

**If status is `concluded`:**

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase planning --topic {topic} status in-progress
```

> *Output the next fenced block as a code block:*

```
Reopening plan: {topic:(titlecase)}
```

The plan already has its context from when it was created. Skip context gathering.

→ Return to **[the skill](../SKILL.md)** for **Step 8**.

**If status is `in-progress`:**

The plan already has its context from when it was created. Skip context gathering.

→ Return to **[the skill](../SKILL.md)** for **Step 8**.

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

→ Return to **[the skill](../SKILL.md)** for **Step 7**.
