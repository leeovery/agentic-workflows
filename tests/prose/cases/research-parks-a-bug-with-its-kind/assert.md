The walk resumes a research sitting in which the user puts aside a bug
in the live product and names where it waits. The words place it, so
the backlogging door parks it in one verb — as a bug, not an idea —
over a project with no roadmap yet, and the research carries on.

The prose should have taken this path:

1. the skill ensures the discovery item (already on the map — nothing
   written), reads the research status once, finds it in progress,
   emits the resuming phase note, and checks the reconcile flag (absent
   — silent)
2. beneath the note the resume surface carries on — the thread register
   rendered, the mailbox read (empty, so no mail warning), then the
   continue-or-restart gate — and the scripted answer continues
3. initialisation is skipped; the walk passes through file strategy and
   the research guidelines and enters the session step, which routes an
   epic to its own session wrapper; the session loop's mailbox check
   no-ops on an empty mailbox
4. the user brings up the broken search box. The research skill's
   standing `## Backlogging` section routes to backlogging.md with
   work_unit `search-relevance`, topic `synonym-handling`, phase
   `research`. It is never read as a thread, a send to another topic,
   or a postpone of a topic
5. **A. Where It Waits** reads the map's horizons first — there is no
   roadmap, so there are none — then finds a horizon named in the
   user's own words ("under Next"), so the park is the route: the
   backlog gate is never written or rendered, and the horizon step is
   never entered, so no horizon pick renders
6. **C. Park** takes the item from the conversation: the name the user
   gave it, kebab-cased (`search-box-clears-on-rotate`); a one-line
   summary in the product's terms — typing in the storefront's search
   box lost when the phone is rotated; the kind `bug`, because something
   is broken; and the source from the phase table —
   `search-relevance/research/synonym-handling.md`, which is on disk
7. the confirm renders through the engine carrying the name, `--kind
   bug`, the horizon `Next`, the summary and the source. There is no
   roadmap, so the statement says the roadmap is created with the item,
   and it marks the item as a bug. The walk **STOPS**
8. on the user's yes the park is one engine call carrying the same
   kind: `roadmap add search-box-clears-on-rotate --kind bug --horizon
   "Next" --summary "…" --origin park:search-relevance --source
   search-relevance/research/synonym-handling.md`. The verb births the
   roadmap and the horizon and commits itself; the roadmap skill is
   never invoked
9. research keeps a running record, so the park is noted in the
   research file the session is writing; the user is told in one line
   what was parked and where
10. control returns to the interrupted flow and the session takes the
    synonym research back up. The walk stops there

Further claims:

- no call anywhere carries `--kind idea` or `--kind quick-fix`: the
  kind was settled once, from the conversation, and both the confirm
  and the park carry it
- nothing went to the inbox: no capture skill ran and no inbox commit
  was made

EXPECTED WORLD — the walk should have produced, from the fixture:

- the project manifest carries a roadmap node it did not have before:
  one horizon, `Next`, holding exactly one item —
  `search-box-clears-on-rotate`, `kind: bug`, `origin:
  park:search-relevance`, a summary about the search box losing what
  was typed when the phone is rotated, and
  `search-relevance/research/synonym-handling.md` as its one source.
  It carries no `pulled_to`: it is waiting. No second horizon and no
  second item exist
- the research file still holds its fixture content, with the park
  noted in it; the synonym-handling research item still reads
  `in-progress`, and the thread register still carries both threads in
  whatever state the session's own turns left them
- no file exists anywhere under `.workflows/.inbox/`
- no discussion, specification, planning, implementation or review item
  exists under any name; no map row is postponed or cancelled; the work
  unit is still in progress
- git history holds the engine's own roadmap commit over the project
  manifest; any other commit is a cadence commit the research session
  made on its own topic
- per-turn cache heartbeats under `.workflows/.cache/` are expected, not
  writes
