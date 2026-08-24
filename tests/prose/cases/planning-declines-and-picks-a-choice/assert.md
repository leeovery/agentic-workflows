The walk resumes a plan into its mid-review and processes two findings
through the two gate paths this case exists to pin: a Discuss exchange
that declines, and a choice menu.

Expected path:

1. the entry skill validates the spec and the phase, finds the plan in
   progress, and hands off to the processing skill
2. resume detection offers the choice and the user continues; session
   setup resets the gate modes to `gated`
3. the loop reads the in-progress tracking file, renders the findings
   summary (two pending rows), and presents **finding 1 (settled —
   order-id telemetry)** at the gate: the problem in product terms,
   the proposal with what determined it, the diff, and a gate whose
   prompt option is **Discuss**
4. the user pushes back through Discuss and asks for it to be left out,
   with their reason. The exchange concludes the finding should not
   land: the tracking file's Resolution becomes **Declined** with the
   reason in Notes, a one-line announcement is made, the work is
   committed — and the plan's capture task is **not** edited. Declined
   is never offered as a menu row; it lands only from this exchange
5. **finding 2 (choice — intent retry ownership)** renders as
   `MENU: finding choice`: numbered options, the recommendation first,
   **Comment** as the prompt option, and no `a/auto` row. No diff and
   no proposed content is shown — a choice proposes nothing
6. the user picks the option that is **not** recommended — mint a
   fresh intent per attempt and void the prior. That choice, and never
   the recommended reuse option, lands in the Phase 1 intent task; the
   tracking file's Resolution becomes Approved-equivalent for planning
   (**Fixed**) with the chosen option named in Notes; the work commits
7. with every row settled the tracking entry flips to `complete`, and
   the review runs a follow-up cycle: `review_cycle` moves to 2, both
   cycle-2 agents return clean through the stub, and the review
   concludes
8. the plan concludes: `topic complete`, the conclude commit, and the
   walk stops at the pipeline continuation without invoking the bridge

Also true:

- the capture-webhooks task text is unchanged — the declined finding's
  proposed telemetry line appears nowhere in the plan
- the intent task carries the fresh-intent-per-attempt behaviour, not
  the stored-intent reuse the recommendation proposed
- the tracking file ends with exactly one **Declined** row (reason
  recorded in Notes) and one **Fixed** row (option recorded in Notes);
  no row reads Pending or Skipped
- `finding_gate_mode` is never set to auto, and no auto-override
  announcement line appears — the walk is gated throughout, so there
  is no auto to override
- the user is never asked to approve the same finding twice, and no
  finding is presented after its row is settled
