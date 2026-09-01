The prose should have taken this path:

1. the entry resolves the topic from its arguments, reads the
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
   the knowledge: a kebab slug is derived, the create allocates E1 and
   locks the discussion item with the evidence wait in the same
   transaction, the problem statement lands in the record's directory —
   plain terms plus a provenance line naming the discussion, the point,
   and the date; no design content — the waiting point is noted in the
   webhook-timing section as awaiting E1, and the discussion commit
   lands before the record's problem-statement commit
5. the now-or-later gate is fetched and its menu emitted verbatim; the
   user takes later, and the conversation continues where it left off
6. the refund-notification wrinkle is worked in the ordinary way: a new
   subtopic on the map, decided by the user, written up, committed —
   the experiment changes nothing about how the session works other
   material
7. the user asks to wrap up. The map is not all decided —
   webhook-timing is still open — so the defer gate renders and the
   user agrees to set it aside; the deferral lands with its Open
   Threads note and the deferral-marked commit. Deferring the subtopic
   does not release anything: the wait is the item's, not the map's
8. the closing gates run: the triage queue reads empty, then the
   evidence-wait check finds E1 still open and renders the wait gate —
   the blocker naming E1, the guidance, and the pause/keep menu — and
   stops. The conclude gate is never reached and no completion is
   attempted: the session never asks the engine to do what it would
   refuse
9. the user takes the pause; uncommitted session work is committed with
   the cadence commit, the session says where the ball sits — the
   closing ceremony waits for the evidence, the menu carries the route
   into E1 — and stops at the terminal condition

Further claims:

- the discussion item stays `in-progress` and carries
  `awaiting_experiments: ["E1"]` — written by the create transaction,
  never by hand
- the experiment item sits at `in-progress` with one record: E1,
  `conceived`, kebab slug; `problem.md` is the record directory's only
  document
- the map ends with retry-policy decided, the refund subtopic decided,
  and webhook-timing `deferred` by the gate — never by the session loop
- the document holds the refund decision written up in full, the dated
  awaiting-E1 note in the webhook-timing section, and no invented
  timing number anywhere
- no review walk blocked the close: the wait gate fired before the
  review classification, so whatever background review ran stayed
  background
- git history holds the spawn commit, the record commit, the refund
  decision's commit, and the deferral-marked commit

EXPECTED WORLD — the fixture plus: `phases.experiment.items.pay` at
`in-progress` with E1 `conceived` and its slug;
`awaiting_experiments: ["E1"]` on the still-in-progress discussion
item; `problem.md` under `experiment/pay/E1-{slug}/` with provenance
and no design content; the discussion document carrying the refund
decision, the awaiting note, and the deferred thread's Open Threads
entry; the map's webhook-timing subtopic `deferred` and a decided
refund subtopic added; no completion, no knowledge-base change.
