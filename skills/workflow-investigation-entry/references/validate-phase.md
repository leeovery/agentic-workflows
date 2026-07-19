# Validate Phase

*Reference for **[workflow-investigation-entry](../SKILL.md)***

---

Check investigation status via `engine manifest`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.investigation.{topic}
```

#### If status is `in-progress`

> *Output the next fenced block as a code block:*

```
Resuming investigation: {work_unit:(titlecase)}
```

Set source="continue".

→ Return to caller.

#### If status is `completed`

Reopen it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reopen {work_unit} investigation {topic}
```

> *Output the next fenced block as a code block:*

```
Reopening investigation: {work_unit:(titlecase)}
```

Set source="continue".

→ Return to caller.
