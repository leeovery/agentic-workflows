The walk resumes a graphed plan into its review and meets two staged
findings in one tracking file. The first is refused at the dispose and
never reaches the user — its whole substance is the builder's. The
second is a criterion the shopper meets that the specification already
decided, and it is presented and approved. The Observations line beneath
them is never walked.

Expected path:

1. the entry's specification gate renders empty; the planning status
   reads in-progress and the handoff is the continuing variant
2. the process finds the planning entry and offers the resume; spec
   change detection diffs the specification against the plan's recorded
   baseline commit and reports it unchanged; the user continues
3. session setup resets the three gate modes to `gated`
4. construction fast-paths: the existing structure is presented through
   the engine-rendered phase tree and confirmed, and with the position
   past the last phase the loop reports complete. The graph step
   delegates to the grapher — stubbed, reapplying the existing edges
   unchanged — and the approval commits through the scoped plan commit
5. review cycle 1 initialises: `review_cycle` is set to 1 and the
   plan's word baseline — the planning file and its phase task files —
   recorded with it in the **same write**, and the manifest committed
6. the traceability review is dispatched first and returns clean
   through its stub, writing no tracking file; its no-findings result is
   announced. Only then is the integrity review dispatched — never in
   parallel — and its stub writes the cycle-1 integrity tracking file
   with two findings and one line under Observations. The tracking entry
   records `in-progress`, commits, and the findings summary renders
   **two** rows, both pending. The Observations line is not one of them
7. **Finding 1 (the capture consumer's order lookup)** is disposed
   before anything renders, and the dispose refuses it: its whole
   substance is a mechanism the specification never decided — how the
   consumer gets from the intent a capture names to the order that
   carries it — and either way the shopper meets the same behaviour, so
   it is the implementer's to settle with the code in front of them.
   Resolution is set to **Declined** with that reason in Notes, the Move
   left as the reviewer staged it, the decline announced in a line, and
   the work committed. **Nothing is rendered for it and the walk does
   not stop** — the user never sees this finding
8. **Finding 2 (what a declined card shows the shopper)** is disposed
   next and stands settled: the specification's Payment Intent section
   decides that a gateway rejection surfaces as a user-visible checkout
   error, card-only sits beside it, and the intent task carries no
   criteria at all — a criterion the product's user meets, which is
   settled whatever its size. It is presented at the gate — the problem
   in product terms, the proposal with what determined it, the diff, and
   a gate whose prompt option is Discuss — and the walk **STOPS**
9. the user approves it: the criteria are applied to the Create Payment
   Intent task through the format adapter, the Resolution set to Fixed,
   and the work committed
10. every row is settled, so the cycle-1 integrity tracking entry flips
    to `complete` and commits
11. findings were surfaced this cycle and the mode is still `gated`, so
    the loop reads the trend before asking: the convergence analysis
    finds only one cycle of tracking data, which is below its threshold,
    and returns without writing or rendering a diagnostic
12. the re-loop prompt is emitted and the re-loop gate fetched from the
    engine in its reloop variant; the walk **STOPS**. The user proceeds
    rather than ordering another round, so no second cycle initialises
13. completion verifies every tracking entry complete and commits the
    review
14. the compliance self-check refreshes the session's instructions; the
    conclusion asks the engine what the plan is waiting on first — the
    wait gate comes back **empty**, so no blocker and no pause menu —
    then the conclude gate is put to the user and, on their yes, the
    plan completes through the engine first and only then is the spec
    baseline re-stamped, before the final commit lands
15. the walk stops at the pipeline continuation without invoking the
    bridge

Also true:

- exactly **one** `render finding` call is recorded in the whole walk.
  A second means the declined finding was put to the user after all,
  which is the acceptance rate this decline exists to break
- the declined finding never touched the plan: the capture task says
  nothing about an index or how it resolves its order, and its text is
  what the fixture left
- the findings summary payload carries two items — the two rows under
  the tracking file's `## Findings` — and the Observations line is
  never an item, never walked, and never counted. A three-item summary
  means the walk promoted a point the reviewer put below the floor
- the tracking file ends with finding 1 Resolution **Declined**, the
  reason recorded in Notes and its Move still as staged, and finding 2
  Resolution **Fixed**. No row reads Pending or Skipped
- `finding_gate_mode` is never set to auto, and no auto-override line
  appears anywhere — the walk is gated throughout, so there is nothing
  to override
- no convergence diagnostic is written or rendered: one cycle is below
  the threshold the analysis needs, and the re-loop gate is asked
  without one
- `review_cycle` never reaches 2, no cycle-2 tracking file exists, and
  no second round of agents is dispatched
- the user is stopped exactly six times — the resume choice, the
  phase-structure confirmation, the graph approval, finding 2's gate,
  the re-loop prompt, and the conclude gate
- the specification and the discussion are untouched; nothing reopens,
  restarts or triages, and no second work unit exists
- cache and scratch files under `.workflows/.cache/` are expected
  working artifacts

EXPECTED WORLD — from an authored, graphed, unreviewed plan:

- the Create Payment Intent task carries acceptance criteria stating
  that card is the only payment method the intent accepts and that a
  gateway rejection surfaces as a user-visible checkout error. The
  Attach Intent To Order and Handle Capture Webhooks tasks are
  unchanged, the graph — dependencies and priorities — stands as the
  grapher reapplied it, and every task status is still pending
- one integrity tracking file on disk for cycle 1, its first finding
  Declined with a reason and its second Fixed, its Observations line
  unchanged; no traceability tracking file, because a clean review
  writes none
- the manifest holding planning `completed`, `review_cycle` 1,
  `review_baseline_words` recorded, `finding_gate_mode` `gated`, the
  cycle-1 integrity tracking entry `complete` and no other tracking
  entry, `task_map` and `external_id` unchanged, and `spec_commit`
  re-stamped to a commit of this session rather than the fixture's
  baseline
- the specification, the discussion and the discovery session log
  byte-for-byte as they were
- no implementation or review artifacts anywhere, and no second work
  unit
