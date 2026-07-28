The prose should have taken this path:

1. the entry's source gate renders empty — the discussion is completed,
   nothing blocks; the phase status reads empty so the verb is a
   creation, and the handoff names the discussion as source material —
   the entry asks the user nothing
2. the process finds no specification file — a fresh start, no resume
   choice is put to the user
3. the source is verified by listing it, not reading it; the
   specification file is created from the format template BEFORE any
   manifest change, then the item registers through the engine, the
   discussion lands as a pending source, review state and both gate
   modes initialise in one batched write, and the initialisation
   commits
4. session setup resets the gate modes and finds no consult references
   to register
5. construction runs one topic at a time: extraction re-scans the
   discussion, each piece is presented in the form it will take in the
   specification and explicitly approved before any write, logged
   verbatim, committed — the whole specification is never generated in
   one pass, and auto mode is never engaged
6. when the discussion's relevant content is exhausted, its source row
   flips to incorporated
7. review cycle 1 initialises through the engine; the input-review
   agent is dispatched first — against the discussion file as its
   source material, never against the specification itself — and
   returns clean through the harness stub, with no tracking file, so
   the no-findings result is announced; only then is gap analysis
   dispatched, with the same clean return; the two are never dispatched
   in parallel
8. with both phases clean the review completes — no findings menus, no
   second cycle — and the review state commits
9. the compliance self-check re-reads the session's instructions;
   completion verifies tracking, sources, and consult references, and
   puts the sign-off to the user
10. on their yes the topic completes through the engine — the artifact
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
  discussion source incorporated, review_cycle at 1, both gate modes
  gated, and no tracking entries; the discussion item untouched and
  still completed
- no review tracking files on disk — clean reviews write none
- no planning, implementation, or review artifacts anywhere; no second
  work unit
