The prose should have taken this path:

1. the entry reads the discussion status, finds it in progress, emits
   the resuming phase note, checks the reconcile flag (absent —
   silent), re-reads the carrier without asking the user anything, and
   hands off with source: existing discussion
2. the process reads the status again, finds the file, renders resume
   detection — the current map shown, then the continue-or-restart
   gate — and the user continues
3. initialisation is skipped: the walk lands at the guidelines,
   addresses the knowledge base once as a contextual query (empty
   store — the session proceeds silently), and enters the session step
4. the session loop's triage check no-ops on an empty queue
5. the check-for-results scan finds the acknowledged review row:
   nothing surfaced, two findings remaining, both in the walked lane.
   The announce menu renders — a count and what the findings ask (two
   need a call), naming no batch lanes because none have findings —
   and the user opts in
6. with no apply findings and no route findings, no batch screen
   renders at any point: the walk raises the first finding directly,
   opening with the `Needs A Decision` heading
7. the raise is fuel-framed: it names the untouched ground (failure
   UX or idempotency — contextual relevance picks), connects it to
   the exploring subtopic, and invites opening the area — an option
   space sketched or a question asked, never a determined fix, never
   a correction. It ends in a single question and the turn ends

Presentation claims — the early shape is the behaviour under test:

- no finding-batch render occurs anywhere in the walk
- the announce menu names only the walked lane's ask; it does not
  mention batches, applying, or sending
- the raise reads as an invitation to explore, not a defect report:
  no "amend", no "correction", no proposed text
- the raise opens with the walked lane's declared heading and ends in
  one question with no menu

Further claims:

- no fresh review dispatch, no ack, no incorporate call
- the discussion file is not edited and no commit lands (per-turn
  presence heartbeats under `.workflows/.cache/` are expected, not
  writes)
- no subtopic is added to the map before the user engages
- the walk stops with the question pending; the user never answers it

EXPECTED WORLD — the fixture plus exactly one change: the agent store
row `review-001` has one finding surfaced and stands `acknowledged`
with the other remaining.
