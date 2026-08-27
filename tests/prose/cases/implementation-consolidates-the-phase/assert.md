The prose should have taken this path:

1. the plan gate renders empty and an implementation item exists, so
   the entry validates and hands off; resume detection reports the
   resumed mode and announces resuming from a previous session —
   never the created arm's start-implementation commit
2. environment setup finds the existing document and asks nothing;
   the plan adapter loads for local-markdown; project skills and
   linter discovery each ask only their skip-again question — the
   first two scripted answers skip both
3. the loop reads work_type once at entry; the crash-resume healing
   finds nothing to heal (pay-1-1 is in both the plan and
   completed_tasks)
4. retrieval selects pay-1-2 — pay-1-1 is completed — and the
   later-phase guard does not fire (the task is in the current
   phase); the task is normalised, started via the engine, marked
   in-progress, and its brief renders before the dispatch
5. the executor stub fires for pay-1-2 and completes; the reviewer
   stub's first firing approves and carries one BANK entry
6. the review's BANK entry deposits the moment the report arrives —
   one `manifest push … bank` with source reviewer, before the task
   gate — and the fix machinery is never touched
7. the result header renders, the summary follows, the task gate
   menu is emitted, and the third scripted answer approves
8. progress lands for pay-1-2: frontmatter flips to completed, and
   the phase disposition comes out `boundary` — no open tasks
   remain, the work type is feature, the phase label is
   plan-authored, and consolidated_phases is absent — so the
   plan-side phase completion is deferred, the engine call carries
   --next-task ~ WITHOUT --phase-complete, the code commit lands
   as impl(pay): Tpay-1-2, and the stage routes to the consolidation
   pass
9. the pass announces itself, reads consolidation_gate_mode (gated)
   and the durable state (staging and consolidated_phases both print
   empty), sees a plan-authored phase label with no resume state,
   and dispatches the consolidation finder
10. the finder stub writes the findings file and returns STATUS
    findings with the banked entry confirmed; the findings commit
    runs (the file was written) and picks it up
11. the orchestrator judges: the one finding folds into one staged
    task, the bank disposition records the entry as folded, no
    pre-existing debt exists to push, and the staging file is
    written to consolidation-tasks-p1.md
12. the walk's gate state initialises (staging.p1.tasks.1 pending),
    the tasks-overview renders, the proposed task renders gated, and
    the fourth scripted answer approves — recorded as
    staging.p1.tasks.1 approved; consolidation_gate_mode never
    flips to auto
13. E records the pass as landed — consolidated_phases gains 1 —
    then invokes the task writer with the per-task
    consolidation-boundary placement; the writer stub creates
    tasks/pay-1-3.md, appends the planning row, and records
    task_map.pay-1-3
14. the folded bank entry is pulled — the bank empties — and the
    consolidation commits land via the engine: the staging file under
    the implementation topic, the tasks with --plan
15. the loop's next fetch sees pay-1-3: started, briefed, executed
    by the consolidation executor stub, reviewed by the reviewer
    stub's later firing (plain approve, no BANK), and approved at
    the gate by the fifth scripted answer
16. progress lands for pay-1-3: no open tasks remain and
    consolidated_phases contains 1 with the approved staged task
    present in the plan, so the disposition is `completing` — the
    plan-side phase completion runs (no action in this format), the
    engine call carries --phase-complete, and the code commit lands
    as impl(pay): Tpay-1-3
17. retrieval finds no available and no open tasks, reports all
    tasks complete, and returns to the caller — the walk stops
    before the analysis loop

Further claims:

- exactly two fresh executor dispatches fired (pay-1-2, pay-1-3) and
  exactly two reviewer dispatches; pay-1-1 was never re-executed or
  re-reviewed
- exactly one consolidation-finder dispatch and exactly one
  task-writer dispatch fired
- the manifest's implementation item ends with all three internal
  ids in completed_tasks, current_task null, phase 1 in both
  completed_phases and consolidated_phases, every gate mode gated,
  and the bank an empty array — deposited once, pulled once
- staging.p1.tasks.1 ends approved; no other staging.p1 row exists
- consolidation-findings-p1.md and consolidation-tasks-p1.md both
  exist in the implementation directory, the staging file carrying
  the task and a Bank Disposition marking the entry folded
- tasks/pay-1-3.md exists with status: completed and the planning
  file's Phase 1 table carries its row
- the helper source and test files exist as the stub gave them;
  pay-1-1's task file and test are untouched, and its source changed
  only by the consolidation task's call-site edit
- no fix-tracking file and no attempt-findings cache file exist
