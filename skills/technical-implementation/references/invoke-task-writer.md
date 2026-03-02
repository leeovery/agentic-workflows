# Invoke Task Writer

*Reference for **[technical-implementation](../SKILL.md)***

---

This step invokes the task writer agent to create plan tasks from approved analysis findings.

---

## Invoke the Agent

**Agent path**: `../../../agents/implementation-analysis-task-writer.md`

Pass via the orchestrator's prompt:

1. **Topic name** — the implementation topic
2. **Staging file path** — `.workflows/{work_unit}/implementation/analysis-tasks-c{cycle-number}.md`
3. **Plan path** — the implementation plan path
4. **Plan format reading adapter path** — `../../technical-planning/references/output-formats/{format}/reading.md`
5. **Plan format authoring adapter path** — `../../technical-planning/references/output-formats/{format}/authoring.md`
6. **plan-index-schema.md** — `../../technical-planning/references/plan-index-schema.md`
7. **Phase label** — `Analysis (Cycle {N})`

---

## Expected Result

The agent creates tasks in the plan for all approved entries in the staging file.

Returns a brief status:

```
STATUS: complete
TASKS_CREATED: {N}
PHASE: {N}
SUMMARY: {1 sentence}
```
