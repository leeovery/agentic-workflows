The walk resumes a specification into its review and processes three
findings, disposing every staged move against the bar before anything
renders: a call the record determines lands from the settled batch, a
staged choice that is a preference nothing leans on is declined and
never rendered, and a choice that clears the bar stops and lands its
pick in the discussion first.

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
6. **every finding is disposed before anything renders**, one at a
   time, and the three go three different ways:
7. **Finding 1 (settled — the 30-day refund window)** stands settled:
   the discussion decides it, so the derivation is the record's own.
   Its row stands as staged and it goes to the settled batch
8. **Finding 2 (staged as a choice — the order of amount and card in
   the refund confirmation)** falls below the bar on the prong that
   makes it a preference: both spellings carry the same two facts, so
   no side costs the customer anything. The session does the search
   the agent never named — the discussion's Refunds decision (against
   the original intent, for 30 days), its Gateway Integration and
   Quoted Total decisions, the specification's own sections, and the
   tree — and nothing leans: no source, specification decision,
   measurement, sibling artifact, precedent, or constraint prefers one
   order, and the premise that a customer is never charged a number
   they did not see governs the charge, not the wording of a credit. A
   preference no side of which costs the user is the builder's, so the
   specification states no rule for it and the finding is
   **declined**: the tracking row's Resolution set to `Declined`, the
   reason in Notes, the Move left as `choice` with its Options intact,
   the decline announced in one line, and the tracking file committed.
   **Nothing renders for it** — it never becomes a batch row and never
   reaches a menu — and nothing lands in the specification
9. **Finding 3 (choice — the failed-webhook retry ceiling)** stands:
   the fork is what the customer gets (an order lost against an order
   held in limbo), nothing in the discussion, the specification, a
   measurement, or a precedent breaks the tie, each side visibly costs
   a customer, and the tie-break is appetite. Its row keeps Move
   `choice`
10. with the lane disposed the walk reaches the settled batch, which
    holds finding 1 alone. A one-row payload is written to the topic's
    cache and rendered through the engine's finding-batch surface at
    the specification's address, lane `settled`. The gate is `gated`,
    so the screen carries its menu and the walk **STOPS**
11. the user answers `auto`: `finding_gate_mode` is set to `auto` on
    the manifest and the screen lands as a yes would — the windowed
    line replaces the bare one in Refunds, the Resolution is set to
    `Approved`, the work commits, and the landing is confirmed in one
    line
12. the settled lane is empty, so the walk takes the choices. Finding
    3 renders through the finding surface with move `choice` and
    **STOPS**, `auto` notwithstanding: its menu opens on the engine's
    auto-override line, then numbered options with the recommendation
    first and no `a/auto` row
13. the user picks the 24-hour reconciliation option — the one **not**
    recommended. The pick is a decision the discussion never made, so
    it lands there first: presence is checked, no session holds the
    discussion, and the decision is written into it as a **new
    subtopic section** in the template's subtopic shape — Context,
    Options Considered carrying the three-attempt alternative,
    Journey, and a Decision naming the 24-hour ceiling and the late
    reconciliation — with no dated timeline entry and no Initial
    wrapper, because there is no prior block to revise, and no map
    registration. The section speaks in the document's own voice and
    names neither the specification nor this session
14. the edited discussion is reindexed through the knowledge CLI; the
    sources-stale step is skipped — single-topic work has no sibling
    specs — and the resolution commits scoped to the discussion with
    the sweep shape (`--topic discussion/pay --sweep`)
15. the specification's Gateway Integration content is then composed
    from the pick and written, re-derived against the live document;
    the Resolution is set to `Routed` with Notes naming the discussion
    and the option chosen, the work commits, and the outcome is
    announced in one line
16. gap analysis runs third and returns clean through its stub; the
    cycle-1 input tracking entry flips to `complete`
17. with `finding_gate_mode` `auto` and findings surfaced, the review
    runs a follow-up cycle without stopping — no re-loop gate renders
    in this world. Cycle 2's three agents all return clean through the
    stubs, the review proceeds to completion, sign-off confirms, and
    the topic completes

Also true:

- the Refunds section carries the 30-day window
- the specification says nothing about a refund confirmation — not its
  wording, not the order of amount and card, in no section. A walk
  that wrote either ordering into the specification has stated a rule
  the record never gave it, whether it landed as a batch row
  documented on the user's behalf or as the user's pick, and has
  failed
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
  Resolution `Routed`, its Options intact, and Notes naming the
  discussion and the option chosen — the dispose discriminated: it
  declined the preference and let the genuine choice stand
- the tracking file's refund-window row ends Move `settled` and
  Resolution Approved
- exactly one `render finding-batch` call is recorded, and its screen
  holds one row — the refund window. A two-row screen means the
  decline was softened into a call made on the user's behalf, which
  lands the presentational fork in the specification by another door
- exactly one `render finding` call is recorded in the whole walk —
  finding 3's choice menu — and it falls after the
  `finding_gate_mode auto` write. A second render, whatever its shape,
  means the walk presented a finding the dispose should have declined
- the user is stopped exactly twice in the review: at the settled
  batch screen and at finding 3's choice menu. No stop lands between
  them — the user is never asked about the refund confirmation
- the discussion gains exactly one new subtopic section, owning the
  retry ceiling. Nothing of the refund window or the confirmation's
  wording is written into it
- no incoherence gate renders: the pick's landing enters the flow at
  its landing step, so nothing classifies, nothing routes to a triage
  queue, and no source is reopened. The declined finding is not a
  route either — no measurement or sibling artifact pins the wording,
  so it belongs to no source document
- the discussion item never leaves `completed`, and the specification
  never pauses
- cache and scratch files under `.workflows/.cache/` are expected
  working artifacts
