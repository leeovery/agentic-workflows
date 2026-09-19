The walk resumes a specification into its review and lands three
settled findings through the batch screen — the first screen gated,
where the user hands the rest over, the second under auto with no stop.
Two of the three are the record's own call and change the specification
alone; the third is the session's call, and it lands in the discussion
that should own it before the specification re-aligns to it.

Expected path:

1. the entry skill validates the source and the phase, finds the
   specification in progress, and hands off to the processing skill
2. resume detection offers the choice and the user continues, so
   initialisation is skipped: the walk lands in the review
3. session setup resets the gate modes to `gated` — the user's auto
   opt-in from any earlier sitting never carries across sessions
4. claims verification runs first and returns clean through its stub,
   writing no tracking file
5. input review runs second and its stub writes the cycle-1 input
   tracking file with one finding; the orchestrator records the
   tracking entry `in-progress`, commits it, and renders the findings
   summary
6. **Finding 1 (settled — the missing 30-day refund window)** is
   disposed and stands settled: the discussion's Refunds decision
   states the answer, so the derivation is the record's own. Nothing
   renders for it on its own — a settled finding at the specification
   has no gate of its own; it goes to the batch
7. with the lane disposed the walk reaches the settled batch. A
   payload of one item — the call and what determined it — is written
   to the topic's cache and rendered through the engine's
   finding-batch surface at the specification's address, lane
   `settled`. The gate is `gated`, so the screen carries its menu and
   the walk **STOPS**
8. the user answers `auto`: `finding_gate_mode` is set to `auto` on
   the manifest and the screen lands as a yes would — the 30-day
   window replaces the bare Refunds line in the specification, the
   Resolution is set to `Approved`, the specification and tracking
   file commit, and the landing is confirmed in one line. The lane is
   empty and every finding resolved, so the cycle-1 input tracking
   entry flips to `complete`
9. gap analysis runs third and its stub writes the cycle-1
   gap-analysis tracking file with two findings; the tracking entry
   records `in-progress`, commits, and the findings summary
   renders — two items, the file's Observations line neither counted
   nor carried into the summary
10. **Finding 1 (settled — how long an order waits for confirmation)**
    is disposed and stands settled on the record's own derivation: the
    specification's delivery schedule and its exhaustion rule fix the
    wait between them, a decided rule whose consequence follows with
    no alternative
11. **Finding 2 (staged settled — an order whose payment is never
    confirmed)** is disposed **before anything renders for it** and
    stands settled as a call **this session** makes rather than one
    the record determines: its staged derivation is an analogy to the
    rejection rule in Payment Intent, which is consistency with the
    record rather than determination by it, and more than one answer
    fits — the order cancelled, or the order held. The session makes
    the call — the order stands as awaiting confirmation and the
    customer is told the payment is still confirming, with nothing
    cancelled on the checkout's own initiative — names what leaned
    (the specification's own decision that capture is confirmed out of
    band and never polled, so the flow is built for a confirmation
    that arrives after the customer has gone), and names the
    alternative that also fits the record (cancel when the
    re-deliveries are exhausted and show the payment-failed error the
    rejection rule already defines). The tracking row is rewritten
    before anything renders: Move `settled`, that Proposal, a Proposed
    Text for Capture Webhooks
12. with both findings disposed the walk reaches the settled batch
    again and writes a two-item payload. `finding_gate_mode` now holds
    `auto`, so the surface answers with its auto-approved display
    alone — the worklist closed by a line in the present tense,
    saying it is documenting them, because the landings come after it
    — no menu, no auto-override line, **no stop**. The walk emits it
    and lands both findings in the order they read
13. the waiting-window finding is the record's own call, so it lands
    in the specification alone: its Proposed Text goes into Capture
    Webhooks, re-derived against the live document, and its Resolution
    is set to `Approved`
14. the unconfirmed-order finding is the session's call, so it lands
    in the owning document first. Presence is checked and no session
    holds the discussion, so the decision is written into the
    discussion as a **new subtopic section** in the template's
    subtopic shape — Context, Options Considered carrying the
    alternative that was weighed, Journey carrying the reasoning, and
    a Decision naming the held order and what the customer is told —
    with no dated timeline entry and no Initial wrapper, because there
    is no prior block to revise, and no map registration. The section
    speaks in the document's own voice, and nothing in it names the
    specification, a review, a tracking file or this session
