# Validate Phase

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

Check if a discussion already exists for this work unit and topic.

Use `engine manifest` to check discussion phase state:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discussion.{topic}
```

#### If output is empty (discussion doesn't exist — fresh start)

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
