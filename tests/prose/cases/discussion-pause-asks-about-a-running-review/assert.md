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
4. the session loop's mailbox check no-ops on an empty mailbox, the
   landed-input read finds no flag, and its check-for-results scans
   the store and finds it empty — nothing pending, nothing in flight,
   nothing to surface
5. the user asks for a review of the document. Their request is the
   trigger: the movement backoff does not apply. Nothing settled is
   waiting to be written, no earlier review exists, both mailboxes are
   empty, and the closing gates are neither next nor underway — so
   nothing blocks
6. the session dispatches the review with `--final` — review-001 —
   makes the agent call the dispatch composes, announces that the
   background review is dispatched, and does not wait on it. The stub
   holds its report back: the row stays in flight
7. the user says that covers it and asks to wrap up. The close opens:
   no calls to flush, the landed-input read finds no flag, and the
   wait gate is fetched before anything is deferred — it comes back
   populated: the blocker naming E1, its guidance, and the yes/keep
   menu, emitted verbatim. The map gate never runs and the closing
   gates never load
8. the user takes the pause. Before anything commits, signposts, or
   hands off, the in-flight check reads the store: review-001 is in
   flight and was dispatched this session, so nothing is closed as
   dead and the count is one
9. the in-flight agents gate is fetched with `--count 1` and `--pause`
   and its menu emitted verbatim — one background agent still working,
   the ask "Wait, or pause now?", waiting for results before pausing
   or pausing now with the results kept for the next session — and
   the walk stops there, the gate unanswered

Further claims:

- a review is dispatched exactly once in this walk, review-001,
  carrying `--final`
- the in-flight gate is the pause's: the fetch carries `--pause`, and
  no fetch without it — the conclusion's wording — happens
- nothing hands off: the pipeline bridge is never invoked, and no
  commit follows the wait gate's yes
- the store is only read after the dispatch: nothing is acknowledged,
  surfaced, or incorporated, and review-001 is still in flight when
  the walk stops
- the map never moves: no subtopic is added or set, and no completion
  is attempted

EXPECTED WORLD — changed as follows:

- the agent store holds one row, review-001, a review in flight, with
  no report at its content path
- the discussion phase item is still in progress and still awaits E1;
  the experiment series is as the fixture left it
- the discussion file is untouched
