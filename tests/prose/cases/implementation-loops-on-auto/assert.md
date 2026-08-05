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
   first, normalised, started via the engine, and marked in-progress
4. the executor stub fires for pay-1-1 and completes; the reviewer
   stub's first firing returns needs-changes with one issue
5. stage E writes the findings to the attempt cache and records the
   attempt via fix-attempt (attempt 1, threshold not reached); the
   findings are presented as a glanceable summary and the fix gate
   menu from the fix-attempt response is emitted — the gate is still
   gated, so the loop stops
6. the third scripted answer opts into auto: fix_gate_mode is set to
   auto in the manifest and the executor is re-invoked as a fix round
   in the same flow — no second fix-attempt is recorded for this
   round's dispatch
7. the executor's second firing completes; the reviewer's second
   firing for pay-1-1 approves; the task gate presents the result
   summary and emits the MENU carried by pay-1-1's start response
8. the fourth scripted answer opts into auto: task_gate_mode is set
   to auto and progress lands in the same turn — frontmatter flips to
   completed, the engine records completion naming pay-1-2 as next,
   and one raw git commit lands as impl(pay): Tpay-1-1
9. the loop returns to retrieval and selects pay-1-2, starts it, and
   marks it in-progress — pay-1-2's start response carries the
   DISPLAY: task gate auto-approved continuation section, not a menu
10. the executor completes pay-1-2; the reviewer's first firing for
    pay-1-2 returns needs-changes; stage E records fix-attempt 1 for
    pay-1-2, summarises the findings, emits the DISPLAY: fix gate
    auto-accepted section from that response, and dispatches the fix
    round in the same turn — no menu, no stop, no user input
11. the executor's fix round completes; the reviewer approves; the
    task gate presents the summary, emits the DISPLAY: task gate
    auto-approved section from pay-1-2's start response, and proceeds
    to commit in the same turn — one raw git commit lands as
    impl(pay): Tpay-1-2 with --phase-complete recorded and next
    task ~
12. retrieval finds no available and no open tasks, reports all tasks
    complete, and returns to the caller — the walk stops before the
    analysis loop

Further claims:

- after the fourth scripted answer, no menu is rendered and no user
  input is consumed — pay-1-2's entire round trip (execute, review,
  fix round, re-review, approve, commit) runs unattended
- both continuation sections are the engine-rendered lines from their
  carrying responses (pay-1-2's start and fix-attempt), emitted after
  the corresponding summary, never before it
- the turn never ends on a bare summary: each auto gate's summary is
  followed by its continuation line and the action it names
- each task produced exactly two executor dispatches and two reviewer
  dispatches — one initial, one fix round each
- exactly one fix-attempt is recorded per task — attempts reset with
  each task start, and the threshold display never renders
- fix-tracking files exist for both tasks and ride their task commits
- the manifest's implementation item ends with both internal ids in
  completed_tasks, current_task null, phase 1 in completed_phases,
  and both gate modes auto
- the task files both end with status: completed; the source and test
  files for both tasks exist as the stubs gave them
