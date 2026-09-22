The walk resumes a plan into Phase 1's task design, meets a
specification defect the record does not settle, and takes it to the
user as a brief exchange rather than a gate. The side they pick is a
product decision, so it lands in the discussion — the document that
records decisions — and the specification is then re-aligned to it by
corrigendum. Only then is the designer re-run and the task list put up
for approval.

Expected path:

1. the entry's specification gate renders empty — the specification is
   completed and settled; the planning status reads in-progress and the
   handoff is the continuing variant
2. the process finds the planning entry; spec change detection diffs the
   specification against the plan's recorded baseline commit and writes
   the read, and the resume gate leads with it — unchanged; the user
   continues
3. session setup loads the format's about and authoring references and
   resets the three gate modes to `gated`; the specification is
   verified by listing it
4. construction opens on the existing phase structure — no phase
   designer is dispatched; the structure is presented through the
   engine-rendered phase tree and confirmed, with nothing re-recorded
5. Phase 1 carries no task table, so task design is delegated; the
   stubbed return carries the two-task table **and** a `## Spec
   Defects` section naming what the shopper is shown while capture is
   unconfirmed, its Ground recording a search that came up empty
6. the entry is classified **before anything is written or rendered**,
   and it is a fork in what the product does that the record does not
   settle: the classification does not enter the correction route at
   all — no specification status read and no presence scan happens for
   the classification itself — and goes straight to the exchange
7. the fork is put to the user in conversation, not through any engine
   surface: what the plan needs and cannot build without, what was
   searched and where the record ran out, the two sides as product end
   states — the shopper told their order is confirmed, or told the
   payment is still confirming — what each costs them, and the
   session's stance. The gate mode is `gated`, so no auto-override
   announcement is made. The walk **STOPS**
8. the user's answer settles it — the shopper is shown a
   payment-pending state and never told the order is confirmed before
   the money is captured. The decision's home is the discussion, so
   presence is scanned and no session holds it
9. the decision is written into `.workflows/pay/discussion/pay.md` as a
   **new subtopic section** in the template's subtopic shape — Context,
   Options Considered carrying the alternative that was weighed,
   Journey carrying the reasoning, and a Decision naming what the
   shopper is shown — with no dated timeline entry and no `#### Initial`
   wrapper, because there is no prior block to revise. The section
   speaks in the document's own voice: nothing in it names planning, a
   specification, a task designer, a defect or this session
10. the edited discussion is re-indexed through the knowledge CLI; the
    sources-stale step is **skipped** — single-topic work has no
    sibling specifications — and the resolution commits scoped to the
    discussion with the sweep shape (`--topic discussion/pay --kb
    --sweep`)
11. the discussion now carries the decision, and that is the record
    that settles the specification: the correction route runs over this
    work unit's own specification from a downstream phase — the item's
    status reads completed, the presence scan shows no
    specification-topic row — and lands under the record-settled arm.
    The pending-state rule is added to the section that owns the ground,
    a dated corrigendum attributed to `planning/pay` is appended citing
    the decision the discussion now carries, the specification is
    re-indexed, and one scoped commit lands carrying `--topic
    specification/pay`, `--kb` and `--sweep`
12. the landing changed the specification, so the task designer is
    re-invoked through its amendment path with the correction as
    feedback; its second stubbed return carries the same two-task table
    and no defects. One corrigendum landed, so the engine's spec
    corrections line is fetched with a count of 1 and emitted
13. the amended task table is written under Phase 1, the manifest
    position recorded, the draft committed on the planning topic's
    scope, and the task-list payload written to the phase cache
14. the task-list gate renders through the engine and the walk
    **STOPS**; the user's yes records the Phase 1 task-list approval,
    advances the position to the first task, and lands the approval
    commit. The walk stops there

Further claims:

- the discussion document gains exactly one new subtopic section,
  deciding what the shopper is shown while capture is unconfirmed. The
  Gateway Integration subtopic and the Summary stand as the fixture
  left them, no timeline entry appears anywhere in the document, and
  nothing in the new section refers to the plan, the specification or
  the session that raised it
- the specification carries the pending-state rule, and ends with a
  Corrigenda section holding exactly one entry, dated and attributed to
  `planning/pay`, citing the discussion's decision as what settled it.
  A specification edited with no matching decision in the discussion
  means a product call was landed where no document records it
- no `sources stale` call is recorded — this is single-topic work, and
  the step is skipped rather than run and found empty
- the discussion item never leaves `completed` and is never reopened;
  nothing was triaged, no wait gate rendered, and the plan never paused
- the specification item is untouched: still `completed`, no reopen, no
  status change, no reconcile flag, its source row still `incorporated`
- exactly two task-designer dispatches fired — the first returning the
  fork, the second the amendment — and the second ran only after both
  landings. No phase designer and no task author was dispatched
- the four scripted answers were consumed by the resume choice, the
  phase-structure gate, the exchange, and the task-list gate, in that
  order. The exchange is the only stop the defect caused: the landings
  and the corrigendum asked nothing
- the plan carries no `[needs-info]` marker, no flagged task, and no
  note of the ambiguity — the answer went into the record, not the plan
- the planning file's Phase 1 now carries the two-task table and Phase 2
  still carries none; the manifest's planning item ends in-progress with
  `approvals.tasks.p1` newly stamped, the position at Phase 1 on the
  first task, all three gate modes `gated`, `review_cycle` still 0, and
  `spec_commit` untouched
- no second work unit exists, and cache payload files are expected
  working artifacts
