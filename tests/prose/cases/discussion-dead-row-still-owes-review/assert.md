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
4. the session loop's triage check no-ops on an empty queue — no
   commit, nothing surfaced
5. the session loop's check-for-results runs the agent scan and finds
   only the incorporated review-001 row — nothing pending, nothing
   acknowledged, nothing to surface, no announce
6. the user signals the discussion covers it; the map is read through
   the gateway and comes back fully decided, and the closing gates
   load
7. classification does not stop at the row's status: review-001 is
   incorporated but has no report on disk — a killed dispatch closed
   as bookkeeping, never a review — so no review row has a report and
   the classification is never-reviewed. The decision write's commit
   is never read as movement from the dead row's timestamp
8. the mandatory review gate renders — a final gap review is owed, no
   skip available — and the user, agreeable to required steps, says
   yes. The optional gate (the offer of another final review, with its
   skip) never renders: had it been offered, this user would have
   skipped it and the discussion would have concluded with no review
   ever run
9. the in-flight check finds no running agents; the final gap review
   step re-derives the same state — the highest row is incorporated
   but reportless, so no review has ever completed — and dispatches
   review-002 as a foreground task; the stubbed report comes back
   clean; the scan promotes it and the clean ack incorporates it — the
   review gate is satisfied
10. document review reconciles the session against the file, the
    compliance check runs, and the conclusion marks the discussion
    complete (`topic complete`), commits, and the walk stops at the
    bridge invocation

Further claims:

- a review is dispatched exactly once in this walk, and it is
  review-002 — the dead row is never re-used, re-opened, or counted as
  the review pass
- review-001 stays inert throughout: never acknowledged, never
  surfaced, never treated as a running agent
- the gate the user answers for the review is the mandatory shape
  (proceed or keep going — no skip option), per their conduct of
  accepting required steps

EXPECTED WORLD — changed as follows:

- the discussion phase item for pay is completed
- the agent store holds two review rows: review-001 incorporated with
  no report on disk, review-002 incorporated with its clean report on
  disk
- the discussion file's decisions are untouched — no new subtopics, no
  rewritten decisions; at most document-review reconciliation and
  summary maintenance
- the completion commit landed via the engine
