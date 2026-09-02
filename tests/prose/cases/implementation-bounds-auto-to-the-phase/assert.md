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
4. retrieval orders by phase and selects pay-1-2 — pay-1-1 is
   completed and pay-2-1 belongs to phase 2 — and the later-phase
   guard does not fire; the task is normalised, started via the
   engine (the start response reports task_gate_mode gated), marked
   in-progress, and its brief renders before the dispatch
5. the executor stub fires for pay-1-2 and completes; the reviewer
   stub's first firing approves and carries one BANK entry, which
   deposits the moment the report arrives — one `manifest push …
   bank` with source reviewer, before the task gate — and the fix
   machinery is never touched
6. the result header renders, the summary follows, the task gate is
   fetched via `render task-gate` and its MENU emitted — the gate is
   gated, so the loop stops; the third scripted answer chooses
   bounded: task_gate_mode is set to `bounded` in the manifest (never
   `auto`) and progress lands in the same turn
7. progress lands for pay-1-2: frontmatter flips to completed, and the
   phase disposition comes out `boundary` — no open phase-1 tasks
   remain, the work type is feature, the phase label is
   plan-authored, and consolidated_phases is absent — so the
   plan-side phase completion is deferred, the engine call carries
   --next-task ~ WITHOUT --phase-complete, the code commit lands as
   impl(pay): Tpay-1-2, and the stage routes to the consolidation
   pass
8. the pass announces itself, reads consolidation_gate_mode (gated)
   and the durable state (staging and consolidated_phases both print
   empty), sees a plan-authored phase label with no resume state, and
   dispatches the consolidation finder for phase 1; the finder stub
   writes the findings file and returns STATUS findings with the
   banked entry confirmed; the findings commit picks the file up
9. the orchestrator judges: no spec defect is recorded, so no
   specification file is touched; the one finding folds into one
   staged proposal at proposal altitude — title, placement, class
   tag, Problem and Solution only — the bank disposition marks the
   entry folded, and the staging file is written to
   consolidation-tasks-p1.md
10. the walk's gate state initialises (staging.p1.tasks.1 pending),
    the tasks-overview renders, and the proposed task renders gated —
    the consolidation walk has its own gate mode, so the bounded task
    gate does not carry it; the fourth scripted answer approves,
    recorded as staging.p1.tasks.1 approved; consolidation_gate_mode
    never changes
11. E records the pass as landed — consolidated_phases gains 1 — then
    invokes the task author over the staging file, and only once it
    has returned the task writer, which creates tasks/pay-1-3.md in
    phase 1, appends its row to the Phase 1 table (the Phase 2 table
    is untouched), and records task_map.pay-1-3; the folded bank entry
    is pulled and the consolidation commits land — the staging file
    under the implementation topic, the tasks with --plan; the pass
    returns to the loop without recording the phase
12. the loop's next fetch orders by phase and sees pay-1-3 ahead of
    pay-2-1; the engine start reports task_gate_mode `bounded` — the
    phase is still open, so the bounded auto still holds; the task is
    briefed, executed by the consolidation executor stub, and reviewed
    by the reviewer stub's later firing (plain approve, no BANK)
13. the result header renders, the summary follows, the task gate is
    fetched via `render task-gate` and its DISPLAY: task gate
    auto-approved continuation section emitted — no menu, no stop, no
    scripted answer consumed — and the commit proceeds in the same
    turn
14. progress lands for pay-1-3: no open phase-1 tasks remain and
    consolidated_phases contains 1 with the approved staged task
    present in the plan, so the disposition is `completing` — the
    plan-side phase completion runs, the engine call carries --phase 1
    --phase-complete, and its response reports gates_reset naming
    task_gate_mode: the phase's close is what ended the bounded auto,
    never a manifest set from the prose; the code commit lands as
    impl(pay): Tpay-1-3
15. retrieval selects pay-2-1; the engine start reports task_gate_mode
    `gated` again; the task is normalised, marked in-progress, briefed,
    executed by the settlement executor stub, and reviewed by the
    reviewer stub's later firing (plain approve)
16. the result header renders, the summary follows, the task gate is
    fetched via `render task-gate` and its MENU emitted — the loop
    stops at the first task of the next phase — and the fifth scripted
    answer approves
17. progress lands for pay-2-1: frontmatter flips to completed and the
    disposition is `boundary` (phase 2 is plan-authored and not yet
    consolidated), so the engine call carries --phase 2 --next-task ~
    WITHOUT --phase-complete, the code commit lands as
    impl(pay): Tpay-2-1, and the stage routes to the consolidation pass
18. the pass reads consolidation_gate_mode (gated) and the phase-2
    state (no staging.p2, consolidated_phases holds 1 only, no
    findings file), and dispatches the consolidation finder for
    phase 2; the stub returns clean with no file, so nothing is judged
    and nothing is staged; the pass records the phase:
    consolidated_phases gains 2, the plan-side completion lands, the
    engine re-records pay-2-1 with --phase 2 --phase-complete, and the
    scoped commit closes the pass
19. retrieval finds no available and no open tasks, reports all tasks
    complete, and returns to the caller — the walk stops before the
    analysis loop

Further claims:

- exactly five scripted answers were consumed, in order: the two
  skip-again gates, the bounded opt-in at pay-1-2's task gate, the
  consolidation proposal's approval, and the approval at pay-2-1's
  task gate — none at pay-1-3, whose whole round trip (execute,
  review, approve, commit) ran unattended
- the only gate-mode write the prose made is `task_gate_mode bounded`
  at pay-1-2's gate; fix_gate_mode and consolidation_gate_mode were
  never set, and no call set task_gate_mode back to gated — the
  engine's phase record did that
- exactly three fresh executor dispatches fired (pay-1-2, pay-1-3,
  pay-2-1) and exactly three reviewer dispatches; pay-1-1 was never
  re-executed or re-reviewed; no fix round ran for any task
- exactly two consolidation-finder dispatches fired — phase 1's
  returning findings, phase 2's returning clean — and exactly one
  task-author and one task-writer dispatch, both during phase 1's
  boundary and in that order
- the manifest's implementation item ends with pay-1-1, pay-1-2,
  pay-1-3, and pay-2-1 in completed_tasks, current_task null,
  current_phase 2, completed_phases holding 1 and 2,
  consolidated_phases holding 1 and 2, every gate mode gated, and the
  bank an empty array — deposited once, pulled once
- staging.p1.tasks.1 ends approved with no other staging.p1 row; no
  staging.p2 subtree exists
- consolidation-findings-p1.md and consolidation-tasks-p1.md both exist
  in the implementation directory; no phase-2 findings or staging file
  exists
- tasks/pay-1-3.md exists with phase 1 and status: completed, and the
  planning file's Phase 1 table carries its row while the Phase 2 table
  is unchanged; tasks/pay-1-2.md and tasks/pay-2-1.md end with
  status: completed
- the settlement source and test files, the helper source and test
  files, and pay-1-2's source and test exist as the stubs gave them;
  pay-1-1's source changed only by the consolidation task's call-site
  edit
- the specification is byte-identical to the fixture's; no
  fix-tracking file and no attempt-findings cache file exist
