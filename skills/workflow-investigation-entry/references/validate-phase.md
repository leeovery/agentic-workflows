# Validate Phase

*Reference for **[workflow-investigation-entry](../SKILL.md)***

---

Branch on the `phase_status` the caller read in Step 1 — no re-read.

#### If status is `in-progress`

Render and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-note {work_unit}.investigation.{topic} --verb Resuming
```

Set source="continue".

→ Return to caller.

#### If status is `completed`

Reopen it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reopen {work_unit} investigation {topic}
```

Render and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-note {work_unit}.investigation.{topic} --verb Reopening
```

Set source="continue".

→ Return to caller.
