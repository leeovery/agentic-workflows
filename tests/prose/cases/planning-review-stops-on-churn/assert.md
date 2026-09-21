The walk runs two review cycles under auto and stops the review itself
at the end of the second: every finding of the first cycle resolved, a
fresh pair in its place, nothing recurring — the churning trend, which
under auto ends the review rather than asking, and the plan concludes.

Expected path:

1. the entry's specification gate renders empty; the planning status
   reads in-progress and the handoff is the continuing variant
2. the process finds the planning entry and offers the resume; spec
   change detection diffs the specification against the plan's recorded
   baseline commit and reports it unchanged; the user continues
3. session setup resets the three gate modes to `gated` — no auto
   carries in from any earlier sitting
4. construction fast-paths: the existing structure is presented through
   the engine-rendered phase tree and confirmed with nothing
   re-recorded, and with the position past the last phase the loop
   reports complete — no task-list gate, no authoring dispatch. The
   graph step delegates to the grapher — stubbed, reapplying the
   existing edges unchanged — and the approval commits through the
   scoped plan commit
5. review cycle 1 initialises: `review_cycle` is set to 1 and the
   plan's word baseline — the planning file and its phase task files —
   recorded with it in the **same write**, and the manifest committed
   on its own
6. the traceability review is dispatched first. The cycle-1 dispatch
   names no earlier tracking file — there is none to name — and its
   stub writes the cycle-1 traceability tracking file with two findings
   and one line under Observations; the tracking entry records
   `in-progress`, commits, and the findings summary renders **two**
   rows. The Observations line is not one of them
7. **Finding 1 (settled — what a declined card shows the shopper)** is
   disposed before it renders and stands settled: the specification's
   Payment Intent section decides that a gateway rejection surfaces as
   a user-visible checkout error, and the intent task carries no
   criteria at all. It is presented at the gate — the problem in
   product terms, the proposal with what determined it, the diff — and
   the walk **STOPS**. The user answers `auto`: the criteria are
   applied to the Create Payment Intent task through the format
   adapter, its Resolution set to Fixed, `finding_gate_mode` set to
   `auto` on the manifest, and the work committed
8. **Finding 2 (settled — a returning shopper behind two payments)** is
   disposed and stands on the specification's duplicate-start rule.
   Rendered under `auto`, the surface answers with its auto-approved
   display alone: the fix lands on the Attach Intent To Order task, the
   Resolution set to Fixed, the work committed — **no menu, no
   auto-override line, no stop**
9. both rows are resolved, so the cycle-1 traceability tracking entry
   flips to `complete` and commits; the integrity review is dispatched
   second — never in parallel — and returns clean through its stub,
   writing no tracking file
10. findings were surfaced and the mode is `auto` at cycle 1, so the
    loop runs a follow-up cycle without reading the trend and without
    any gate — cycle 1 is the one cycle the churn check never covers
11. cycle 2 initialises: `review_cycle` set to 2, and with the cycle
    under the gate's threshold no continue gate renders. The
    traceability dispatch this time carries the cycle-1 traceability
    tracking file's path as the settled directions a finding may not
    reverse
12. the cycle-2 stub writes the cycle-2 traceability tracking file with
    two findings, both against the capture task neither cycle-1 finding
    touched; the tracking entry records `in-progress` and commits, and
    the summary renders. Both stand settled on the specification's own
    rules — duplicate deliveries idempotent, and a capture naming an
    intent no order carries logged and ignored — and both land under
    `auto` with no stop, the second finding's diff re-derived against
    the task as the first left it rather than the stale copy in the
    tracking file. The cycle-2 tracking entry flips to `complete`.
    Integrity is dispatched second again and returns clean
13. findings were surfaced, the mode is `auto`, and the cycle is 2, so
    the loop reads the trend before looping again: the convergence
    analysis runs over both cycles' tracking files in churning-render
    mode, counting the `## Findings` rows alone, and reads the growth
    pair — the baseline from the manifest and the plan's live word
    count over the planning file and its phase task files. Both
    cycle-1 findings are resolved, both cycle-2 findings are new, and
    nothing recurs, so the trend classifies as **churning**
