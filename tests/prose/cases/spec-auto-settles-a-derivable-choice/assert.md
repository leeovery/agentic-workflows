The walk resumes a specification into its review and processes three
findings, disposing every staged move against the bar before anything
renders: a settled call and a staged choice the record settles land
together on one screen, and a choice that clears the bar stops on its
own and lands its pick in the discussion first.

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
   time:
7. **Finding 1 (settled — the 30-day refund window)** stands settled:
   the discussion decides it, so the derivation is the record's own
8. **Finding 2 (staged as a choice — the quoted total on a
   re-render)** falls below the choice bar: the discussion ties the
   total's re-quote to exactly one event — the customer editing the
   cart by hand from the payment step — and a re-render with no hand
   edit is not that event, so the record determines the answer, a
   decided event whose consequence follows with no alternative: the
   quoted total holds across every re-render until the customer edits
   the cart. The session does the search the agent never named and
   finds the discussion's own principle (a customer is never charged
   a number they did not see) confirms it. It rewrites the tracking
   row: Move `settled`, a Proposal carrying that derivation and
   naming the hand-edit event as the one release, the Options
   removed, a Proposed Text stating the rule for the Quoted Total
   section
9. **Finding 3 (choice — the failed-webhook retry ceiling)** stands:
   the fork is what the customer gets (an order lost against an order
   held in limbo), nothing in the discussion, the specification, a
   measurement, or a precedent breaks the tie, each side visibly costs
   a customer, and the tie-break is appetite. Its row keeps Move
   `choice`
10. the settled batch renders once — a two-row payload at the
    specification's address with lane `settled`, carrying findings 1
    and 2 and what determined each. The gate is `gated`, so the screen
    carries its menu and the walk **STOPS**. Finding 2 appears here,
    not as a choice menu: the agent's staged choice was a proposal,
    not a verdict
11. the user answers `auto`: `finding_gate_mode` is set to `auto` on
    the manifest and the screen lands as a yes would — the windowed
    line into Refunds and the holds-across-a-re-render rule into
    Quoted Total, both Resolutions set to Approved, the work
    committed and the landing confirmed in one line
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
  Resolution `Routed`, its Options intact, and Notes naming the
  discussion and the option chosen — the dispose discriminated: it
  settled the derivable choice and let the genuine one stand
- the tracking file's refund-window row ends Move `settled` and
  Resolution Approved
- exactly one `render finding-batch` call is recorded, holding two
  rows, and exactly one `render finding` call, the choice's, after the
  `finding_gate_mode auto` write. A second `render finding` means a
  settled call was put to the user one at a time, or the derivable
  choice reached a menu it had no business reaching
- the user is stopped exactly twice in the review: at the settled
  batch screen and at finding 3's choice menu. No stop lands between
  them
- no finding is skipped or declined: the two settled rows end
  Approved, and the retry-ceiling row ends `Routed`
- the discussion gains exactly one new subtopic section, owning the
  retry ceiling. Nothing of the refund window or the quoted total's
  behaviour is written into it — the discussion's own decisions
  determine both, so they land in the specification alone
- no incoherence gate renders: the pick's landing enters the flow at
  its landing step, so nothing classifies, nothing routes to a triage
  queue, and no source is reopened
- the discussion item never leaves `completed`, and the specification
  never pauses
- cache and scratch files under `.workflows/.cache/` are expected
  working artifacts
