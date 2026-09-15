The prose should have taken this path:

1. the entry asks the engine whether research is outstanding on the
   topic (it is not), then reads the discussion status, finds it in
   progress, emits the resuming phase note, checks the reconcile flag
   (absent — silent), finds the carrier usable without asking the user
   anything, and hands off with source: existing discussion
2. the process reads the status again, finds the file, renders resume
   detection — the current map shown, then the continue-or-restart
   gate — and the user continues
3. initialisation is skipped: the walk lands at the guidelines,
   addresses the knowledge base once as a contextual query (empty
   store — the session proceeds silently), and enters the session step
4. the session loop's triage check no-ops on an empty queue; its
   check-for-results runs the agent scan and finds an empty store —
   nothing pending, nothing to surface, no announce
5. the user signals the discussion covers it; the close opens: the
   wait gate (empty), the map read through the gateway and fully
   decided, the settled line, and the closing gates load
6. classification finds no review row at all — never-reviewed — and
   the mandatory review gate renders in its final-review shape; the
   user, agreeable to required steps, says yes; the in-flight check
   finds nothing running; the final review step dispatches review-001
   as a foreground task carrying `--final`, and the stubbed report
   comes back with two gaps on decided ground, F1 and F2, both
   ask-laned
7. the final review menu reference scans (the row promotes to
   pending), reads the report, acknowledges the row with both finding
   ids, fetches the drain offer from the engine, records the announce,
   and stops; the user chooses to walk the findings
8. F1 is raised on its own — the lost-webhook consequence, retold at
   product altitude with a position and a closing question — and the
   turn ends; the user settles it as an amendment to the
   capture-confirmation decision (an hourly reconciliation sweep over
   orders pending longer than thirty minutes), the outcome lands as a
   dated revision on that block, the commit carries the `(review-001
   F1)` marker, and the finding is surfaced through the engine. No new
   subtopic is added: the map stays fully decided
9. the close was interrupted, not ended: the flow is back in the
   session loop. F2 is raised next — by the loop's own review check at
   the break, or by the resumed close classifying findings-owed and
   the final review step raising it; either is a pass — and the user
   settles it the same way, an amendment to the failed-payment-retries
   decision (the counter is per card), its commit carrying the
   `(review-001 F2)` marker; surfacing the last finding incorporates
   the row
10. with nothing pending and no raise open, the session loop's check
    re-enters the close on its own — no second signal is asked for or
    given; the user adds nothing: the wait gate (empty), the map read
    through the gateway and still fully decided, the closing gates
    classify afresh — review-001 incorporated with its report on disk,
    every commit since its dispatch carrying a drain marker, so the
    residue is empty and the classification is satisfied; no review
    gate renders, the wrap-up gate does, and the user says yes
11. the in-flight check finds nothing running; the final review step
    finds the row incorporated and the gate satisfied; document review
    reconciles the session against the file; the compliance check
    runs; the conclude gate renders and the user confirms; the
    conclusion marks the discussion complete (`topic complete`),
    commits, finds no leavings to sweep, and the walk stops at the
    bridge invocation

Further claims:

- the user wrapped up exactly once, before the review ran, and was
  never asked to again: no free-text question about concluding sits
  between the last finding's engagement and the resumed wait gate
- the second entry into the close is the loop's own — no
  `discussion-map set` precedes it, the map never left fully decided,
  and the wait gate renders a second time as the re-entry's first act
- both findings are surfaced through the engine one at a time; no
  finding is skipped, no batch screen renders for an ask-laned
  finding, and the row is never incorporated by hand
- the two engagements land as dated revisions on existing decided
  blocks, per the template's revision convention — never as new
  subtopics, never as edits to the original prose
- the mandatory-review variant renders once, before the review; the
  optional re-review offer never renders (the only movement since the
  review is its own drain)

EXPECTED WORLD — changed as follows:

- the discussion phase item for pay is completed
- the agent store holds one review row: review-001 incorporated, its
  findings F1 and F2 both surfaced, its report on disk
- the discussion file's Capture Confirmation and Failed Payment
  Retries blocks each carry a dated revision entry recording the
  amendment, their `#### Initial` prose unedited; the map holds the
  same three subtopics, all `decided`, and no others
- git history holds two engagement commits carrying the review-001
  drain markers, then the completion commit, all via the engine
