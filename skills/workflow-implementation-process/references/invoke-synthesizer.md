# Invoke Synthesizer

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

This step invokes the synthesis agent to read analysis findings, deduplicate, and write proposals to a staging file for the user's approval walk.

---

## Invoke the Agent

**Agent path**: `../../../agents/workflow-implementation-analysis-synthesizer.md`

Pass via the orchestrator's prompt:

1. **Work unit** — the work unit name (for path construction)
2. **Topic name** — the implementation topic
3. **Cycle number** — the current analysis cycle number
4. **Banked residue** — the manifest's `bank` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.implementation.{topic} bank`): entries the phase boundaries left for this loop. Omit when the field is absent or empty.

The agent locates findings files and writes output files using the work unit and topic name.

---

## Expected Result

Returns a brief status:

```
STATUS: tasks_proposed | clean
TASKS_PROPOSED: {N}
SUMMARY: {1-2 sentences}
```

- `tasks_proposed`: proposals written to the staging file, or at least one spec defect recorded in the report — present for approval
- `clean`: neither — no actionable findings and no spec defects; proceed to completion

---

## Consume the Bank

**If banked residue was passed**, the synthesizer has verdicted every entry — proposed into the staging or discarded in its report. Delete the field; the deletion rides the synthesis commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.implementation.{topic} bank
```

---

## Initialise Gate State

**If `STATUS` is `tasks_proposed`**, initialise the cycle's gate state — one batched write, one `pending` per task from `TASKS_PROPOSED`. A spec-defect-only synthesis proposes none: nothing is written here, and the approval overview initialises whatever its spec-defect settling stages.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.c{N}.tasks.1=pending … staging.c{N}.tasks.{TASKS_PROPOSED}=pending
```

→ Return to caller.
