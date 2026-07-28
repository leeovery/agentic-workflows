The prose should have taken this path:

1. the entry's specification gate renders empty — nothing blocks; the
   phase status reads empty, and the late-context menu is put to the
   user, whose continue sets a fresh start with no extra context
2. cross-cutting context runs: the manifest list finds no cross-cutting
   work units, and the knowledge query — filtered to cross-cutting
   specifications — returns nothing on the empty store; the walk
   proceeds silently and hands off a fresh-plan payload naming the
   specification
3. the process finds no planning entry — no resume choice
4. with no project default recorded, the format menu is put to the
   user; their choice registers the plan: the planning file created,
   the item started through the engine, the metadata set in one batched
   write with the spec commit captured, and local-markdown recorded as
   the project default before the initialise commit lands
5. session setup loads the format's about and authoring references and
   resets the gate modes; the specification is verified by listing it
6. phase design is delegated: the dispatch is stubbed, the returned
   two-phase structure is written to the planning file, the position
   set, and the draft committed
7. the phase tree renders through the engine for approval; on the
   user's yes the structure approval is recorded and committed
8. the first phase has no task table, so task design is delegated —
   stubbed — and the returned table is written under the phase, the
   draft committed, and the task-list gate rendered through the engine
9. on the user's yes the phase 1 task-list approval is recorded, the
   position advances to the first task, and the approval commit lands
10. the walk stops there — no task is authored, no staging subtree is
    created, and the plan is not completed

Further claims:

- auto mode is never offered as taken: both approvals are explicit
  user answers
- the specification is never re-litigated — no content questions are
  put to the user beyond the four scripted gates
- cache payload files (phase tree, task list) are expected working
  artifacts

EXPECTED WORLD — from a specified feature with no plan and no project
defaults:

- a planning file at `.workflows/pay/planning/pay/planning.md` holding
  the two-phase structure — payment intent core, webhook capture —
  with goals and acceptance criteria, and a Phase 1 task table with the
  two designed tasks; no task detail files, no phase-2 table
- the manifest holding planning in progress on the local-markdown
  format with spec_commit set, gate modes gated, review_cycle 0,
  approvals.structure and approvals.tasks.p1 stamped, position at
  phase 1 with the first task current, and an empty task_map
- local-markdown recorded as the project's default plan format
- no authored task files anywhere, no implementation artifacts, the
  specification untouched; no second work unit
