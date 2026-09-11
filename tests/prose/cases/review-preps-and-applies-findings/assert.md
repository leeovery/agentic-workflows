The prose should have taken this path:

1. the entry's prerequisite gate renders empty — plan and
   implementation are completed — and the review status reads empty, so
   nothing is reopened and the handoff carries the work forward with
   nothing asked
2. the process finds no report file, registers the review through the
   engine, reads the plans and specification, and looks up the
   implementation's project skills
3. a verifier is dispatched per task — stubbed: each report lands at its
   task's suffix, each complete with no blocking issues and carrying one
   finding that names its failure, its scope and its blast radius
4. both verified task ids are pushed onto the reviewed list, and the
   aggregation reads every per-task report — no criterion was recorded
   as unsettled, so no unsettled file is written
5. the change-set verification derives its sections from the
   specification's numbered headings — the payment-intent section, the
   capture section, and the test surface — finds none of this cycle's
   files (`change-set-c1-…`) already written, gathers the brief (the
   first task commit and the file list, the linter names — the fixture
   declares none — the project skills, the finding floor path, and the
   statement that nothing was unsettled, since no unsettled file
   exists), and dispatches the three agents in parallel — stubbed: each
   section's file is clean, carrying a coverage map and no finding; the
   tree is checked with nothing outside `.workflows/` modified or
   untracked, the reconciliation reads every section file from disk and
   finds nothing to reconcile, and no `not-measured.txt` is written
6. findings prep collects the two findings out of the per-task reports
   into its own payloads — the section files carry none — giving each a
   stable id built from its report's task suffix, then dispatches the
   assessment agents — assessor, guards and relationships — with
   relationships taking the whole set rather than a batch
7. synthesis is dispatched once over those assessments and writes the
   action list — stubbed: two do-now actions, one amended where its
   proposed wording overreached, one carrying a rescued defect, and a
   derived pass verdict since nothing needs planning; prep then commits
   the per-task reports, the section files and the manifest as the
   verification-and-prep checkpoint, so the apply starts from a clean
   tree
8. the do-now apply marks its step and announces the two corrections
   in its signpost, dispatches an applier — stubbed: both applied, nothing skipped — then the verifier
   over the uncommitted diff — stubbed: nothing to repair, suite green —
   and commits the corrections through the engine's code commit as
   one body of work
9. the review report is produced from the action list with a Pass
   verdict — its Specification Compliance carrying the three sections'
   coverage maps as their files record them, its Plan Completion's bold
   `Criteria not measured` line reading `none`, its corrected section
   recording what was applied — and committed
10. the outcome renders through the review presentation surface as a
   pass — the corrections a count, nothing listed, since nothing in this
   review is the user's to decide — and at the review gate the user
   completes
11. the compliance self-check refreshes the session's instructions, the
   actions loop reads the Pass verdict, the review completes through
   the engine, and the walk stops at the pipeline continuation

Further claims:

- the change-set verification is dispatched exactly once, after both
  task verifiers have returned and coverage is pushed, and before
  findings prep — its section files exist before the prep payloads do
- the section agents are given the specification path, the change-set,
  the project's conventions, the finding floor path and the statement
  that there are no unsettled criteria — never a per-task report
- the working tree is checked after the section agents return, and the
  review continues only because nothing outside `.workflows/` is
  modified or untracked — the review's own uncommitted reports and
  section files under `.workflows/` do not stop it
- the prep agents are dispatched fresh, each given its payload path —
  none is asked to re-judge another's verdict, and synthesis runs only
  after all of them return
- the apply precedes the report and the presentation: by the time
  anything is shown, the corrections are made, verified and committed
- the applier never commits and never runs the suite; the verifier
  never commits; the orchestrator makes the one apply commit
- no synthesis of findings into plan tasks is offered or dispatched: no
  action was routed to replan, so the remediation path is never entered
  and no task is written into the plan
- nothing is banked to the manifest's out-of-scope set and nothing
  reaches the inbox — both findings were in scope
- the two edits are the only changes outside `.workflows/`; no task is
  started and no implementation is reopened
- the per-task reports and the section files are left as they were
  written — prep adds a layer above them and never rewrites them
- cache files under the review directory are expected working artifacts

EXPECTED WORLD — from an implemented feature with no review:

- a review report at `.workflows/pay/review/pay/report.md` carrying a
  Pass verdict, a Specification Compliance section carrying the three
  coverage maps, a Plan Completion whose criteria-not-measured line
  reads `none`, and a corrected-in-this-session record of the two
  actions; plus one per-task report file for each task suffix, each
  recording complete with its findings intact, and one change-set file
  per section for this cycle — `change-set-c1-1-payment-intent.md`,
  `change-set-c1-2-capture-webhooks.md`, `change-set-c1-test-surface.md`
  — each clean with its coverage map
- the manifest holding the review completed, with reviewed_tasks
  carrying both internal ids and no out_of_scope field
- the false polling-recovery claim gone from `src/webhooks/capture.js`
  (the webhook sentence intact) and the assertion in
  `tests/checkout/payment-intent.test.js` built through
  `createPaymentIntent`, committed as one apply commit
- the plan, tasks and specification untouched; no remediation phase
  anywhere; no second work unit; nothing in the inbox
