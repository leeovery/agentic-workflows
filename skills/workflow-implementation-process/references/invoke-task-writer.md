# Invoke Task Writer

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

This step invokes the task writer agent to create plan tasks from approved analysis findings.

---

## Invoke the Agent

**Agent path**: `../../../agents/workflow-implementation-analysis-task-writer.md`

Pass via the orchestrator's prompt:

1. **Work unit** — the work unit name (for path construction)
2. **Topic name** — the implementation topic
3. **Staging file path** — `.workflows/{work_unit}/implementation/{topic}/analysis-tasks-c{cycle-number}.md`
4. **Planning file path** — `.workflows/{work_unit}/planning/{topic}/planning.md`
5. **Plan format reading adapter path** — `../../workflow-planning-process/references/output-formats/{format}/reading.md`
6. **Plan format authoring adapter path** — `../../workflow-planning-process/references/output-formats/{format}/authoring.md`
7. **Phase label** — `Analysis (Cycle {N})`

---

## Expected Result

Pass the approved task numbers from the manifest's `staging.c{N}.tasks` (the rows marked `approved`) — the agent creates exactly those.

Returns a brief status:

```
STATUS: complete
TASKS_CREATED: {N}
PHASE: {N}
SUMMARY: {1 sentence}
```

→ Return to caller.
