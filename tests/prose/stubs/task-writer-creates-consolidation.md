# stub: task-writer-creates-consolidation

A task writer that faithfully creates the one approved consolidation
task from the staging file it is pointed at. Read the staging file,
then:

1. Create `.workflows/pay/planning/pay/tasks/pay-1-3.md` with the
   frontmatter below and a body carrying the staged task's title as
   the `#` heading, its description content, and its
   `**Acceptance Criteria**:` and `**Tests**:` lines as staged —
   copied, never rewritten.
2. Append the row `| pay-1-3 | {the staged task's title} |` to the
   Phase 1 task table in `.workflows/pay/planning/pay/planning.md`.
3. Record the mapping:
   `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set pay.planning.pay task_map.pay-1-3 pay-1-3`
4. Return the status block.

No git activity and no other writes.

---

The task file's frontmatter:

```
---
id: pay-1-3
phase: 1
status: pending
created: 2026-01-01
---
```

The status block:

```
STATUS: complete
TASKS_CREATED: 1
PHASES: 1
SUMMARY: Created the approved consolidation task in phase 1.
```
