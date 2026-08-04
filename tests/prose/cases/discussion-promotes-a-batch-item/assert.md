The prose should have taken this path:

1. the entry reads the discussion status, finds it in progress, emits
   the resuming phase note, checks the reconcile flag (absent —
   silent), re-reads the carrier without asking the user anything, and
   hands off with source: existing discussion
2. the process reads the status again, finds the file, renders resume
   detection, and the user continues
3. initialisation is skipped: the walk reaches the guidelines,
   addresses the knowledge base once as a contextual query (empty store
   — the session proceeds silently), and enters the session step
4. the session loop's triage check no-ops on an empty queue
5. the check-for-results scan finds the acknowledged row with three
   findings remaining, the announce menu is rendered, and the user opts
   in
6. all three are in the apply lane, so the batch screen is built from a
   payload rendered through the engine's finding-batch surface, and its
   DISPLAY and MENU sections are emitted
7. the user does not approve the lot: they say the retry ceiling is not
   the published figure for this account. Nothing in the artifact showed
   that, so the promotion could only come from them. That finding leaves
   the apply lane — unsurfaced, treated as a decision from here on
8. the batch re-renders for the two remaining items after the
   promotion; the user approves, and the two settled corrections are
   applied and recorded in one surface call carrying exactly those two
   ids, each committed under its own subject marker. The row stays
   acknowledged: one finding remains
9. with the apply lane empty, the promoted finding is raised as a
   decision — the lane heading, then the full raise, ending in a single
   question, and the turn ends

Presentation claims:

- the batch screen shows all three items before anything is written —
  the retry finding is not re-classified out beforehand, because nothing
  in the artifact contradicts it
- when the user pushes back on one item, no attempt is made to defend
  it back into the batch or to apply it anyway
- the promoted finding is raised as an open question about what the
  ceiling should be, NOT as a correction with a determined answer — the
  user withheld the real number, so the raise asks for it
- the raise states the finding self-contained before any position, and
  ends in a single question with no menu and no bundled follow-ups

Further claims:

- the surface call for the batch carries exactly the two settled ids —
  the promoted finding is never in a batch call
- the promoted finding's own surface call happens only when it is
  raised, at step 9
- no fresh review dispatch, no ack, no incorporate call
- the discussion file's edits are confined to the two applied
  corrections, each landing as a dated in-place amendment rather than a
  revision block preserving the original under an `#### Initial`
  heading; nothing is written about the retry ceiling, which is still an
  open question when the walk stops
- the two corrections commit separately, one per finding, each under its
  own `(review-001 F…)` subject — not one commit sweeping both
- the walk stops with the question pending; the user never answers it

EXPECTED WORLD — the fixture plus: the two settled corrections amended
into the discussion file and committed under their own `(review-001 F…)`
subjects, one commit each, and the store row `review-001` with all three
findings surfaced, standing `incorporated`.
