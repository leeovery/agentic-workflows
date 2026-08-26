The `search-relevance` epic, one boot after a gap-analysis gate died
mid-walk. Both discussions are concluded and decided, and the
relevance-measurement research completed *after* the last gap-analysis
stamp — so the analysis cache reads stale against its own input set.

A prior session already did the reading: two candidates sit staged in
`.state/discovery-gap-analysis-candidates.md` — `signal-freshness-contract`
(the join between behavioural-ranking's batch-only ingestion and
synonym-handling's live-stream expansion, which no topic owns) and
`search-analytics-dashboard` (a merchandiser view over the metrics) —
and both are registered `pending` under a `gated` gate mode. Nothing was
ever approved, skipped, or dismissed; the dismissed list is empty and the
map still holds only the three harvested topics.

The build order needs nothing (no specification items) and the map is
fully ordered from the harvest. The only pending machine work on entry is
the staged gate.
