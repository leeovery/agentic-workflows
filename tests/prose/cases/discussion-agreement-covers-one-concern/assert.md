The prose should have taken this path:

1. the entry reads the discussion status and finds it `triaged` — a
   first start: the entry proceeds through its new-entry path seeding
   from the topic's brief
2. initialisation creates the discussion file from the template,
   registers the topic (`topic start` flips `triaged` to
   `in-progress`), and commits action-scoped
3. the session loop's first triage check reads the queue and renders
   the two-entry agenda — titles and origins only, bodies unread —
   together with the offer menu, and stops for the user
4. the user opts in; the first concern is armed on the map
   (`discussion-map add` then set `exploring`), surfaced whole —
   provenance line and full body — broken down, and discussed to a
   resolution; the user answers with broad agreement that names "the
   rest" of the queue
5. the breadth of that agreement changes nothing beyond the concern on
   the table: the fold records the first concern alone — its section,
   its map state, its absorb commit — and nothing of the second
   concern is folded or absorbed on the strength of it
6. the second concern is raised individually — armed on the map,
   surfaced whole with its own breakdown, ending in its own single
   question — and the walk stops there when the user leaves

Further claims:

- the discussion document holds exactly one absorbed subtopic section
  (the offline-metrics-baseline fold, its Context opening with the
  provenance line and the concern body, its decision recorded); no
  section exists for expansion-quality-tracking
- the triage queue still holds `002-expansion-quality-tracking.md` —
  never deleted; git history holds exactly one absorb commit, naming
  the first concern's file and origin
- the map holds `offline-metrics-baseline` at `decided` and
  `expansion-quality-tracking` at `exploring` — armed by its raise,
  never folded
- the manifest holds `discussion.relevance-measurement` as
  `in-progress` — the topic was never completed
- neither sibling discussion document changed
