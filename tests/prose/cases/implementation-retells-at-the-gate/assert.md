The prose should have taken this path:

1. the plan gate renders empty and no implementation item exists, so
   this is a new entry; dependency validation returns immediately —
   external dependencies are an epic concern
2. the entry hands off into the processing skill carrying the
   local-markdown format read from the planning item
3. resume detection initialises tracking and reports the created mode,
   which commits the start of implementation through the engine's
   scoped commit
4. environment setup finds the existing document stating no setup is
   required and returns without asking anything; the plan adapter
   loads for the manifest's format; project skills and linter
   discovery each ask only their skip-again question — the first two
   scripted answers skip both
5. the loop reads work_type once at entry; the crash-resume healing
   finds nothing to heal; task pay-1-1 is selected, normalised,
   started via the engine, marked in-progress, and its brief renders
   via `render task-brief` before the executor dispatch — same turn,
   no stop
6. the executor stub fires for pay-1-1 and returns complete; the
   reviewer stub approves — no findings cache, no fix-attempt
7. the result header renders via `render task-result … --result
   approved`, and the result summary follows as the register's
   product summary — bold section labels from the register's fixed
   vocabulary (Before / Now / Decisions / Tests as earned), not
   flowing narrative paragraphs
8. the task gate is fetched via `render task-gate` and its MENU
   emitted; the third scripted answer is `t`
9. the retell renders as the register's technical retell — the
   code's side of the same result (structure, flow, decisions,
   costs), drawn from the reports and the changes on disk, never a
   raw file dump — and in the same turn the gate is fetched again
   via `render task-gate` and its MENU re-emitted; the result header
   and product summary are NOT re-presented — a lens return re-emits
   the menu alone
10. the fourth scripted answer is `s`; the show-me diagrams render —
    ASCII in a plain code block, narrow, captioned, real names — for
    the mechanism pay-1-1 built; a one-line note that an interactive
    page is available on request appears only if the walking session
    actually has a tool that can publish a browser page (its absence
    is correct, and no question is posed either way); in the same
    turn the gate is fetched a third time and its MENU re-emitted,
    again with no re-presented header or summary
11. the fifth scripted answer approves; progress lands for pay-1-1:
    frontmatter status flips to completed, the engine records
    completion naming pay-1-2 as next, and the code commit lands
    as impl(pay): Tpay-1-1
12. pay-1-2 runs the plain path: brief, executor and reviewer stubs,
    result header, product summary, one gate fetch, and the sixth
    scripted answer approves; its completion carries --next-task ~
    WITHOUT --phase-complete (the boundary is owed), one raw commit
    lands as impl(pay): Tpay-1-2, and the stage routes to the
    consolidation pass
13. the pass reads its durable state, dispatches the consolidation
    finder — the stub returns clean with no file — records the phase
    (consolidated_phases gains 1), lands the plan-side phase
    completion, re-records pay-1-2 with --phase 1 --phase-complete,
    and closes with the scoped commit
14. retrieval finds no open tasks, reports all tasks complete, and
    returns to the caller — the walk stops before the analysis loop

Further claims:

- task pay-1-1's gate menu was fetched exactly three times (initial,
  after the retell, after the diagrams) and pay-1-2's exactly once —
  every lens return re-fetched the menu via `render task-gate` in the
  turn it returned, never carrying an earlier response's section and
  never ending the turn on the lens output alone
- the result header rendered once per task — neither lens return
  re-ran `render task-result` or re-composed the product summary
- both lens outputs concern pay-1-1 only, and neither is a paste of
  the executor's report or a source file
- no fix-tracking file and no attempt-findings cache file exist; each
  task produced exactly one executor and one reviewer dispatch
- exactly one consolidation-finder dispatch fired; the clean path
  staged nothing
- the manifest's implementation item ends with both internal ids in
  completed_tasks, current_task null, phase 1 in completed_phases and
  consolidated_phases, and no bank field
- the task files both end with status: completed; the source and test
  files for both tasks exist as the stubs gave them
