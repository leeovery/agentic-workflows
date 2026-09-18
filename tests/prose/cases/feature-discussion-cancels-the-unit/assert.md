The prose should have taken this path:

1. the entry resolves the topic from the work unit (a feature's topic is
   its name), asks the engine whether research is outstanding (none
   exists), reads the discussion status, finds it in progress, emits the
   resuming phase note, checks the reconcile flag (absent — silent),
   reads the discovery session log and finds a usable carrier, and hands
   off with source: existing discussion
2. the process reads the status again, finds the file, renders resume
   detection — the triage queue read (empty, so no triage warning), then
   the continue-or-restart gate — and the user continues
3. initialisation is skipped: the walk lands at the guidelines,
   addresses the knowledge base once as a contextual query (empty
   store — the session proceeds silently), and enters the session step
4. the session loop's triage check no-ops on an empty queue; its
   check-for-results finds an empty agent store — nothing pending,
   nothing to surface, no dispatch
5. the session takes up the live subtopic and the user calls the feature
   off. The session does not read that as a subtopic, a reroute, or a
   done-signal: no `discussion-map add`, nothing set `deferred`, no
   closing gates, no document review, no `topic complete`
6. the cancel protocol reads the work type, finds `feature`, and
   resolves the unit as the work unit itself — the topic and the work
   unit are the same thing, so there is no stage to address and no
   per-topic cancel to run
7. one work-unit cancel transaction runs — `workunit cancel pay` —
   having first committed anything the session had written and not yet
   committed. No cancel gate is fetched: the linear path carries no
   confirm of its own, and the session never authors one
8. the receipt is fetched from the engine (`render workunit-receipt pay
   --verb cancel`) and emitted, and the flow stops on a terminal
   condition. The pipeline bridge is never invoked — there is no next
   phase and no menu to return to — and no continue skill is entered

Further claims:

- the epic-side surfaces are never reached: no cancel gate, no
  `topic cancel`, no discovery map anything. A feature has no map row,
  and the flow never addresses one
- the walk ends on the receipt. Nothing is offered after it — no "what
  next", no route into another work unit

EXPECTED WORLD — from the fixture:

- the work unit's manifest reads `status: cancelled`; the discussion
  item is untouched by the cancel and still reads in progress, because
  the whole unit is what was cancelled
- the discussion file is still on disk with its Capture Confirmation
  section intact — a cancel takes the unit's status, never its documents
- the work unit's cache directory is gone, purged by the cancel
- git history holds the engine's own cancel commit
  (`workflow(pay): mark as cancelled`); any commit the session made
  before it is a cadence commit on the discussion topic, and nothing
  else was committed
- no second work unit exists, and no phase item was created under any
  name
