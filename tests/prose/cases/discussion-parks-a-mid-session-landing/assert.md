The prose should have taken this path:

1. the skill asks the engine whether research is outstanding on the
   topic (it is not), finds the topic already on the discovery map
   (nothing created), then reads the discussion status once, finds it
   in progress, emits the resuming phase note, and checks the reconcile
   flag (absent — silent) — the user is asked nothing about the carrier
2. beneath the note, with the file found, the resume surface carries on
   — the map with result-caching and cache-key-shape open, then the
   continue-or-restart gate, with no second heading of its own — and
   the user continues; initialisation is skipped; the guidelines load;
   the knowledge base is addressed once as a contextual query; the
   session loop's first mailbox check reads the mailbox and finds it
   empty — no agenda, nothing surfaced
3. the session works result caching to its decision, the map records
   it decided — `all_decided` still false, the key shape open — and
   the write commits action-scoped. That commit is meaningful, the
   mailbox is still empty, no review has ever run, and the map is not
   settled, so the dispatch check fires the cadence's free first pass:
   a background review is recorded and the stubbed report lands clean.
   Should the check be passed over at that commit instead, no review
   runs; either outcome is a pass
4. immediately after that commit the armed substitution delivers the
   peer message — the engine's self-committing delivery, performed
   once as the peer, landing one file in this topic's mailbox
5. the loop's check notices the landing at the next natural break and
   offers it: the one-message agenda — title and origin only, body
   unread — with the offer menu, stopping for the user
6. the user says later; the message stays waiting untouched, nothing is
   added to the map for it, and the walk stops there — the session is
   left in progress with the key shape still open

Further claims:

- the mailbox directory holds exactly one file at the end — the injected
  message, never read in full, never armed, never absorbed
- the red mail blocker never renders, and no closing flow runs — the
  map never settled
- the document holds the result-caching decision written up in the
  template's shape; nothing about the parked message is written into
  it
- the map holds result-caching `decided`, cache-key-shape `pending`,
  and no entry for the message
- git history holds, in order: the result-caching session commit and
  the peer delivery commit (the send message from
  relevance-measurement); nothing after them
- the manifest holds `discussion.synonym-handling` as `in-progress`;
  behavioural-ranking's items are untouched
- the delivery's scratch file under `.workflows/.cache/` is consumed

EXPECTED WORLD — from the fixture:

- `.workflows/search-relevance/discussion/synonym-handling.md` gains a
  `## Result Caching` section carrying the per-session cache decision
  keyed on the normalised query and invalidated at the nightly refresh
- `.workflows/search-relevance/discussion/.mailbox/synonym-handling/`
  holds `001-expansion-cache-invalidation.md`
- the manifest's subtopics read result-caching `decided`,
  cache-key-shape `pending`; the discussion item stays `in-progress`
- the agent store holds at most one review row, clean and drained or
  still pending, its report on disk if dispatched; per-turn cache
  heartbeats under `.workflows/.cache/` are expected, not writes
