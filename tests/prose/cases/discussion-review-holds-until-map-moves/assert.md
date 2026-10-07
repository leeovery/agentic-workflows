The prose should have taken this path:

1. the skill asks the engine whether research is outstanding on the
   topic (it is not), then reads the discussion status once, finds it
   in progress, emits the resuming phase note, and checks the reconcile
   flag (absent — silent) — the user is asked nothing about the carrier
2. beneath the note, with the file found, the resume surface carries on
   — the current map shown, then the continue-or-restart gate, with no
   second heading of its own — and the user continues
3. initialisation is skipped: the walk lands at the guidelines,
   addresses the knowledge base once as a contextual query (empty
   store — the session proceeds silently), and enters the session step
4. the session loop's triage check no-ops on an empty queue; the
   check-for-results scan finds only incorporated review rows —
   nothing to surface
5. the user settles failed-payment retries — three attempts,
   exponential backoff, counter reset on a new checkout; the session
   records the subtopic decided on the map, writes the decision into
   the discussion file, and commits
6. the dispatch check runs at the commit: meaningful content
   committed, all three prior reviews drained — but the arming verdict
   on the scan is quiet: three completed cycles put the bar at three
   map moves, and only the retry decision has landed since review-003.
   No review is dispatched; the session simply continues
7. the session replies to the user and the walk stops there

Further claims:

- no agent dispatch of any kind is recorded — the movement backoff
  held with a drained store and a meaningful commit on the table,
  which is exactly the churn shape the backoff exists to kill
- the store still holds exactly three review rows, all incorporated,
  untouched by the walk
- the arming verdict was read from the engine (`review_arming` on the
  scan), never computed by the prose counting exchanges or commits

EXPECTED WORLD — the fixture, with: the failed-payment-retries
subtopic decided on the map (chargeback-disputes still pending — the
map does not converge); the discussion file's Failed Payment Retries
section carrying the pinned decision (three attempts, exponential
backoff, reset on new checkout) and the Summary reflecting it; one new
commit on the discussion file. Nothing else moved.
