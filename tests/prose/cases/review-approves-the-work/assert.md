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
   aggregation reads every per-task report
6. the review report is produced from the template with an Approve
   verdict and no recommendations section, and committed
7. the verdict is presented product-first; at the questions gate the
   user continues, and the compliance self-check refreshes the
   session's instructions
8. the actions loop finds every verdict Approve: the no-actionable
   display renders, the review completes through the engine, the
   completion commit lands, and the walk stops at the pipeline
   continuation — the bridge is never invoked

Further claims:

- no synthesis is offered or dispatched — the approve arm never routes
  to it
- no code is fixed, no task is started, and nothing outside
  `.workflows/` changes
- cache and report files under the review directory are expected
  working artifacts

EXPECTED WORLD — from an implemented feature with no review:

- a review report at `.workflows/pay/review/pay/report.md` holding an
  Approve verdict over both tasks, plus one per-task report file for
  each task suffix, each recording complete with no blocking issues
- the manifest holding the review completed, with reviewed_tasks
  carrying both internal ids
- the plan, tasks, specification, and source files untouched; no
  remediation phase anywhere; no second work unit
