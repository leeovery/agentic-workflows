The prose should have taken this path:

1. the entry ensures the discovery item (already on the map — nothing
   written), reads the research status, finds it in progress, validates
   the phase, reads the map item's source and finds it shaped on the map
   rather than direct-started, so nothing is gathered, and hands off
2. the process renders the thread register, then resume detection — the
   triage queue read (empty, so no triage warning), then the
   continue-or-restart gate — and the user continues
3. initialisation and file strategy are skipped: the walk lands at the
   research guidelines, addresses the knowledge base once as a
   contextual query (empty store — the session proceeds silently), and
   enters the session step, which routes an epic to its own session
   wrapper
4. the session loop's triage check no-ops on an empty queue; no dive has
   ever been dispatched, so nothing is folded
5. the session takes up one of the open threads and the user calls the
   topic off. The session does not read that as a thread to park, a
   reroute, or a done-signal: nothing is set `parked`, no thread is
   added, no deep dive is offered, no conclude gate renders, and the
   research is never completed — with or without a dead end
6. the cancel protocol resolves the unit before anything else — the work
   type is read from the manifest, and a research session on an epic
   addresses the Discovery stage under the topic's own name
7. the confirm is fetched from the engine at
   `search-relevance.discovery.synonym-handling` and its menu emitted,
   and the flow STOPs. The statement is the engine's — the session never
   composes what the cancel takes — and nothing is cancelled before the
   yes
8. on yes the background-agent store is scanned for the session's own
   phase and topic; no row is in flight, so no task is stopped and no
   row is incorporated
9. one cancel transaction runs, addressed `discovery` — never
   `research`, never `discussion`, and never the work-unit cancel
10. the receipt is fetched from the engine and emitted; the response's
    `discarded`, `abandoned`, and `released_waits` all come back empty,
    so the session adds no line of its own
11. the session hands off to the pipeline bridge with the cancelled
    outcome and the next phase as `none`. No phase banner is rendered on
    the way through — neither the completed banner nor the paused one:
    the receipt was the session's
12. the bridge runs the epic continuation — the scoped discovery, no
    sequencing owed, no gap analysis owed, the epic not all done — and
    the dashboard and menu render. The walk stops with the menu waiting
    on a selection

Further claims:

- the dead end is never reached for: the research conclude gate is not
  rendered in either variant, the map row is never marked handled, and
  the topic is not closed as a question that was answered. Cancel and
  dead end are different endings and only one of them ran
- the thread register is not used as the exit — no thread is parked to
  stand in for the topic being dropped

EXPECTED WORLD — from the fixture:

- the manifest's research item for `synonym-handling` reads `cancelled`
  and carries `previous_status: in-progress`; the map row carries
  `cancelled: true` with its `order` stashed as `previous_order`, and no
  `handled` marker. The other two map rows are untouched, and their
  orders still read 1 and 3
- the research file is still on disk with its content intact — a cancel
  takes the item, never the document — and the thread register still
  carries both threads in whatever state the session's own turns left
  them
- no discussion, specification, planning, implementation, or review item
  exists under any name; no second work unit; the work-unit status is
  still in progress
- git history holds the engine's own cancel commit over the manifest
  (`workflow(search-relevance): cancel synonym-handling (discovery)`);
  any commit the session made before it is a cadence commit on the
  research topic, and nothing else was committed
- per-turn cache heartbeats under `.workflows/.cache/` are expected, not
  writes
