# Validate Phase

*Reference for **[workflow-research-entry](../SKILL.md)***

---

Check research status via `engine manifest`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.research.{topic} status
```

#### If status is `completed`

Reopen it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reopen {work_unit} research {topic}
```

> *Output the next fenced block as a code block:*

```
Reopening research: {topic:(titlecase)}
```

Set source="continue".

→ Load **[reconcile-advisory.md](../../workflow-shared/references/reconcile-advisory.md)** with downstream_phase = `research`.

→ Return to caller.

#### If status is `in-progress`

> *Output the next fenced block as a code block:*

```
Resuming research: {topic:(titlecase)}
```

Set source="continue".

→ Load **[reconcile-advisory.md](../../workflow-shared/references/reconcile-advisory.md)** with downstream_phase = `research`.

→ Return to caller.
