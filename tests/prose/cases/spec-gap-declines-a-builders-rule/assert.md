The walk resumes a specification into its review and processes three
gap findings, disposing every staged move against the bar before
anything renders: a call the record determines lands from the settled
batch, a staged settled whose whole substance is the builder's is
declined and never rendered, and a choice that clears the bar stops
even under auto and lands its pick in the discussion first.

Expected path:

1. the entry skill validates the source and the phase, finds the
   specification in progress, and hands off to the processing skill
2. resume detection offers the choice and the user continues, so
   initialisation is skipped: the walk lands in the review
3. session setup resets the gate modes to `gated` — the user's auto
   opt-in from any earlier sitting never carries across sessions
4. claims verification runs first and input review second; both return
   clean through their stub and write no tracking file
5. gap analysis runs third and its stub writes the cycle-1
   gap-analysis tracking file with three findings; the orchestrator
   records the tracking entry `in-progress`, commits it, and renders
   the findings summary — three items, the file's Observations line
   neither counted nor carried into the summary
6. **every finding is disposed before anything renders**, one at a
   time, and the three go three different ways:
7. **Finding 1 (settled — how long an order waits for confirmation)**
   stands settled: the specification's own delivery schedule and its
   exhaustion rule fix the wait between them, a decided rule whose
   consequence follows with no alternative. Its row stands as staged
   and it goes to the settled batch
8. **Finding 2 (staged settled — which of the audit line's two fields
   is written first)** is **declined**: its whole substance is the
   order two fields go out in, a detail any competent implementer
   settles the same way and one no customer ever sees either way, so
   it is the builder's and the specification has no rule to state for
   it — and its derivation, an analogy to the unmatched-delivery line,
   is consistency with the document rather than determination by it,
   so it could not have stood as a call on the record's authority
   either. The tracking row's Resolution is set to `Declined` with the
   reason in Notes, the Move left as staged, the decline announced in
   one line, and the tracking file committed. **Nothing renders for
   it** — it never appears as a batch row and never reaches a menu —
   and nothing lands in the specification
9. **Finding 3 (choice — whether a refund can be for part of an
   order)** stands: the fork is what the customer gets (money back for
   what they returned, against a refund that always matches what they
   were charged), nothing in the specification, the discussion, a
   measurement, or a precedent breaks the tie, each side visibly costs
   a customer, and the tie-break is appetite. Its row keeps Move
   `choice`
10. with the lane disposed the walk reaches the settled batch, which
    holds finding 1 alone. A one-item payload — the call and what
    determined it — is written to the topic's cache and rendered
    through the engine's finding-batch surface at the specification's
    address, lane `settled`. The gate is `gated`, so the screen
    carries its menu and the walk **STOPS**
11. the user answers `auto`: `finding_gate_mode` is set to `auto` on
    the manifest and the screen lands as a yes would — the
    waiting-window rule goes into Capture Webhooks, re-derived against
    the live document, the Resolution is set to `Approved`, the
    specification and tracking file commit, and the landing is
    confirmed in one line
12. the settled lane is empty, so the walk takes the choices. Finding
    3 renders through the finding surface with move `choice` and
    **STOPS**, `auto` notwithstanding: its menu opens on the engine's
    auto-override line, then numbered options with the recommendation
    first and no `a/auto` row
13. the user picks refunds down to a single line item — the option
    **not** recommended. The pick is a decision the discussion never
    made, so it lands there first: presence is checked, no session
    holds the discussion, and the decision is written into it as a
    **new subtopic section** in the template's subtopic shape —
    Context, Options Considered carrying the whole-order alternative,
    Journey, and a Decision naming per-line-item refunds — with no
    dated timeline entry and no Initial wrapper, because there is no
    prior block to revise, and no map registration. The section speaks
    in the document's own voice and names neither the specification
    nor this session
