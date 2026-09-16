# Fixture — spec-grouping-reserves-a-cancelled-key

The `search-relevance` epic after a specification was cancelled from
the epic menu: both discussions (`behavioural-ranking`,
`synonym-handling`) concluded in earlier sittings, and the `expansion`
specification — completed over the pair, both source rows incorporated,
a document on disk, sequenced first in the build order — then cancelled
as one unit. Its item reads `cancelled` with `previous_status:
completed`, its order stashed as `previous_order: 1`, and its sources
map intact. No plan, implementation, or review exists under any name.
The third map topic, `relevance-measurement`, is still fresh.

A cancelled specification groups nothing, so both discussions are
unaccounted again and no analysis cache exists: the next specification
entry runs the grouping analysis. The spec-entry snapshot lists the
cancelled specification under `cancelled_specifications:` with its two
sources, and nothing under `specifications:`.
