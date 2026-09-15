The prose should have taken this path:

1. the entry asks the engine whether research is outstanding on the
   topic (it is not), then reads the discussion status, finds it in progress, emits
   the resuming phase note, checks the reconcile flag (absent —
   silent), reads the map item's source and gathers nothing, and hands
   off with source: existing discussion
2. the process renders resume detection — the map with result-caching
   open, the triage queue read (one entry), the triage warning directly
   above the continue-or-restart gate — and the user continues;
   initialisation is skipped; the guidelines load; the knowledge base
   is addressed once as a contextual query
3. the session loop's first triage check finds a resumed sitting with
   a queued concern: the one-entry agenda and the offer menu render
   before any session output — no opening question, no thread of the
   topic's own first — and the user says later; the concern stays
   queued untouched
4. the session works result caching to its decision; the map records
   it decided and its set answers `all_decided: true`; the write
   commits action-scoped, and the dispatch check holds — the queue is
   not empty and the closing gates are next — so no review is
   dispatched
5. the close opens in the same turn: the wait gate (empty), the map
   read through the gateway, the settled line, and the closing gates —
   which meet the queued concern and, this entry being the map's
   settling rather than the user's signal, never render the triage
   blocker: the flow returns to the session loop, whose triage check
   offers the agenda at this break (the close holds over the earlier
   later), and the user takes it
6. the raise reads the queue file as the session's own brief, arms the
   map — the concern is new ground (`discussion-map add` then set
   `exploring`) — and raises it as an opener — the entry never emitted
   verbatim — then the concern is discussed to a decision
7. the fold writes the armed subtopic: a provenance-led Context
   carrying the entry's body verbatim, the decision documented, the
   map set `decided` — answering `all_decided: true` again — and the
   concern absorbed under its own commit naming file and origin; the
   clear line renders and, the queue now empty, the same turn enters
   the close: the wait gate (empty), the map read through the gateway,
   the settled line, the closing gates — with or without the user's
   own wrap-up
8. the closing gates classify never-reviewed — no review has run on
   this topic — so the mandatory final-review gate renders and the
   user says yes; the in-flight check finds nothing running and routes
   to the final gap review step, and the walk stops there, before that
   step runs

Further claims:

- the red triage blocker never renders: the settled map met the parked
  concern as an offer, never as a refusal
- the user never signalled conclusion and was never asked to: no
  free-text question about concluding sits between the result-caching
  commit and the second offer, nor between the absorb and the wait gate
- no review is dispatched at any point of the walk — the queue held
  the first commit's check shut, the absorb arms nothing, and the walk
  stops before the final review step runs
- the document holds an expansion-cache-invalidation subtopic whose
  Context opens with the provenance line naming relevance-measurement
  and carries the entry's body, recording the piggyback decision; the
  map holds it and result-caching `decided`
- git history holds, in order: the result-caching session commit and
  the absorb commit — the peer's delivery commit predates the walk
- the manifest holds `discussion.synonym-handling` as `in-progress`
  (the discussion is NOT completed); behavioural-ranking's items are
  untouched

EXPECTED WORLD — from the fixture:

- `.workflows/search-relevance/discussion/synonym-handling.md` gains a
  `## Result Caching` section carrying the per-session cache decision
  and a `## Expansion Cache Invalidation` section whose Context opens
  with `*From: relevance-measurement · discussion · 2026-01-03*`
  followed by the entry's body, recording that invalidation rides the
  nightly refresh the cache already watches
- `.workflows/search-relevance/discussion/.triage/synonym-handling/`
  is empty — the concern file deleted by its absorb
- the manifest's subtopics read result-caching `decided` and
  expansion-cache-invalidation `decided`; the discussion item stays
  `in-progress`
- the agent store holds no review row; per-turn cache heartbeats under
  `.workflows/.cache/` are expected, not writes
