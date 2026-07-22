# Validate Phase

*Reference for **[workflow-research-entry](../SKILL.md)***

---

Branch on the `phase_status` the caller read in Step 2 — no re-read.

#### If status is `completed`

Reopen it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reopen {work_unit} research {topic}
```

Render and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-note {work_unit}.research.{topic} --verb Reopening
```

Set source="continue".

→ Load **[reconcile-advisory.md](../../workflow-shared/references/reconcile-advisory.md)** with downstream_phase = `research`.

→ Return to caller.

#### If status is `in-progress`

Render and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-note {work_unit}.research.{topic} --verb Resuming
```

Set source="continue".

→ Load **[reconcile-advisory.md](../../workflow-shared/references/reconcile-advisory.md)** with downstream_phase = `research`.

→ Return to caller.
