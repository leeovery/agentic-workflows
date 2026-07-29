The prose should have taken this path:

1. the entry's spec gate clears; the planning status reads in-progress
   and the handoff is the continuing variant — no resuming note is
   rendered, no late-context question, no cross-cutting sweep
2. the process finds the planning entry and offers the resume; spec
   change detection diffs the specification against the plan's recorded
   baseline commit and reports it unchanged
3. on continue, the missing-storage-paths backfill does not fire — the
   field is present — and session setup loads the format references and
   resets the gate modes
4. construction fast-paths over approved work: the existing structure
   is presented through the engine-rendered phase tree and confirmed
   with nothing re-recorded — the approval already stands; with the
   position past the last phase, construction reports the loop
   complete — no per-phase gate renders and no authoring dispatch
   occurs
5. the graph step reads format, external id, and task map through the
   engine, loads the format's reading and graph references, and
   delegates to the grapher — stubbed: the edges and priorities land in
   the task files' frontmatter and the summary comes back complete
6. the applied graph is presented and, on the user's yes, committed
   through the scoped plan commit
7. the walk stops there — external dependencies are epic-only and never
   run, the plan review never starts, and the plan is not concluded

Further claims:

- nothing is re-authored and no staging subtree ever exists — approved
  work is presented, never rebuilt
- the position advances only as construction sweeps phases; no task is
  started
- cache payloads are expected working artifacts

EXPECTED WORLD — from an authored, ungraphed plan:

- the task files carrying the applied graph: pay-1-2 depending on
  pay-1-1, pay-2-1 depending on pay-1-2, priorities 1 and 2 on the
  phase-1 tasks — everything else in them unchanged
- the planning item still in progress, approvals as they were, task_map
  and external_id unchanged, no staging subtree, no review tracking
- planning.md, the detail files, and the specification untouched; no
  implementation artifacts; no second work unit
