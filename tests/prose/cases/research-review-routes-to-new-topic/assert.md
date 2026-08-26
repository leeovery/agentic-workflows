The prose should have taken this path:

1. the entry reads the research status, finds it in progress, and hands
   off to the processing skill without asking the user anything — the map
   item's source is map-shaped, so nothing is gathered
2. the process detects the in-progress file, renders resume detection,
   and the user continues; initialisation is skipped
3. the walk passes through file strategy and the guidelines, addresses
   the knowledge base once as a contextual query, and routes into the
   epic research session
4. the user signals they are done. The triage check reads the queue and
   finds it empty; no agent is in flight, so the walk enters topic
   completion, which re-reads the queue and runs the closing gates
5. the final review dispatches — no review row has ever existed here —
   and the stubbed report lands at the dispatch path carrying one
   finding
6. the report has findings, so the row is acknowledged with its ids and
   the final-review menu renders its count. The user opts to work
   through it
7. the finding's lane is read from the report and re-classified against
   the current document: it is a `route` — ground this topic does not
   own — so the walk takes the belongs-elsewhere lane, not the walked
   `Needs Investigation` raise and not an in-place amendment
8. the landing phase is judged from the concern's nature — an open
   question to explore, so `research`, regardless of anything about the
   target — and the batch payload names the target the report proposed:
   `experiment-assignment`, a name **no row on the map holds**, with the
   detail saying the landing creates it. One item, rendered through the
   engine's finding-batch surface
9. the user approves the send. Triage landing resolves the target against
   live map state, finds no row, and creates it through the shared
   topic-creation core: the name is validated, and the discovery item is
   written routed at the judged landing phase with `reroute:` provenance
   naming this topic as the origin. No summary was passed, so the item is
   created for later backfill rather than with invented text
10. with the target now on the map, the concern is written out in full
    and delivered by the self-committing `topic triage`: the research
    item is created as `triaged` — parked, never started — the concern
    lands as one engine-numbered file in the new topic's research triage
    queue, and the delivery commits under the reroute message
11. the landed id is recorded in one surface call, the send is confirmed
    in a single line, and the lane empties. No lane holds findings, so
    the row is drained and closed out loud, and the conversation is
    handed back. The walk stops there — nothing concludes

Further claims:

- `experiment-assignment` is on the discovery map with a `reroute:`
  source naming relevance-measurement, and its research item is
  `triaged` — not `in-progress`: nothing was started
- its research triage queue holds exactly one file (`001-…`) whose
  provenance line names relevance-measurement · research and whose body
  carries the finding's substance — what interleaving needs from a
  traffic layer and why neither of the other two topics owns it — not a
  bare title
- no research artifact file exists for `experiment-assignment` — the
  concern is parked in the queue
- the origin's own research file is untouched by the routing: the thread
  is not written into it as an unexplored note, and no reroute record is
  written there either — the target's queue is the record
- exactly one review dispatch, and no re-dispatch after the report landed
- the delivery's scratch concern file under `.workflows/.cache/` is
  consumed
- git history holds the delivery commit
  (`research(search-relevance/relevance-measurement): reroute concern to
  experiment-assignment`) as its own action-scoped commit
- nothing concludes: no `topic complete`, no document review, no
  knowledge indexing, and no deep-dive dispatched

EXPECTED WORLD — the fixture plus: the `experiment-assignment` discovery
item with reroute provenance; a `triaged` research item under that name;
one numbered concern file in its research triage queue; the stubbed
review report on disk in relevance-measurement's cache with its agent row
holding the one finding surfaced; and relevance-measurement's own
research item still in progress with its document unchanged.