15. the edited discussion is reindexed through the knowledge CLI; the
    sources-stale step is skipped — single-topic work has no sibling
    specs — and the resolution commits scoped to the discussion with
    the sweep shape (`--topic discussion/pay --kb --sweep`)
16. back in the batch the finding's Proposed Text lands in the
    specification's Capture Webhooks section, re-derived against the
    live document; the Resolution is set to `Routed` with Notes naming
    the discussion the decision landed in and the specification
    content re-aligned to it, and the specification and tracking file
    commit for the screen
17. the lane is empty and every finding resolved, so the cycle-1
    gap-analysis tracking entry flips to `complete`
18. with `finding_gate_mode` `auto` and findings surfaced at cycle 1,
    the review runs a follow-up cycle without stopping — no re-loop
    gate renders in this world. Cycle 2's three agents all return
    clean through the stub, the review proceeds to completion,
    sign-off confirms, and the topic completes

Also true:

- no `render finding` call is recorded anywhere in the walk. A
  settled finding at the specification is gated by its batch screen
  and nothing else, and this user asked for nothing to be expanded —
  a `render finding` call means a settled call was put to them one at
  a time, which is the walk the batch exists to replace
- two `render finding-batch` calls are recorded, both at
  `pay.specification.pay` with lane `settled`: the first carrying its
  menu and stopping, the second answering with the auto-approved
  display and not stopping. A second stop after the opt-in means auto
  did not take
- the specification's Refunds section carries the 30-day window
- the specification's Capture Webhooks section carries the 25-minute
  wait and the held-order rule, and never says the order is cancelled
  at the ceiling. A walk that wrote the cancellation in has taken an
  analogy for a determination and applied a decision nobody made
- the discussion gains one new subtopic section owning what happens to
  an order the gateway never confirms; the Gateway Integration and
  Refunds subtopics stand as they were, and no timeline entry appears
  anywhere in the document. Nothing of the refund window or the
  waiting window is written into the discussion — the record already
  determines both, so they belong to the specification alone
- the input tracking file's refund-window row ends with Move `settled`
  and Resolution Approved
- the gap tracking file's waiting-window row ends with Move `settled`
  and Resolution Approved; its unconfirmed-order row ends with Move
  `settled`, Resolution `Routed`, a Proposal carrying the call, what
  leaned, and the alternative, a Proposed Text, and Notes naming where
  the decision landed. A row ending Approved with nothing in the
  discussion means the walk applied a call the source never made to
  the specification alone
- the user is stopped exactly once inside the review's finding
  processing: at the first batch screen. The second screen does not
  stop, no finding is ever put to them as a numbered choice, and no
  re-loop gate renders — the only stops left in the walk are the
  resume choice before it and sign-off after it
- the Observations line is never walked, never counted, and never put
  to the user
- nothing runs the incoherence flow's classification: the batch's
  landing enters at the landing step, so no incoherence gate renders
  and no gap is routed to a triage queue
- the discussion item never leaves `completed` — no reopen, no triage
  landing; the specification never pauses
- cache and scratch files under `.workflows/.cache/` are expected
  working artifacts

EXPECTED WORLD — from a feature holding a completed discussion and a
constructed specification awaiting review:

- the discussion carries a new subtopic section deciding what becomes
  of an order whose payment is never confirmed — the order held
  awaiting confirmation, the customer told it is still confirming —
  reasoned in the document's own voice, with the two original
  subtopics and the Summary intact and no timeline entry
- the specification's Capture Webhooks section carries the 25-minute
  waiting window and the held-order rule; Refunds carries the 30-day
  window alongside the audit-log rule; Payment Intent stands as
  constructed
- the cycle-1 input tracking file on disk with its one finding
  Approved, and the cycle-1 gap-analysis tracking file with its two
  findings resolved — one Approved, one Routed — and its Observations
  line untouched; no claims tracking file for either cycle, and no
  cycle-2 tracking files, because clean reviews write none
- the manifest holding the specification completed with a date, the
  source incorporated, `review_cycle` at 2 with the construction
  baseline recorded, `finding_gate_mode` `auto`, and both cycle-1
  tracking entries `complete`; the discussion item untouched and still
  completed
- no planning, implementation, or review artifacts anywhere
