# stub: task-writer-creates-analysis-trio

A task writer that faithfully creates the three approved analysis tasks
from the staging file it is pointed at, in the phase the dispatch
names. Read the staging file, then:

1. Create `.workflows/pay/planning/pay/tasks/pay-2-1.md`,
   `.workflows/pay/planning/pay/tasks/pay-2-2.md` and
   `.workflows/pay/planning/pay/tasks/pay-2-3.md` for the three
   approved tasks in staging order, each with the frontmatter below
   (its own `id`) and a body carrying that task's title as the `#`
   heading, its **Do** content as the description, and its
   `**Acceptance Criteria**:` and `**Tests**:` lines as the author
   left them — copied, never rewritten.
2. Append a new phase section to
   `.workflows/pay/planning/pay/planning.md`, headed
   `## Phase 2: Analysis (Cycle 1)` — the phase label the dispatch
   names — with a task table carrying three rows:
   `| pay-2-1 | {that task's title} |`, `| pay-2-2 | {that task's title} |`
   and `| pay-2-3 | {that task's title} |`.
3. Record the three mappings:
   `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set pay.planning.pay task_map.pay-2-1 pay-2-1`
   `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set pay.planning.pay task_map.pay-2-2 pay-2-2`
   `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set pay.planning.pay task_map.pay-2-3 pay-2-3`
4. Return the status block.

No git activity and no other writes.

---

Each task file's frontmatter:

```
---
id: {pay-2-1, pay-2-2 or pay-2-3}
phase: 2
status: pending
created: 2026-01-01
---
```

The status block:

```
STATUS: complete
TASKS_CREATED: 3
PHASES: 2
SUMMARY: Created all three approved analysis tasks in a new phase 2.
```
