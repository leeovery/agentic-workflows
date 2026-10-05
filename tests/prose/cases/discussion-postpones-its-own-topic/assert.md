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
   addresses the knowledge base once as a contextual query — the
   store holds the epic's discovery session log, so results come back
   and one line acknowledges the surfaced context — and enters the
   session step
4. the session loop's triage check no-ops on an empty queue; its
   check-for-results finds an empty agent store — nothing pending,
   nothing to surface, no dispatch
5. the session takes up the live subtopic and the user sends the whole
   topic to a later release. The session does not read that as a
   subtopic, a reroute, a deferral, or an idea to put aside: no
   `discussion-map add`, nothing set `deferred`, no backlog gate, no
   park gate, no closing gates, no wait gate, no document review, no
   `topic complete`
6. the postpone door resolves the unit before anything else — the work
   type is read from the manifest, and a discussion session on an epic
   whose own topic is the one leaving addresses the Discovery stage
   under that name
7. the user named no horizon, so the roadmap state is read. It holds
   two, so the horizon is **picked**: the pick renders the map's
   horizons in their order as numbered rows with `n/new` beneath them,
   and the walk STOPs. Nothing in prose asks the user to name a horizon
   — that arm belongs to a map that does not exist — and the second
   horizon, `v2`, is what comes back
8. before the confirm, what the sitting discussed and had not yet
   recorded — the user's answers on the refresh cadence — is written
   into the discussion and committed with the session's own cadence
   commit on its topic: the postpone transaction writes the manifests
   alone, so the sitting that sent the topic away is on record with the
   rest of it when the topic comes back
9. the confirm is fetched from the engine at
   `search-relevance.discovery.behavioural-ranking` with the horizon,
   and its menu emitted, and the flow STOPs. The statement is the
   engine's — the session never composes what goes or where it lands —
   and nothing is written before the yes. The gate is the one
   confirmation: the request is not put back to the user in
   conversation first
10. on yes the background-agent store is scanned for the session's own
    phase and topic; no row is in flight, so no task is stopped and no
    row is incorporated
11. one postpone transaction runs, carrying the horizon; the receipt is
    fetched from the engine and emitted, naming it. The response carries
    no discarded grouping and no reverted join — the topic was the
    epic's own, so an item is born rather than re-waited — and the
    session adds no line of its own
12. the session invokes the pipeline bridge with the **postponed**
    outcome and the next phase as `none`. No phase banner is rendered on
    the way through — neither the completed banner nor the paused one:
    the receipt was the session's
13. the bridge reads the work type — epic — and hands off to the epic
    menu: the engine's handoff names `workflow-continue-epic` with the
    work unit, `discussion` and the postponed outcome, and the line naming
    where the work goes is the turn's last text. No dashboard, gap
    analysis or menu runs in this context — the menu opens in the next
    one — and the walk stops at the handoff

Further claims:

- cancel is never reached for: no `cancel-gate` renders, no cancel
  transaction runs, and the bridge is not handed the cancelled outcome.
  Postpone and cancel are different endings and only one of them ran
- the roadmap skill is never invoked and no item is added by hand — one
  verb does the epic side and the roadmap side together

EXPECTED WORLD — from the fixture:

- the manifest's discussion item for `behavioural-ranking` reads
  `postponed` and carries `previous_status: in-progress`; the map row
  carries `postponed: true` with its `order` stashed as
  `previous_order`. The other two map rows are untouched, and their
  orders still read 2 and 3
- the discussion file is still on disk with its Signal Set section
  intact — a postpone takes the item, never the document — and it
  carries what the user said on the refresh cadence this sitting; the
  topic's brief is untouched. The discussion map's subtopics are
  unchanged or carry only what the session's own turns added; nothing
  is `deferred`
- the roadmap holds the same two horizons it started with, `v1` then
  `v2`, in that order, and the two fixture items are untouched. A third
  item now waits under `v2`, named for the topic, its summary the map
  row's, its origin the postpone of this epic, recording the work unit
  and topic it came from and pointing at the topic's brief and
  discussion files. It carries no `pulled_to` — it is waiting
- no research, specification, planning, implementation, or review item
  exists under any name; no second work unit; the work-unit status is
  still in progress; nothing is under `.workflows/.inbox/`
- git history holds the engine's own postpone commit over both
  manifests, preceded by the session's cadence commit on the discussion
  topic; nothing else was committed
- per-turn cache heartbeats under `.workflows/.cache/` are expected, not
  writes
