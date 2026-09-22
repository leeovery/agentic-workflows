The walk resumes a plan into Phase 1's task design, meets a
specification defect the record does not settle, and takes it to the
user as a brief exchange. The user's answer is that the point needs
real discussion work rather than a snap call, so nothing is decided
here: the concern goes to the owning discussion's triage queue and the
plan pauses behind it. Nothing is written into the plan, nothing is
written into the discussion document, and the specification is not
touched.

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
   settle: the classification does not enter the correction route — no
   specification status read, no presence scan for it — and goes
   straight to the exchange
7. the fork is put to the user in conversation, not through any engine
   surface: what the plan needs, what was searched and where the record
   ran out, the two sides as product end states, and the session's
   stance. The gate mode is `gated`, so no auto-override announcement
   is made. The walk **STOPS**
8. the user's answer does not settle it — the whole post-checkout
   experience needs exploration the record never did. The session does
   not press for a pick, does not re-present the fork, and does not
   settle it on its own: the point goes to the owning document's triage
   queue
9. the work type is `feature`, so the epic triage-landing reference is
   never loaded and no map topic is created or resolved. The concern is
   written in the triage entry shape — a short title, a `*From: pay ·
   planning · {date}*` line, then what the plan needs, the evidence,
   and what was explored — to
   `.workflows/.cache/pay/planning/pay/gap-concern.md` with the Write
   tool
10. one engine transaction delivers it: `topic triage pay discussion
    pay` with the concern file, a kebab-case slug and the message
    `planning(pay): gap routed to pay`. It reopens the completed
    discussion item to in-progress, installs the concern as the first
    numbered file in that topic's triage queue, and commits itself —
    the session commits nothing for the delivery
11. the plan pauses: the session's own work commits on the planning
    topic's scope with the pause message, an honest no-op here since
    the delivery left nothing dirty
12. the wait gate is fetched for the plan and now returns content — the
    landing staled the specification's source row and flagged it, so
    the specification is unsettled and the plan is held. Its blocker,
    guidance and menu are emitted verbatim and the walk **STOPS**
13. the user answers yes; the pause line is emitted and the walk stops
    at the invocation of `/workflow-bridge pay planning none paused`.
    The bridge is not executed

Further claims:

- the discussion item reads `in-progress` — reopened by the delivery —
  and its document file is byte-identical to the fixture's: no new
  subtopic, no timeline entry, no edit of any kind. A document that
  changed means a decision was landed where the user asked for a
  discussion
- exactly one file sits in the discussion's triage queue for this
  topic, engine-numbered, carrying the gap in the triage entry shape
  with the `*From: pay · planning · …*` line. It was installed by the
  engine, never written into the queue by hand
- the specification document is byte-identical to the fixture's: no
  corrigendum, no Corrigenda section, no edit. The specification item
  carries `reconcile_needed: discussion` and its `pay` source row reads
  `stale`, both set by the delivery — and its status is still
  `completed`, never reopened by this session
- the planning item is still `in-progress`, never completed and never
  reopened; `review_cycle` is still 0, `spec_commit` untouched, all
  three gate modes `gated`, and `approvals.tasks.p1` was never stamped
- the planning file carries no Phase 1 task table — the designer's
  table was never written, because the gap was settled nowhere. Phase
  goals, acceptance criteria and ordering rationale stand as the
  fixture left them
- the knowledge base is never written: no index call anywhere in the
  walk. Nothing was resolved, so nothing was re-served
- exactly one task-designer dispatch fired. No amendment re-invocation
  happened, no spec corrections line was rendered, and no phase
  designer or task author was dispatched
- the four scripted answers were consumed by the resume choice, the
  phase-structure gate, the exchange, and the wait gate, in that order.
  The user was never asked to pick a side after saying the point needed
  discussion, and never asked to classify anything
- no second work unit exists, and the cache's concern scratch and phase
  tree payload are expected working artifacts
