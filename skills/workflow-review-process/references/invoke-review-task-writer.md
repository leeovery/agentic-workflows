# Invoke Review Task Writer

*Reference for **[workflow-review-process](../SKILL.md)***

---

This step invokes the task writer agent to create plan tasks from approved review findings. It reuses the `workflow-implementation-analysis-task-writer` agent with a review-specific phase label.

---

## Determine Format

Read the `format` field from the manifest (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase planning --topic {topic} format`). This determines which output format adapters to pass to the agent.

---

## Invoke the Agent

**Agent path**: `../../../agents/workflow-implementation-analysis-task-writer.md`

Pass via the orchestrator's prompt:

1. **Topic name** — the implementation topic (scopes tasks to correct plan)
2. **Staging file path** — `.workflows/{work_unit}/implementation/{topic}/review-tasks-c{cycle-number}.md`
3. **Plan path** — the implementation plan path
4. **Plan format reading adapter path** — `../../workflow-planning-process/references/output-formats/{format}/reading.md`
5. **Plan format authoring adapter path** — `../../workflow-planning-process/references/output-formats/{format}/authoring.md`
6. **plan-index-schema.md** — `../../workflow-planning-process/references/plan-index-schema.md`
7. **Phase label** — `Review Remediation (Cycle {N})`

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
