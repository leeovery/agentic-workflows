The prose should have taken this path:

1. the entry's prerequisite gate renders empty — plan and
   implementation are completed — and the review status reads empty, so
   nothing is reopened and the handoff carries the work forward with
   nothing asked
2. the process registers the review, reads the plans and specification,
   scopes verification from the per-task implementation commits, and
   dispatches a verifier per task — stubbed clean; both task ids land
   on the reviewed list, and the aggregation finds nothing unsettled
3. the change-set verification derives its sections from the
   specification's numbered headings — the payment-intent section, the
   capture section, and the test surface — gathers the brief (the
   first task commit, the file list, no declared linters, the finding
   floor, no unsettled file) and dispatches one agent per section,
   three in all — stubbed clean, each with a coverage map — then
   checks the tree with nothing outside `.workflows/` dirty and has
   nothing to reconcile, so no `not-measured.txt` is written
4. the review report is produced with a Pass verdict — no
   `actions.json` exists on the clean path, so the verdict derives
   from nothing outstanding — and committed; the presentation renders
   with zero counts, the scripted answer continues past the gate, and
   the compliance self-check runs
5. the review completes through the engine, and the completion commit
   lands
6. the pipeline continuation invokes the bridge with the work unit and
   the completed phase review, and the walk crosses into the bridge
7. the bridge reads the work type — feature, not discovery, not epic —
   and runs its discovery gateway, whose output derives next_phase as
   done
8. routing selects the feature continuation, whose terminal check
   matches done first: the work unit is completed through the engine's
   one-command completion — status, timestamp, and commit together
9. the completion banner is fetched via render workunit-receipt with
   the pipeline flag, its confirmation section is emitted verbatim,
   and the walk
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
- the review report at `.workflows/pay/review/pay/report.md` holds a
  Pass verdict, its Specification Compliance carrying the three
  coverage maps and its Criteria not measured line reading none; one
  per-task report file exists per task suffix, and one change-set file
  per section — `change-set-c1-1-payment-intent.md`,
  `change-set-c1-2-capture-webhooks.md`, `change-set-c1-test-surface.md`
- the plan, tasks, specification, and source files are untouched; no
  second work unit exists
