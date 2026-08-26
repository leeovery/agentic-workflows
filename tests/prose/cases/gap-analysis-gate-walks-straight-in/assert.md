The prose should have taken this path:

1. workflow-start boots (nothing to migrate, the store ready) and routes
   into continue-epic for the one active epic; the scoped discovery run
   reports the gap-analysis cache stale
2. the topic-discovery dispatch checks presence before reading anything —
   no peer session is live — and enters the analysis orchestration on the
   stale branch
3. the stale branch reads the staging state first and finds candidates
   still `pending`, so it **reuses** them: the gap analysis itself never
   re-runs, no artifact is re-read, and the gate state is never
   re-registered
4. the gate counts the pending candidates, announces the count — two —
   and goes **straight into candidate 1**. Nothing is offered between the
   count and the first candidate: no review-or-defer choice, no
   opt-in, no "come back later" arm. The first STOP of the gate is the
   per-candidate menu itself
5. candidate 1, signal-freshness-contract, renders with its routing and
   summary; the user approves; the candidate is recorded `approved` and
   the topic is written to the map with `gap-analysis` provenance and the
   staged block's own summary and description, its name joining the
   new-arrivals tracker
6. the gate returns to the next `pending` block on its own — no menu
   between candidates. Candidate 2, search-analytics-dashboard, renders
   and the user skips: the candidate is recorded `skipped` and the name
   is pushed to the dismissed list. Nothing is written to the map for it
7. no `pending` block remains, so the gate clears the spent staging
   subtree in one manifest delete and returns
8. the cache is stamped: the cache file is rewritten from the staged
   candidate blocks — a reuse boot never re-derived a full topic list —
   and the stamp records a checksum over the completed research and both
   completed discussions
9. the sweep finds the tree dirty (the cache file and the manifest —
   on this reuse boot the staged candidates file was never rewritten)
   and commits the bookkeeping; the dispatch then re-runs the epic
   gateway so the caller sees the new item
10. the refreshed output reports the map unsequenced — the new item
    carries no order — so the map sequencing step fires and records a
    contiguous 1..4 in one call (which topic leads is the model's
    judgment), then re-runs discovery
11. the build-order step is silent (no specification items exist), and
    the dashboard renders with the new-topic callout above the map,
    counting the one approval rather than the two proposals. The walk
    stops with nothing selected

Further claims:

- the discovery map holds four items; signal-freshness-contract carries
  `source: gap-analysis`, `routing: discussion`, and the summary and
  description the staged block held — not a re-derivation
- no phase item was started for signal-freshness-contract: it is a fresh
  map topic, nothing more
- search-analytics-dashboard appears nowhere on the map, and its name is
  the only entry on the dismissed list
- the `analysis_staging.discovery-gap-analysis` subtree is gone — the
  gate deleted it rather than leaving candidates marked
  `approved`/`skipped` (the engine's delete may leave the parent
  `analysis_staging` container behind empty; that residue is fine)
- nothing anywhere reads or writes research-analysis state; the only
  boot-time analysis is the gap one
- the three harvested map items keep their harvest summaries and
  descriptions; the two discussion documents and the research document
  are untouched, and no topic's status changed
- git history holds the analysis bookkeeping commit; the sequencing
  commits itself, so the two are distinct

EXPECTED WORLD — the fixture plus: `signal-freshness-contract` on the
discovery map with gap-analysis provenance and an order within a
contiguous 1..4; `search-analytics-dashboard` on the discovery phase's
dismissed list and nowhere else; no `analysis_staging.discovery-gap-analysis` subtree; a
rewritten `.state/discovery-gap-analysis.md` naming the staged
candidates, with `gap_analysis_cache` stamped over the current input
set; and no new phase items, artifacts, or work units.
