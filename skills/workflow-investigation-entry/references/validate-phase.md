# Validate Phase

*Reference for **[workflow-investigation-entry](../SKILL.md)***

---

Branch on the `phase_status` the caller read in Step 1 — no re-read.

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
