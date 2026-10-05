The prose should have taken this path:

1. the title renders, the index dump runs, and the count is one; the
   work unit arrived as an argument, so no epic is picked, and the
   completed phase `review` and the outcome `completed` are held
2. validation finds the epic in the index and runs the scoped dump for
   it, which reads `all_done: true`
3. the session is labelled with the work unit alone; the legacy
   research-split detector finds nothing to split and every map row has
   its summary and description, so nothing is backfilled
4. the gap analysis cache reads valid, so no analysis is dispatched; the
   map and the build order are both sequenced, so neither is re-derived
5. before the menu, the banner for what came in: `render
   phase-completed` for the work unit with phase `review`, its section
   emitted verbatim — review completed for the epic. No paused banner
6. the scoped dump read all done, so the completion offer follows the
   banner in the same step: its marker and signpost, then the engine's
   all-done gate fetched and its menu emitted, and the flow STOPs
7. the scripted user answers yes: one `workunit complete` marks the epic
   completed with the epic pipeline's commit message, and the receipt is
   fetched through the engine with the pipeline flag and its
   confirmation emitted verbatim. The flow ends at that terminal
   condition

Further claims:

- the epic's dashboard and menu never render — the `view` snapshot is
  never fetched — and no route is taken: completing the epic ends the
  flow
- no handoff is made and no phase entry is invoked
- the banner is the completed banner, rendered once, before the gate;
  the gate is fetched once
- nothing is written by hand: the completion is the engine's own
  transaction and commit

EXPECTED WORLD — from the fixture:

- the work unit's manifest reads `status: completed` with a
  `completed_at` stamp; every phase item is exactly as the fixture left
  it
- git history holds the completion commit
  (`workflow(search-relevance): complete epic pipeline`) and nothing else
  new
- completing the epic purges its cache: everything under
  `.workflows/.cache/search-relevance/` — the fixture's gap-analysis
  file and any per-turn heartbeat — is gone, the unit's scratch going
  when the unit closes
