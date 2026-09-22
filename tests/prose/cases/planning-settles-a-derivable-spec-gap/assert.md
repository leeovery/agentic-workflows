The walk resumes a plan into Phase 1's task design, meets a
specification defect in the designer's return, and settles it against
the specification's own recorded rule before anything is written to the
plan or put to the user. The correction lands as a corrigendum on the
concluded specification, attributed to the planning phase; the designer
is then re-run against the corrected record, and what the user approves
is the amended task list.

Expected path:

1. the entry's specification gate renders empty — the specification is
   completed and settled, so nothing blocks; the planning status reads
   in-progress and the handoff is the continuing variant
2. the process finds the planning entry; spec change detection diffs the
   specification against the plan's recorded baseline commit and writes
   the read, and the resume gate leads with it — unchanged; the user
   continues
3. session setup loads the format's about and authoring references and
   resets the three gate modes to `gated`; the specification is
   verified by listing it
4. construction opens on the existing phase structure — the phases are
   already in the planning file, so no phase designer is dispatched;
   the structure is presented through the engine-rendered phase tree
   and confirmed, and with the approval already stamped and the
   structure unchanged nothing is re-recorded
5. the position sits at Phase 1, which carries no task table, so task
   design is delegated: the work type is read from the manifest and the
   task designer is dispatched with the specification and the target
   phase. Its stubbed return carries the two-task table **and** a
   `## Spec Defects` section naming the intent attachment's unstated
   client timeout
6. the defect is settled **before the task table is written and before
   the task-list gate renders**. The specification is this work unit's
   own and this session's phase is planning — a downstream phase — so
   the correction routes through that arm: the specification item's
   status reads completed and the presence scan shows no
   specification-topic row, so neither early return fires
7. the classification reaches the open class and stays there: no
   approved, landed change supersedes the omission, and the bound is
   not a value the tree can measure — the shared clients are ambient
   and no file carries either timeout — so the record does not settle
   it directly; the code is not wrong, since the specification's own
   design puts the bounds on the shared clients rather than the call
   sites. Within the open class the session finds the defensible
   derivation: the section's own recorded rule for the intent-creation
   bound — twice the dependency's documented p99 — transfers
   mechanically to the orders store's recorded 250 milliseconds,
   yielding 500 milliseconds. It settles the point in place rather
   than returning it open
8. the settle is the four record-settled steps, silently: the missing
   bound is ADDED to the Client Call Bounds section — the section that
   owns the ground, nothing replaced elsewhere; one dated corrigendum
   attributed to `planning/pay` is appended under a Corrigenda section
   the file did not have, stating the point the specification left open
   (never a quoted claim — the defect is an omission) and recording the
   derivation; the specification is re-indexed with a single-file
   knowledge index; and one scoped commit lands carrying
   `--topic specification/pay`, `--kb` and `--sweep`. No gate renders
   for it, no question is asked, no scripted answer is consumed, and
   the specification item's status is never touched
9. the landing changed the specification, so the task designer is
   re-invoked through its amendment path with the correction as
   feedback; its second stubbed return carries the same two-task table
   and no defects. One corrigendum landed, so the engine's spec
   corrections line is fetched with a count of 1 and emitted — one
   line, never a per-correction recap
10. only then is the amended task table written under Phase 1 in the
    planning file, the manifest position recorded, and the draft
    committed on the planning topic's scope; the task-list payload is
    written to the phase cache with the Write tool
11. the task-list gate renders through the engine and the walk
    **STOPS**; the user's yes records the Phase 1 task-list approval,
    advances the position to the first task, and lands the approval
    commit. The walk stops there

Further claims:

- exactly two task-designer dispatches fired — the first returning the
  defect, the second the amendment — and the second ran only after the
  corrigendum had landed. No phase designer and no task author was ever
  dispatched
- the three scripted answers were consumed by the resume choice, the
  phase-structure gate and the task-list gate, in that order and
  nowhere else. The specification correction took no user turn:
  nothing about it was asked, offered, confirmed or waited on
- the specification's Client Call Bounds section now states the intent
  attachment's bound at 500 milliseconds with its derivation — twice
  the store's documented 250 millisecond p99, by the rule the section
  already records for intent creation; the intent-creation bullet and
  every other section stand exactly as the fixture left them
- the specification file ends with a Corrigenda section holding exactly
  one entry, dated and attributed to `planning/pay`, whose text states
  the point the file had left open and the derivation that settled it.
  An entry attributed to anything else — a work unit name, a bare
  `planning` — means the correcting phase was not carried through
- the specification item in the manifest is untouched: still
  `completed`, no reopen, no status change, no reconcile flag, and its
  source row still `incorporated`
- the plan carries no `[needs-info]` marker, no flagged task, and no
  note of the ambiguity anywhere — the answer went into the record, not
  into the plan
- the planning file's Phase 1 now carries the two-task table and Phase 2
  still carries none; the phase goals, acceptance criteria and ordering
  rationale are unchanged
- the manifest's planning item ends in-progress with
  `approvals.structure` as it was, `approvals.tasks.p1` newly stamped,
  the position at Phase 1 on the first task, all three gate modes
  `gated`, `review_cycle` still 0, and `spec_commit` untouched — the
  baseline is re-stamped only at conclusion
- nothing reopened, nothing was triaged, no wait gate and no incoherence
  gate rendered, the discussion document is byte-identical to the
  fixture's, and no second work unit exists
- cache payload files (phase tree, task list) are expected working
  artifacts
