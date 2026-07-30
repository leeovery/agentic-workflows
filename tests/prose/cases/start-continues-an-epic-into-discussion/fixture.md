# Fixture — start-continues-an-epic-into-discussion

The `search-relevance` epic stands freshly harvested: one closed
discovery session whose log records the shaping and three identified
topics, a discovery map holding those topics — `behavioural-ranking`
(routed to discussion), `synonym-handling` and `relevance-measurement`
(routed to research) — each with a summary, a description, and a brief
under `discovery/briefs/`, and no per-phase work anywhere.

No topic carries an `order` field: the map has never been sequenced,
so the first continue-epic visit should run the sequencing step. Both
analysis caches are absent — no research or discussion has ever
completed — and nothing qualifies for the legacy backfills. The
active-session marker is cleared (the harvest closed the session), so
no resume detection fires.
