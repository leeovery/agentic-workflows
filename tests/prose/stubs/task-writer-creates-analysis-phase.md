# stub: task-writer-creates-analysis-phase

A task writer that faithfully creates the one approved analysis task
from the staging file it is pointed at, in the phase the dispatch names.
Read the staging file, then:

1. Create `.workflows/pay/planning/pay/tasks/pay-2-1.md` with the
   frontmatter below and a body carrying the approved task's title as
   the `#` heading, its **Do** content as the description, and its
   `**Acceptance Criteria**:` and `**Tests**:` lines as the author left
   them — copied, never rewritten.
2. Append a new phase section to
   `.workflows/pay/planning/pay/planning.md`, headed
   `## Phase 2: Analysis (Cycle 1)` — the phase label the dispatch
   names — with a task table carrying one row:
   `| pay-2-1 | {that task's title} |`.
3. Record the mapping:
   `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set pay.planning.pay task_map.pay-2-1 pay-2-1`
4. Return the status block.

The declined proposal is not written to the plan. No git activity and no
other writes.

---

The task file's frontmatter:

```
---
id: pay-2-1
phase: 2
status: pending
created: 2026-01-01
---
```

The status block:

```
STATUS: complete
TASKS_CREATED: 1
PHASES: 2
SUMMARY: Created the approved analysis task in a new phase 2.
```
