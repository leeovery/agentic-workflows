The prose should have taken this path:

1. the entry resolves the topic from its arguments, reads the research
   status, finds it in progress, emits the resuming phase note, checks
   the reconcile flag (absent — silent), and hands off to the processing
   skill without asking the user anything; the epic context arm reads the
   map item's source, finds it map-shaped rather than direct-start, and
   gathers nothing
2. the process reads the status again, finds the file, renders resume
   detection, and the user continues; initialisation is skipped
3. the walk passes through file strategy and the guidelines, addresses
   the knowledge base once as a contextual query, and routes into the
   epic research session
4. the user signals they are done with nothing to add. The session loop's
   triage check reads the queue and finds it empty; no agent is in
   flight, so the walk enters topic completion
5. topic completion re-reads the triage queue — still empty — and runs
   the closing gates in order: the final review dispatches (no review row
   has ever existed here), the stubbed report returns clean, so the row
   is acknowledged clean and nothing is raised; document review
   reconciles the session against the file and finds it already says what
   the session said; the compliance check passes silently
6. the session judges the dead-end question **before** rendering, from
   the topic's own conclusion — the answer is no, and nothing under this
   name is left to weigh — so the gate is rendered with `--dead-end` and
   the three-row menu carries the dead-end option. The judgment is the
   session's: the flag is passed, never derived by the engine
7. the user takes the dead end. The map item is marked first, with no
   commit of its own — the conclusion's commit carries the manifest
   change
8. the conclusion runs with the dead-end closure: the queue is checked a
   final time, the research completes and indexes, and one `--kb` commit
   closes it. Presence clears, the sweep finds no leavings, and the
   closing recap runs
9. the closing signpost is the dead-end one — the topic is closed, no
   discussion follows, the file stays on the map and in the knowledge
   base as record, and reopening it from the map makes it actionable
   again. It is **not** the discussion promise ("the discussion phase
   will use these findings"), which belongs to the other arm
10. the walk stops at the bridge invocation

Further claims:

- the map item is marked before the completion, and the marking carries
  no commit of its own
- the research item is `completed`, not `cancelled` and not `superseded`
  — the file is kept as record, so its knowledge-base chunks survive
- nothing was routed anywhere: no triage delivery, no new map topic, no
  reopening of a sibling
- the research document is unchanged in substance — document review had
  nothing to reconcile, and no "unexplored" residue was written into it
  on the way out
- exactly one review dispatch, and it was the final review at conclusion
  — the session's own dispatch check never fired, the user having
  signalled conclusion before any commit landed
- git history holds the conclusion commit; the map marking rides it
  rather than committing separately

EXPECTED WORLD — the fixture plus: `vector-search-migration`'s research
item `completed`; its discovery item carrying the dead-end marker
(`handled: true`, the stored field the vocabulary change deliberately
kept); the stubbed review report on disk in the topic's cache with its
agent row closed; and no discussion item, no new map topic, no dismissed
entry, and no change to the three untouched topics.
