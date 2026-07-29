The prose should have taken this path:

1. the entry's prerequisite gate renders empty — plan and
   implementation are completed — and the review status reads empty, so
   nothing is reopened and the handoff carries the work forward with
   nothing asked
2. the process registers the review, reads the plans and specification,
   scopes verification from the per-task implementation commits, and
   dispatches a verifier per task — stubbed clean; both task ids land
   on the reviewed list
3. the review report is produced with an Approve verdict and committed;
   the verdict is presented, the scripted answer continues past the
   questions gate, and the compliance self-check runs
4. the actions loop finds every verdict Approve: the no-actionable
   display renders, the review completes through the engine, and the
   completion commit lands
5. the pipeline continuation invokes the bridge with the work unit and
   the completed phase review, and the walk crosses into the bridge
6. the bridge reads the work type — feature, not discovery, not epic —
   and runs its discovery gateway, whose output derives next_phase as
   done
7. routing selects the feature continuation, whose terminal check
   matches done first: the work unit is completed through the engine's
   one-command completion — status, timestamp, and commit together —
   with the pipeline flag
8. the completion confirmation section is emitted verbatim and the walk
   stops at the terminal condition — no early-completion gate, no
   revisit offer, no plan mode, no plan file

Further claims:

- the bridge never runs the early-completion or revisit renders — the
  done arm precedes both
- no EnterPlanMode is attempted and no plan content is produced —
  the terminal arm ends the pipeline instead
- the work unit's manifest ends with status completed and a
  completed_at stamp; the review item is completed with both internal
  ids in reviewed_tasks
- no cache directory for the work unit remains at
  `.workflows/.cache/pay/` after the completion
- the review report at `.workflows/pay/review/pay/report.md` holds an
  Approve verdict; one per-task report file exists per task suffix
- the plan, tasks, specification, and source files are untouched; no
  second work unit exists
