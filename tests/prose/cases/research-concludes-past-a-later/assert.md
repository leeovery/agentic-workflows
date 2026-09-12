The prose should have taken this path:

1. the entry resolves the topic from its arguments, reads the research
   status, finds it in progress, emits the resuming phase note, checks
   the reconcile flag (absent — silent), and hands off to the processing
   skill without asking the user anything
2. the process reads the status again, finds the file, renders the
   thread register once above resume detection, and the user continues;
   initialisation is skipped
3. the walk routes into the epic research session; the loop's first
   check finds the queue holding one concern and the sitting freshly
   opened, so the triage announce renders and the session opens from
   its own material without offering yet
4. the user asks what is waiting — that is the user asking for the
   queue, which satisfies the first offer's deferral — and the offer
   renders; the user says later
5. the user says their one thing (the metric they are taking forward),
   which the session documents and commits; then the user says they are
   done, and the wrapper routes to its conclusion handling: the fold
   check finds nothing landed, nothing is in flight, and the walk enters
   topic completion, whose first act is the queue check — it reads one
   entry and renders the blocker, returning to the session loop
6. back in the loop, the triage check judges the break: the user
   chose `later` one turn ago, and the checklist's deferral would hold —
   except the user is now concluding, which is the break the deferral
   was waiting for; the offer renders again in the same turn, and the
   turn ends awaiting the user, where the walk stops

Claims — the conclusion reading of the triage check is the behaviour
under test:

- the blocker and the re-offer land in the same turn: the user is never
  shown a red blocker naming a queue and then left with nothing to
  answer
- nothing concludes: no wait gate, no conclude gate, no completion — the
  queue owns the close
- the concern is neither absorbed nor requeued: the walk stops at the
  offer, and the register is untouched
- no dive, no review, no experiment is dispatched or offered anywhere

EXPECTED WORLD — the fixture plus the user's remark documented in the
research file and committed; the queue entry still present; the register
unchanged; the research item still `in-progress`.