14. the diagnostic is written to the topic's cache and rendered through
    the engine — the trend, the latest cycle, the resolved and new
    lists, one count per tracking stream, and the baseline against the
    live word count — and emitted, followed by one line saying the
    findings are churning and the review is concluding. **Nothing is
    asked**: no re-loop gate is fetched, and no third cycle starts
15. completion verifies every tracking entry complete and commits the
    review
16. the compliance self-check refreshes the session's instructions;
    the conclusion asks the engine what the plan is waiting on first —
    the wait gate comes back **empty**, so no blocker and no pause menu
    — then the conclude gate is put to the user and, on their yes, the
    plan completes through the engine first and only then is the spec
    baseline re-stamped from the current commit, before the final
    commit lands
17. the walk stops at the pipeline continuation without invoking the
    bridge

Also true:

- there is no third cycle: `review_cycle` never reaches 3, no cycle-3
  tracking file is written, and no third round of agents is
  dispatched. A walk that looped again has read the cap as the only
  exit and missed the churn one
- **no plan review gate renders anywhere in the walk** — not the
  continue gate, not the re-loop gate. Under auto the churn verdict
  concludes; a gate fetched here is the ratification stop auto exists
  to remove
- the diagnostic renders **before** the review completes, and its
  payload carries the word-count pair. A payload without it means the
  baseline recorded at cycle 1 was never read back, and the growth
  signal — the one reading that says whether the review is writing
  mechanism nobody decided — never reached the user
- the cycle-1 stamp is one write, not two: `review_cycle` and the word
  baseline land together, and a commit of that manifest follows before
  the first agent is dispatched
- all four findings end Resolution Fixed and Move `settled`: none is
  declined, routed or left pending, and nothing is landed in the
  specification or the discussion — every one of them is a decision
  the specification already made
- the cycle-1 findings summary lists two items. The Observations line
  is never an item, never walked, and never counted toward the
  cycle's findings — a three-row summary means the walk promoted a
  point the reviewer put below the floor
- the cycle-2 traceability dispatch named the cycle-1 traceability
  tracking file to the agent. The integrity stream wrote no file in
  either cycle, so there is nothing else to pass
- the user is stopped exactly five times in the whole walk — the
  resume choice, the phase-structure confirmation, the graph approval,
  cycle 1's first finding, and the conclude gate. Nothing stops
  between the auto opt-in and the conclusion
- no integrity tracking file exists for either cycle — clean reviews
  write none — and the manifest's tracking subtree holds the two
  traceability entries alone
- the specification and the discussion are untouched; nothing
  reopens, restarts or triages; no second work unit exists
- cache and scratch files under `.workflows/.cache/` are expected
  working artifacts

EXPECTED WORLD — from an authored, graphed, unreviewed plan:

- the plan carries all four landed fixes: the Create Payment Intent
  task states card-only and a gateway rejection surfacing as a
  user-visible checkout error; the Attach Intent To Order task states
  that a second start on an order already carrying an intent id reuses
  it; the Handle Capture Webhooks task states both that a repeat
  delivery of an applied capture changes nothing and that a capture
  naming an intent no order carries is logged and ignored. The graph —
  dependencies and priorities — stands as the grapher reapplied it, and
  every task status is still pending
- two traceability tracking files on disk, cycle 1 and cycle 2, each
  with its two findings resolved Fixed, the cycle-1 file still carrying
  its Observations line unchanged; nothing for a cycle 3
- the manifest holding planning `completed`, `review_cycle` 2,
  `review_baseline_words` recorded, `finding_gate_mode` `auto`, both
  traceability tracking entries `complete` and no integrity entry,
  `task_map` and `external_id` unchanged, and `spec_commit` re-stamped
  to a commit of this session rather than the fixture's baseline
- the specification, the discussion and the discovery session log
  byte-for-byte as they were
- no implementation or review artifacts anywhere, and no second work
  unit
