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
4. the session loop's triage check no-ops on an empty queue — no
   commit, nothing surfaced
5. the session loop's check-for-results runs the agent scan and finds
   an empty store — nothing pending, nothing acknowledged, nothing to
   surface, no announce
6. the user signals the discussion covers it; the map is read through
   the gateway and comes back fully decided, and the closing gates
   load
7. classification finds no review row at all — never-reviewed — and
   the mandatory review gate renders: a final gap review is owed, no
   decline available; the user, agreeable to required steps, says yes.
   The optional gate (the offer of one more review) never renders
8. the in-flight check finds no running agents; the final gap review
   step re-derives the same state and dispatches review-001 as a
   foreground task, carrying `--final`; the stubbed report comes back
   with two gaps, F1 and F2, both ask-laned
9. the final review menu reference scans (the row promotes to
   pending), reads the report in full, acknowledges the row with both
   finding ids, and fetches the drain offer from the engine — the
   menu renders with the row's own count, two findings still to walk,
   and the review/skip pair; it names no final review; the announce is
   recorded and the walk stops for the user
10. the user, done for today, chooses skip: the row is incorporated
    with both findings unsurfaced — nothing is raised, no finding
    screen renders, the report stays on disk — and the review gate is
    satisfied
11. document review reconciles the session against the file, the
    compliance check runs, and the conclusion marks the discussion
    complete (`topic complete`), commits, and the walk stops at the
    bridge invocation

Further claims:

- a review is dispatched exactly once in this walk, and it is
  review-001, carrying `--final` (the mandatory closing pass)
- the drain offer is engine-rendered — the walk fetches
  `render review-findings-gate` and emits what came back; it never
  composes the menu by hand, and nothing put on screen for that gate
  says "final review"
- neither finding is surfaced: no `agent surface`, no finding
  presentation, no batch screen; the skip closes the row with F1 and
  F2 still unsurfaced
- the discussion's three decisions are never reopened or amended on
  the strength of the unwalked findings

EXPECTED WORLD — changed as follows:

- the discussion phase item for pay is completed
- the agent store holds one review row: review-001 incorporated, its
  findings F1 and F2 recorded, neither surfaced, its report on disk
- the discussion file's decisions are untouched — no new subtopics, no
  rewritten decisions; at most document-review reconciliation and
  summary maintenance
- the completion commit landed via the engine
