# Fixture — gap-gate-postpones-a-candidate

The `search-relevance` epic, one boot after a gap-analysis session staged
its candidates and stopped. Both discussions are concluded and decided,
and the relevance-measurement research completed *after* the last
gap-analysis stamp — so the analysis cache reads stale against its own
input set.

The reading is already done. One candidate sits staged in
`.state/discovery-gap-analysis-candidates.md` —
`signal-freshness-contract`, the join between behavioural-ranking's
batch-only ingestion, synonym-handling's live-stream expansion, and the
measurement research's silent assumption about the same aggregates — with
the artifacts it was read out of and its gap type recorded beside the
summary and description. It is registered `pending` under a `gated` gate
mode, nothing has been approved or dismissed, the dismissed list is empty,
and the map still holds only the three harvested topics, each with the
brief the harvest wrote for it.

The gap is real and the user knows it, but settling a freshness contract
means settling it with the platform team, whose pipeline work is a year
out. It is a topic for then, not for this epic.

The project has no roadmap: nothing has ever been parked onto one and no
work unit was ever pulled from one. The build order needs nothing (no
specification items) and the map is fully ordered from the harvest, so
the only pending machine work on entry is the staged gate.
