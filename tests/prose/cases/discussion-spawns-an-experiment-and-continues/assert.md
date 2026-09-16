The prose should have taken this path:

1. the entry resolves the topic from its arguments, asks the engine
   whether research is outstanding on the topic (it is not), reads the
   discussion status, finds it in progress, emits the resuming phase
   note, checks the reconcile flag (absent — silent), finds the carrier
   in the discovery session log, and hands off without asking the user
   anything
2. the process renders resume detection — the map with webhook-timing
   open — and the user continues; initialisation is skipped and the
   session resumes on the existing document and map
3. the conversation goes at webhook timing and surfaces the unmeasured
   vendor claim; the session recognises the laboratory's bar — the
   number is about to bear the window decision — and offers the
   experiment conversationally, declining named as valid
4. the user accepts. The spawn is recorded while the conversation holds
   the knowledge: the problem statement is written to the session's
   cache scratch — plain terms plus a provenance line naming the
   discussion, the point, and the date; no design content — then a
   kebab slug is derived and the create allocates E1, installs the
   scratch as the record's `problem.md`, and locks the discussion item
   with the evidence wait in the same transaction; the waiting point is
   noted in the webhook-timing section as awaiting E1, and the
   discussion commit lands before the record's problem-statement
   commit, which is sweep-marked: the experiment topic is the
   laboratory's slot, never the spawner's to claim
5. the now-or-later gate is fetched and its menu emitted verbatim; the
   user takes later, and the conversation continues where it left off
6. the refund-notification wrinkle is worked in the ordinary way: a new
   subtopic on the map, decided by the user, written up, committed —
   the experiment changes nothing about how the session works other
   material
7. the user asks to wrap up. The concluding ceremony fetches the wait
   gate before anything is deferred; it comes back populated over E1
   still open — the blocker naming E1, the guidance, and the yes/keep
   menu — emitted verbatim, and the session stops. No separate read of
   the wait precedes the fetch: the gate is the one call, empty when
   nothing is owed. The defer gate never appears and
   nothing is written `deferred`: deferral is a choice, and this point
   is blocked pending input. The closing gates are never loaded and no
   completion is attempted — the session never asks the engine to do
   what it would refuse
8. the user takes the pause; uncommitted session work is committed with
   the cadence commit, the session says where the ball sits — the
   closing ceremony waits for the evidence — and hands off to the
   pipeline bridge as a pause: the invocation carries the work unit,
   the phase discussion, the literal `none` for the next phase, and
   `paused`. Nothing tells the user to run /clear or /workflow-start
9. the bridge reads the work type — feature, not discovery, not epic —
   and runs its discovery gateway, whose output derives next_phase as
   experiment: the discussion is in progress behind a live evidence
   wait, and the experiment slot holds the record it waits on
10. the feature continuation's terminal check falls through and the
    pause routes straight to plan mode, revisitable phases or not: a
    paused phase revisits nothing and skips nothing. No next-phase gate
    renders, no completed banner renders
11. plan mode: the continuation resolves the plan template on the
    paused arm — the paused-on-a-wait line, never the completed line,
    never the revisiting line — and the resolved content lands as the
    world's plan-handoff artifact per the capture mechanism; the walk
    stops at the presentation, the flow's terminal handoff

Further claims:

- the plan-handoff artifact holds the template verbatim with its
  placeholders resolved: the title Continue Feature: pay, "The
  previous phase paused on a wait — the pipeline continues at what it
  waits on.", a Next Step invoking /workflow-experiment-entry feature
  pay with the arguments line, and the How to proceed block — and
  nothing else: no session learnings, no enrichment, no User
  instructions heading (the user attached none)
- no experiment entry was invoked and no experiment record moved past
  `conceived` — the handoff is content for the next context, not an
  action taken in this one

- the discussion item stays `in-progress` and carries
  `awaiting_experiments: ["E1"]` — written by the create transaction,
  never by hand
- the experiment item sits at `in-progress` with one record: E1,
  `conceived`, kebab slug; `problem.md` is the record directory's only
  document
- the map ends with retry-policy decided, the refund subtopic decided,
  and webhook-timing exactly where the conversation left it — never
  `deferred`, and no deferral-marked commit exists
- the document holds the refund decision written up in full, the dated
  awaiting-E1 note in the webhook-timing section, and no invented
  timing number anywhere
- no review walk blocked the close: whatever background review ran
  came back clean and raised nothing, so the wait gate was the first
  and only block the wrap-up met
- git history holds the spawn commit, the sweep-marked record commit,
  and the refund decision's commit

EXPECTED WORLD — the fixture plus: `phases.experiment.items.pay` at
`in-progress` with E1 `conceived` and its slug;
`awaiting_experiments: ["E1"]` on the still-in-progress discussion
item; `problem.md` under `experiment/pay/E1-{slug}/` with provenance
and no design content; the discussion document carrying the refund
decision and the awaiting note; the map's webhook-timing subtopic
still open (never `deferred`) and a decided refund subtopic added; no
completion, no knowledge-base change.
