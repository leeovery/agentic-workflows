# Fixture — epic-menu-unblocks-a-dep-blocked-plan

The `search-relevance` epic stands at the edge of delivery: both
discussions concluded, both specifications completed and ordered
(`behavioural-ranking` 1, `synonym-handling` 2), both plans completed.
The `synonym-handling` plan declares one external dependency, resolved
to `behavioural-ranking:behavioural-ranking-1-2` — and no
implementation exists anywhere, so that dependency is unmet and the
plan is dep-blocked. `behavioural-ranking`'s own plan is free to start.

`build_order_stale` is clear (the sequence ran after the completions),
the map is fully ordered, both analysis caches are settled, and the
active-session marker is cleared — entry runs no machine work before
the dashboard. The third map topic, `relevance-measurement`, is still
fresh and research-routed, so the map has not converged.
