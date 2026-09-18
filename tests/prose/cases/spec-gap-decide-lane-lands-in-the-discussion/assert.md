The walk resumes a specification into its review and processes two gap
findings: one the record determines rides auto, and one the record
leaves open is held out of the per-finding walk, put to the user as a
veto batch, and landed in the discussion that should own it before the
specification re-aligns to it.

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
   gap-analysis tracking file with two findings; the orchestrator
   records the tracking entry `in-progress`, commits it, and renders
   the findings summary — two items, the file's Observations line
   neither counted nor carried into the summary
6. **Finding 1 (settled — how long an order waits for confirmation)**
   is disposed and stands settled: the specification's own delivery
   schedule and its exhaustion rule fix the wait between them, a
   decided rule whose consequence follows with no alternative. It is
   presented at the gate, leading with what is wrong for the customer
   and the call the record determines. The user answers `auto`: the
   finding is applied to the Capture Webhooks section, its Resolution
   set to Approved, `finding_gate_mode` set to `auto` on the manifest,
   and the work committed
7. **Finding 2 (staged settled — an order whose payment is never
   confirmed)** is disposed **before anything renders for it** and
   falls below the settled bar: its derivation is an analogy to the
   rejection rule in Payment Intent, which is consistency with the
   record rather than determination by it, and more than one answer
   fits — the order cancelled, or the order held. The fork is
   product-level (what the customer is left holding), so the move
   becomes `decide`: the session makes the call — the order stands as
   awaiting confirmation and the customer is told the payment is still
   confirming, with nothing cancelled on the checkout's own initiative
   — names what leaned (the specification's own decision that capture
   is confirmed out of band and never polled, so the flow is built for
   a confirmation that arrives after the customer has gone), and names
   the alternative that also fits the record (cancel when the
   re-deliveries are exhausted and show the payment-failed error the
   rejection rule already defines). The tracking row is rewritten
   before anything renders: Move `decide`, that Proposal, a Proposed
   Text for Capture Webhooks. The finding is then **held** — nothing
   is presented for it in the per-finding walk, and nothing of it
   lands in the specification yet
8. with no finding left to dispose, the walk reaches the decide batch.
   A payload of one item — the call and what leaned — is written to
   the topic's cache and rendered through the engine's finding-batch
   surface at the specification's address, lane `decide`; the mode
   holds `auto`, so its menu opens on the engine's auto-override line.
   **This stop overrides auto** — it is one of the calls
   auto never makes
9. the user answers yes, and the call lands in the owning document
   first. Presence is checked and no session holds the discussion, so
   the decision is written into the discussion as a **new subtopic
   section** in the template's subtopic shape — Context, Options
   Considered carrying the alternative that was weighed, Journey
   carrying the reasoning, and a Decision naming the held order and
   what the customer is told — with no dated timeline entry and no
   Initial wrapper, because there is no prior block to revise, and no
   map registration. The section speaks in the document's own voice,
   and nothing in it names the specification, a review, a tracking
   file or this session
10. the edited discussion is reindexed through the knowledge CLI; the
    sources-stale step is skipped — single-topic work has no sibling
    specs — and the resolution commits scoped to the discussion with
    the sweep shape (`--topic discussion/pay --kb --sweep`)
11. back in the batch the finding's Proposed Text lands in the
    specification's Capture Webhooks section, re-derived against the
    live document; the Resolution is set to `Routed` with Notes naming
    the discussion the decision landed in and the specification
    content re-aligned to it, and the specification and tracking file
    commit. The screen's landing is confirmed in one line
12. the lane is empty and every finding resolved, so the cycle-1
    gap-analysis tracking entry flips to `complete`
13. with `finding_gate_mode` `auto` and findings surfaced at cycle 1,
    the review runs a follow-up cycle without stopping — no re-loop
    gate renders in this world. Cycle 2's three agents all return
    clean through the stub, the review proceeds to completion,
    sign-off confirms, and the topic completes

Also true:

- exactly one `render finding` call is recorded in the whole walk —
  finding 1's gate. A second one means the decide finding was
  presented as a per-finding call, which is the walk the batch exists
  to replace, and the walk has failed
- the specification's Capture Webhooks section carries the 25-minute
  wait and the held-order rule, and never says the order is cancelled
  at the ceiling. A walk that wrote the cancellation in has taken an
  analogy for a determination and applied a decision nobody made
- the discussion gains one new subtopic section owning what happens to
  an order the gateway never confirms; the Gateway Integration and
  Refunds subtopics stand as they were, and no timeline entry appears
  anywhere in the document
- the tracking file's unconfirmed-order row ends with Move `decide`,
  Resolution `Routed`, a Proposal carrying the call, what leaned, and
  the alternative, a Proposed Text, and Notes naming where the
  decision landed. A row ending Move `settled` and Resolution
  Approved means it rode auto on an analogy
- the tracking file's waiting-window row ends with Move `settled` and
  Resolution Approved
- the user is stopped exactly twice in the review: at finding 1's gate
  and at the decide batch. No other stop lands, and the decide
  finding is never put to them as a numbered choice
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
  waiting window and the held-order rule; Payment Intent and Refunds
  stand as constructed
- the cycle-1 gap-analysis tracking file on disk with its two findings
  resolved — one Approved, one Routed — and its Observations line
  untouched; no claims or input tracking files for either cycle, and
  no gap-analysis tracking file for cycle 2, because clean reviews
  write none
- the manifest holding the specification completed with a date, the
  source incorporated, `review_cycle` at 2 with the construction
  baseline recorded, `finding_gate_mode` `auto`, and the cycle-1
  gap-analysis tracking entry `complete`; the discussion item
  untouched and still completed
- no planning, implementation, or review artifacts anywhere
