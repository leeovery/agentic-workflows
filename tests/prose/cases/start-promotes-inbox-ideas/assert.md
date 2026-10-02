The prose should have taken this path:

1. initialisation runs the boot pipeline — no migrations to apply, the
   knowledge base ready — and the discovery dump shows no active work
   but two inbox items, routing to the empty state
2. the empty-state snapshot renders with its start menu; the first
   scripted answer selects the inbox action by its ACTIONS entry
3. the inbox pickup snapshot renders the numbered list of both ideas —
   no archived option, the archived store is empty — and the second
   answer selects both numbers, building a two-item working set
4. the working-set snapshot is fetched with both paths; the set is
   type-uniform (ideas), so the work option is offered; each item gets
   a short synthesised summary in the set display, and the third
   answer chooses work
5. work routes to discovery with work_type none and both inbox paths
   as seeds, comma-joined in set order — the work_unit argument is the
   literal none: the engine's handoff names `workflow-discovery` with
   `none none` and the two paths, the line naming where the work goes is
   the turn's last text, and the walk stops at the handoff

Further claims:

- the handoff carries the skill and its three arguments and nothing
  else — the summaries synthesised for the set display stay behind
- discovery starts in the next context, not this one: no seed file is
  read for shaping, no work unit is created
- nothing was archived, restored, or deleted from the inbox

EXPECTED WORLD — from the fixture:

- both ideas still in `.workflows/.inbox/ideas/`, unchanged; no work
  unit, no `seeds/` directory anywhere
- the working-set summaries payload in the cache
  (`.workflows/.cache/working-set-summaries.json`) is expected — the set
  display's input, not state
