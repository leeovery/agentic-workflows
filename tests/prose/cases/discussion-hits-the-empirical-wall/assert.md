The prose should have taken this path:

1. the entry resolves the topic from its arguments, reads the discussion
   status, finds it in progress, emits the resuming phase note, checks
   the reconcile flag (absent — silent), finds the carrier in the
   discovery session log, and hands off to the processing skill without
   asking the user anything
2. the process renders resume detection, the user continues, and
   initialisation is skipped — the session resumes on the existing
   document and map
3. the conversation goes at webhook timing, and the session recognises
   the point as this topic's own but settled only by measurement — no
   amount of talking answers whether the vendor's delivery claim holds.
   Per ask-or-decide the gate always asks: the session writes the gate
   payload, renders the experiment exit gate, and stops
4. the user takes the experiment route. The session documents the
   waiting point in the owning subtopic's section as a dated note and in
   the Summary's open threads, leaves the subtopic's map state where the
   conversation left it — **not** `deferred`, deferral is parked by
   choice and this point is blocked pending input — and commits the
   discussion artefacts with the waiting-on-experiment message
5. the session exits straight into the experiment entry with context hot
   — no bridge, no context clear — holding the point as the spawning
   point. The entry finds no experiment item, finds the carrier in the
   session log (so no interview), and hands off to the experiment
   process with a `Spawned from: discussion` line carrying the point
6. the experiment process initialises: reads the carrier, finds no
   completed research, registers the topic (`topic start`), commits, and
   opens the session on the empty register
7. the question arrives hot from the spawning point; the user confirms
   it is worth a run. The walk conceives E1 — and because the handoff
   carries the spawned-from line, it records the evidence wait
   immediately after the create and commits, so create and await land
   together
8. the design conversation is next — the user is out of time, says the
   design happens next sitting, and the walk stops at the next wait for
   the user. No design is recorded (`advance` never runs), nothing is
   approved, and neither the discussion nor the experiment topic is
   completed

Further claims:

- the waiting subtopic's map state is whatever the conversation reached,
  never `deferred`
- the wait is engine-owned: `awaiting_experiments` on the discussion
  item lists exactly `E1`, written by `experiment await`, never by hand
- the create→await→commit ordering holds — the wait is recorded in the
  same beat as the conceive, before any design work
- the discussion item stays `in-progress`; no conclude gate was rendered
  and no completion was attempted past the wait
- the experiment record is `conceived` with a kebab-case slug derived
  from the question; no design.md exists yet
- git history holds the discussion's waiting-note commit before the
  experiment topic's initialize and conceive commits

EXPECTED WORLD — the fixture plus: the discussion document carrying the
dated waiting note in the webhook-timing section and the Summary thread;
`phases.experiment.items.pay` at `in-progress` with one series record
(`E1`, status `conceived`, a kebab slug); `awaiting_experiments: ["E1"]`
on the discussion item; the discussion item still `in-progress`, its map
states unchanged except as the conversation moved them; and no
design.md, report.md, or record directory content on disk.
