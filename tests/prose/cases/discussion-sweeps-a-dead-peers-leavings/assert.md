The prose should have taken this path:

1. the entry reads the discussion status, finds it in progress, emits the
   resuming phase note, checks the reconcile flag (absent — silent), and
   hands off with source: existing discussion
2. the process reads the status again, finds the file, renders resume
   detection — the current map shown, then the continue-or-restart gate —
   and the user continues
3. initialisation is skipped: the walk lands at the guidelines, addresses
   the knowledge base once as a contextual query, and enters the session
   step
4. the session loop's triage check no-ops on an empty queue
5. the user says that covers it; the map is read through the gateway and
   comes back fully decided, and the closing gates load. No review has
   ever run on this topic, so the mandatory review gate is put — not the
   optional one — and the user takes it; no agent is in flight
6. the final gap review dispatches one review, marked as the mandatory
   closing pass; the harness stub stands in for the report, it comes back
   clean, and the gate is satisfied with nothing to surface
7. the document review and the compliance self-check run over the
   document, and the conclusion is reached
8. the conclusion runs in order: the queue is empty, the user confirms,
   the summary is confirmed populated, the topic is completed through the
   engine — which indexes the artifact — and the conclusion's own commit
   carries the topic scope and the knowledge-base rider, in one call
9. only then the sweep: the working tree is read for workflow dirt, and
   two other topics' documents are sitting uncommitted. The presence scan
   decides between them — research on relevance measurement is held by a
   live session, so its dirt is left exactly where it is; the synonym
   handling discussion has no heartbeat at all, so its document is a dead
   session's leavings and is committed on its own topic's scope, with the
   sweep marker
10. the walk stops there, before the closing recap

Further claims:

- the sweep is two calls, not one: the conclusion's own commit lands
  first and names only behavioural ranking, and the sweep commit is a
  separate call naming only synonym handling. Neither commit contains a
  path belonging to the other, and neither reaches the live session's
  research document
- the live peer is untouched in every sense — its document stays
  uncommitted, its topic's phase item does not move, and its heartbeat is
  neither cleared nor refreshed
- the dead peer's discussion is not concluded, reopened, or otherwise
  moved by the sweep: committing a file is not adopting the topic
- behavioural ranking's own heartbeat is not cleared by any instruction
  the walk follows — the prose never mentions heartbeats at all

EXPECTED WORLD — from the three-topic epic above:

- the behavioural-ranking discussion completed on the manifest, its
  document committed with whatever reconciliation the document review
  landed, and its subtopics still both decided
- `.workflows/search-relevance/discussion/synonym-handling.md` committed
  unchanged, and its discussion item still in progress with its subtopic
  still exploring
- `.workflows/search-relevance/research/relevance-measurement.md` still
  uncommitted and unchanged, its research item still in progress
- one agent row for the closing review, incorporated, with its report
  under `.workflows/.cache/` — cache files there are expected working
  artifacts
- no specification, planning, implementation, or review artifacts
  anywhere; no new topics on the discovery map
