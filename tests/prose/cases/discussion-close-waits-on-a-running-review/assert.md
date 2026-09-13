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
   check-for-results scans the store and finds only the three
   incorporated rows — nothing pending, nothing in flight, nothing to
   surface
5. the user asks for a fresh review of the document. Their request is
   the trigger: the movement backoff does not apply. Nothing settled is
   waiting to be written, the prior reviews are all drained, both
   queues are empty, and no wrap-up was signalled — so nothing blocks
6. the session dispatches the review with `--final` — review-004 —
   announces that the background review is dispatched, and does not
   wait on the agent. The stub holds its report back: the row stays in
   flight
7. the user says that covers it and asks to wrap up. The map is read
   through the gateway and comes back fully decided; the closing gates
   load; the triage queue is empty
8. classification finds review-004 in flight — review-running — and
   the mandatory review gate renders in its review-running shape: a
   review is still running, what it finds must be heard before
   concluding, nothing new is dispatched, and yes means waiting for
   it. No option offers to run a review, nothing on that screen says
   "final review", and there is no decline. The user, agreeable to
   required steps, says yes
9. the in-flight check scans, finds review-004 still running and
   dispatched this session, and — the wait already chosen at the gate
   it just came from — asks no second time: the in-flight agents gate
   (wait-or-proceed) never renders. The session waits for the result
10. the stub fires now — the report lands at review-004's path, the
    next scan promotes the row to pending — and surfacing delegates to
    the protocol: the report is clean, the row is acknowledged
    `--clean` and incorporated, the one-line "nothing new" note is
    emitted, and control returns to the session loop
11. the user says again that it covers it; the map comes back fully
    decided; the closing gates classify afresh: review-004 is
    incorporated with its report on disk, and no commit to the
    discussion file postdates its dispatch — satisfied, no judgment.
    No review gate renders; the wrap-up gate does, and the user says
    yes
12. the in-flight check finds nothing running; the final gap review
    step re-derives the same state — the highest row incorporated, its
    report present, no movement since — and returns satisfied without
    dispatching
13. document review reconciles the session against the file, the
    compliance check runs, and the conclusion marks the discussion
    complete (`topic complete`), commits, and the walk stops at the
    bridge invocation

Further claims:

- a review is dispatched exactly once in this walk, review-004,
  carrying `--final`; the final gap review step never dispatches
- the generic final-review gate (`--variant final-review`) never
  renders, and no closing-gate call carries a `--reason`
- the in-flight agents gate never renders — the review-running gate's
  yes is the whole of the wait decision
- the review-004 report is written after the review-running gate has
  rendered, never before; until then every scan reports the row in
  flight
- no finding is surfaced (the report is clean) and the map never
  moves — the user settled nothing

EXPECTED WORLD — changed as follows:

- the discussion phase item for pay is completed
- the agent store holds four review rows: review-001 to review-003 as
  the fixture left them, and review-004 incorporated with its clean
  report on disk
- the discussion file's decisions are untouched — no new subtopics, no
  rewritten decisions; at most document-review reconciliation and
  summary maintenance
- the completion commit landed via the engine
