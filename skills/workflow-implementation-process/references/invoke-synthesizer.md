# Invoke Synthesizer

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

This step invokes the synthesis agent to read analysis findings, deduplicate, and write proposals to a staging file for the user's approval walk.

---

## Invoke the Agent

**Agent path**: `../../../agents/workflow-implementation-analysis-synthesizer.md`

Read the manifest's `staging` — every earlier walk's approval rows; absent prints empty:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.implementation.{topic} staging
```

Pass via the orchestrator's prompt:

1. **Work unit** — the work unit name (for path construction)
2. **Topic name** — the implementation topic
3. **Cycle number** — the current analysis cycle number
4. **finding-floor.md path** — `.claude/skills/workflow-implementation-process/references/finding-floor.md`
5. **Settled directions** — the `staging` JSON the read printed, verbatim; omitted when it printed nothing. Every `p{M}` or `c{M}` row marked `approved` names a proposal in that pass's staging file (`consolidation-tasks-p{M}.md`, `analysis-tasks-c{M}.md`) whose title and Solution an earlier pass settled

The agent locates findings files and writes output files using the work unit and topic name.

---

## Expected Result

Returns a brief status:

```
STATUS: tasks_proposed | clean
TASKS_PROPOSED: {N}
SUMMARY: {1-2 sentences}
```

- `tasks_proposed`: proposals written to the staging file, a spec defect recorded in the report, or a comment correction collected there — the approval overview handles all three
- `clean`: none of the three — proceed to completion

---

## Initialise Gate State

**If `STATUS` is `tasks_proposed`**, initialise the cycle's gate state — one batched write, one `pending` per task from `TASKS_PROPOSED`. A synthesis that proposes none — spec defects or comment corrections alone — writes nothing here, and the approval overview initialises whatever its spec-defect settling stages.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.c{N}.tasks.1=pending … staging.c{N}.tasks.{TASKS_PROPOSED}=pending
```

→ Return to caller.
