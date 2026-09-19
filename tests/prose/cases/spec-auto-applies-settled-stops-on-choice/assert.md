The walk resumes a specification into its review and processes three
findings across both moves the walk presents: two settled calls that
land together on one screen, and a choice that stops on its own
afterwards and lands its pick in the discussion before the
specification re-aligns to it.

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
6. **every finding is disposed before anything renders.** Finding 1
   (the 30-day refund window) and finding 2 (partial refunds) both
   stand settled — the discussion's Refunds decision states each
   answer, so both derivations are the record's own. Finding 3 (the
   failed-webhook retry ceiling) is re-derived against the bar and
   stands as a choice: the fork is what the customer gets (an order
   lost against an order held in limbo), nothing in the discussion,
   the specification, a measurement, or a precedent breaks the tie,
   each side visibly costs a customer, and the tie-break is appetite.
   Its row keeps Move `choice` and nothing is rewritten settled
7. the settled batch renders once — a two-row payload at the
   specification's address with lane `settled`, each row the call and
   what determined it. The gate is `gated`, so the screen carries its
   menu and the walk **STOPS**. No finding is put to the user on its
   own here: a settled call at the specification has no gate but this
   screen
8. the user answers `auto`: `finding_gate_mode` is set to `auto` on
   the manifest and the screen lands as a yes would — both findings
   applied to the Refunds section, re-derived against the live
   document so the second lands on top of the first rather than
   reverting it, both Resolutions set to Approved, the work committed
   and the landing confirmed in one line
9. the settled lane is empty, so the walk takes the choices. Finding
   3 renders through the finding surface with move `choice` and
   **STOPS**, `auto` notwithstanding, because only the user can pick.
   Its menu opens on the engine's auto-override line, then numbered
   options with the recommendation first and no `a/auto` row
10. the user picks the 24-hour reconciliation option — the one **not**
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
11. the edited discussion is reindexed through the knowledge CLI; the
    sources-stale step is skipped — single-topic work has no sibling
    specs — and the resolution commits scoped to the discussion with
    the sweep shape (`--topic discussion/pay --kb --sweep`)
12. the specification's Gateway Integration content is then composed
    from the pick and written, re-derived against the live document;
    the Resolution is set to `Routed` with Notes naming the discussion
    and the option chosen, the work commits, and the outcome is
    announced in one line
13. gap analysis runs third and returns clean through its stub; the
    cycle-1 input tracking entry flips to `complete`
14. with `finding_gate_mode` `auto` and findings surfaced, the review
    runs a follow-up cycle without stopping — no re-loop gate renders
    in this world. Cycle 2's three agents all return clean through the
    stubs, the review proceeds to completion, sign-off confirms, and
    the topic completes

Also true:

- the specification's Refunds section ends up carrying both the
  30-day window and per-line-item partial support — the two settled
  findings both landed, from one screen and one answer
- Gateway Integration carries the 24-hour reconciliation ceiling, never
  the three-attempt one. A walk that landed the recommendation instead
  has rubber-stamped a choice rather than presented it
- exactly one `render finding-batch` call is recorded, holding two
  rows, and exactly one `render finding` call, the choice's, after the
  `finding_gate_mode auto` write. A `render finding` call for either
  settled finding means a call already made was put to the user one at
  a time, which is the walk the batch exists to replace
- no finding is skipped or declined: the two settled rows end
  Approved, and the retry-ceiling row ends `Routed`
- the retry-ceiling row still reads Move `choice` at the end, with its
  Options intact and no Proposal — a walk that rewrote it settled and
  swept it into the batch has demoted a choice the bar holds, which is
  the failure the dispose exists to refuse in that direction
- the discussion gains exactly one new subtopic section, owning the
  retry ceiling. Nothing of the refund window or partial refunds is
  written into it — the discussion already decides both, so those are
  the specification's alone
- no incoherence gate renders: the pick's landing enters the flow at
  its landing step, so nothing classifies, nothing routes to a triage
  queue, and no source is reopened
- the discussion item never leaves `completed`, and the specification
  never pauses
- the user is stopped exactly twice in the review: at the settled
  batch screen and at the choice menu
- cache and scratch files under `.workflows/.cache/` are expected
  working artifacts
