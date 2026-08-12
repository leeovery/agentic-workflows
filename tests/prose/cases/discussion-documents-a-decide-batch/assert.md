The prose should have taken this path:

1. the entry reads the discussion status, finds it in progress, emits
   the resuming phase note, checks the reconcile flag (absent —
   silent), finds the carrier usable without asking the user anything,
   and hands off with source: existing discussion
2. the process reads the status again, finds the file, renders resume
   detection — the current map shown, then the continue-or-restart gate
   — and the user continues
3. initialisation is skipped: the walk lands at the guidelines,
   addresses the knowledge base once as a contextual query (empty store
   — the session proceeds silently), and enters the session step
4. the session loop's triage check no-ops on an empty queue — no
   commit, nothing surfaced
5. the session loop's check-for-results runs the agent scan and finds
   the acknowledged review row: nothing surfaced, two findings
   remaining. The announce menu is rendered — a count and the lane
   shape, no finding content — and the user opts in
6. every remaining finding is in the decide lane, so the decide screen
   is built: a payload written to the topic's cache, rendered through
   the engine's finding-batch surface with lane decide, and its DISPLAY
   and MENU sections emitted — the menu carrying a document-all
   confirm, a Discuss route, and an Ask route
7. the user says yes. The calls are documented one at a time — for
   each, a new subtopic is added to the Discussion Map and set decided,
   its section written into the discussion file, and the write
   committed under that finding's own subject marker, before the next
   begins — so two commits land, not one sweeping both. The batch is
   then recorded in ONE surface call carrying both ids, which drains
   the row so it incorporates automatically

Presentation claims — deliberate display claims; the screen's shape is
the behaviour under test:

- the announce names a count and what the lane asks of the user — a
  scan of made calls, not decisions to make — and describes no
  individual finding
- the decide screen renders from the engine, not from a template in
  the prose, and the user sees both items — numbered, two lines each,
  each naming what determined the call — before anything is written
- no finding is raised individually: there is no scene, no worked
  example, no per-finding question, and no per-finding stop
- exactly one stop gate stands between the announce and the documented
  batch: the decide screen's menu itself
- after the commits the confirmation is one line total, not a
  per-call recap, and the turn does not end silently on it: the row is
  drained, so the same turn closes the review out loud — a line that
  the findings are worked through — and hands the conversation back

Further claims:

- the two Observations entries are never surfaced, never given ids, and
  never mentioned to the user — the announce count is two, not four
- no fresh review dispatch, no ack, no incorporate call: surfacing the
  batch is what closes the row
- each documented call lands as a new section whose Decision block
  opens with the derivation marker — **Settled by derivation**, naming
  what determined the call and its finding id — and the section's
  Journey carries the derivation, not an invented debate
- the two decided sections already in the file are untouched; the
  Summary may be brought current, but no other ground moves
- the walk stops after the drained close; no further subtopic is
  opened and no conclusion gate is entered

EXPECTED WORLD — the fixture plus: the agent store row `review-001`
holds both findings surfaced and stands `incorporated`; the Discussion
Map carries two new subtopics, both `decided`; the discussion file
carries a new section per call, each Decision opening with the
**Settled by derivation** marker naming its determinant and finding id;
and each call is committed under its own `(review-001 F…)` subject, one
commit per finding.
