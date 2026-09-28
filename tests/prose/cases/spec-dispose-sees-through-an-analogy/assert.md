The walk resumes a specification into its review and meets one finding
the gap analysis staged `settled` on an analogy: an exhausted capture
delivery read as the same failure as a rejection at creation, so the
order is cancelled. An analogy is consistency with the record, not
determination by it, so the call is never the record's own — the
session makes it itself or puts the fork to the user — and either way
it lands in the discussion that should own it before the specification
re-aligns. The staged cancellation never goes into the specification on
the record's authority.

Expected path:

1. the entry skill validates the source and the phase, finds the
   specification in progress, and hands off to the processing skill
2. resume detection offers the choice and the user continues, so
   initialisation is skipped: the walk lands in the review. Session
   setup resets both gate modes to `gated`
3. cycle 1 initialises: `review_cycle` is set to 1 and the
   construction baseline word count recorded with it, in the same
   write, and the manifest committed
4. claims verification runs first and input review second; both
   return clean through their stub and write no tracking file
5. gap analysis runs third and its stub writes the cycle-1
   gap-analysis tracking file with one finding; the orchestrator
   records the tracking entry `in-progress`, commits it, and renders
   the findings summary — one item
6. **the finding is disposed before anything renders for it**, and the
   analogy is seen for what it is: its derivation reads the rejection
   rule forward onto ground the record never decided, which is
   consistency with the record rather than determination by it, so the
   row is never kept as the record's own call. The disposal writes its
   reasoning down and takes one of the two moves the bar allows:
   - **the session makes the call itself** — no source states what
     becomes of the order, and first principles over the
     specification's capture rules lean it: capture is confirmed by
     webhook, never by polling, and an exhausted delivery leaves the
     payment unconfirmed, not failed, so the order is held and the
     customer told the payment is still confirming. The row's Proposal
     is rewritten as the session's call, naming what leaned and the
     cancellation as the alternative that also fits, with a Proposed
     Text for the held order; or
   - **the fork is irreducible** — both outcomes cost a customer
     something and nothing in the record breaks the tie — and the row
     is rewritten as a `choice`, its Options the held order and the
     cancellation, the search named
7. the finding takes exactly one stop, by its move: a session call
   renders on the settled batch screen, which is `gated`, and the walk
   **STOPS**; the user answers `yes`. A choice renders alone at the
   finding surface with its numbered sides and the walk **STOPS**; the
   user picks the held order
8. either way the decision is one the discussion never made, so it
   lands there first. Presence is checked and no session holds the
   discussion, so the decision is written into it as a **new subtopic
   section** in the template's subtopic shape — Context, Options
   Considered carrying the cancellation as the alternative weighed,
   Journey, and a Decision naming the held order and what the customer
   is told — with no dated timeline entry, no Initial wrapper, and no
   map registration. The section speaks in the document's own voice,
   and nothing in it names the specification, a review, a tracking
   file or this session
9. the edited discussion is reindexed through the knowledge CLI; the
   sources-stale step is skipped — single-topic work has no sibling
   specs — and the resolution commits scoped to the discussion with
   the sweep shape (`--topic discussion/pay --sweep`)
10. the held-order rule lands in the specification's Capture Webhooks
    section, re-derived against the live document; the row records
    `Routed` with Notes naming the discussion the decision landed in,
    and the specification and tracking file commit
11. no finding remains, so the cycle-1 gap-analysis tracking entry
    flips to `complete`
12. findings were surfaced and the mode is `gated`, so the convergence
    analysis is reached and returns without a diagnostic — one cycle
    of tracking data is below its threshold — and the re-loop gate
    renders. The walk **STOPS**; the user proceeds to completion,
    sign-off confirms, and the topic completes. The walk stops at the
    pipeline continuation without invoking the bridge

Also true:

- the specification never says the order is cancelled at the ceiling,
  and the finding's row never ends `Approved`. An Approved row with the
  cancellation in Capture Webhooks means the walk took the analogy for
  the record's own determination and wrote a decision nobody made into
  the specification
- the row ends Move `settled` with a Proposal carrying the session's
  call, what leaned and the alternative, or Move `choice` with its
  Options and the search named — Resolution `Routed` either way
- the discussion gains exactly one new subtopic section owning what
  becomes of an order the gateway never confirms; the Gateway
  Integration and Refunds subtopics stand as they were, and no timeline
  entry appears anywhere in the document
- `finding_gate_mode` is never set to `auto`, and no auto-override line
  appears
- the user is stopped exactly four times: the resume choice, the
  finding's one stop, the re-loop gate, and sign-off
- no incoherence gate renders, nothing routes to a triage queue, and no
  source is reopened; the discussion item never leaves `completed`, and
  the specification never pauses
- cache and scratch files under `.workflows/.cache/` are expected
  working artifacts

EXPECTED WORLD — from a feature holding a completed discussion and a
constructed specification awaiting review:

- the discussion carries a new subtopic section deciding what becomes
  of an order whose payment is never confirmed — the order held
  awaiting confirmation, the customer told it is still confirming —
  reasoned in the document's own voice, with the two original
  subtopics and the Summary intact and no timeline entry
- the specification's Capture Webhooks section carries the held-order
  rule and no cancellation; Payment Intent and Refunds stand as
  constructed
- the cycle-1 gap-analysis tracking file on disk with its one finding
  Routed; no claims or input tracking files
- the manifest holding the specification completed with a date, the
  source incorporated, `review_cycle` at 1 with the construction
  baseline recorded, `finding_gate_mode` `gated`, and the cycle-1
  gap-analysis tracking entry `complete`; the discussion item untouched
  and still completed
- no planning, implementation, or review artifacts anywhere
