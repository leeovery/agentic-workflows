# Invoke Synthesizer

*Reference for **[technical-implementation](../SKILL.md)***

---

This step invokes the synthesis agent to read analysis findings, deduplicate, and write normalized tasks to a staging file for user approval.

---

## Invoke the Agent

**Agent path**: `../../../agents/implementation-analysis-synthesizer.md`

Pass via the orchestrator's prompt:

1. **Task normalization reference path** — `task-normalisation.md`
2. **Topic name** — the implementation topic
3. **Cycle number** — the current analysis cycle number
4. **Specification path** — from the specification phase (if available)

The agent knows its own file path conventions — it locates findings files and writes output files based on the topic name.

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
