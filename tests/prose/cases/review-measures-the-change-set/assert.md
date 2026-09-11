The prose should have taken this path:

1. the entry's prerequisite gate renders empty — plan and
   implementation are completed — and the review status reads empty, so
   nothing is reopened and the handoff carries the work forward with
   nothing asked
2. the process finds no report file, registers the review through the
   engine, reads the plans and specification, and looks up the
   implementation's project skills
3. a verifier is dispatched per task — stubbed: each report lands at its
   task's suffix, each complete with no blocking issues and no findings;
   the payment-intent task's report records two of its criteria as
   unsettled, each with what would have to run to settle it
4. both verified task ids are pushed onto the reviewed list, the
   aggregation reads every per-task report, and the two unsettled
   criteria are collected into the review's cache file, each block
   opening with the task suffix
5. the change-set verification derives its sections from the
   specification's numbered headings — the payment-intent section, the
   capture section, and the test surface — finds none of this cycle's
   files (`change-set-c1-…`) already written, gathers the brief (the
   first task commit and the file list, the linter names — the fixture
   declares none — the root `CLAUDE.md` and the project skills as the
   project's conventions, the finding floor path, and the unsettled
   file path), and dispatches one agent per section in parallel —
   stubbed: the payment-intent section's file measures the
   gateway-rejection criterion by the project's documented single-file
   test command as holding, reports the duplicate-start criterion as
   not measured with its reason, raises one in-scope contained finding
   against the intent test, and carries a coverage map; each other
   section's file is clean, both criteria reported as the
   payment-intent section's, with its own coverage map
6. the tree is checked — nothing outside `.workflows/` is modified or
   untracked — and the reconciliation reads every section file from
   disk: the gateway-rejection criterion is measured because one section
   measured it, the duplicate-start criterion is not measured because no
   section did, so the cache's `not-measured.txt` is written with that
   one block — opening with the task suffix and quoting the criterion —
   and the three coverage maps are left in their files for the report
7. findings prep collects the one finding out of the payment-intent
   section's file into its own payloads, giving it a stable id built
   from the section slug and its position, then dispatches the
   assessment agents — assessor, guards and relationships — with
   relationships taking the whole set
8. synthesis is dispatched once over those assessments and writes the
   action list — stubbed: one do-now action carrying a rescued defect and
   a derived pass verdict since nothing needs planning; prep then commits
   the per-task reports, the section files and the manifest as the
   verification-and-prep checkpoint, so the apply starts from a clean
   tree
9. the do-now apply announces the correction in prose, dispatches an
   applier — stubbed: applied, nothing skipped — then the verifier over
   the uncommitted diff — stubbed: nothing to repair, suite green — and
   commits the correction through the engine's code commit as one body
   of work
10. the review report is produced with a Pass verdict: its Specification
   Compliance carries one sub-heading per section with that section's
   coverage entries, its Plan Completion carries the duplicate-start
   criterion with its task suffix under a bold `Criteria not measured`
   line — disclosed, never a checkbox — its corrected section records
   what was applied — and it is committed
11. the outcome renders through the review presentation surface as a
   pass — the correction a count, the one unmeasured criterion a count
   of 1 read from the cache file's blocks, nothing listed since nothing
   in this review is the user's to decide — and at the review gate the
   user completes
12. the compliance self-check refreshes the session's instructions, the
   actions loop reads the Pass verdict, the review completes through
   the engine, and the walk stops at the pipeline continuation

Further claims:

- the change-set verification is dispatched exactly once, after every
  task verifier has returned and coverage is pushed, and before findings
  prep — its section files exist before the prep payloads do
- the section agents are given the specification path, the change-set,
  the project's conventions — the root `CLAUDE.md` among them — the
  finding floor path and the unsettled file path — never a per-task
  report
- the working tree is checked after the section agents return, and the
  review continues only because nothing outside `.workflows/` is
  modified or untracked — the review's own uncommitted reports and
  section files under `.workflows/` do not stop it
- the not-measured criterion is disclosed, never absorbed: it is written
  to `not-measured.txt`, appears in the report's Plan Completion under
  the bold line and as a count of 1 in the presentation, and is not
  ticked off as met
- the prep agents are dispatched fresh, each given its payload path —
  none is asked to re-judge another's verdict, and synthesis runs only
  after all of them return
- the apply precedes the report and the presentation: by the time
  anything is shown, the correction is made, verified and committed
- no synthesis of findings into plan tasks is offered or dispatched: no
  action was routed to replan, so the remediation path is never entered
  and no task is written into the plan
- nothing is banked to the manifest's out-of-scope set and nothing
  reaches the inbox — the finding was in scope
- the one test edit is the only change outside `.workflows/`; no task is
  started and no implementation is reopened
- the per-task reports and the section files are left as they were
  written — prep adds a layer above them and never rewrites them
- cache files under the review directory are expected working artifacts

EXPECTED WORLD — from an implemented feature with no review:

- a review report at `.workflows/pay/review/pay/report.md` carrying a
  Pass verdict, a Specification Compliance section with one sub-heading
  per change-set section carrying that section's coverage entries, a
  Plan Completion whose bold `Criteria not measured` line names the
  duplicate-start criterion with its task suffix, and a
  corrected-in-this-session record of the one action
- one per-task report file for each task suffix, the payment-intent
  task's carrying its two unsettled criteria, plus one change-set file
  per section for this cycle — `change-set-c1-1-payment-intent.md`,
  `change-set-c1-2-capture-webhooks.md`, `change-set-c1-test-surface.md`
  — each recording what it measured, what it could not, its findings
  and its coverage map
- the review cache holding `not-measured.txt` with one block — `[1-1]`
  and the quoted duplicate-start criterion
- the manifest holding the review completed, with reviewed_tasks
  carrying both internal ids and no out_of_scope field
- the assertion in `tests/checkout/payment-intent.test.js` built
  through `createPaymentIntent`, committed as one apply commit;
  `src/webhooks/capture.js`, `src/checkout/payment-intent.js` and the
  root `CLAUDE.md` untouched
- the plan, tasks and specification untouched; no remediation phase
  anywhere; no second work unit; nothing in the inbox
