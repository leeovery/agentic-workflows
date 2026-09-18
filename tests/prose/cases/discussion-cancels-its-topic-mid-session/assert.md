The prose should have taken this path:

1. the entry asks the engine whether research is outstanding on the
   topic (no research item exists, so nothing holds it), reads the
   discussion status, finds it in progress, emits the resuming phase
   note, checks the reconcile flag (absent — silent), reads the map
   item's source and finds it shaped on the map rather than
   direct-started, so nothing is gathered, and hands off with source:
   existing discussion
2. the process reads the status again, finds the file, renders resume
   detection — the triage queue read (empty, so no triage warning),
   then the continue-or-restart gate — and the user continues
3. initialisation is skipped: the walk lands at the guidelines,
   addresses the knowledge base once as a contextual query (empty
   store — the session proceeds silently), and enters the session step
4. the session loop's triage check no-ops on an empty queue; its
   check-for-results finds an empty agent store — nothing pending,
   nothing to surface, no dispatch
5. the session takes up the live subtopic and the user calls the topic
   off. The session does not read that as a subtopic, a reroute, or a
   done-signal: no `discussion-map add`, nothing set `deferred`, no
   closing gates, no wait gate, no document review, no `topic complete`
6. the cancel protocol resolves the unit before anything else — the
   work type is read from the manifest, and a discussion session on an
   epic addresses the Discovery stage under the topic's own name
7. the confirm is fetched from the engine at
   `search-relevance.discovery.behavioural-ranking` and its menu
   emitted, and the flow STOPs. The statement is the engine's — the
   session never composes what the cancel takes — and nothing is
   cancelled before the yes
8. on yes the background-agent store is scanned for the session's own
   phase and topic; no row is in flight, so no task is stopped and no
   row is incorporated
9. one cancel transaction runs, addressed `discovery` —
   never `discussion`, never `research`, and never the work-unit cancel
10. the receipt is fetched from the engine and emitted; the response's
    `discarded`, `abandoned`, and `released_waits` all come back empty,
    so the session adds no line of its own
11. the session hands off to the pipeline bridge with the cancelled
    outcome and the next phase as `none`. No phase banner is rendered
    on the way through — neither the completed banner nor the paused
    one: the receipt was the session's
12. the bridge runs the epic continuation — the scoped discovery, no
    sequencing owed, no gap analysis owed, the epic not all done — and
    the dashboard and menu render. The walk stops with the menu waiting
    on a selection

Further claims:

- the user never signalled conclusion and never asked to park the
  topic; the words that opened the cancel were their own, and no free
  text the session composed offered them a choice of verbs
- the cancel and the gate are addressed to the stage, not the phase:
  every engine call carrying the unit names `discovery`, and the only
  place `discussion` appears is the session's own phase argument to the
  agent scan and the bridge

EXPECTED WORLD — from the fixture:

- the manifest's discussion item for `behavioural-ranking` reads
  `cancelled` and carries `previous_status: in-progress`; the map row
  carries `cancelled: true` with its `order` stashed as
  `previous_order`. The other two map rows are untouched, and their
  orders still read 2 and 3
- the discussion file is still on disk with its Signal Set section
  intact — a cancel takes the item, never the document. The discussion
  map's subtopics are unchanged or carry only what the session's own
  turns added; nothing is `deferred`
- no research, specification, planning, implementation, or review item
  exists under any name; no second work unit; the work-unit status is
  still in progress
- git history holds the engine's own cancel commit over the manifest
  (`workflow(search-relevance): cancel behavioural-ranking
  (discovery)`); any commit the session made before it is a cadence
  commit on the discussion topic, and nothing else was committed
- per-turn cache heartbeats under `.workflows/.cache/` are expected,
  not writes
