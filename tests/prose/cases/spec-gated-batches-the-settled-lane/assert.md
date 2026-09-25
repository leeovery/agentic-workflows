The walk resumes a specification into its review and lands three
settled calls from one gated screen — read, one of them expanded, all
three approved on a single answer — then asks before running a second
cycle. Two of the calls are the record's own and change the
specification alone; the third is the session's, and it lands in the
discussion that should own it first.

Expected path:

1. the entry skill validates the source and the phase, finds the
   specification in progress, and hands off to the processing skill
2. resume detection offers the choice and the user continues, so
   initialisation is skipped: the walk lands in the review
3. cycle 1 initialises: `review_cycle` is set to 1 and the
   construction baseline word count recorded with it, in the same
   write, and the manifest committed. Session setup has already reset
   both gate modes to `gated`
4. claims verification runs first and input review second; both
   return clean through their stub and write no tracking file
5. gap analysis runs third and its stub writes the cycle-1
   gap-analysis tracking file with three findings; the orchestrator
   records the tracking entry `in-progress`, commits it, and renders
   the findings summary — three items
6. **every finding is disposed before anything renders**, one at a
   time, and all three stand settled — but not on the same footing:
7. **Finding 1 (how long an order waits for confirmation)** and
   **finding 2 (refunding an order before the money is taken)** stand
   settled on the record's own derivation: the specification's
   delivery schedule and its exhaustion rule fix the wait between
   them, and its webhook-only confirmation rule and the
   refund-against-the-intent rule fix the second. Both rows stand as
   staged
8. **Finding 3 (an order whose payment is never confirmed)** stands
   settled as a call **this session** makes rather than one the
   record determines: its staged derivation is an analogy to the
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
   rejection rule already defines). The row is rewritten before
   anything renders: Move `settled`, that Proposal, a Proposed Text
   carrying the held-order rule
9. the settled batch renders once — a three-row payload at the
   specification's address with lane `settled`, each row the call and
   what it rests on, all three fitting one screen with nothing
   remaining beyond it. The gate is `gated`, so the screen carries
   its menu — `y/yes`, `a/auto`, Discuss, Ask — and the walk **STOPS**
10. the user asks for the third to be expanded. Its payload is
    written with move `settled` and rendered through the finding
    surface, which at a specification address answers with the report
    and its diff alone — no menu, no auto-approved line, and no
    `a/auto` row anywhere, because the screen is the gate. The
    finding has no Current and a short Proposed Text, so the payload
    carries it as a diff with an empty current side and the wording
    reads in place; no separate wording section is owed, that shape
    belonging to a finding that proposes a whole section. It carries
    the held-order rule, not the cancellation the agent staged — the
    dispose ran before anything rendered
11. nothing is resolved by expanding, so the batch screen renders
    again, unchanged, and the walk **STOPS** a second time
12. the user answers `yes`, and the screen's three findings land in
    the order they read
13. findings 1 and 2 are the record's own calls, so each lands in the
    specification alone: the waiting-window rule into Capture
    Webhooks, and the confirmed-capture condition replacing the
    Refunds line it modifies — each re-derived against the live
    document rather than the tracking file's copy — with both
    Resolutions set to `Approved`
14. finding 3 is the session's call, so it lands in the owning
    document first. Presence is checked and no session holds the
    discussion, so the decision is written into it as a **new
    subtopic section** in the template's subtopic shape — Context,
    Options Considered carrying the alternative that was weighed,
    Journey carrying the reasoning, and a Decision naming the held
    order and what the customer is told — with no dated timeline
    entry and no Initial wrapper, because there is no prior block to
    revise, and no map registration. The section speaks in the
    document's own voice, and nothing in it names the specification,
    a review, a tracking file or this session
15. the edited discussion is reindexed through the knowledge CLI; the
    sources-stale step is skipped — single-topic work has no sibling
    specs — and the resolution commits scoped to the discussion with
    the sweep shape (`--topic discussion/pay --sweep`)
16. back in the batch the held-order rule lands in the
    specification's Capture Webhooks section, and the row records
    `Routed` with Notes naming the discussion the decision landed in
17. with every finding on the screen landed, the specification and
    the tracking file commit together — **once for the screen**, not
    once per finding — and the landing is confirmed in one line
    naming all three
18. the lane is empty, no choice and no route remains, and the
    cycle-1 gap-analysis tracking entry flips to `complete`
19. findings were surfaced and the mode is still `gated`, so the
    convergence analysis is reached and returns without a diagnostic
    — one cycle of tracking data is below its threshold — and the
    re-loop gate renders in its reloop variant. The walk **STOPS**
20. the user orders another cycle: `review_cycle` is set to 2 and
    committed, and cycle 2's three agents all return clean through
    the stub. With nothing surfaced the loop goes to completion,
    which verifies every tracking entry complete and the source
    incorporated, fetches the sign-off gate, and on the user's yes
    completes the topic through the engine and commits the conclusion
21. the walk stops at the pipeline continuation without invoking the
    bridge

Also true:

- `finding_gate_mode` is never set to `auto`: the screen's `a/auto`
  row is offered twice and declined twice, and no auto-override line
  and no auto-approved display appears anywhere in the walk
- exactly two `render finding-batch` calls are recorded, both
  carrying the same three rows — the screen before the expansion and
  the screen after it. A single call means the screen never came
  back after the expansion; a third means something was resolved that
  should not have been
- exactly one `render finding` call is recorded, between the two
  batch renders. It is the expansion, and it resolves nothing
- the specification's Capture Webhooks section carries the 25-minute
  wait and the held-order rule, and never says the order is cancelled
  at the ceiling. A walk that wrote the cancellation in has taken an
  analogy for a determination and applied a decision nobody made
- the specification's Refunds section carries the 30-day window and
  the confirmed-capture condition in one rule — the finding replaced
  that line rather than appending a second one beside it
- the discussion gains exactly one new subtopic section, owning what
  happens to an order the gateway never confirms; the Gateway
  Integration and Refunds subtopics stand as they were, and no
  timeline entry appears anywhere in the document. Nothing of the
  waiting window or the refund condition is written into it — the
  record already determines both, so they belong to the specification
  alone
- the tracking file's first two rows end with Move `settled` and
  Resolution Approved; the third ends with Move `settled`, Resolution
  `Routed`, a Proposal carrying the call, what leaned, and the
  alternative, a Proposed Text, and Notes naming where the decision
  landed. A third row ending Approved with nothing in the discussion
  means the walk applied a call the source never made to the
  specification alone
- the user is stopped exactly five times in the whole walk — the
  resume choice, the screen, the screen again after the expansion,
  the re-loop prompt, and sign-off
- no incoherence gate renders: the batch's landing enters the flow at
  its landing step, so nothing classifies, nothing routes to a triage
  queue, and no source is reopened
- the discussion item never leaves `completed`, and the specification
  never pauses
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
  waiting window and the held-order rule; Refunds carries the
  confirmed-capture condition alongside the 30-day window and the
  audit-log rule; Payment Intent stands as constructed
- the cycle-1 gap-analysis tracking file on disk with its three
  findings resolved — Approved, Approved, Routed; no claims or input
  tracking files for either cycle, and no gap-analysis tracking file
  for cycle 2, because clean reviews write none
- the manifest holding the specification completed with a date, the
  source incorporated, `review_cycle` at 2 with the construction
  baseline recorded, `finding_gate_mode` still `gated`, and the
  cycle-1 gap-analysis tracking entry `complete`; the discussion item
  untouched and still completed
- no planning, implementation, or review artifacts anywhere
