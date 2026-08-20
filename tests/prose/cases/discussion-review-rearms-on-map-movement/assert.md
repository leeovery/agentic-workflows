The prose should have taken this path:

1. the entry reads the discussion status, finds it in progress, emits
   the resuming phase note, checks the reconcile flag (absent —
   silent), finds the carrier usable without asking the user anything,
   and hands off with source: existing discussion
2. the process reads the status again, finds the file, renders resume
   detection — the current map shown, then the continue-or-restart
   gate — and the user continues
3. initialisation is skipped: the walk lands at the guidelines,
   addresses the knowledge base once as a contextual query (empty
   store — the session proceeds silently), and enters the session step
4. the session loop's triage check no-ops on an empty queue; the
   check-for-results scan finds only the incorporated review row —
   nothing to surface
5. the user settles failed-payment retries — three attempts,
   exponential backoff, counter reset on a new checkout; the session
   records the subtopic decided on the map, writes the decision into
   the discussion file, and commits
6. the dispatch check runs at the commit and every condition holds:
   meaningful content, the prior review drained, and the arming
   verdict armed — one completed cycle put the bar at one map move,
   and the retry decision supplied it. A background review is
   dispatched (`--kind review`, no `--final` — the automatic trigger
   never bypasses), the dispatch announcement is emitted, and the
   session does not wait on the agent
7. the session replies to the user and the walk stops there

Further claims:

- exactly one dispatch is recorded, after the decision's commit, and
  it carries no `--final` flag
- the store gains a second review row (review-002), stamped with the
  moved map (failed-payment-retries decided)
- the arming verdict was read from the engine (`review_arming` on the
  scan), never computed by the prose counting exchanges or commits

EXPECTED WORLD — the fixture, with: the failed-payment-retries
subtopic decided on the map; the discussion file's Failed Payment
Retries section carrying the pinned decision (three attempts,
exponential backoff, reset on new checkout) and the Summary reflecting
it; one new commit on the discussion file; a review-002 row in the
agent store with the stub's report on disk. Nothing else moved.
