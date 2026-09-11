The walk resumes a specification into its review and processes three
findings, disposing each staged move against the bar before it renders:
a settled call rides auto, a staged choice that is a preference nothing
leans on is declined at dispose and never rendered, and a choice that
clears the bar stops.

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
7. **Finding 2 (staged as a choice — the order of amount and card in
   the refund confirmation)** is disposed **before it renders**, and
   falls below the bar on the prong that makes it a preference: both
   spellings carry the same two facts, so no side costs the customer
   anything. The session does the search the agent never named — the
   discussion's Refunds decision (against the original intent, for 30
   days), its Gateway Integration and Quoted Total decisions, the
   specification's own sections, and the tree — and nothing leans: no
   source, specification decision, measurement, sibling artifact,
   precedent, or constraint prefers one order, and the premise that a
   customer is never charged a number they did not see governs the
   charge, not the wording of a credit. With nothing leaning there is
   no rule for the specification to state, so the finding is
   **declined**: the tracking row's Resolution set to `Declined`, the
   reason in Notes, the Move left as `choice` with its Options intact,
   the decline announced in one line, and the tracking file committed.
   **Nothing renders for it** — no `render finding`, no choice menu,
   no settled auto-apply, no auto-override line — and nothing lands in
   the specification. The walk returns to the loop and takes up the
   next finding. This is the behaviour the decline arm exists to give:
   a point the specification has no rule for never reaches the user
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
- the specification says nothing about a refund confirmation — not its
  wording, not the order of amount and card, in no section. A walk
  that wrote either ordering into the specification has stated a rule
  the record never gave it, whether it landed as an auto-applied
  settled call or as the user's pick, and has failed
- Gateway Integration carries the 24-hour reconciliation ceiling, never
  the three-attempt one. A walk that landed the recommendation instead
  has rubber-stamped a choice rather than presented it
- the tracking file's refund-confirmation row ends with Move `choice`,
  its Options intact, Resolution `Declined`, and Notes carrying the
  reason — nothing leans, no side costs the customer, the wording is
  the builder's. A row reading Approved, with an option noted or
  rewritten settled with a Proposal, means the walk rendered a finding
  the dispose owed a decline; a row still Pending means the walk
  skipped it without disposing it
- the tracking file's retry-ceiling row ends with Move `choice`,
  Resolution Approved, its Options intact, and a note naming the
  option chosen — the dispose discriminated: it declined the
  preference and let the genuine choice stand
- the tracking file's refund-window row ends Approved
- exactly two `render finding` calls are recorded in the whole walk —
  finding 1's and finding 3's — with the `finding_gate_mode auto`
  write between them. A third render, whatever its shape (a choice
  menu, a settled auto-apply, an auto-override line for the refund
  confirmation), means the walk presented a finding the dispose should
  have declined, and the walk has failed
- the user is stopped exactly twice in the review: at finding 1's gate
  and at finding 3's choice menu. No stop lands between them — the
  user is never asked about the refund confirmation
- nothing routes to a source: no `incoherence-gate` render, no
  presence scan, no reindex, no triage, no reopen. The declined
  finding is not a route — no measurement or sibling artifact pins it,
  so it belongs to no source document either
- the discussion document is untouched — no finding here indicts it
- the user is never asked to approve the same finding twice, and the
  gate never renders a second copy of a finding's heading beneath its
  own content