14. the edited discussion is reindexed through the knowledge CLI; the
    sources-stale step is skipped — single-topic work has no sibling
    specs — and the resolution commits scoped to the discussion with
    the sweep shape (`--topic discussion/pay --sweep`)
15. the specification's Refunds content is then composed from the pick
    and written, re-derived against the live document; the Resolution
    is set to `Routed` with Notes naming the discussion and the option
    chosen, the work commits, and the outcome is announced in one line
16. every finding is resolved, so the cycle-1 gap-analysis tracking
    entry flips to `complete`
17. with `finding_gate_mode` `auto` and findings surfaced at cycle 1,
    the review runs a follow-up cycle without stopping — no re-loop
    gate renders in this world. Cycle 2's three agents all return
    clean through the stub, the review proceeds to completion,
    sign-off confirms, and the topic completes

Also true:

- the specification says nothing about the order of the audit line's
  fields — not in Refunds, not anywhere. A walk that wrote either
  order in has stated a rule the record never gave it, whether it
  landed as a batch row documented on the user's behalf or as the
  user's pick, and has failed
- the specification's Capture Webhooks section carries the 25-minute
  waiting window
- Refunds carries refunds down to a single line item, never the
  whole-order-or-nothing rule. A walk that landed the recommendation
  instead has rubber-stamped a choice rather than presented it
- exactly one `render finding-batch` call is recorded, and its screen
  holds one row — the waiting window. A two-row screen means the
  decline was softened into a call made on the user's behalf, which
  lands the builder's detail in the specification by another door
- exactly one `render finding` call is recorded in the whole walk —
  finding 3's choice menu — and it falls after the
  `finding_gate_mode auto` write. A second render, whatever its shape,
  means the walk presented a finding the dispose owed a decline
- the tracking file's audit-line row ends with Resolution `Declined`,
  its Move left as staged, and Notes carrying the reason — the field
  order is the builder's, no side of it costs the customer. A row
  reading Approved or Routed means the walk rendered or landed a
  finding the dispose owed a decline; a row still Pending means the
  walk skipped it without disposing it
- the tracking file's partial-refunds row ends with Move `choice`,
  Resolution `Routed`, its Options intact, and Notes naming the
  discussion and the option chosen; the waiting-window row ends Move
  `settled` and Resolution Approved — the dispose discriminated across
  all three
- the user is stopped exactly twice in the review: at the settled
  batch screen and at finding 3's choice menu. No stop lands between
  them — the user is never asked about the audit line
- the Observations line is never walked, never counted, and never put
  to the user
- no incoherence gate renders: the choice's landing enters the flow at
  its landing step, so nothing classifies, nothing is routed to a
  triage queue, and no source is reopened. The declined finding is not
  a route either — no measurement or sibling artifact pins the field
  order, so it belongs to no source document
- the discussion item never leaves `completed`, and the specification
  never pauses
- cache and scratch files under `.workflows/.cache/` are expected
  working artifacts

EXPECTED WORLD — from a feature holding a completed discussion and a
constructed specification awaiting review:

- the specification's Capture Webhooks section carries the 25-minute
  waiting window, and its Refunds section carries per-line-item
  refunds alongside the 30-day window; the audit-log rule stands
  exactly as constructed, and Payment Intent is untouched
- the discussion gains one new subtopic section owning whether a
  refund can be for part of an order — down to a single line item —
  reasoned in the document's own voice, with the two original
  subtopics and the Summary intact and no timeline entry
- the cycle-1 gap-analysis tracking file on disk with its three
  findings resolved — Approved, Declined, Routed — and its
  Observations line untouched; no claims or input tracking files for
  either cycle, and no gap-analysis tracking file for cycle 2, because
  clean reviews write none
- the manifest holding the specification completed with a date, the
  source incorporated, `review_cycle` at 2 with the construction
  baseline recorded, `finding_gate_mode` `auto`, and the cycle-1
  gap-analysis tracking entry `complete`; the discussion item
  untouched and still completed
- no planning, implementation, or review artifacts anywhere
