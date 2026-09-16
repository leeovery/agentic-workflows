The prose should have taken this path:

1. workflow-start boots (migrations + knowledge gate through engine
   boot), shows the active work, and routes into the epic's continue
   skill for search-relevance; backfill, topic discovery, and both
   sequencing steps are silent (every order present, no analysis cache
   owed, no specification on the board)
2. the epic dashboard renders with all three topics fresh, and the menu
   carries `a/cancel` and no `e/reactivate`
3. choosing `a` fetches the cancel-menu sub-view: one `Topics` group,
   three numbered rows in map order, none locked, no `Specifications`
   group
4. picking Relevance Measurement fetches the engine-rendered cancel
   gate addressed to the discovery unit — the statement says nothing
   has started, so only the map row is marked, and it can be
   reactivated later — and STOPs; the flow never composes the
   statement itself and never runs the cancel before the yes
5. on yes the flow runs one cancel transaction addressed `discovery`
   and fetches the receipt through the engine (`Cancelled "Relevance
   Measurement".`); no cascade gate, no `--cascade`, no discovery-map
   remove, no manifest write by hand
6. the dashboard re-renders with the topic cancelled and the menu now
   carries `e/reactivate`
7. choosing `e` fetches the reactivate-menu sub-view: one row,
   Relevance Measurement, `never started`
8. picking it runs one reactivate transaction addressed `discovery` and
   fetches the receipt (`Reactivated "Relevance Measurement".` with
   nothing restored)
9. the dashboard re-renders with the topic fresh again and the menu
   without `e/reactivate`; the walk stops there

Further claims about the end state:

- the map row is the fixture's again: no `cancelled` marker, `order` 3
  back and no `previous_order` left
- no research or discussion item was born under any name; nothing else
  on the manifest moved
- the cancel and the reactivate each landed as their own engine commit
  (`workflow(search-relevance): cancel relevance-measurement
  (discovery)`, `… reactivate …`), and no other commit was made
