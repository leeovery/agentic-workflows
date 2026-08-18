The prose should have taken this path:

1. the plan gate renders empty and no implementation item exists, so
   this is a new entry; dependency validation returns immediately —
   external dependencies are an epic concern
2. the entry hands off into the processing skill carrying the
   local-markdown format read from the planning item
3. resume detection initialises tracking and reports the created mode,
   which commits the start of implementation through the engine's
   scoped commit
4. environment setup finds the existing document stating no setup is
   required and returns without asking anything and without writing it
   again
5. the plan adapter is loaded for the manifest's format; project
   skills and linter discovery each ask only their skip-again question
   — the first two scripted answers skip both
6. the loop selects pay-1-1 first (phase order, then task order),
   normalises it, notes its position across the three backend tasks,
   starts it via the engine, marks it in-progress, and renders its
   brief before the dispatch
7. the executor stub fires for pay-1-1 and returns complete; the
   reviewer stub fires and approves; the result header renders and the
   task gate menu is fetched and emitted
8. the third scripted answer does not answer the gate — it raises new
   work. The processing skill's standing rule routes to
   ad-hoc-plan-changes.md; the pending gate is left to re-present on
   return
9. framing needs no specification decision — the ask is concrete — so
   the landing is picked: the in-flight task (payment intent) does not
   own a reconciliation job, and neither pending task (capture
   webhooks, gateway error logging) owns it either; it is new work,
   routed to drafting. The walk never routes to amend-a-pending-task
10. drafting reads the format's graph adapter, settles placement from
    the user's own words (the open phase 1, no priority, no
    dependencies), and writes the staging file ad-hoc-tasks-1.md with
    one task carrying placement: phase 1 and no priority or depends_on
    lines; the gate state is initialised in one batched write
    (gate_mode gated, task 1 pending)
11. the proposed task renders through the engine from its cache
    payload; the fourth scripted answer approves, recorded on the
    staging row
12. the task-writer agent is invoked unstubbed — the walk crosses into
    agents/workflow-implementation-task-writer.md and follows it: the
    staging file is read, the plan is read through the reading adapter
    (three existing tasks in phase 1, so the new task is pay-1-4 —
    numbering continues from pay-1-3 even though planning.md's table
    stops at pay-1-2), the destination phase 1 is open and valid, and
    the task file tasks/pay-1-4.md is created per the authoring
    adapter
13. the writer records the created task in planning.md — one row
    appended to Phase 1's existing #### Tasks table — and does not
    write phase-1-tasks.md, whatever its drifted contents suggest
    about where later tasks go (reading it is not a violation; the
    file ending changed is). It records task_map.pay-1-4 and, the
    plan's external_id being unset, sets it to the topic name per the
    format. No graph adapter mechanics run — the staged task carried
    no priority and no depends_on
14. back in the orchestrator, storage_paths already exists so no
    backfill write happens; the scoped commit lands as
    impl(pay): add 1 ad hoc task(s)
15. the interrupted flow is the task loop, so control returns to the
    caller and the pending task gate re-presents — re-fetched from the
    engine, not replayed from memory. The walk stops there: the gate
    unanswered, pay-1-1 never completed, no further task started

Further claims:

- phase-1-tasks.md is byte-identical to the fixture — no section
  added, no frontmatter change, the `total: 3` line untouched. The
  drifted artifact state is not treated as a convention to follow
- planning.md changes in exactly one way: Phase 1's #### Tasks table
  gains one row for pay-1-4 (name matching the reconciliation task).
  No row is added for pay-1-3 — the writer records the tasks it
  created, never reconciling history it did not write — and no new
  phase section appears
- tasks/pay-1-4.md exists, status pending, phase 1, carrying the
  reconciliation content the user asked for and the staging file
  holds
- the staging file .workflows/pay/implementation/pay/ad-hoc-tasks-1.md
  exists as committed record — pure markdown, no frontmatter, its one
  task carrying placement: phase 1
- the manifest's implementation item still has current_task pay-1-1
  with no completed_tasks entry; staging.ad-hoc-1 remains with
  gate_mode gated and tasks.1 approved — the ad hoc record is not
  cleaned up
- the planning item's task_map gains exactly one row,
  pay-1-4 → pay-1-4, and external_id is pay
- exactly one executor dispatch and one reviewer dispatch fired, both
  stubbed, both for pay-1-1; the task-writer was walked from its own
  agent file, not substituted
- the commit impl(pay): add 1 ad hoc task(s) exists; no commit
  completes pay-1-1
