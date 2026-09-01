The prose should have taken this path:

1. the entry resolves the topic from its arguments, reads the research
   status, finds it in progress, emits the resuming phase note, checks
   the reconcile flag (absent — silent), and hands off to the
   processing skill without asking the user anything; the epic context
   arm reads the map item's source, finds it map-shaped rather than
   direct-start, and gathers nothing
2. the process reads the status again, finds the file, renders resume
   detection, and the user continues; initialisation is skipped
3. the walk passes through file strategy and the guidelines, addresses
   the knowledge base once as a contextual query, and routes into the
   epic research session; the session loop's triage check reads the
   queue and finds it empty
4. the conversation goes at the recovery number, and the session
   recognises the laboratory's bar is met — a controlled measurement
   would settle the replacement choice, not merely inform it — so it
   offers the experiment conversationally, in its own words: never a
   script, never a menu, with the inline-measurement alternative named
   and declining valid
5. the user accepts. The spawn is recorded right there: the session
   derives a kebab slug and creates the record — the engine allocates
   E1, and the same transaction locks the research item with the
   evidence wait
6. the problem statement is written to the record's directory: the
   problem in plain terms — what to pick or learn, the space, what is
   hoped — closing with a provenance line naming the synonym-handling
   research, the point, and the date. It carries **no design content**:
   no hypothesis, no prediction, no decision rule, no setup — those are
   the laboratory's
7. the session notes the handed-off question in the research file as
   the waiting point awaiting E1, commits the research topic with the
   spawn message, then commits the experiment record sweep-marked — the
   laboratory's slot is never the spawner's to claim — two commits, in
   that order
8. the now-or-later gate is fetched from the engine and its menu
   emitted verbatim; the user takes now
9. the session pauses mid-phase with no closing ceremony — no final
   review, no document review, no completion attempt — says where the
   ball sits (E1 queued, the menu carries the way in, fresh context via
   /clear then /workflow-start), and stops at the terminal condition

Further claims:

- the research item stays `in-progress` and gains
  `awaiting_experiments: ["E1"]` — the wait is engine-owned, written by
  the create transaction, never by hand
- the experiment item exists at `in-progress` with exactly one record:
  E1, status `conceived`, a kebab-case slug derived from the problem
- the record's directory holds `problem.md` and nothing else — no
  design.md, no report.md
- the research document gained the waiting-point note and its
  substance is otherwise unchanged; no conclusion was written
- nothing was measured: the sandbox log was not scored, and no number
  entered the research file as a result
- git history holds the research topic's spawn commit before the
  experiment record's problem-statement commit
- no deep-dive was dispatched and nothing was rerouted or triaged

EXPECTED WORLD — the fixture plus: the synonym-handling research item
`in-progress` carrying `awaiting_experiments: ["E1"]`; a
`phases.experiment.items.synonym-handling` item at `in-progress` whose
series holds E1 `conceived` with its slug; `problem.md` on disk under
`experiment/synonym-handling/E1-{slug}/` with the provenance line and
no design content; the research file carrying the awaiting-E1 note; and
no change to the other topics, the map, or the discussion phase.
