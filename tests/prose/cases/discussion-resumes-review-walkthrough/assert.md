The prose should have taken this path:

1. the entry reads the discussion status, finds it in progress, emits
   the resuming phase note, checks the reconcile flag (absent — silent),
   re-reads the carrier without asking the user anything, and hands off
   with source: existing discussion
2. the process reads the status again, finds the file, renders resume
   detection — the current map shown, then the continue-or-restart
   gate — and the user continues
3. initialisation is skipped: the walk lands at the guidelines,
   addresses the knowledge base once as a contextual query (empty
   store — the session proceeds silently), and enters the session step
4. the triage drain no-ops on a `(none)` section — no commit, nothing
   surfaced
5. the session loop's check-for-results runs the agent scan and finds
   the acknowledged review row: F1 surfaced, F2 remaining. Because the
   user already opted into the walkthrough, no announce menu is
   re-rendered and no announce is recorded — at the first natural break
   (on resuming, or on the user's ask about the review) the one
   remaining finding is raised directly
6. the raise records F2 surfaced in the store — the last finding, so
   the row incorporates automatically — and the turn ends awaiting the
   user

Presentation claims — deliberate display claims; the raise's shape is
the behaviour under test:

- the finding itself is stated first, self-contained: what the review
  observed about a webhook that never arrives, in plain terms a user
  returning after hours can follow without the report in front of them
  — before any verdict, position, or proposal
- the raise opens with a one-line bridge acknowledging the first
  finding was already raised — and does not fabricate a recap of that
  engagement, which predates this session's context
- any term borrowed from another subtopic or an earlier decision is
  restated in place, never referenced bare
- the raise ends in a single question — no list of remaining findings,
  no menu, no bundled follow-ups

Further claims:

- no fresh review dispatch, no ack, no incorporate call: the row's own
  lifecycle carries the walk, and surfacing the last finding is what
  closes the row
- nothing is written: no discussion-file edit, no map change, no
  commit — the only state change is the surface call's
- the walk stops with the question pending; the user never answers it

EXPECTED WORLD — the fixture plus exactly one change: the agent store
row `review-001` has both findings surfaced and stands `incorporated`.
