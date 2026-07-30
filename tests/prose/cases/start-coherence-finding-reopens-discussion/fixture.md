# Fixture — start-coherence-finding-reopens-discussion

The `search-relevance` epic has moved past its harvest: two of its
three topics have concluded discussions. `behavioural-ranking`
deliberately decided batch-only signal ingestion — real-time streaming
rejected as over-engineering, the events pipeline exposes batch
aggregates only, no live signal stream will be built.
`synonym-handling` (rerouted from research and discussed later)
decided behaviour-driven synonym expansion and, in passing, rested its
freshness on the expansion service reading the live click-signal
stream at query time — the capability the earlier discussion settled
will not exist — without citing that decision. Both documents carry a
decided subtopic on the manifest map and a terminal `## Triage`
section holding `(none)`. `relevance-measurement` is untouched.

The discovery map is fully sequenced (orders 1..3), so no sequencing
step should fire. The gap-analysis cache is stamped and valid — the
prior boot's pass surfaced nothing new — and no research exists, so
the research-analysis cache reads absent. No coherence cache exists:
the next boot reads it stale over the two concluded discussions, and
the coherence check is the only analysis with anything to do. The
active-session marker is cleared and nothing qualifies for the legacy
backfills.
