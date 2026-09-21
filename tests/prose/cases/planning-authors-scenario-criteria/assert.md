The walk authors one phase's tasks under the current task template and
writes them to the plan. What it leaves on disk is the point: two task
files carrying scenario acceptance criteria, a **Do** on one task only,
and neither a Tests nor an Edge Cases field anywhere.

Expected path:

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
   its engine-rendered gate and committed. The Phase 1 task table lands
   with the edges the designer cited to the specification's own
   sections, and nothing is added to that column
5. authoring begins for Phase 1: the task-author dispatch is stubbed
   and the task detail file lands at the prescribed path; the walk
   validates its task count against the planning file's table — two and
   two, so no count gate renders and no second authoring dispatch
   fires. The agent's return carries no `## Spec Defects` section, so
   the gap flow is never entered and no corrections display is emitted
6. the staging rows register as pending through the engine, the gate
   mode reads gated, and each task is presented in full with its
   engine-rendered gate — two explicit approvals, recorded on their
   staging rows one at a time
7. with no rejections, the write pass runs per task, in order: the
   local-markdown task file written from the detail file's content, and
   one batched manifest record folding the task's external id with — on
   the first task only — the phase mapping and the plan's external id,
   each task closed by its own scoped plan commit
8. the spent staging subtree is deleted — the plan's tasks are the
   record — and the phase advances with its completion commit
9. the walk stops there: Phase 2 is never processed, no second
   authoring dispatch occurs, and the plan is not completed

Further claims:

- **neither written task file carries a `**Tests**` field or an
  `**Edge Cases**` field**, and neither does the task detail file. A
  task file holding either is a reading or writing path still shaped by
  the retired template
- each task's acceptance criteria read as scenarios — a starting state,
  an action, and something observable: a checkout beginning and one
  intent existing, a shopper with a saved non-card method meeting a
  card-only intent, a refusal showing the shopper a checkout error, a
  second checkout start reusing the intent the order already carries.
  A criterion phrased as "code exists" or as a test name means the
  shape was flattened on the way through
- the intent task carries a **Do** naming what the record decided — the
  existing gateway account, no new provider onboarding — and the attach
  task carries none at all. A Do on both means one was manufactured for
  the task whose how the specification left open
- both task files name the specification sections they trace to, and
  the attach task names the capture section as well as the intent one
- the presented content and the written content match the detail file:
  nothing is summarised on the way to the plan, and no feedback
  blockquote appears under either heading — both tasks were approved as
  written
- auto mode is never engaged at any gate — every approval is an
  explicit answer, and both staging rows are approved one at a time
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
  `tasks/pay-1-2.md`, frontmatter id/phase/status with both pending,
  each body carrying its scenario criteria
- the manifest holding planning in progress on local-markdown with
  spec_commit set, both approvals stamped, `task_map` carrying pay-1,
  pay-1-1 and pay-1-2, external_id pay, position at phase 2 with no
  current task, and NO staging subtree
- local-markdown recorded as the project's default plan format
- no Phase 2 task table or files, no implementation artifacts, the
  specification untouched; no second work unit
