The prose should have taken this path:

1. the skill reads the investigation status once and finds it already
   registered as in progress, so it resumes rather than gathering bug
   context — the resuming phase note, no interview
2. beneath the note, with the investigation file found, the resume
   choice is put to the user with no second heading of its own, and the
   user continues
3. symptom gathering is skipped — an earlier session already interviewed
   the user, and this one has nothing new to fold in
4. the plan step reads the ledger and recognises an agreed plan, so it
   re-renders the position rather than running recon again
5. **the board is fetched, never drawn.** A payload carrying the two
   hypotheses at their current statuses is written to the phase cache,
   then the engine renders it — the walk composes no board of its own
6. the rendered sections are emitted verbatim and the walk stops at the
   gate

Further claims:

- the ledger travels with its ids intact: H1 ruled out, H2 tracing, each
  carrying what the file records for it. No hypothesis is renumbered,
  invented, or dropped
- what is left is named — H2 mid-trace, the tax-context construction
  unread — rather than left for the user to infer
- no hypothesis changes status. This session has traced nothing yet; the
  board reports the position, it does not advance it
- recon does not re-run. No code is read to re-form hypotheses that are
  already on the ledger and agreed

EXPECTED WORLD — from an investigation interrupted mid-trace:

- the investigation file unchanged: same symptoms, same ledger, same
  statuses, no root cause
- a board payload in the phase cache, holding the ledger the render was
  given
- the investigation still registered as in progress, no other phase
  touched
