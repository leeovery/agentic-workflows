The prose should have taken this path:

1. workflow-start boots (nothing to migrate, the store ready) and routes
   into continue-epic for the one active epic; the scoped discovery run
   reports the gap-analysis cache stale
2. the topic-discovery dispatch checks presence before reading anything —
   no peer session holds a source topic — and enters the analysis
   orchestration on the stale branch
3. the stale branch reads the staging state first and finds the candidate
   still `pending`, so it **reuses** it: the gap analysis itself never
   re-runs, no artifact is re-read, and the gate state is never
   re-registered
4. the gate counts the pending candidates — one — and goes straight into
   it. The first STOP is the per-candidate menu itself
5. signal-freshness-contract renders with its routing and summary; the
   user approves; the candidate is recorded `approved`
6. the topic is written to the map in a single add carrying the
   `gap-analysis` provenance, the staged block's own summary and
   description, and the brief pointer
   `discovery/briefs/signal-freshness-contract.md`. The pointer rides
   that add — no second call sets `brief_path` afterwards
7. **with the row on the map, the brief is written** to
   `.workflows/search-relevance/discovery/briefs/signal-freshness-contract.md`
   from the staged block, and never rendered back to the user. Its name
   joins the new-arrivals tracker
8. no `pending` block remains, so the gate clears the spent staging
   subtree in one manifest delete and returns
9. the cache is stamped: the cache file is rewritten from the staged
   candidate block — a reuse boot never re-derived a full topic list —
   and the stamp records a checksum over the completed research and both
   completed discussions
10. the sweep finds the tree dirty and lands both leavings: the analysis
    bookkeeping in the state scope, and the brief — which that scope does
    not reach — in the discovery scope. The dispatch then re-runs the
    epic gateway so the caller sees the new item
11. the refreshed output reports the map unsequenced — the new item
    carries no order — so the map sequencing step fires and records a
    contiguous 1..4 in one call (which topic leads is the model's
    judgment), then re-runs discovery
12. the build-order step is silent (no specification items exist), and
    the dashboard renders with the new-topic callout above the map. The
    walk stops with nothing selected

Further claims:

- the discovery map holds four items; signal-freshness-contract carries
  `source: gap-analysis`, `routing: discussion`, the summary and
  description the staged block held — not a re-derivation — and
  `brief_path: discovery/briefs/signal-freshness-contract.md`
- the brief file exists at that path and holds exactly these sections in
  this order and no others: an H1 naming the topic in title case, one
  line saying it is drawn from the discovery-gap analysis and naming all
  three artifacts the block recorded (behavioural-ranking.md,
  synonym-handling.md, relevance-measurement.md), then **The gap**,
  **Why it matters**, and **Open questions**. There is no soft-decisions
  section and no rejected-paths section — no conversation produced any
- **The gap** carries the staged description's own paragraphs; **Why it
  matters** and **Open questions** are drawn from that description rather
  than invented, and name no decision the epic has not taken
- the three harvested briefs are untouched, and no other brief is written
- nothing was pushed to the dismissed list — it is still empty
- no phase item was started for signal-freshness-contract: it is a fresh
  map topic with a brief, nothing more
- the `analysis_staging.discovery-gap-analysis` subtree is gone — the
  gate deleted it rather than leaving the candidate marked `approved`
  (the engine's delete may leave the parent `analysis_staging` container
  behind empty; that residue is fine)
- the three harvested map items keep their harvest summaries,
  descriptions, and brief pointers; the two discussion documents and the
  research document are untouched, and no topic's status changed
- git history holds the brief in a commit distinct from the analysis
  bookkeeping, and the sequencing commits itself — three distinct commits

EXPECTED WORLD — the fixture plus: `signal-freshness-contract` on the
discovery map with gap-analysis provenance, a brief pointer, and an order
within a contiguous 1..4; a fourth file under `discovery/briefs/` holding
the gap brief; an empty dismissed list; no
`analysis_staging.discovery-gap-analysis` subtree; a rewritten
`.state/discovery-gap-analysis.md` naming the staged candidate, with
`gap_analysis_cache` stamped over the current input set; and no new phase
items, artifacts, or work units.
