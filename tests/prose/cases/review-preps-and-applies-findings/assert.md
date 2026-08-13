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
   non-blocking notes
4. both verified task ids are pushed onto the reviewed list
5. findings prep collects the notes out of the per-task reports into its
   own payloads, giving each a stable id built from its report's task
   suffix, then dispatches the assessment agents — assessor, guards and
   relationships — with relationships taking the whole set rather than a
   batch
6. synthesis is dispatched once over those assessments and writes the
   action list — stubbed: two actions, both fix-now, one amended where
   its proposed wording overreached and one carrying a rescued defect
7. the review report is produced from the action list rather than from
   the per-task notes, and committed
8. the presentation renders through its surface: the fix-now lane
   reports a count and neither action is listed individually, since
   nothing in this review is the user's to decide; at the questions gate
   the user continues
9. the fix-now lane batches the actions by the files they touch and
   dispatches an applier — stubbed: both applied, none skipped or
   reverted, the suite green — and the applied work is committed
10. lane routing files nothing, since neither inbox lane carries an
   action, and the consolidation lane is empty
11. the compliance self-check refreshes the session's instructions, the
   actions loop finds every verdict Approve, the review completes
   through the engine, and the walk stops at the pipeline continuation

Further claims:

- the prep agents are dispatched fresh, each given its payload path —
  none is asked to re-judge another's verdict, and synthesis runs only
  after all of them return
- no synthesis of findings into plan tasks is offered or dispatched: no
  action needed design, so the remediation path is never entered and no
  task is written into the plan
- the two edits the applier makes are the only changes outside
  `.workflows/`; no task is started and no implementation is reopened
- the per-task reports are left as they were written — prep adds a layer
  above them and never rewrites them
- cache files under the review directory are expected working artifacts

EXPECTED WORLD — from an implemented feature with no review:

- a review report at `.workflows/pay/review/pay/report.md` carrying the
  verdict and a recommendations section built from the two actions, plus
  one per-task report file for each task suffix, each recording complete
  with its non-blocking notes intact
- the manifest holding the review completed, with reviewed_tasks
  carrying both internal ids
- the stale comment claim gone from `src/checkout/payment-intent.js` and
  the assertion in `tests/checkout/payment-intent.test.js` reading the
  gateway payload
- the plan, tasks and specification untouched; no remediation phase
  anywhere; no second work unit; nothing in the inbox
