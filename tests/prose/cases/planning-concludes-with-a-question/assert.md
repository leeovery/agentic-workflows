The prose should have taken this path:

1. the entry's spec gate clears; the planning status reads in-progress
   and the handoff is the continuing variant — no late-context
   question, no cross-cutting sweep
2. the process finds the planning entry and offers the resume; spec
   change detection diffs the specification against the plan's
   recorded baseline commit and reports it unchanged
3. on continue, session setup loads the format references and resets
   the gate modes; the specification is verified by listing it
4. construction fast-paths: the existing structure is presented through
   the engine-rendered phase tree and confirmed with nothing
   re-recorded, and with the position past the last phase the loop
   reports complete — no per-phase gate, no task-list render, no
   authoring dispatch
5. the graph step reads the plan's state through the engine and
   delegates to the grapher — stubbed, reapplying the existing edges
   unchanged — and the approval commits through the scoped plan commit
6. review cycle 1 initialises: `review_cycle` is set to 1 and the
   plan's word baseline recorded with it in one write, and the manifest
   committed. The traceability review is dispatched first — stubbed
   clean, no tracking file — and its no-findings result is announced;
   only then is the integrity review dispatched, same clean return,
   never in parallel
7. with no findings surfaced this cycle the review completes: the
   tracking subtree is verified trivially, the completion commits, and
   no re-loop prompt is put to the user
8. the compliance self-check refreshes the session's instructions —
   attempting the re-reads and standing on any the tool confirms
   unchanged — then the conclusion asks the engine what the plan is
   waiting on first: the wait gate is fetched and comes back empty, so
   no blocker and no pause menu is emitted. Only then does it fetch the
   conclude gate through the engine and emit its MENU section: the
   conclusion question, a
   `y/yes` row concluding the plan, and an **Ask** row offering
   questions about the plan without marking it complete — no `n/no` row
   anywhere on it — and STOPS. The fourth scripted answer is the
   question about phase 2's acceptance criteria
9. the Ask arm: the question is answered from the record the session
   already holds. The plan's Phase 2: Webhook Capture carries
   **Acceptance criteria**: `The webhook consumer marks orders paid; no
   polling path exists anywhere.` — that is the answer, and the
   specification's section 2 stands behind it (`Capture is confirmed by
   gateway webhook, never by polling.`). Nothing is dispatched to
   answer it, nothing is read that the session had not already read,
   and no engine transaction runs on the answer. The flow does not
   return to plan construction — no second phase tree is rendered and
   no task list is — nor to the review: no second review cycle is
   recorded and no review agent fires again. The conclude gate is then
   fetched again through the engine — a second fetch, the same address
   — its MENU section re-emitted, and the walk STOPS again. The wait
   gate is **not** re-fetched: the Ask arm returns to the conclude
   gate, not back past the wait. The fifth scripted answer concludes
   the plan
10. the yes arm: the plan completes through the engine first, the spec
    baseline is re-stamped from the current commit after it, and the
    final commit lands
11. the walk stops at the pipeline continuation — the bridge is never
    invoked

Further claims:

- the conclude gate was fetched through the engine exactly twice, both
  before the completion, with nothing between them but the answer; the
  review cycle was recorded exactly once, before the first fetch, and
  nothing construction- or review-shaped ran after it
- the five scripted answers were consumed by the resume gate, the phase
  structure gate, the graph approval gate, and the conclude gate twice
  — the question, then the yes — in that order and nowhere else
- no finding is ever presented and no findings summary is rendered —
  both reviews returned clean
- nothing is re-authored: no staging subtree, no task gates, no task
  file content changes beyond what the grapher reapplies unchanged
- cache payloads are expected working artifacts

EXPECTED WORLD — from an authored, graphed, unreviewed plan:

- the manifest holding planning completed, review_cycle 1, both
  approvals as they were, task_map and external_id unchanged, no
  tracking entries, and spec_commit re-stamped to a commit of this
  session rather than the fixture's baseline
- the task files unchanged in substance: same dependencies, same
  priorities, statuses all pending
- planning.md, the detail files, and the specification untouched — the
  question at the gate was answered, never recorded anywhere; no review
  tracking files anywhere; no implementation artifacts; no second work
  unit
