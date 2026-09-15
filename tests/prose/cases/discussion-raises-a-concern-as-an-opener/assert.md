The prose should have taken this path:

1. the entry asks the engine whether research is outstanding on the
   topic (it is not), then reads the discussion status — in-progress,
   reopened by the triage delivery — emits the resuming phase note,
   checks the reconcile flag (absent — silent), reads the map item's
   source and gathers nothing, and hands off with source: existing
   discussion
2. the process reads the status, finds the file, renders resume
   detection — the map with expansion-source decided, plus the
   one-concern triage warning — and the user continues;
   initialisation is skipped
3. the guidelines load; the knowledge base is addressed once as a
   contextual query; the session loop's first triage check finds a
   resumed sitting with a non-empty queue and renders the one-entry
   agenda — title and origin only, body unread — with the offer menu
   before any session output, and stops for the user
4. the user opts in; the raise reads the queue file as the session's
   own brief; the ask is a decision this discussion owes, so no
   requeue offer renders; the concern's title names no subtopic, but
   its ask re-decides the cutover clause of the decided
   `expansion-source`, so that ground re-arms `exploring` before
   anything is said — no new subtopic is added
5. the raise is composed as an opener from the entry and emitted in
   the same turn, and the turn ends awaiting the user, where the walk
   stops

Presentation claims — the opener shape is the behaviour under test:

- the first sentence names the shop's shopper and their moment — a
  shopper typing a misspelt product name once the hand list is gone,
  or the like — and names no topic, queue, entry, concern, or sibling;
  behavioural-ranking and what it settled arrive in a clause only
  after the situation is on the page
- the problem lands through one to three devices — a worked instance
  (the everyday case finding its product, the rare misspelling finding
  nothing), a before/after, a small diagram — chosen for
  understanding-speed, never all of them
- the raise states a position — a lean between the fallback tier and
  the seeded import, with one load-bearing reason riding as a clause,
  never its derivation — never a neutral option survey and never an
  abdication; the alternative gets at most one clause naming the kind
  of cost it carries, never two costs, never a cost with its
  consequence spelled out
- the entry's tuning stays back: the seed weight (three-tenths of a
  real pair), the decay window (ninety days) and the search budget
  (three hundred milliseconds, a threshold) appear nowhere in the
  raise; the two measurements — coverage, and the lookup's cost — may
  reach the user only as what they mean for the product (everyday
  terms are covered, misspellings of rare products are not; a second
  lookup on every search), with or without their figures, and never
  as a figure weighed against the budget
- the rejected parallel-merge alternative appears nowhere in the raise
- the raise's last beat says where the ball sits — a literal question
  whose sides are product end states (a hand-kept safety net for
  misspellings stays, or misspellings live on behaviour alone after a
  one-off import), or an invitation to push back pointing at the
  reason the raise already gave — never "what do you think?", no
  keyed menu, no bundled follow-ups, never a dead stop after the
  position, and nothing drawn from the held-back depth
- the raise's prose is well under half the entry's length (the
  entry runs to 494 words), a diagram aside — readable in a glance — and the entry is never emitted
  verbatim: no paragraph of it appears in the turn
- the raise covers this concern alone: no other item, finding, or
  gap rides along
- no outcome is documented in the raise's turn: nothing is written to
  the discussion file, no decision is recorded, and the map state
  goes no further than `exploring`

Further claims:

- no review dispatch, no requeue offer, no absorb, no completion
- the discussion file is byte-unchanged and no commit lands past the
  fixture's (render payloads and per-turn presence heartbeats under
  `.workflows/.cache/` are machinery, not writes)
- the queue file is still present with its content intact
- behavioural-ranking's document is unchanged
- the walk stops with the raise pending; the user never answers it

EXPECTED WORLD — the fixture plus exactly one durable change: the
manifest's map for synonym-handling holds `expansion-source` at
`exploring` (it was `decided`), re-armed by the raise; no subtopic is
added. Render payloads and per-turn
heartbeats under `.workflows/.cache/` are machinery, not changes.
