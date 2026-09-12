The walk resumes a plan into its mid-review and processes two findings
through the two gate paths this case exists to pin — a Discuss exchange
that declines, and a choice menu — disposing each staged move against
the bar before it renders and moving neither.

Expected path:

1. the entry skill validates the spec and the phase, finds the plan in
   progress, and hands off to the processing skill
2. resume detection offers the choice and the user continues; session
   setup resets the gate modes to `gated`
3. the loop reads the in-progress tracking file and renders the findings
   summary (two pending rows). **Finding 1 (settled — a repeat delivery
   changes nothing)** is disposed before it renders and stands settled:
   its derivation holds — the specification's Capture Webhooks section
   decides that duplicate deliveries are idempotent, and the capture
   task says nothing of it. It is presented at the gate: the problem in
   product terms, the proposal with what determined it, the diff, and a
   gate whose prompt option is **Discuss**
4. the user pushes back through Discuss and asks for it to be left out,
   with their reason. The exchange concludes the finding should not
   land: the tracking file's Resolution becomes **Declined** with the
   reason in Notes, a one-line announcement is made, the work is
   committed — and the plan's capture task is **not** edited. Declined
   is never offered as a menu row; it lands only from this exchange
5. **Finding 2 (choice — what the customer sees while capture is
   pending)** is disposed before it renders and stands: the fork is
   what the customer gets (a confirmation that may be taken back,
   against a wait with no confirmation), nothing in the specification,
   the discussion, the plan's own conventions, or a measurement breaks
   the tie, each side visibly costs the customer, and the tie-break is
   appetite; the row names its search, so the session has none to run
   for it. Its row keeps Move `choice`, and only then does it render as
   `MENU: finding choice`: numbered options, the recommendation first,
   **Comment** as the prompt option, and no `a/auto` row. No diff and
   no proposed content is shown — a choice proposes nothing
6. the user picks the option that is **not** recommended — hold the
   customer on a payment-pending page until the capture webhook lands.
   That behaviour, and never the confirm-on-the-spot side the
   recommendation proposed, lands in the Phase 2 capture task; the
   tracking file's Resolution becomes Approved-equivalent for planning
   (**Fixed**) with the chosen option named in Notes; the work commits
7. with every row settled the tracking entry flips to `complete`, and
   the review runs a follow-up cycle: `review_cycle` moves to 2, both
   cycle-2 agents return clean through the stub, and the review
   concludes
8. the plan concludes: `topic complete`, the conclude commit, and the
   walk stops at the pipeline continuation without invoking the bridge

Also true:

- the capture task carries no idempotency sentence — the declined
  finding's proposed text appears nowhere in the plan
- the capture task carries the payment-pending-page behaviour, never
  the confirm-then-retract behaviour the recommendation proposed. A
  walk that landed the recommendation has rubber-stamped a choice
  rather than presented it
- the tracking file ends with exactly one **Declined** row (reason
  recorded in Notes, Move still `settled`) and one **Fixed** row (Move
  still `choice`, its Options intact, the option recorded in Notes); no
  row reads Pending or Skipped. A choice row rewritten to `settled` with
  a Proposal means the dispose demoted a fork that clears the bar
- `finding_gate_mode` is never set to auto, and no auto-override
  announcement line appears — the walk is gated throughout, so there
  is no auto to override
- the user is never asked to approve the same finding twice, and no
  finding is presented after its row is settled
