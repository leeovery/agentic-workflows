# Fixture — discussion-direct-entry-refuses-a-mapped-topic

The `search-relevance` epic stands harvested and sequenced: one closed
discovery session whose log records the shaping, and a discovery map
holding three topics — `behavioural-ranking` (routed to discussion),
`synonym-handling` and `relevance-measurement` (routed to research) —
each with a summary, a description, a brief under `discovery/briefs/`,
and an `order` of 1..3. No per-phase work exists anywhere: no research
has started, no discussion has been opened.

The map is already sequenced, so the continue-epic visit runs no
sequencing step. Both analysis caches are absent and nothing qualifies
for the legacy backfills. The active-session marker is cleared, so no
resume detection fires.
