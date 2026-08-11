The prose should have taken this path:

1. workflow-start boots (migrations + knowledge gate through engine
   boot), shows the active work, and routes into the epic's continue
   skill for search-relevance
2. the epic menu renders; the user picks the cancel option and selects
   the synonym-handling discussion topic
3. the flow confirms the cancellation, then runs the bare cancel
   transaction — which the engine refuses, naming the expansion
   specification the cancel would collapse
4. the flow fetches the engine-rendered cancel-cascade gate — the
   statement names expansion as cancelled-with-it (started work,
   reactivatable) — and STOPS; it never hand-authors the warning and
   never re-runs the bare cancel
5. on the user's confirmation it re-runs the cancel with the cascade
   flag: one transaction cancels synonym-handling and the expansion
   specification together and commits
6. the receipt renders through the engine and the user is told, in a
   line, that expansion went with the topic; the walk stops there

The end world's claims:

- synonym-handling's discussion item reads cancelled with
  previous_status completed
- the expansion specification item reads cancelled with
  previous_status in-progress; its sources map survives untouched
- behavioural-ranking is untouched in every phase
- the discovery map's synonym-handling item lost its order to
  previous_order (the cancel stash) — reactivation can restore it
- the cascade landed as one commit; no second independent cancel
  commit for the specification exists
- the user answered exactly two gates: the cancel confirm and the
  collapse confirm — never a hand-written warning, never a request to
  cancel the specification separately
