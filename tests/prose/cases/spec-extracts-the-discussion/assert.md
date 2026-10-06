The prose should have taken this path:

1. the source gate renders empty — the discussion is completed,
   nothing blocks — and the specification status reads empty, so this
   is a first start: no phase note, no resume choice, and the user is
   asked nothing
2. the specification file is created from the format template BEFORE
   any manifest change, then the item registers through the engine, the
   discussion lands as its one pending source, review state and both
   gate modes initialise in one batched write, and the initialisation
   commits
3. session setup resets the gate modes and holds the discussion at
   `.workflows/pay/discussion/pay.md` as the source — a feature reads no
   research beside it
4. construction runs one topic at a time: extraction re-scans the
   discussion, each piece is presented in the form it will take in the
   specification and explicitly approved before any write, logged
   verbatim, committed — the whole specification is never generated in
   one pass, and auto mode is never engaged
5. when the discussion's relevant content is exhausted, its source row
   flips to incorporated
6. review cycle 1 initialises through the engine; the claims
   verification agent is dispatched first, then input review — against
   the discussion file as its source material, never against the
   specification itself — then gap analysis, each returning clean
   through the harness stub with no tracking file, so each no-findings
   result is announced; no two agents are ever dispatched in parallel
7. with all three phases clean the review completes — no findings
   menus, no second cycle — and the review state commits
8. the compliance self-check re-reads the session's instructions;
   completion verifies tracking and sources, and puts the sign-off to
   the user
9. on their yes the topic completes through the engine — the artifact
   is indexed as part of that call, never by a direct knowledge-CLI
   call — the date is stamped, the conclusion commits, and the walk
   stops at the pipeline continuation without invoking the bridge

Further claims:

- nothing the discussion decided is re-asked, and the user's approvals
  are explicit — content is never written ahead of them
- the deferred wallet support stays out of the specification's
  requirements, appearing at most as recorded out-of-scope
- no supersession runs — the source is a discussion, not a prior
  specification
- cache and scratch files under `.workflows/.cache/` are expected
  working artifacts

EXPECTED WORLD — from a feature holding a completed discussion and
nothing later:

- a standalone specification at
  `.workflows/pay/specification/pay/specification.md` carrying the
  discussion's decisions — the existing gateway account, card-only v1,
  webhook-confirmed capture with no polling — with wallets excluded
  from requirements, and no reliance on reading the discussion back
- the manifest holding the specification completed with a date, the
  discussion source incorporated, review_cycle at 1 with the construction baseline recorded (review_baseline_words), both gate modes
  gated, and no tracking entries; the discussion item untouched and
  still completed
- no review tracking files on disk — clean reviews write none
- no planning, implementation, or review artifacts anywhere; no second
  work unit
