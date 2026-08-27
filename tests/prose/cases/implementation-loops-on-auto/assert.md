The prose should have taken this path:

1. the plan gate renders empty and no implementation item exists, so
   this is a new entry; dependency validation returns immediately;
   the entry hands off into the processing skill carrying the
   local-markdown format read from the planning item
2. resume detection initialises tracking and commits the start of
   implementation; environment setup finds the existing document and
   asks nothing; the plan adapter loads; project skills and linter
   discovery each ask only their skip-again question — the first two
   scripted answers skip both
3. the loop reads work_type once at entry; task pay-1-1 is selected
   first, normalised, started via the engine, and marked in-progress;
   its brief renders via `render task-brief` before the dispatch
4. the executor stub fires for pay-1-1 and completes; the reviewer
   stub's first firing returns needs-changes with one issue
5. stage E writes the findings to the attempt cache and records the
   attempt via fix-attempt (attempt 1, threshold not reached); the
   result header renders via `render task-result … --result
   needs-changes`, the findings are presented as a glanceable
   summary, the fix gate is fetched via `render fix-gate`, and its
   menu is emitted — the gate is still gated, so the loop stops
6. the third scripted answer opts into auto: fix_gate_mode is set to
   auto in the manifest and the fix round continues pay-1-1's own
   executor in the same flow — no fresh executor dispatch, and no
   second fix-attempt is recorded for this round
7. the executor's fix-round firing completes; the reviewer's second
   firing for pay-1-1 is a fresh dispatch and approves; the result
   header renders via `render task-result … --result approved`, the
   summary follows, the gate is fetched via `render task-gate`, and
   its MENU emitted
8. the fourth scripted answer opts into auto: task_gate_mode is set
   to auto and progress lands in the same turn — frontmatter flips to
   completed, the engine records completion naming pay-1-2 as next,
   and the task's commits land — the state through --plan, the code
   through --paths as impl(pay): Tpay-1-1
9. the loop returns to retrieval and selects pay-1-2, starts it,
   marks it in-progress, and renders its brief before the dispatch
10. the executor completes pay-1-2; the reviewer's first firing for
    pay-1-2 returns needs-changes; stage E records fix-attempt 1 for
    pay-1-2, renders the result header, summarises the findings,
    fetches the fix gate via `render fix-gate` and emits its
    DISPLAY: fix gate auto-accepted continuation section, and
    continues pay-1-2's executor for the fix round in the same turn —
    no menu, no stop, no user input
11. the executor's fix round completes; the reviewer approves; the
    result header renders, the summary follows, the gate is fetched
    via `render task-gate` and its DISPLAY: task gate auto-approved
    continuation section emitted, and the commit proceeds in the same
    turn — the phase disposition comes out `boundary` (no open tasks,
    consolidated_phases lacks phase 1), so the engine call carries
    next task ~ WITHOUT --phase-complete, the code commit lands as
    impl(pay): Tpay-1-2, and the stage routes to the consolidation
    pass
12. the pass announces itself, reads consolidation_gate_mode and the
    durable state (the staging and consolidated_phases prints are
    empty; the gate mode reads gated), sees a plan-authored phase
    label with no resume state, and dispatches the consolidation
    finder — the stub returns clean with no file; the pass records the
    phase: consolidated_phases gains 1, the plan-side phase completion
    lands, the engine re-records pay-1-2 with --phase 1
    --phase-complete, and the scoped commit closes the pass
13. retrieval finds no available and no open tasks, reports all tasks
    complete, and returns to the caller — the walk stops before the
    analysis loop

Further claims:

- after the fourth scripted answer, no menu is rendered and no user
  input is consumed — pay-1-2's entire round trip (execute, review,
  fix round, re-review, approve, commit) runs unattended
- both continuation sections are engine-rendered lines fetched via
  `render task-gate` / `render fix-gate` at the gate itself, emitted
  after the corresponding summary, never before it
- the turn never ends on a bare summary: each auto gate's summary is
  followed by its continuation line and the action it names
- each task produced exactly one fresh executor dispatch, continued
  once for its fix round — never a second fresh executor — and exactly
  two fresh reviewer dispatches, the re-review never continuing the
  first reviewer
- exactly one fix-attempt is recorded per task — attempts reset with
  each task start, and every needs-changes verdict reads attempt 1,
  escalates at 3 — the escalation-threshold wording never renders
- the brief renders exactly once per task, at its start — the fix
  round and the re-review never repeat it
- fix-tracking files exist for both tasks and ride their task
  commits; the task-brief and task-result payload cache files under
  .workflows/.cache are expected residue of the renders
- the manifest's implementation item ends with both internal ids in
  completed_tasks, current_task null, phase 1 in completed_phases,
  phase 1 in consolidated_phases, and both gate modes auto —
  consolidation_gate_mode stays gated, its walk never engaged on the
  clean path
- exactly one consolidation-finder dispatch fired; no
  consolidation-findings file, no consolidation-tasks staging file,
  and no staging.p1 subtree exist
- the task files both end with status: completed; the source and test
  files for both tasks exist as the stubs gave them
