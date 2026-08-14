The prose should have taken this path:

1. the entry's prerequisite gate renders empty — plan and
   implementation are completed — and the review status reads empty, so
   nothing is reopened and the handoff carries the work forward with
   nothing asked
2. the process finds no report file, registers the review through the
   engine, reads the plans and specification, and looks up the
   implementation's project skills
3. a verifier is dispatched per task — stubbed: each report lands at its
   task's suffix, each complete with no blocking issues but carrying
   findings, every finding naming its failure, its scope and its blast
   radius
4. both verified task ids are pushed onto the reviewed list
5. findings prep collects the findings out of the per-task reports into
   its own payloads, giving each a stable id built from its report's
   task suffix, then dispatches the assessment agents — assessor, guards
   and relationships — with relationships taking the whole set rather
   than a batch
6. synthesis is dispatched once over those assessments and writes the
   action list — stubbed: two do-now actions, one amended where its
   proposed wording overreached, one carrying a rescued defect, and a
   derived pass verdict since nothing needs planning
7. the do-now apply announces the corrections in prose, dispatches an
   applier — stubbed: both applied, nothing skipped — then the verifier
   over the uncommitted diff — stubbed: nothing to repair, suite green —
   and commits the corrections with raw git as one body of work
8. the review report is produced from the action list with a Pass
   verdict, its corrected section recording what was applied, and
   committed
9. the outcome renders through the review presentation surface as a
   pass — the corrections a count, nothing listed, since nothing in this
   review is the user's to decide — and at the review gate the user
   completes
10. the compliance self-check refreshes the session's instructions, the
   actions loop reads the Pass verdict, the review completes through
   the engine, and the walk stops at the pipeline continuation

Further claims:

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
- the per-task reports are left as they were written — prep adds a layer
  above them and never rewrites them
- cache files under the review directory are expected working artifacts

EXPECTED WORLD — from an implemented feature with no review:

- a review report at `.workflows/pay/review/pay/report.md` carrying a
  Pass verdict and a corrected-in-this-session record of the two
  actions, plus one per-task report file for each task suffix, each
  recording complete with its findings intact
- the manifest holding the review completed, with reviewed_tasks
  carrying both internal ids and no out_of_scope field
- the stale comment claim gone from `src/checkout/payment-intent.js` and
  the assertion in `tests/checkout/payment-intent.test.js` reading the
  gateway payload, committed as one apply commit
- the plan, tasks and specification untouched; no remediation phase
  anywhere; no second work unit; nothing in the inbox
