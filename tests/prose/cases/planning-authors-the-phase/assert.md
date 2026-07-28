The prose should have taken this path:

1. the entry clears the spec gate, takes the fresh arm at the
   late-context menu, runs the cross-cutting sweep against the empty
   store, and hands off a fresh-plan payload — nothing beyond the
   scripted gates is asked
2. the process finds no planning entry; with no project default the
   format menu is put to the user, and their choice registers the plan
   — item started through the engine, metadata batched with the spec
   commit captured, local-markdown recorded as the project default —
   before the initialise commit
3. session setup loads the format references and resets gates; the
   specification is verified by listing it
4. phase design and Phase 1 task design are delegated to their stubbed
   agents, each product written to the planning file, each approved at
   its engine-rendered gate and committed
5. authoring begins for Phase 1: the task-author dispatch is stubbed
   and the task detail file lands at the prescribed path; the walk
   validates its task count against the planning file's table
6. the staging rows register as pending through the engine, the gate
   mode reads gated, and each task is presented in full with its
   engine-rendered gate — two explicit approvals, recorded on their
   staging rows one at a time
7. with no rejections, the write pass runs per task, in order: the
   local-markdown task file written, and one batched manifest record
   folding the task's external id with — on the first task only — the
   phase mapping and the plan's external id, each task closed by its
   own scoped plan commit
8. the spent staging subtree is deleted — the plan's tasks are the
   record — and the phase advances with its completion commit
9. the walk stops there: Phase 2 is never processed, no second
   authoring dispatch occurs, and the plan is not completed

Further claims:

- auto mode is never engaged at any gate — every approval is an
  explicit answer
- no task is ever written to the plan ahead of its approval, and
  nothing is written for Phase 2
- cache payloads and the task detail file are expected working
  artifacts

EXPECTED WORLD — from a specified feature with no plan and no project
defaults:

- planning.md holding the two-phase structure and the Phase 1 task
  table; the task detail file at
  `.workflows/pay/planning/pay/phase-1-tasks.md` carrying both authored
  tasks with no feedback blockquotes
- task files at `.workflows/pay/planning/pay/tasks/pay-1-1.md` and
  `tasks/pay-1-2.md`, frontmatter id/phase/status with both pending
- the manifest holding planning in progress on local-markdown with
  spec_commit set, both approvals stamped, `task_map` carrying pay-1,
  pay-1-1 and pay-1-2, external_id pay, position at phase 2 with no
  current task, and NO staging subtree
- local-markdown recorded as the project's default plan format
- no Phase 2 task table or files, no implementation artifacts, the
  specification untouched; no second work unit
