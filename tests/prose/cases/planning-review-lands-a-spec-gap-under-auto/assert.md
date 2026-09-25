The walk resumes a graphed plan into its review, lands one ordinary
settled finding under the user's auto opt-in, and then meets a finding
that indicts the specification. Auto is on and the gap flow stops
anyway: the fork is put to the user in conversation, their answer lands
in the discussion, the specification is re-aligned by corrigendum, and
the finding is re-disposed against the corrected record and applied
without a second stop.

Expected path:

1. the entry's specification gate renders empty; the planning status
   reads in-progress and the handoff is the continuing variant
2. the process finds the planning entry and offers the resume; spec
   change detection diffs the specification against the plan's recorded
   baseline commit and reports it unchanged; the user continues
3. session setup resets the three gate modes to `gated` — no auto
   carries in from any earlier sitting
4. construction fast-paths: the existing structure is presented through
   the engine-rendered phase tree and confirmed; the graph step
   delegates to the grapher — stubbed, reapplying the existing edges
   unchanged — and the approval commits through the scoped plan commit
5. review cycle 1 initialises: `review_cycle` is set to 1 and the
   plan's word baseline recorded with it in one write, and the manifest
   committed. The traceability review is dispatched first and its stub
   writes the cycle-1 traceability tracking file with two findings; the
   orchestrator records the tracking entry `in-progress`, commits it,
   and renders the findings summary
6. **Finding 1 (settled — the unknown-intent rule missing from the
   capture task)** does not indict the specification: the record
   decides it and the plan simply never carried it. It is disposed
   `settled`, rendered at the gate, and the walk **STOPS**. The user
   answers `auto`: the fix is applied to the Handle Capture Webhooks
   task through the format adapter, its Resolution set to Fixed,
   `finding_gate_mode` set to `auto` on the manifest, and the work
   committed
7. **Finding 2** is read next and it **does** indict the
   specification — a missing-from-plan finding whose ground the
   specification asserts (card-only) without the mechanism that makes
   it buildable (what the shopper with a wallet method meets). The gap
   flow is entered before the finding is disposed and before anything
   renders for it
8. the gap is classified and the record does not settle it: the
   finding's own search came up empty, and nothing in the
   specification, the discussion, the plan's conventions or the tree
   breaks the tie. It is a fork in what the product does, so the
   correction route is never entered for the classification — no
   specification status read and no presence scan happens for it — and
   the flow goes straight to the exchange
9. **the exchange overrides auto.** `finding_gate_mode` now holds
   `auto`, so the exchange opens with the announcement verbatim —
   **Auto is on — stopping anyway:** — and then puts the fork to the
   user in conversation, not through any engine surface: what the plan
   needs, what was searched and where the record ran out, the two sides
   as product end states, what each costs the shopper, and the
   session's stance. The walk **STOPS** and consumes a scripted answer
10. the user's answer settles it — non-card methods are hidden at
    checkout so a wallet is never offered and never refused. The
    decision's home is the discussion, so presence is scanned and no
    session holds it
11. the decision is written into `.workflows/pay/discussion/pay.md` as
    a **new subtopic section** in the template's subtopic shape —
    Context, Options Considered carrying the alternative weighed,
    Journey, and a Decision naming what the shopper is shown — with no
    dated timeline entry and no `#### Initial` wrapper, because there
    is no prior block to revise. The section speaks in the document's
    own voice: nothing in it names planning, a review, a tracking file,
    a finding or this session
12. the edited discussion is re-indexed through the knowledge CLI; the
    sources-stale step is **skipped** — single-topic work has no
    sibling specifications — and the resolution commits scoped to the
    discussion with the sweep shape (`--topic discussion/pay
    --sweep`)
13. the discussion now carries the decision, and that is the record
    that settles the specification: the correction route runs over this
    work unit's own specification from a downstream phase — status
    completed, presence scan clean — and lands under the record-settled
    arm. The rule is added to the section that owns the ground, a dated
    corrigendum attributed to `planning/pay` is appended citing the
    decision, the specification is re-indexed, and one scoped commit
    lands carrying `--topic specification/pay` and `--sweep`
