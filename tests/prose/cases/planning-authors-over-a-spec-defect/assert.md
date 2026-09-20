The walk resumes a plan whose Phase 1 task list is approved and
authors that phase. The author's first return reports a specification
defect the record settles; it is corrected by corrigendum before any
task reaches its gate, the whole phase is authored again against the
corrected record, and only the second version is ever put to the user.

Expected path:

1. the entry's specification gate renders empty; the planning status
   reads in-progress and the handoff is the continuing variant
2. the process finds the planning entry and offers the resume; spec
   change detection diffs the specification against the plan's recorded
   baseline commit and reports it unchanged; the user continues
3. session setup loads the format's about and authoring references and
   resets the three gate modes to `gated`; the specification is
   verified by listing it
4. construction opens on the existing phase structure — no phase
   designer is dispatched; the structure is presented through the
   engine-rendered phase tree and confirmed, with nothing re-recorded
5. Phase 1 already carries its task table, so no task designer is
   dispatched either: the task-list payload is written to the phase
   cache and the existing-variant task-list gate is rendered for
   confirmation. On the user's yes nothing is re-recorded — the
   approval is already stamped — and the flow moves to authoring
6. no task id for Phase 1 is in `task_map`, so authoring runs. No task
   detail file exists and no staging rows do, so it is a full run: the
   task author is dispatched, and its stubbed first return writes
   `.workflows/pay/planning/pay/phase-1-tasks.md` with both tasks and
   returns a `## Spec Defects` section naming the attach task's
   unstated client timeout. The defects section stays in the return —
   it reaches neither the detail file nor the planning file
7. validation passes: the detail file's two tasks match the planning
   file's two-row table. This is not an amendment run — no row is
   `rejected`, and none is reset
8. the defect is settled **before any task reaches its gate**. The
   specification is this work unit's own and this session's phase is
   planning — a downstream phase — so the correction routes through
   that arm: the item's status reads completed and the presence scan
   shows no specification-topic row, so neither early return fires
9. the classification reaches the open class and stays there: no landed
   change supersedes the omission, and the bound is not a value the
   tree can measure — the shared clients are ambient — so the record
   does not settle it directly; the code is not wrong, since the
   specification's own design puts the bounds on the shared clients.
   Within the open class the defensible derivation is the section's own
   recorded rule — twice the dependency's documented p99 — applied to
   the orders store's recorded 250 milliseconds, yielding 500
   milliseconds. It is settled in place
10. the settle is the four record-settled steps, silently: the missing
    bound is ADDED to the Client Call Bounds section, one dated
    corrigendum attributed to `planning/pay` is appended under a
    Corrigenda section the file did not have, stating the point the
    specification left open and recording the derivation, the
    specification is re-indexed with a single-file knowledge index, and
    one scoped commit lands carrying `--topic specification/pay`,
    `--kb` and `--sweep`. No gate renders for it and no scripted answer
    is consumed
11. one corrigendum landed, so the engine's spec corrections line is
    fetched with a count of 1 and emitted — one line, never a
    per-correction recap
12. the landing changed the specification and this return is not itself
    from a re-run, so the whole phase is authored again as a full run.
    This is a first authoring run, so there is **no** `staging.author-p1`
    subtree to clear and no delete is issued. The author is dispatched
    a second time and its stubbed return rewrites the same detail file,
    the attach task now carrying the 500 millisecond bound, and reports
    no defects
13. validation passes again; nothing is left to settle, so the flow
    reaches the gate check: the staging subtree is read, found absent,
    and both task rows are registered `pending` in one batched write.
    `author_gate_mode` reads `gated`, so the approval loop runs
14. the first task is presented in full from the detail file and its
    gate is rendered through the engine at position 1 of 2. The walk
    **STOPS**. The user takes auto: this task and the remaining pending
    row are recorded `approved` and `author_gate_mode` is set to `auto`
    in one batched write
15. no row is `rejected`, so the revision check passes straight through
    and the write pass runs. The first task is written to
    local-markdown at `.workflows/pay/planning/pay/tasks/pay-1-1.md`,
    and one batched manifest write folds its external id with the
    phase's mapping and the plan's `external_id` — the once-per-phase
    and once-per-plan fields that ride the phase's first task — and the
    next task position. Its own scoped plan commit lands, and the walk
    stops there

Further claims:

- the task detail file was written **twice**, and only the second
  version reached the user: it carries the 500 millisecond bound on the
  attach task's Do, Acceptance Criteria and Tests, and the first
  version's bound-less attach task survives nowhere on disk
- no task reached its gate before the corrigendum landed: the author
  gate is rendered once, after the second authoring run. A gate
  rendered before the specification commit means the user approved
  content authored against a record known to be wrong
- the specification's Client Call Bounds section now states the attach
  write's bound at 500 milliseconds with its derivation — twice the
  store's documented 250 millisecond p99, by the rule the section
  already records for intent creation; the intent-creation bullet and
  every other section stand as the fixture left them
- the specification file ends with a Corrigenda section holding exactly
  one entry, dated and attributed to `planning/pay`. An entry
  attributed to anything else — a work unit name, a bare `planning` —
  means the correcting phase was not carried through
- no `manifest delete pay.planning.pay staging.author-p1` is recorded
  before the re-run: a first authoring run has no subtree to clear, and
  a delete issued over nothing is a guard on an impossibility
- the staging subtree ends with both rows `approved`; `author_gate_mode`
  ends `auto` while `task_list_gate_mode` and `finding_gate_mode` stay
  `gated`
- `task_map` ends carrying the phase mapping and `pay-1-1` only —
  `pay-1-2` was never written — `external_id` reads `pay`, and the
  position has advanced to `pay-1-2`
- exactly two task-author dispatches fired and nothing else: no phase
  designer, no task designer, no review agent
- the four scripted answers were consumed by the resume choice, the
  phase-structure gate, the task-list gate and the author gate, in that
  order and nowhere else. The specification correction took no user
  turn
- neither task carries a `[needs-info]` marker or a note of the
  ambiguity — the answer went into the record, not the plan
- the specification item is untouched: still `completed`, no reopen, no
  reconcile flag, its source row still `incorporated`; nothing was
  triaged, no wait gate and no incoherence gate rendered, the
  discussion document is byte-identical to the fixture's, and the plan
  is never concluded
- cache payload files (phase tree, task list) are expected working
  artifacts
