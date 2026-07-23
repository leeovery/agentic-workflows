# Invoke Review Task Writer

*Reference for **[workflow-review-process](../SKILL.md)***

---

This step invokes the task writer agent to create plan tasks from approved review findings. It reuses the `workflow-implementation-analysis-task-writer` agent with a review-specific phase label.

---

## Determine Format

Read the `format` field from the manifest (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} format`). This determines which output format adapters to pass to the agent.

---

## Invoke the Agent

**Agent path**: `../../../agents/workflow-implementation-analysis-task-writer.md`

Pass via the orchestrator's prompt:

1. **Work unit** — the work unit name (for path construction)
2. **Topic name** — the implementation topic (scopes tasks to correct plan)
3. **Staging file path** — `.workflows/{work_unit}/implementation/{topic}/review-tasks-c{N}.md`
4. **Planning file path** — `.workflows/{work_unit}/planning/{topic}/planning.md`
5. **Plan format reading adapter path** — `../../workflow-planning-process/references/output-formats/{format}/reading.md`
6. **Plan format authoring adapter path** — `../../workflow-planning-process/references/output-formats/{format}/authoring.md`
7. **Phase label** — `Review Remediation (Cycle {N})`
8. **Approved task numbers** — read `manifest get {work_unit}.review.{topic} staging.c{N}` and pass the task numbers whose rows are `approved`

---

## Expected Result

The agent creates exactly the approved tasks passed in the prompt; if the cycle's phase already exists in the plan, it creates only those not yet present.

Returns a brief status:

```
STATUS: complete
TASKS_CREATED: {N}
PHASE: {N}
SUMMARY: {1 sentence}
```

→ Return to caller.
