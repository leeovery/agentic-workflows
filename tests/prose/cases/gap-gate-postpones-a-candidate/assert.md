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
   user takes the postpone arm. The candidate is recorded `approved`,
   exactly as a yes records it, and nothing is pushed to the dismissed
   list — a postpone is not a skip, and the analysis has no reason to
   stop proposing a topic that now exists
6. the topic is written to the map in a single add carrying the
   `gap-analysis` provenance, the staged block's own summary and
   description, and the brief pointer
   `discovery/briefs/signal-freshness-contract.md`. The pointer rides
   that add — no second call sets `brief_path` afterwards. Its name joins
   the new-arrivals tracker, as an approved candidate's does
7. **with the row on the map, the brief is written** to
   `.workflows/search-relevance/discovery/briefs/signal-freshness-contract.md`
   from the staged block, and never rendered back to the user — the same
   brief the approve arm writes, because the topic is landing either way
8. only then does the postpone run, over a topic that now exists. The
   door reads the work type, finds an epic, and resolves the Discovery
   unit under the candidate's name; the gate is no session in a topic, so
   nothing is committed and no agent store is scanned
9. the user named no horizon at the gate, so the roadmap state is read.
   It holds no horizons — there is no roadmap — so the horizon is asked
   for in prose. The numbered horizon pick never renders
10. the confirm is fetched from the engine at
    `search-relevance.discovery.signal-freshness-contract` with the named
    horizon, its menu emitted, and the flow STOPs; on yes one postpone
    transaction runs and the receipt is fetched from the engine and
    emitted. The statement and the receipt are both the engine's
11. control returns to the per-candidate walk. No `pending` block
    remains, so the gate clears the spent staging subtree in one manifest
    delete and returns
12. the cache is stamped: the cache file is rewritten from the staged
    candidate block — a reuse boot never re-derived a full topic list —
    and the stamp records a checksum over the completed research and both
    completed discussions
13. the sweep finds the tree dirty and lands both leavings: the analysis
    bookkeeping in the state scope, and the brief — which that scope does
    not reach — in the discovery scope. The brief commit fires because
    the tracker holds a name; a postponed candidate is still a candidate
    that landed. The dispatch then re-runs the epic gateway so the caller
    sees the map as it now stands
14. the map sequencing step is silent: a postponed row waits on the
    roadmap and carries no execution order, and the three harvested
    topics are ordered already. The build-order step is silent too (no
    specification items), and the dashboard renders with the
    signal-freshness-contract topic named on the compact postponed line
    with its horizon rather than in the tree. The walk stops with nothing
    selected

Further claims:

- the discovery map holds four items; signal-freshness-contract carries
  `source: gap-analysis`, `routing: discussion`, the summary and
  description the staged block held — not a re-derivation —
  `brief_path: discovery/briefs/signal-freshness-contract.md`, and
  `postponed: true`. It carries no `order` and no `previous_order`: it
  never had one to stash
- the brief file exists at that path and holds exactly these sections in
  this order and no others: an H1 naming the topic in title case, one
  line saying it is drawn from the discovery-gap analysis and naming all
  three artifacts the block recorded (behavioural-ranking.md,
  synonym-handling.md, relevance-measurement.md), then **The gap**,
  **Why it matters**, and **Open questions**. There is no soft-decisions
  section and no rejected-paths section — no conversation produced any
- the project manifest now holds a roadmap: one horizon, the one the user
  named, holding one item named for the candidate, its summary the map
  row's, its origin the postpone of this epic, recording the work unit
  and topic it came from and pointing at the brief that was just written.
  It carries no `pulled_to` — it is waiting
- nothing was pushed to the dismissed list — it is still empty
- no phase item was started for signal-freshness-contract: it is a map
  topic with a brief, waiting on the roadmap, nothing more
- the `analysis_staging.discovery-gap-analysis` subtree is gone — the
  gate deleted it rather than leaving the candidate marked `approved`
  (the engine's delete may leave the parent `analysis_staging` container
  behind empty; that residue is fine)
- the three harvested map items keep their harvest summaries,
  descriptions, brief pointers, and orders 1–3; the two discussion
  documents and the research document are untouched, and no topic's
  status changed
- git history holds three distinct commits and no more: the engine's own
  postpone over both manifests, the analysis bookkeeping, and the brief

EXPECTED WORLD — the fixture plus: `signal-freshness-contract` on the
discovery map with gap-analysis provenance, a brief pointer and the
postponed marker; a fourth file under `discovery/briefs/` holding the gap
brief; a roadmap on the project manifest with one horizon and one waiting
item recording where it came from; an empty dismissed list; no
`analysis_staging.discovery-gap-analysis` subtree; a rewritten
`.state/discovery-gap-analysis.md` naming the staged candidate, with
`gap_analysis_cache` stamped over the current input set; and no new phase
items, artifacts, or work units.
