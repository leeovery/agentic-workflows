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
4. the user asks for a fresh review of the document. Their request is
   the trigger: the movement backoff and the content conditions don't
   apply. Nothing the conversation settled is waiting to be written
   (the user decided nothing), the prior reviews are all drained, both
   queues are empty, and no wrap-up was signalled — so nothing blocks
5. the session dispatches the review with `--final` — the user's
   request outranks the movement backoff that would have refused a
   bare dispatch at 0 of 3 moves — announces that the background
   review is dispatched, and does not wait on the agent
6. the session replies to the user and the walk stops there

Further claims:

- exactly one dispatch is recorded and it carries `--final`
- the map never moves and the discussion file is never edited — the
  user settled nothing; the store simply gains a review-004 row with
  the stub's report on disk
- the automatic trigger stayed out of it: no dispatch was attempted
  bare, so no engine refusal was ever surfaced

EXPECTED WORLD — the fixture, with a review-004 row in the agent store
(stamped with the unchanged map) and the stub's report on disk.
Nothing else moved.
