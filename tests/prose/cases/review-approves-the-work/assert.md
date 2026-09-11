The prose should have taken this path:

1. the entry's prerequisite gate renders empty — plan and
   implementation are completed — and the review status reads empty, so
   nothing is reopened and the handoff carries the work forward with
   nothing asked
2. the process finds no report file — a fresh start, no resume choice —
   and registers the review through the engine
3. the plans and specification are read through the planning subtree
   and the format's reading adapter; the implementation's project
   skills are looked up
4. verification scopes its files from the git history of the per-task
   implementation commits, extracts both tasks from the plan, creates
   the review directory, and dispatches a verifier per task — stubbed:
   each report lands at its task's suffix, each return is complete with
   nothing found
5. both verified task ids are pushed onto the reviewed list, and the
   aggregation reads every per-task report — no criterion was recorded
   as unsettled, so no unsettled file is written
6. the change-set verification derives its sections from the
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
7. findings prep collects nothing — neither per-task report nor any
   section file carries a finding — so it returns without assessing,
   and no prep agent is dispatched
8. the do-now apply finds no actions and returns without announcing,
   dispatching, or committing anything
9. the review report is produced from the template with a Pass verdict
   and no findings section — its Specification Compliance carrying the
   three sections' coverage maps as their files record them, its Plan
   Completion's bold `Criteria not measured` line reading `none` — and
   committed
10. the outcome renders through the review presentation surface as a
   pass with nothing listed and nothing counted, and the summary
   follows product-first; at the review gate the user completes
11. the compliance self-check refreshes the session's instructions;
   the actions loop reads the Pass verdict, the review completes
   through the engine, the completion commit lands, and the walk stops
   at the pipeline continuation — the bridge is never invoked

Further claims:

- the change-set verification is dispatched exactly once, after both
  task verifiers have returned and coverage is pushed, and before
  findings prep — its section files exist before prep reads anything
- the section agents are given the specification path, the change-set,
  the project's conventions, the finding floor path and the statement
  that there are no unsettled criteria — never a per-task report
- the working tree is checked after the section agents return, and the
  review continues only because nothing outside `.workflows/` is
  modified or untracked — the review's own uncommitted reports and
  section files under `.workflows/` do not stop it
- no synthesis is offered or dispatched — the pass arm never routes
  to it
- no prep, apply or inbox work happens: with nothing found there is
  nothing to assess, apply or file, no apply commit lands, and nothing
  is banked to the manifest's out-of-scope set
- no code is fixed, no task is started, and nothing outside
  `.workflows/` changes
- cache and report files under the review directory are expected
  working artifacts

EXPECTED WORLD — from an implemented feature with no review:

- a review report at `.workflows/pay/review/pay/report.md` holding a
  Pass verdict over both tasks, a Specification Compliance section
  carrying the three coverage maps, and a Plan Completion whose
  criteria-not-measured line reads `none`; plus one per-task report
  file for each task suffix, each recording complete with no blocking
  issues, and one change-set file per section for this cycle —
  `change-set-c1-1-payment-intent.md`,
  `change-set-c1-2-capture-webhooks.md`, `change-set-c1-test-surface.md`
  — each clean with its coverage map
- the manifest holding the review completed, with reviewed_tasks
  carrying both internal ids
- the plan, tasks, specification, and source files untouched; no
  remediation phase anywhere; no second work unit
