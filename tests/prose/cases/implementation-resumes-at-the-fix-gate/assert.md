The prose should have taken this path:

1. the plan gate renders empty and the implementation item exists
   in-progress, so the entry proceeds as a resume — dependency
   validation returns immediately and the code-session gate finds no
   other session holding the tree
2. the entry hands off into the processing skill
3. resume detection reports the resumed mode: the one-line resuming
   notice, and no start commit
4. environment setup finds the existing document and returns without
   asking; project skills and linters both read their populated topic
   values and return silently
5. the task loop opens, and the plan's reading procedure gives the
   task still in flight — `pay-1-1` — as the next task
6. the task is started through the engine, which answers that this is a
   resume rather than a fresh start
7. that answer routes the loop to the pending fix gate, not to
   execution: the result header renders for a needs-changes verdict,
   the reviewer's recorded findings are presented from the task's
   fix-tracking file, and the fix gate's menu is emitted
8. the walk stops there, at the gate, with the question unanswered

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