14. control returns to the findings walk, which re-disposes finding 2
    against the corrected record: it is now `settled`, carrying what
    landed into the plan. The tracking row is rewritten before anything
    renders — Move `settled`, the Proposal carrying the landed
    decision, the Options removed, Current and Proposed Text supplied
    in plan format for the Create Payment Intent task
15. the finding is rendered with move `settled` under `auto`: the
    surface answers with its auto-approved display, the fix is applied
    to that task, the Resolution set to Fixed with Notes naming where
    the decision landed, and the work committed — **no second stop, no
    choice menu, no auto-override line**
16. both findings are resolved, so the cycle-1 traceability tracking
    entry flips to `complete` and commits; the integrity review is
    dispatched second and returns clean through its stub, writing no
    tracking file
17. findings were surfaced and `finding_gate_mode` is `auto`, so the
    review runs a follow-up cycle without stopping — no re-loop gate
    renders. Both cycle-2 dispatches carry the cycle-1 traceability
    tracking file's path as the settled directions a finding may not
    reverse, and both agents return clean through the stub, in
    order, and the review completes
18. the compliance self-check refreshes the session's instructions;
    the conclusion asks the engine what the plan is waiting on first —
    the wait gate comes back **empty**, because the landing touched no
    manifest state and the specification is still completed, its source
    still incorporated and unflagged — then the conclude gate is put to
    the user and, on their yes, the plan completes through the engine
    first and the spec baseline is re-stamped after it. The final
    commit lands and the walk stops at the pipeline continuation
    without invoking the bridge

Further claims:

- the exchange happened **after** auto was already on, and it consumed
  a scripted answer. A walk in which finding 2 was applied without a
  user turn has let auto make the one call auto never makes
- the traceability tracking file's finding 2 ends with Move `settled`,
  Resolution `Fixed`, and Notes naming the landing — the decision in
  the discussion and the specification brought into line. A row still
  reading `choice` with Options means the re-dispose never ran; a row
  reading `Routed` means the walk queued the gap instead of landing it
- finding 1's row ends Move `settled`, Resolution Fixed; neither row
  reads Declined, Pending or Skipped
- the discussion gains exactly one new subtopic section, deciding what
  a shopper with a non-card method meets at checkout. The Gateway
  Integration subtopic and the Summary stand as the fixture left them,
  and no timeline entry appears anywhere in the document
- the specification's Payment Intent section now says what the shopper
  meets, and the file ends with a Corrigenda section holding exactly
  one entry, dated and attributed to `planning/pay`, citing the
  discussion's decision. A specification edited with no matching
  decision in the discussion means a product call was landed where no
  document records it
- no `sources stale` call is recorded — single-topic work skips the
  step — and no triage landing, no `topic reopen`, and no incoherence
  gate anywhere
- the specification item is untouched: still `completed`, no reopen, no
  reconcile flag, its source row still `incorporated` — which is why
  the wait gate comes back empty at the conclusion
- the Create Payment Intent task carries what the shopper meets, and
  the Handle Capture Webhooks task carries the unknown-intent rule;
  neither carries a `[needs-info]` marker and neither notes an
  ambiguity — the answers went into the record, not the plan
- exactly four review agents were dispatched: traceability and
  integrity at cycle 1, then both again at cycle 2, in that order and
  never in parallel
- the six scripted answers were consumed by the resume choice, the
  phase-structure gate, the graph approval, finding 1's gate, the gap
  exchange, and the conclude gate, in that order and nowhere else
- the manifest ends with planning `completed`, `review_cycle` 2,
  `finding_gate_mode` `auto`, the cycle-1 traceability tracking entry
  `complete` and no other tracking entry, and `spec_commit` re-stamped
  to a commit of this session
- no second work unit exists; cache payloads are expected working
  artifacts
