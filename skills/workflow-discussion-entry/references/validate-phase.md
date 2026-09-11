# Validate Phase

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

Branch on the `phase_status` the caller read in Step 3 — no re-read.

#### If status is `triaged`

Rerouted concerns are parked on this topic, but no session has ever run — this is a first start, not a resume. No reopen, no phase note, no reconcile advisory; `source` keeps its value.

→ Return to caller.

#### If status is `in-progress`

Render and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-note {work_unit}.discussion.{topic} --verb Resuming
```

Set source="continue".

→ Load **[reconcile-advisory.md](../../workflow-shared/references/reconcile-advisory.md)** with downstream_phase = `discussion`.

→ Return to caller.

#### If status is `completed`

Reopen it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reopen {work_unit} discussion {topic}
```

Render and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-note {work_unit}.discussion.{topic} --verb Reopening
```

Set source="continue".

→ Load **[reconcile-advisory.md](../../workflow-shared/references/reconcile-advisory.md)** with downstream_phase = `discussion`.

→ Return to caller.
