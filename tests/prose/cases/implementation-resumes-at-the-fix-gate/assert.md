The prose should have taken this path:

1. the code-session gate finds no other session holding the tree and the
   plan gate renders empty; dependency validation returns immediately,
   and the implementation status reads in-progress, so this is a resume
2. tracking resumes, and the one-line resuming phase note is emitted
   with no start commit; the reconcile flag reads absent (silent)
3. environment setup finds the existing document and returns without
   asking; project skills and linters both read the empty arrays the
   topic stored — a confirmed none — and return silently, with no
   skip-again gate and no project default read
4. the task loop opens, and the plan's reading procedure gives the
   task still in flight — `pay-1-1` — as the next task
5. the task is started through the engine, which answers that this is a
   resume rather than a fresh start
6. that answer routes the loop to the pending fix gate, not to
   execution: the result header renders for a needs-changes verdict,
   the reviewer's recorded findings are presented from the task's
   fix-tracking file, and the fix gate's menu is emitted
7. the walk stops there, at the gate, with the question unanswered

Further claims:

- no executor agent and no reviewer agent was dispatched, and the task
  brief — the pre-dispatch announcement — was never rendered
- no new fix attempt was recorded: the attempt count is still 1 and
  `fix-tracking-pay-1-1.md` still holds exactly one `## Attempt`
  section, unchanged from the fixture
- the findings the user is shown come from the fix-tracking file; the
  session did not invent them, and did not re-derive them by
  re-reviewing the code
- nothing was committed, no task was completed, and the only world
  change is the result header's payload under the cache, naming
  `pay-1-1`
- the uncommitted executor code from the previous session is left
  exactly as it was
