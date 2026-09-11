The walk resumes a specification into its review and processes three
findings, disposing each staged move against the bar before it renders:
a settled call rides auto, a staged choice the record settles is
rewritten settled and rides auto too, and a choice that clears the bar
stops.

Expected path:

1. the entry skill validates the source and the phase, finds the
   specification in progress, and hands off to the processing skill
2. resume detection offers the choice and the user continues, so
   initialisation is skipped: the walk lands in the review
3. session setup resets the gate modes to `gated` — the user's auto
   opt-in from any earlier sitting never carries across sessions
4. claims verification runs first and returns clean through its stub,
   writing no tracking file
5. input review runs second and its stub writes the cycle-1 tracking
   file with three findings; the orchestrator records the tracking
   entry `in-progress` and renders the findings summary
6. **Finding 1 (settled — the 30-day refund window)** is disposed and
   stands settled: the discussion decides it. It is presented at the
   gate, leading with what is wrong for the product and the call the
   discussion determines. The user answers `auto`: the finding is
   applied to the Refunds section, its Resolution set to Approved,
   `finding_gate_mode` set to `auto` on the manifest, and the work
   committed
7. **Finding 2 (staged as a choice — the quoted total on a
   re-render)** is disposed **before it renders**, and falls below the
   bar: the discussion ties the total's re-quote to exactly one event
   — the customer editing the cart by hand from the payment step — and
   a re-render with no hand edit is not that event, so the record
   yields exactly one answer: the quoted total holds across every
   re-render until the customer edits the cart. The session does the
   search the agent never named and finds the discussion's own
   principle (a customer is never charged a number they did not see)
   confirms it. It rewrites the tracking row: Move `settled`, a
   Proposal carrying that derivation and naming the hand-edit event
   as the one release, the Options removed, a Proposed Text stating
   the rule for the Quoted Total section. Then it renders the finding
   with move `settled` under `auto`: the finding is applied to the
   Quoted Total section, its Resolution set to Approved, and announced
   in a line — **no stop, no choice menu, no auto-override line**.
   This is the behaviour the dispose exists to give: the agent's
   staged choice was a proposal, not a verdict
8. **Finding 3 (choice — the failed-webhook retry ceiling)** is
   disposed and stands: the fork is what the customer gets (an order
   lost against an order held in limbo), nothing in the discussion,
   the specification, a measurement, or a precedent breaks the tie,
   each side visibly costs a customer, and the tie-break is appetite.
   Its row keeps Move `choice`. Only then does it stop, `auto`
   notwithstanding: its menu opens on the engine's auto-override line,
   then numbered options with the recommendation first and no `a/auto`
   row. The user picks the 24-hour reconciliation option — the one
   **not** recommended — and that is what lands in Gateway
   Integration, with the Resolution set to Approved and a note naming
   the option chosen
9. gap analysis runs third and returns clean through its stub; the
   cycle-1 input tracking entry flips to `complete`
10. with `finding_gate_mode` `auto` and findings surfaced, the review
    runs a follow-up cycle without stopping — no re-loop gate renders
    in this world. Cycle 2's three agents all return clean through the
    stubs, the review proceeds to completion, sign-off confirms, and
    the topic completes

Also true:

- the Refunds section carries the 30-day window
- the Quoted Total section carries the rule that the quoted total holds
  across a re-render of the payment step — a return from a 3-D Secure
  challenge, a rate refresh, a reload — until the customer edits the
  cart, in the specification's own voice; it never says the total
  re-quotes on every re-render
- Gateway Integration carries the 24-hour reconciliation ceiling, never
  the three-attempt one. A walk that landed the recommendation instead
  has rubber-stamped a choice rather than presented it
- the tracking file's quoted-total row ends with Move `settled`,
  Resolution Approved, a Proposal whose derivation names the hand edit
  as the discussion's one re-quote event, a Proposed Text, and no
  Options — a row still reading Move `choice` with an option noted in
  Notes means the walk stopped on a call the record had already made
- the tracking file's retry-ceiling row ends with Move `choice`,
  Resolution Approved, its Options intact, and a note naming the
  option chosen — the dispose discriminated: it settled the derivable
  choice and let the genuine one stand
- the user is stopped exactly twice in the review: at finding 1's gate
  and at finding 3's choice menu. No stop lands between them
- no finding is skipped or declined: every row in the tracking file
  ends Approved
- nothing routes to a source: no `incoherence-gate` render, no
  presence scan, no reindex, no triage, no reopen. All three findings
  belong to the specification — the quoted-total derivation comes from
  the discussion's own decision and lands in the spec, never back in
  the discussion
- the discussion document is untouched — no finding here indicts it
- the user is never asked to approve the same finding twice, and the
  gate never renders a second copy of a finding's heading beneath its
  own content
