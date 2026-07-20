# Validate Phase

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

Check whether a discussion already exists for this work unit and topic. Branch on the `phase_status` the caller read in Step 1 — no re-read.

#### If `phase_status` is empty (discussion doesn't exist — fresh start)

Nothing to validate — `source` keeps the value set in Step 1.

→ Return to caller.

#### If discussion exists and status is `in-progress`

> *Output the next fenced block as a code block:*

```
Resuming discussion: {topic:(titlecase)}
```

Set source="continue".

→ Load **[reconcile-advisory.md](../../workflow-shared/references/reconcile-advisory.md)** with downstream_phase = `discussion`.

→ Return to caller.

#### If discussion exists and status is `completed`

Reopen it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reopen {work_unit} discussion {topic}
```

> *Output the next fenced block as a code block:*

```
Reopening discussion: {topic:(titlecase)}
```

Set source="continue".

→ Load **[reconcile-advisory.md](../../workflow-shared/references/reconcile-advisory.md)** with downstream_phase = `discussion`.

→ Return to caller.
