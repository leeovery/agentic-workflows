The prose should have taken this path:

1. the scoped path (epic, no topic) renders the spec-entry snapshot:
   both discussions concluded, nothing under `specifications:`, and
   `expansion` under `cancelled_specifications:` with both sources —
   the scenario is analyze, and prerequisites pass
2. the analyze prompt renders and, on yes, the analysis checks presence
   before reading anything — no source session is held, so nothing
   defers
3. the analysis reads both discussions in full and, with the user's
   context that they are one feature, forms one grouping over the pair;
   that grouping shares a majority of the cancelled specification's
   sources, so the flow names it afresh — never `expansion` — and
   records the resemblance for the cache
4. the reconcile snapshots the existing items, sets the cancelled
   `expansion` aside (never augmented, never deleted, never written
   to), and persists the new proposed grouping — with both sources
   pending and the build order assigned — through one `manifest apply`
5. the cache is written naming the resemblance and its route back, the
   reconcile commits, and the flow tells the user in one line that the
   grouping resembles the cancelled Expansion specification and that
   the epic menu's reactivate brings it back
6. the groupings menu is presented and the walk stops there

Further claims about the end state:

- exactly one new specification item exists, `proposed`, keyed
  anything but `expansion`, carrying `behavioural-ranking` and
  `synonym-handling` as `pending` sources and an integer `order`
- the `expansion` item is byte-for-byte the fixture's: `cancelled`,
  `previous_status: completed`, `previous_order: 1`, both source rows
  still `incorporated`, no `order` — no set, no delete, no reactivate
  touched it
- the analysis cache at
  `.workflows/search-relevance/.state/discussion-consolidation-analysis.md`
  names the cancelled specification and the reactivate as the way back
- no discussion, planning, or map item moved; `relevance-measurement`
  has no specification item
- the reconcile landed as one commit; no `topic reactivate`,
  `topic cancel`, or `build-order sequence` ran
