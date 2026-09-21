The walk resumes a graphed plan into its review and meets two
traceability findings in one tracking file. The first names a mechanism
the specification never decided and asks for its removal; it is
approved and the mechanism leaves the plan with nothing put in its
place. The second is a rule the specification decides that a task never
carried; it is approved and written in. The user declines a second
cycle and concludes.

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
   unchanged over the task bodies as they stand — and the approval
   commits through the scoped plan commit
5. review cycle 1 initialises: `review_cycle` is set to 1 and the
   plan's word baseline — the planning file and its phase task files —
   recorded with it in the **same write**, and the manifest committed
6. the traceability review is dispatched first; its stub writes the
   cycle-1 traceability tracking file with two findings. The tracking
   entry records `in-progress`, commits, and the findings summary
   renders two rows, both pending, each tagged with its Type's token —
   `hallucinated` for the first, `missing` for the second
7. **Finding 1 (the capture task's invented retry schedule)** is
   disposed and stands `settled`: the specification decides what a
   capture does to its order and decides nothing about retries, keys or
   eviction, so the plan has no ground for any of it and the fix is
   removal. It is presented at the gate — the problem in product terms
   (a redelivery outside a window nobody chose marks the order paid
   twice), the proposal, the diff, and a gate whose prompt option is
   Discuss — and the walk **STOPS**
8. the user approves it: the fix is applied to the Handle Capture
   Webhooks task through the format adapter — the **Do** removed and
   the specification's own capture rules written in as acceptance
   criteria — the Resolution set to Fixed, and the work committed
9. **Finding 2 (the retried checkout missing from the attach task)** is
   disposed next and stands `settled`: the specification's Payment
   Intent section decides that a duplicate checkout start reuses the
   existing intent, and the task carries no criteria at all. Its diff
   is re-derived against the live plan — the earlier fix moved a
   different task, so nothing of it is reverted — presented at the
   gate, and the walk **STOPS**
10. the user approves it: the criteria are applied to the Attach Intent
    To Order task, the Resolution set to Fixed, and the work committed
11. both rows are settled, so the cycle-1 traceability tracking entry
    flips to `complete` and commits. The integrity review is dispatched
    second — never in parallel — and returns clean through its stub,
    writing no tracking file; its no-findings result is announced
12. findings were surfaced this cycle and the mode is still `gated`, so
    the loop reads the trend before asking: the convergence analysis
    finds only one cycle of tracking data, which is below its
    threshold, and returns without writing or rendering a diagnostic
13. the re-loop prompt is emitted and the re-loop gate fetched from the
    engine in its reloop variant; the walk **STOPS**. The user proceeds
    rather than ordering another round, so no second cycle initialises
14. completion verifies every tracking entry complete and commits the
    review
15. the compliance self-check refreshes the session's instructions; the
    conclusion asks the engine what the plan is waiting on first — the
    wait gate comes back **empty**, so no blocker and no pause menu —
    then the conclude gate is put to the user and, on their yes, the
    plan completes through the engine first and only then is the spec
    baseline re-stamped, before the final commit lands
16. the walk stops at the pipeline continuation without invoking the
    bridge

Also true:

- the Handle Capture Webhooks task carries **no mechanism at all**: no
  retry helper, no attempt count, no delay in milliseconds, no key, and
  no eviction window or 24-hour figure anywhere in its text. A task
  that names a different helper, a different schedule, or a different
  key has swapped one invention for another, which is the failure this
  finding's fix exists to prevent
- that task now carries acceptance criteria that read as scenarios — a
  capture arriving and the order reading paid, the same capture
  arriving again and the order still reading paid once, a capture
  naming an intent no order carries being logged and ignored — each one
  a rule the specification's Capture Webhooks section states
- the Attach Intent To Order task carries criteria stating that an
  order with no intent id takes the one just created and that a second
  checkout start reuses the intent the order already carries; the
  Create Payment Intent task is untouched
- the graph — dependencies and priorities — stands as the grapher
  reapplied it, and every task status is still pending
- exactly **two** `render finding` calls are recorded, and the user is
  stopped at both — neither finding was declined at the dispose, and
  neither rode past the user
- the tracking file ends with both rows Resolution **Fixed**; no row
  reads Pending, Declined or Skipped, and neither Proposal was rewritten
  to argue the mechanism's inclusion
- `finding_gate_mode` is never set to auto and no auto-override line
  appears anywhere — the walk is gated throughout
- no convergence diagnostic is written or rendered: one cycle is below
  the threshold the analysis needs, and the re-loop gate is asked
  without one
- `review_cycle` never reaches 2, no cycle-2 tracking file exists, no
  integrity tracking file exists at all, and no second round of agents
  is dispatched
- the user is stopped exactly seven times — the resume choice, the
  phase-structure confirmation, the graph approval, finding 1's gate,
  finding 2's gate, the re-loop prompt, and the conclude gate
- the specification and the discussion are untouched: nothing was
  corrected, nothing reopened, nothing triaged, and no corrigendum was
  written. The plan had no ground for the mechanism and that is a plan
  defect, not a gap in the record
- no second work unit exists; cache and scratch files under
  `.workflows/.cache/` are expected working artifacts

EXPECTED WORLD — from an authored, graphed, unreviewed plan whose
capture task carried an invented how:

- `tasks/pay-2-1.md` with its **Do** gone and scenario acceptance
  criteria in its place, its frontmatter — id, phase, status pending,
  created, `depends_on: pay-1-2` — as the grapher left it
- `tasks/pay-1-2.md` carrying the duplicate-start criteria, its
  frontmatter priority and dependency unchanged; `tasks/pay-1-1.md`
  byte-for-byte as it was
- one traceability tracking file on disk for cycle 1, both findings
  Fixed; no integrity tracking file, because a clean review writes none
- the manifest holding planning `completed`, `review_cycle` 1,
  `review_baseline_words` recorded, `finding_gate_mode` `gated`, the
  cycle-1 traceability tracking entry `complete` and no other tracking
  entry, `task_map` and `external_id` unchanged, and `spec_commit`
  re-stamped to a commit of this session rather than the fixture's
  baseline
- the specification, the discussion and the discovery session log
  byte-for-byte as they were
- no implementation or review artifacts anywhere, and no second work
  unit
