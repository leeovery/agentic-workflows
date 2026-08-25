The prose should have taken this path:

1. workflow-start routes into continue-epic; topic discovery and both
   sequencing steps are silent (caches settled, every order present,
   no stale flag)
2. the epic dashboard renders: the synonym-handling planning row
   carries the `· blocked` cue, and the ⚑ plans-not-ready block names
   `behavioural-ranking:behavioural-ranking-1-2`
3. the menu offers **no** implementation row for `synonym-handling` —
   its blocked start is not selectable — while `behavioural-ranking`'s
   implementation start is offered; the `u/unblock` command option is
   present
4. choosing `u` fetches the unblock-menu sub-view: one numbered row,
   naming the plan and the dependency
5. the selection records `satisfied_externally` on the synonym-handling
   plan's dependency, commits, and returns to the dashboard and menu

Further claims about the end state:

- the dependency's `state` is `satisfied_externally`; its
  `internal_id` and `description` are untouched
- nothing else on the manifest moved — no order changed, no status
  changed, no flag appeared
- the re-rendered menu offers implementation starts for both topics
  and no `u/unblock` option
