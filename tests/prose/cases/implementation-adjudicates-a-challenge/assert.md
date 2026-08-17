The prose should have taken this path:

1. the plan gate renders empty and no implementation item exists, so
   this is a new entry; the entry validates and hands off; resume
   detection reports the created mode and commits the start of
   implementation through the engine's scoped commit
2. environment setup finds the existing document and asks nothing;
   the plan adapter loads; project skills and linter discovery each
   ask only their skip-again question — the first two scripted
   answers skip both
3. the loop reads work_type once at entry; the crash-resume healing
   finds nothing to heal; task pay-1-1 is selected first,
   normalised, started via the engine, marked in-progress, and its
   brief renders before the dispatch
4. the executor stub fires once for pay-1-1 and completes; the
   reviewer stub's first firing returns needs-changes with one
   issue and no BANK — nothing deposits
5. stage E writes the findings to the attempt cache and records the
   attempt via fix-attempt (attempt 1, threshold not reached); the
   result header renders as needs-changes, the findings are
   presented, the fix gate is fetched via `render fix-gate`, and
   its menu is emitted — the gate is gated, so the loop stops
6. the third scripted answer disputes the finding, and the flow
   takes the challenge branch — never the direction branch: the
   executor is not re-invoked with the challenge as fix guidance
7. the confirmation review dispatches a fresh reviewer — the stub's
   second firing — carrying the standard items plus the challenged
   finding and the user's argument verbatim; it returns VERDICT
   approved with the finding withdrawn and the reason; no fix
   round ran, and no second fix-attempt was recorded
8. the confirmation carries no BANK and the original review carried
   no comment corrections, so nothing deposits and nothing is
   applied; the withdrawal is noted for the result summary and the
   flow proceeds to the task gate
9. the result is presented with the withdrawal noted, the task gate
   menu is emitted, and the fourth scripted answer approves
10. progress lands for pay-1-1: frontmatter flips to completed,
    tasks remain in the phase (pay-1-2 is open) so the disposition
    is `continuing` — the engine records completion naming pay-1-2
    as next with no --phase-complete, and one raw git commit lands
    as impl(pay): Tpay-1-1
11. the walk stops — pay-1-2 is never started

Further claims:

- exactly one fresh executor dispatch fired, never continued — the
  challenge produced no fix round
- exactly two reviewer dispatches fired: the review and the
  confirmation, the second a fresh dispatch, never a continuation
  of the first
- exactly one fix-attempt was recorded; the fix-tracking file for
  pay-1-1 exists with a single Attempt 1 section and rides the task
  commit
- the manifest's implementation item ends with pay-1-1 in
  completed_tasks, current_task pay-1-2, fix_attempts 0, every gate
  mode gated, and no bank, consolidated_phases, or completed_phases
  fields
- the task file pay-1-1 ends with status: completed and pay-1-2
  stays pending; the source and test files exist as the stub gave
  them, unmodified by any guard the withdrawn finding proposed
