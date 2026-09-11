The prose should have taken this path:

1. the entry's prerequisite gate renders empty — plan and
   implementation are completed — and the review status reads empty, so
   nothing is reopened and the handoff carries the work forward with
   nothing asked
2. the process finds no report file, registers the review through the
   engine, reads the plans and specification, and looks up the
   implementation's project skills
3. a verifier is dispatched per task — stubbed: the payment-intent task's
   report records the card-only criterion unmet under its blocking
   issues, pointing at the finding beneath it that prescribes the
   one-line remedy, and returns incomplete; the capture task's report
   records one finding whose failure line describes behaviour — the paid
   write runs for an unknown intent — while the change it prescribes is
   comment text, and returns issues_found
4. both verified task ids are pushed onto the reviewed list; the
   aggregation reads every per-task report from disk and collects the
   blocking issue from the BLOCKING ISSUES section, never inferred from
   a status; no criterion was recorded as unsettled, so no unsettled
   file is written
5. the change-set verification derives its sections from the
   specification's numbered headings — the payment-intent section, the
   capture section, and the test surface — finds none of this cycle's
   files (`change-set-c1-…`) already written, gathers the brief (the
   first task commit and the file list, the linter names — the fixture
   declares none — the project skills, the finding floor path, and the
   statement that nothing was unsettled, since no unsettled file
   exists), and dispatches one agent per section in parallel — stubbed:
   every section's file is clean, carrying a coverage map and no
   finding; the tree is checked with nothing outside `.workflows/`
   modified or untracked, the reconciliation reads every section file
   from disk and finds nothing to reconcile, and no `not-measured.txt`
   is written
6. findings prep collects three entries out of the per-task reports into
   its own payloads — the section files carry none — the blocking entry
   marked `[blocking]` in both payloads, the tag written where a finding's
   scope and radius tags sit, its id built from its task suffix and its position
   in that report's blocking list, and the two findings with ids built
   from their task suffixes and positions — then dispatches the
   assessment agents — assessor, guards and relationships — with
   relationships taking the whole set rather than a batch — stubbed: the
   assessor answers the remedy question `code` for the capture finding
   and names the guard the failure needs, and `-` for the blocking entry
   and its paired finding; relationships groups the blocking entry with
   the finding that prescribes its remedy as one overlap group
7. synthesis is dispatched once over those assessments and writes the
   action list — stubbed: two do-now actions — the blocking entry and
   its paired finding collapsed into one action carrying the blocking
   marker, its remedy contained; the capture finding re-aimed at the
   code the assessor named, its radius re-read with the code open and
   contained with the case that observes it — and a derived pass verdict
   since nothing needs planning; prep then commits the per-task reports,
   the section files and the manifest as the verification-and-prep
   checkpoint, so the apply starts from a clean tree
8. the do-now apply marks its step and announces the two corrections
   in its signpost, dispatches an applier — stubbed: both applied, the blocking one among them, nothing
   skipped — then the verifier over the uncommitted diff — stubbed:
   nothing to repair, suite green — and commits the corrections through
   the engine's code commit as one body of work
9. the review report is produced from the action list with a Pass
   verdict: its Specification Compliance carries the three sections'
   coverage maps as their files record them, its Plan Completion's bold
   `Criteria not measured` line reads `none`, its Corrected in this
   session section names the card-only action as blocking and corrected
   beside the capture correction, its Blocking Issues section lists
   nothing — the one blocking issue was corrected, not left outstanding
   — and it is committed
10. the outcome renders through the review presentation surface as a
   pass — the corrections a count of two, nothing listed, since nothing
   in this review is the user's to decide — and at the review gate,
   rendered for a pass, the user completes
11. the compliance self-check refreshes the session's instructions, the
   actions loop reads the Pass verdict, the review completes through
   the engine, and the walk stops at the pipeline continuation

Further claims:

- the blocking issue is never relabelled non-blocking and never fails
  the review on its own: it reaches prep as a [blocking] entry beside
  its paired finding, is routed by that finding's contained radius, and
  the verdict derives from the replan set alone — which is empty
- the capture correction that lands is the guard in the handler, never
  the comment edit the verifier prescribed — the comment stands as
  written
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
  reaches the inbox — every finding was in scope
- the three edits — the intent literal, the capture guard, and the
  covering case in the capture test — are the only changes outside
  `.workflows/`; no task is started and no implementation is reopened
- the per-task reports and the section files are left as they were
  written — prep adds a layer above them and never rewrites them
- cache files under the review directory are expected working artifacts

EXPECTED WORLD — from an implemented feature with no review:

- a review report at `.workflows/pay/review/pay/report.md` carrying a
  Pass verdict, a Specification Compliance section carrying the three
  coverage maps, a Plan Completion whose criteria-not-measured line
  reads `none`, a Corrected in this session section of two actions with
  the card-only one marked as blocking and corrected, and no blocking
  issue listed under QA Verification; plus one per-task report file for
  each task suffix — the payment-intent task's recording incomplete with
  its blocking issue and finding intact — and one change-set file per
  section for this cycle — `change-set-c1-1-payment-intent.md`,
  `change-set-c1-2-capture-webhooks.md`, `change-set-c1-test-surface.md`
  — each clean with its coverage map
- the manifest holding the review completed, with reviewed_tasks
  carrying both internal ids and no out_of_scope field
- `src/checkout/payment-intent.js` creating the intent with
  `methods: ['card']`; `src/webhooks/capture.js` returning before the
  paid write when no order carries the intent, its header comment
  unchanged; `tests/webhooks/capture.test.js` carrying the
  unknown-intent case — committed as one apply commit
- the plan, tasks and specification untouched; no remediation phase
  anywhere; no second work unit; nothing in the inbox
