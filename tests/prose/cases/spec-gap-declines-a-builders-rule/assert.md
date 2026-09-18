The walk resumes a specification into its review and processes three
gap findings, disposing each staged move against the record bar before
it renders: a call the record determines rides auto, a staged settled
whose whole substance is the builder's is declined and never rendered,
and a choice that clears the bar stops even under auto.

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
6. **Finding 1 (settled — how long an order waits for confirmation)**
   is disposed and stands settled: the specification's own delivery
   schedule and its exhaustion rule fix the wait between them, a
   decided rule whose consequence follows with no alternative. It is
   presented at the gate, leading with what is wrong for the customer
   and the call the record determines. The user answers `auto`: the
   finding is applied to the Capture Webhooks section, its Resolution
   set to Approved, `finding_gate_mode` set to `auto` on the manifest,
   and the work committed
7. **Finding 2 (staged settled — which of the audit line's two fields
   is written first)** is disposed **before it renders** and is
   **declined**: its whole substance is the order two fields go out
   in, a detail any competent implementer settles the same way and one
   no customer ever sees either way, so it is the builder's and the
   specification has no rule to state for it — and its derivation, an
   analogy to the unmatched-delivery line, is consistency with the
   document rather than determination by it, so it could not have
   ridden auto as a settled call either. The tracking row's Resolution
   is set to `Declined` with the reason in Notes, the Move left as
   staged, the decline announced in one line, and the tracking file
   committed. **Nothing renders for it** — no `render finding`, no
   settled auto-apply, no auto-override line — and nothing lands in
   the specification. The walk returns to the loop and takes up the
   next finding
8. **Finding 3 (choice — whether a refund can be for part of an
   order)** is disposed and stands: the fork is what the customer gets
   (money back for what they returned, against a refund that always
   matches what they were charged), nothing in the specification, the
   discussion, a measurement, or a precedent breaks the tie, each side
   visibly costs a customer, and the tie-break is appetite. Its row
   keeps Move `choice`. Only then does it stop, `auto`
   notwithstanding: its menu opens on the engine's auto-override line,
   then numbered options with the recommendation first and no `a/auto`
   row. The user picks refunds down to a single line item — the option
   **not** recommended — and that is what lands in Refunds, with the
   Resolution set to Approved and a note naming the option chosen
9. every finding is resolved and none carries the `decide` move, so no
   batch is built and no batch screen renders; the cycle-1
   gap-analysis tracking entry flips to `complete`
10. with `finding_gate_mode` `auto` and findings surfaced at cycle 1,
    the review runs a follow-up cycle without stopping — no re-loop
    gate renders in this world. Cycle 2's three agents all return
    clean through the stub, the review proceeds to completion,
    sign-off confirms, and the topic completes

Also true:

- the specification says nothing about the order of the audit line's
  fields — not in Refunds, not anywhere. A walk that wrote either
  order in has stated a rule the record never gave it, whether it
  landed as an auto-applied settled call, as a decide batch's
  documented call, or as the user's pick, and has failed
- the specification's Capture Webhooks section carries the 25-minute
  waiting window
- Refunds carries refunds down to a single line item, never the
  whole-order-or-nothing rule. A walk that landed the recommendation
  instead has rubber-stamped a choice rather than presented it
- exactly two `render finding` calls are recorded in the whole walk —
  finding 1's and finding 3's — with the `finding_gate_mode auto`
  write between them. A third render, whatever its shape, means the
  walk presented a finding the dispose owed a decline, and the walk
  has failed
- no `render finding-batch` call is recorded: the declined finding
  left the walk without a lane, and a batch screen means the decline
  was softened into a call made on the user's behalf — which lands
  the builder's detail in the specification by another door
- the tracking file's audit-line row ends with Resolution `Declined`,
  its Move left as staged, and Notes carrying the reason — the field
  order is the builder's, no side of it costs the customer. A row
  reading Approved or Routed means the walk rendered or landed a
  finding the dispose owed a decline; a row still Pending means the
  walk skipped it without disposing it
- the tracking file's partial-refunds row ends with Move `choice`,
  Resolution Approved, its Options intact, and a note naming the
  option chosen; the waiting-window row ends Move `settled` and
  Resolution Approved — the dispose discriminated across all three
- the user is stopped exactly twice in the review: at finding 1's gate
  and at finding 3's choice menu. No stop lands between them — the
  user is never asked about the audit line
- the Observations line is never walked, never counted, and never put
  to the user
- nothing routes to a source: no `incoherence-gate` render, no
  presence scan, no reindex, no triage, no reopen. The declined
  finding is not a route — no measurement or sibling artifact pins the
  field order, so it belongs to no source document either
- the discussion document is untouched — no finding here indicts it
- cache and scratch files under `.workflows/.cache/` are expected
  working artifacts

EXPECTED WORLD — from a feature holding a completed discussion and a
constructed specification awaiting review:

- the specification's Capture Webhooks section carries the 25-minute
  waiting window, and its Refunds section carries per-line-item
  refunds alongside the 30-day window; the audit-log rule stands
  exactly as constructed, and Payment Intent is untouched
- the cycle-1 gap-analysis tracking file on disk with its three
  findings resolved — Approved, Declined, Approved — and its
  Observations line untouched; no claims or input tracking files for
  either cycle, and no gap-analysis tracking file for cycle 2, because
  clean reviews write none
- the manifest holding the specification completed with a date, the
  source incorporated, `review_cycle` at 2 with the construction
  baseline recorded, `finding_gate_mode` `auto`, and the cycle-1
  gap-analysis tracking entry `complete`; the discussion item
  untouched and still completed
- the discussion document byte-for-byte as it was
- no planning, implementation, or review artifacts anywhere
