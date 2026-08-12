The prose should have taken this path:

1. the plan gate renders empty and no implementation item exists, so
   this is a new entry; dependency validation returns immediately —
   external dependencies are an epic concern
2. the entry hands off into the processing skill carrying the
   local-markdown format read from the planning item
3. resume detection initialises tracking and reports the created mode,
   which commits the start of implementation through the engine's
   scoped commit — never the resuming-from-a-previous-session note
4. environment setup finds the existing document stating no setup is
   required and returns without asking anything and without writing it
   again
5. the plan adapter is loaded for the manifest's format; about.md
   demands no setup
6. project skills discovery reads an unpopulated topic value, finds
   the project default present but empty, and asks only the skip-again
   question — the first scripted answer skips; no scan of
   .claude/skills happens
7. linter discovery takes the same shape — the second scripted answer
   skips; no linter discovery runs
8. knowledge usage loads and returns; no knowledge query is made —
   implementation reads code, not the knowledge base
9. the loop reads work_type once at entry; the crash-resume healing
   finds nothing to heal — no task complete runs before the first
   retrieval
10. task pay-1-1 is selected first (phase order, then task order),
    normalised to the template shape, its position noted from the
    format listing, started via the engine, and marked in-progress in
    its frontmatter; the task brief then renders via `render
    task-brief` (one section — the task's marker, its meta rows, the
    summary and watch lines — emitted as markdown, nothing authored
    above it) before any executor dispatch — same turn, no stop
11. the executor stub fires for pay-1-1 and its STATUS is complete, so
    the block menu never renders; the reviewer stub fires and its
    verdict is approved, so the fix machinery is never touched — no
    findings cache, no fix-attempt
12. the result header renders via `render task-result … --result
    approved` (marker line, then the engine's verdict-and-meta
    section emitted as markdown), the summary follows, then the gate
    is fetched via `render task-gate` and its MENU emitted; the third
    scripted answer approves
13. progress lands for pay-1-1: frontmatter status flips to completed,
    the phase is not yet complete (pay-1-2 remains), the engine
    records completion naming pay-1-2 as next, and one raw git commit
    lands as impl(pay): Tpay-1-1 with a brief description
14. the loop returns to retrieval and selects pay-1-2, starts it,
    marks it in-progress, and presents its brief before the dispatch
15. executor and reviewer stubs fire once each for pay-1-2; the fourth
    scripted answer approves at the task gate
16. progress lands for pay-1-2: status completed, the phase check
    finds no open tasks so the engine call carries --phase-complete
    and next task ~, and one raw git commit lands as
    impl(pay): Tpay-1-2
17. retrieval then finds no available and no open tasks, reports all
    tasks complete, and returns to the caller — the walk stops before
    the analysis loop

Further claims:

- each task produced exactly one executor dispatch and one reviewer
  dispatch — no retries, no re-invocations
- both task briefs are engine-rendered sections fetched via `render
  task-brief` at the announcement itself; both result headers likewise
  via `render task-result` at the presentation itself — never
  hand-drawn; both task-gate menus likewise via `render task-gate` at
  the gate itself, emitted verbatim and never carried from an earlier
  response
- the per-task commits are raw git commits that include the task
  file's status change alongside the code and tests — the plan's
  state is not left uncommitted
- no fix-tracking file and no attempt-findings cache file exist; the
  task-brief and task-result payload cache files under
  .workflows/.cache are expected residue of the renders
- the manifest's implementation item ends with both internal ids in
  completed_tasks, current_task null, and phase 1 in completed_phases
- the task files both end with status: completed; the source and test
  files for both tasks exist as the stubs gave them
