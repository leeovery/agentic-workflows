# Invoke Task Author

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

This step invokes the task author agent to expand the approved proposals into full task bodies in the staging file, before the task writer transcribes them into the plan.

---

## Invoke the Agent

**Agent path**: `../../../agents/workflow-implementation-task-author.md`

Pass via the orchestrator's prompt:

1. **Work unit** — the work unit name (for path construction)
2. **Topic name** — the implementation topic
3. **Staging file path** — the staging file the walk ran over
4. **Approved task numbers** — the task numbers whose staging rows are `approved`
5. **Findings file path(s)** — the findings the proposals were judged from
6. **Specification path** — `.workflows/{work_unit}/specification/{topic}/specification.md` (if the unit has one)
7. **task-design.md path** — `../../workflow-planning-process/references/task-design.md`

---

## Expected Result

The agent authors exactly the approved tasks in place; a re-invocation after a crash is safe (it skips the tasks already carrying a body).

Returns a brief status:

```
STATUS: complete | failed
TASKS_AUTHORED: {N}
SUMMARY: {1 sentence}
```

- `complete`: every approved task carries its full body
- `failed`: nothing usable was authored — `SUMMARY` names what blocked the run; the caller's failure branch handles it

→ Return to caller.
