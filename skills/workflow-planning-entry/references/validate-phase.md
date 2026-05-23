# Validate Phase

*Reference for **[workflow-planning-entry](../SKILL.md)***

---

Check whether a plan already exists for this topic.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.planning.{topic} status
```

#### If output is empty (plan doesn't exist — fresh start)

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

→ Return to caller.

#### If status is `completed`

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.planning.{topic} status in-progress
```

> *Output the next fenced block as a code block:*

```
Reopening plan: {topic:(titlecase)}
```

Set source="existing".

→ Return to caller.

#### If status is `in-progress`

Set source="existing".

→ Return to caller.
