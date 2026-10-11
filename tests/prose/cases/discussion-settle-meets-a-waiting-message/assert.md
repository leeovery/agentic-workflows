The prose should have taken this path:

1. the skill asks the engine whether research is outstanding on the
   topic (it is not), finds synonym-handling already on the discovery
   map — nothing is created — then reads the discussion status once,
   finds it in progress, emits the resuming phase note, and checks the
   reconcile flag (absent — silent); nothing is gathered — the user is
   asked nothing about the carrier
2. beneath the note, with the file found, the resume surface carries on
   — the map with result-caching open, the mailbox read (one
   message), the mail warning directly above the continue-or-restart
   gate — and the user continues; initialisation is skipped; the
   guidelines load; the knowledge base is addressed once as a
   contextual query
3. the session loop's first mailbox check finds a resumed sitting with
   a waiting message: the one-message agenda and the offer menu render
   before any session output — no opening question, no thread of the
   topic's own first — and the user says later; the message stays
   waiting untouched
4. the session works result caching to its decision; the map records
   it decided and its set answers `all_decided: true`; the write
   commits action-scoped, and the dispatch check holds — the mailbox is
   not empty and the closing gates are next — so no review is
   dispatched
5. the close opens in the same turn: the landed-input read (no
   flag), the wait gate (empty), the map
   read through the gateway, the settled line, and the closing gates —
   which meet the waiting message and, this entry being the map's
   settling rather than the user's signal, never render the mail
   blocker: the flow returns to the session loop, whose mailbox check
   offers the agenda at this break (the close holds over the earlier
   later), and the user takes it
6. the raise reads the message file as the session's own brief, arms the
   map — the message is new ground (`discussion-map add` then set
   `exploring`) — and raises it as an opener — the message never emitted
   verbatim — then the message is discussed to a decision
7. the fold writes the armed subtopic: a provenance-led Context
   carrying the message's body verbatim, the decision documented, the
   map set `decided` — answering `all_decided: true` again — and the
   message absorbed under its own commit naming file and origin; the
   clear line renders and, the mailbox now empty, the same turn enters
   the close: the wait gate (empty), the map read through the gateway,
   the settled line, the closing gates — with or without the user's
   own wrap-up
8. the closing gates classify never-reviewed — no review has run on
   this topic — so the mandatory final-review gate renders and the
   user says yes; the in-flight check finds nothing running and routes
   to the final gap review step, and the walk stops there, before that
   step runs

Further claims:

- the red mail blocker never renders: the settled map met the parked
  message as an offer, never as a refusal
- the user never signalled conclusion and was never asked to: no
  free-text question about concluding sits between the result-caching
  commit and the second offer, nor between the absorb and the wait gate
  (the close's own landed-input read excepted)
- no review is dispatched at any point of the walk — the mailbox held
  the first commit's check shut, the absorb arms nothing, and the walk
  stops before the final review step runs
- the document holds an expansion-cache-invalidation subtopic whose
  Context opens with the provenance line naming relevance-measurement
  and carries the message's body, recording the piggyback decision; the
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
  followed by the message's body, recording that invalidation rides the
  nightly refresh the cache already watches
- `.workflows/search-relevance/discussion/.mailbox/synonym-handling/`
  is empty — the message file deleted by its absorb
- the manifest's subtopics read result-caching `decided` and
  expansion-cache-invalidation `decided`; the discussion item stays
  `in-progress`
- the agent store holds no review row; per-turn cache heartbeats under
  `.workflows/.cache/` are expected, not writes
