The walk resumes a graphed, once-reviewed plan, runs a second clean
review cycle, and concludes. The conclusion's first act is to ask the
engine what the plan is waiting on: the specification is settled, so
the wait gate answers empty and the conclude gate follows. On the
user's yes the plan is completed **first** and the specification
baseline re-stamped after — the completion is what makes the baseline
true, so a baseline stamped over a refused completion would be a lie.

Expected path:

1. the entry's specification gate renders empty — the specification is
   completed, its source incorporated and nothing has moved beneath it;
   the planning status reads in-progress and the handoff is the
   continuing variant
2. the process finds the planning entry; spec change detection diffs the
   specification against the plan's recorded baseline commit and writes
   the read, and the resume gate leads with it — unchanged; the user
   continues
3. session setup loads the format references and resets the gate modes
   to `gated`; the specification is verified by listing it
4. construction fast-paths: the existing structure is presented through
   the engine-rendered phase tree and confirmed with nothing
   re-recorded, and with the position past the last phase the loop
   reports complete — no per-phase gate, no authoring dispatch
5. the graph step delegates to the grapher — stubbed, reapplying the
   existing edges and priorities unchanged — and the approval commits
   through the scoped plan commit
6. external dependencies are skipped: the work type is not an epic
7. review initialisation finds `review_cycle` at 1 and increments it to
   2; two is within the cycle allowance, so no convergence analysis
   runs and no review gate is put to the user. Traceability is
   dispatched first and returns clean through its stub, writing no
   tracking file, and only then is integrity dispatched, same clean
   return — never in parallel
8. no findings were surfaced, so the review completes straight away:
   the tracking subtree is verified trivially, the completion commits,
   and no re-loop prompt renders
9. the compliance self-check refreshes the session's instructions
10. the conclusion asks the engine for the plan's waits **before**
    anything else it does: the wait gate renders for
    `pay.planning.pay` and comes back **empty**. No blocker is emitted,
    no pause menu appears, no pause commit runs, and the bridge is not
    invoked as a pause
11. with nothing owed, the conclude gate renders and the walk
    **STOPS**; the user confirms
12. the plan is completed through the engine **first** — `topic
    complete pay planning pay`, which would have refused had the
    specification been unsettled — and only then is `spec_commit`
    re-stamped from the current commit. The final commit lands, the
    completion summary is emitted, and the walk stops at the pipeline
    continuation without invoking the bridge

Further claims:

- the wait gate was called exactly once, at the conclusion, and it
  returned nothing; the plan was never paused and `/workflow-bridge pay
  planning none paused` was never invoked
- the completion call is recorded **before** the `spec_commit` write. A
  baseline stamped first means the plan would carry a settled baseline
  over a completion the engine could still refuse
- no finding is ever presented and no findings summary renders — both
  reviews returned clean — and no tracking entry exists in the manifest
- nothing is re-authored: no staging subtree, no task gates, no task
  file content changes beyond what the grapher reapplies unchanged
- the four scripted answers were consumed by the resume choice, the
  phase-structure gate, the graph approval and the conclude gate, in
  that order and nowhere else
- the specification is untouched — no corrigendum, no reindex, no
  status change — and the discussion document is untouched; nothing was
  triaged and nothing reopened
- cache payloads are expected working artifacts

EXPECTED WORLD — from an authored, graphed, once-reviewed plan:

- the manifest holding planning `completed`, `review_cycle` 2, both
  approvals as they were, `task_map` and `external_id` unchanged, no
  tracking entries, and `spec_commit` re-stamped to a commit of this
  session rather than the fixture's baseline
- the task files unchanged in substance: same dependencies, same
  priorities, statuses all pending
- planning.md, the detail files, the specification and the discussion
  untouched; no review tracking files anywhere; no implementation
  artifacts; no second work unit
