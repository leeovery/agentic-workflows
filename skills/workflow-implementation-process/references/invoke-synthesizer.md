# Invoke Synthesizer

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

This step invokes the synthesis agent to read analysis findings, deduplicate, and write normalized tasks to a staging file for user approval.

---

## Invoke the Agent

**Agent path**: `../../../agents/workflow-implementation-analysis-synthesizer.md`

Pass via the orchestrator's prompt:

1. **Task normalization reference path** — `task-normalisation.md`
2. **Work unit** — the work unit name (for path construction)
3. **Topic name** — the implementation topic
4. **Cycle number** — the current analysis cycle number
5. **Specification path** — from the specification (if available)

The agent locates findings files and writes output files using the work unit and topic name.

---

## Expected Result

Returns a brief status:

```
STATUS: tasks_proposed | clean
TASKS_PROPOSED: {N}
SUMMARY: {1-2 sentences}
```

- `tasks_proposed`: tasks written to staging file — orchestrator should present for approval
- `clean`: no actionable findings — orchestrator should proceed to completion

→ Return to caller.
