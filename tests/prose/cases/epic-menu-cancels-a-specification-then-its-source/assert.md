The prose should have taken this path:

1. workflow-start boots (migrations + knowledge gate through engine
   boot), shows the active work, and routes into the epic's continue
   skill for search-relevance; backfill, topic discovery, and both
   sequencing steps are silent (caches settled, every order present,
   no stale flag)
2. the epic dashboard renders; the menu carries `a/cancel`
3. choosing `a` fetches the cancel-menu sub-view: under `Topics`,
   Behavioural Ranking and Synonym Handling are shown keyless, each
   `locked by specification "expansion" — cancel it first`, and
   Relevance Measurement is numbered; under `Specifications`,
   Expansion is numbered with its completed status; the flow never
   composes a lock reason or drops a locked row
4. picking Expansion fetches the engine-rendered cancel gate addressed
   to the specification unit — the statement names the specification
   and its plan cancelled and the two source discussions freed to be
   regrouped or cancelled — and STOPs
5. on yes the flow runs one cancel transaction addressed
   `specification` and fetches the receipt through the engine
   (`Cancelled "Expansion".`); no cascade gate, no `--cascade`, no
   discussion or plan cancelled by a separate call, no manifest write
   by hand
6. the dashboard re-renders; choosing `a` again fetches the cancel
   menu with all three topics numbered, no lock on any row, and no
   `Specifications` group — the cancelled specification is never
   offered
7. picking Synonym Handling fetches the cancel gate addressed to the
   discovery unit — the statement names its discussion (completed)
   cancelled and reactivatable, with no discard clause (nothing was
   proposed over it) and no abandoned records — and STOPs
8. on yes the flow runs one cancel transaction addressed `discovery`
   and fetches the receipt (`Cancelled "Synonym Handling".`); the
   walk stops at the re-rendered dashboard and menu

Further claims about the end state:

- the expansion specification reads cancelled with previous_status
  completed, its `order` stashed as `previous_order` 1, and its
  sources map untouched (both rows still incorporated)
- the expansion plan reads cancelled with previous_status completed
- the synonym-handling discussion reads cancelled with previous_status
  completed, and its map row carries `cancelled: true` with `order`
  stashed as `previous_order` 2
- behavioural-ranking is untouched in every phase — its discussion
  still completed, its map row still ordered 1
- each cancel landed as its own engine commit
  (`workflow(search-relevance): cancel expansion (specification)`,
  `workflow(search-relevance): cancel synonym-handling (discovery)`),
  and no other commit was made
