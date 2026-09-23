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
5. the session takes up one of the open threads and the user sends a
   **different** topic to a later release. The session does not read
   that as an idea to put aside, a thread to park, a reroute, or
   anything about the topic it is in: no backlog gate, no park gate, no
   off-topic reroute, no thread set `parked`, no conclude gate, and the
   synonym research is never completed
6. the postpone door resolves the unit from the name the user gave, not
   from the session's own topic — the work type is read from the
   manifest, and the Discovery unit addressed is `relevance-measurement`
7. the user named the horizon in the same breath, so the roadmap state
   is never read and the numbered horizon pick never renders: that step
   is for a horizon the user has not named
8. nothing is committed on the way to the gate. The session's own topic
   is not the one leaving, so the commit that guards a departing record
   is not owed here — the session's cadence commits stay its own loop's
   business
9. the confirm is fetched from the engine at
   `search-relevance.discovery.relevance-measurement` with the named
   horizon, and its menu emitted, and the flow STOPs. The statement is
   the engine's — the session never composes what goes or where it lands
   — and nothing is written before the yes
10. on yes **no agent store is closed**: stopping this session's
    background work belongs to a session whose own topic is leaving, and
    this one is staying. One postpone transaction runs, carrying the
    horizon, and the receipt is fetched from the engine and emitted
11. the session returns to the turn it was interrupted in and takes the
    synonym research back up. It does not hand off to the bridge, render
    a phase banner, or leave for the epic menu — its own topic never
    moved. The walk stops there

Further claims:

- the session's own topic is never addressed by the postpone: every call
  carrying the unit names `relevance-measurement`, and `synonym-handling`
  appears only as the session's own phase-and-topic arguments
- cancel is never reached for, and neither is the dead end: no
  `cancel-gate`, no cancel transaction, no conclude gate in either
  variant, and no map row marked handled

EXPECTED WORLD — from the fixture:

- the map row for `relevance-measurement` carries `postponed: true` with
  its `order` stashed as `previous_order`, and no research or discussion
  item was born under that name — the postpone of a never-started topic
  marks the row and nothing else
- the project manifest now holds a roadmap: one horizon, the one the
  user named, holding one item named for the postponed topic, its
  summary the map row's, its origin the postpone of this epic, recording
  the work unit and topic it came from and pointing at that topic's
  brief. It carries no `pulled_to` — it is waiting
- the synonym-handling research item still reads `in-progress`, its file
  is on disk with its content intact, and the thread register still
  carries both threads in whatever state the session's own turns left
  them. The `behavioural-ranking` map row is untouched, order 1
- no discussion, specification, planning, implementation, or review item
  exists under any name; no second work unit; the work-unit status is
  still in progress; nothing is under `.workflows/.inbox/`
- git history holds the engine's own postpone commit over both
  manifests; any other commit is a cadence commit the research session
  made on its own topic
- per-turn cache heartbeats under `.workflows/.cache/` are expected, not
  writes
