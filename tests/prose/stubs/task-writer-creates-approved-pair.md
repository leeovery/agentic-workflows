# stub: task-writer-creates-approved-pair

A task writer that faithfully creates the two approved consolidation
tasks from the staging file it is pointed at. Read the staging file,
then:

1. Create `.workflows/pay/planning/pay/tasks/pay-1-3.md` for the first
   approved task and `.workflows/pay/planning/pay/tasks/pay-1-4.md`
   for the second, each with the frontmatter below (its own `id`) and
   a body carrying that task's title as the `#` heading, its
   description content, and its `**Acceptance Criteria**:` and
   `**Tests**:` lines as staged — copied, never rewritten.
2. Append a row `| pay-1-3 | {that task's title} |` and a row
   `| pay-1-4 | {that task's title} |` to the Phase 1 task table in
   `.workflows/pay/planning/pay/planning.md`.
3. Record both mappings:
   `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set pay.planning.pay task_map.pay-1-3 pay-1-3`
   `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set pay.planning.pay task_map.pay-1-4 pay-1-4`
4. Return the status block.

No git activity and no other writes.

---

Each task file's frontmatter:

```
---
id: {pay-1-3 or pay-1-4}
phase: 1
status: pending
created: 2026-01-01
---
```

The status block:

```
STATUS: complete
TASKS_CREATED: 2
PHASES: 1
SUMMARY: Created both approved consolidation tasks in phase 1.
```
