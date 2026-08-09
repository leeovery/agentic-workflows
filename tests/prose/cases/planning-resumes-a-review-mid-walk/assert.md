The prose should have taken this path:

1. the entry's spec gate clears; the planning status reads in-progress
   and the handoff is the continuing variant
2. the process offers the resume; spec change detection diffs the
   specification against the plan's recorded baseline and reports it
   unchanged
3. on continue, session setup loads the format references and resets
   the gate modes; the specification is verified by listing it
4. construction fast-paths: the existing structure is presented through
   the engine-rendered phase tree and confirmed with nothing
   re-recorded; the loop reports complete
5. the graph step delegates to the grapher — stubbed, reapplying the
   existing edges unchanged — and the approval commits through the
   scoped plan commit
6. review cycle initialisation reads cycle 1 from the manifest and
   increments to 2 through the engine; the cycle gate passes; the
   traceability then integrity reviews are dispatched sequentially —
   both stubbed clean, no tracking file written
7. with no findings surfaced this cycle, completion's tracking
   checkpoint reads the tracking subtree, finds cycle 1's traceability
   entry still in-progress, and routes into the findings walk for that
   tracking file
8. the findings summary renders through the engine with the tracking
   file's resolutions mapped into the payload — the Fixed finding
   struck with a remaining count of one, the Pending finding open —
   and the walk then presents ONLY the unresolved finding; the settled
   finding is never re-presented and its fix is never re-applied
9. on the user's yes, the remaining finding's Proposed content is
   applied to the pay-1-2 task file, its Resolution set to Fixed in
   the tracking file, the tracking entry set complete through the
   engine, and the commit lands
10. re-verification passes with every tracking entry complete; the
    review completes and commits; the compliance self-check refreshes
    the session's instructions; the conclusion gate is put to the user
    and, on their yes, the spec baseline is re-stamped from the current
    commit, the plan completes through the engine, and the final commit
    lands
11. the walk stops at the pipeline continuation — the bridge is never
    invoked

Further claims:

- exactly one finding gate is put to the user in the whole session
- the findings-summary payload carries a status for both findings —
  approved for the Fixed one, pending for the open one — and the
  rendered summary shows the struck row and the remaining count
- cache payloads are expected working artifacts

EXPECTED WORLD — from the mid-walk fixture:

- the manifest holding planning completed, review_cycle 2,
  tracking.review-traceability-tracking-c1 complete, and spec_commit
  re-stamped to a commit of this session rather than the fixture's
  baseline
- the tracking file's finding 1 untouched (Fixed, notes as written);
  finding 2's Resolution now Fixed
- tasks/pay-1-2.md carrying the retry-reuse sentence from the
  finding's Proposed content; pay-1-1 and pay-2-1 unchanged in
  substance; statuses all pending
- planning.md, the detail files, and the specification untouched; no
  implementation artifacts; no second work unit
