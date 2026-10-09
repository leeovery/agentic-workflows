The prose should have taken this path:

1. initialisation runs the boot pipeline — no migrations to apply, the
   knowledge base ready — and the discovery dump shows no active work
   but two inbox items, routing to the empty state
2. the empty-state snapshot renders with its start menu; the first
   scripted answer selects the inbox action by its ACTIONS entry
3. the inbox pickup snapshot lists the idea and the bug, and the second
   answer selects both numbers, building a two-item working set that
   mixes types
4. the working-set snapshot is fetched with both paths; each item gets
   a short synthesised summary in the set display. The work row is on
   the menu though the set mixes types — no blocker is shown and
   nothing asks the user to narrow the set — and the third answer
   chooses work
5. the set's pre-seed is the one the snapshot's data reads: the set
   holds an idea, so the work type is none — discovery decides the
   shape, and the bug rides along as a seed that never sets it. Work
   routes to discovery with that pre-seed and both inbox paths as
   seeds, comma-joined in set order, the idea first — the work_unit
   argument is the literal none: the engine's handoff names
   `workflow-discovery` with `none none` and the two paths, the line
   naming where the work goes is the turn's last text, and the walk
   stops at the handoff

Further claims:

- the handoff never carries `bugfix`: the bug in the set does not make
  the work a bugfix while an idea is beside it
- the handoff carries the skill and its three arguments and nothing
  else — the summaries synthesised for the set display stay behind
- discovery starts in the next context, not this one: no seed file is
  read for shaping, no work unit is created
- nothing was archived, restored, deleted, or put on a roadmap

EXPECTED WORLD — from the fixture:

- both captures still in `.workflows/.inbox/ideas/` and
  `.workflows/.inbox/bugs/`, unchanged; no work unit, no `seeds/`
  directory anywhere, no roadmap
- the working-set summaries payload in the cache
  (`.workflows/.cache/working-set-summaries.json`) is expected — the set
  display's input, not state
