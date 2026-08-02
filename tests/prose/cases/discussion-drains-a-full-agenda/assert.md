The prose should have taken this path:

1. the entry reads the discussion status and finds it `triaged` — a
   first start, not a resume: parked concerns wait in the queue, and
   the entry proceeds through its new-entry path seeding from the
   topic's brief without re-asking settled ground
2. the process's own status read routes the same way — no file exists,
   no map to render, no resume gate — and initialisation creates the
   discussion file from the template, registers the topic (`topic
   start` flips `triaged` to `in-progress`), and commits action-scoped
3. the session-step entry reads the queue and shows the two-entry
   agenda — both titles with their origins — and returns; nothing is
   surfaced until the session machinery is loaded
4. the loop's check offers the waiting concerns; the user takes them;
   the first concern is surfaced whole — provenance line and full
   body, not a title — and discussed to the baseline decision
5. the fold is new ground: `discussion-map add
   offline-metrics-baseline` succeeds, the subtopic's Context opens
   with the provenance line and the concern body, the decision is
   documented, and the concern absorbs under its own commit naming
   file and origin; the map state lands `decided`
6. the second concern surfaces the same way, decides, folds as new
   ground, and absorbs under its own distinct commit
7. with both settled the user wraps; the closing gates run the review
   machinery per the conduct (the stubbed review returns clean); the
   conclude gate reads the queue, finds it empty, and the discussion
   completes with the `--kb` commit
8. presence clears, the sweep finds no leavings, and the walk stops at
   the bridge invocation

Further claims:

- the discussion document holds the two drained subtopic sections,
  each opening its Context with a provenance line naming the origin
  topic, each recording its decision; the map holds both `decided`.
  Initialisation may legitimately have seeded further subtopics from
  the brief — any such ended `decided` or `deferred`, never left
  pending — but the triage-queue titles were not pre-seeded: the
  drained subtopics entered the map at their folds
- a fold's decision may carry a `Sibling check:` line citing the
  origin sibling's decided text — legal where the resolution leans on
  ground that sibling owns, never required
- the triage queue directory for relevance-measurement is empty —
  both files deleted by their absorbs, deletions staged by the absorb
  commits
- git history holds two distinct absorb commits, each naming its
  concern file and origin, and the delivery commits from the fixture
  bracket them
- the manifest holds `discussion.relevance-measurement` as
  `completed`; no research item for it exists
- neither sibling discussion document changed
