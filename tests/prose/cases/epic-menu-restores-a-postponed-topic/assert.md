The prose should have taken this path:

1. workflow-start boots (migrations + knowledge gate through engine
   boot), shows the active work, and routes into the epic's continue
   skill for search-relevance; backfill, topic discovery, and both
   sequencing steps are silent — a postponed row asks for no order, and
   nothing else on the board is unsequenced
2. the epic dashboard renders — one decided topic and one fresh one in
   the tree, the postponed topic named on the compact line beneath with
   its horizon — and the menu carries the pull-forward row beside
   `a/cancel` and `p/postpone`. There is no `e/reactivate`: nothing is
   cancelled, and postpone and cancel have different ways back
3. choosing the pull-forward row fetches its sub-view: one `Topics`
   group holding a single numbered row, Synonym Handling with the
   horizon it waits under. No other topic appears — the two still on the
   board never left, so there is nothing to bring back for them
4. picking it stores the topic and the roadmap item the row carries,
   and runs the return through the roadmap verb — the pull is the way
   back, not the reactivate. No horizon is asked for and no gate is
   composed: the row the user picked is the whole decision
5. the receipt is fetched from the engine and emitted, naming the
   statuses the unit came back to — the discussion returning to
   completed. The flow composes no confirmation of its own
6. the dashboard re-renders with Synonym Handling back in the tree at
   its old place in the order and no postponed line beneath the phases;
   the walk stops there with nothing selected

Further claims:

- reactivate is never reached for: no reactivate transaction runs and no
  reactivate menu is fetched. A postponed topic is not a cancelled one,
  and the epic menu offers only the door that fits
- nothing is written by hand: no manifest write, no discovery-map call,
  no second postpone. One roadmap verb does the whole return
- the roadmap skill is never invoked — the epic menu's own row is the
  door, and the walk never leaves the epic

EXPECTED WORLD — from the fixture:

- the manifest's discussion item for `synonym-handling` reads
  `completed` again with its stash gone, and its map row carries no
  postponed marker and holds order 2 once more — the number no live row
  took while it was away. The other two map rows are untouched, still
  at 1 and 3
- the discussion file and the topic's brief are exactly as the fixture
  left them — the topic's documents never moved in either direction —
  and the topic's thinking is back in the knowledge base
- the project manifest's roadmap still holds the item under `v2`, now
  joined to the epic and its topic, with `postponed_from` gone: the item
  is in flight again
- no research, specification, planning, implementation, or review item
  exists under any name; no second work unit; the work-unit status is
  still in progress
- git history holds the engine's own pull-forward commit over both
  manifests, and nothing else was committed
