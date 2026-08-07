The prose should have taken this path:

1. the entry reads the discussion status and finds it `triaged` — a
   first start: the entry proceeds through its new-entry path gathering
   nothing
2. initialisation reads the topic's brief, creates the discussion file
   from the template, registers the topic (`topic start` flips
   `triaged` to `in-progress`), and commits action-scoped
3. the session loop's first triage check finds a fresh sitting: it
   announces the queue in a single count-only line — no agenda, no
   menu — and the session opens from the topic's own material
4. when the user asks for the queue the check offers: the one-entry
   agenda — title and origin only, body unread — with the offer menu,
   stopping for the user
5. the user opts in; the queue file is read as the session's own
   brief and the concern armed on the map (`discussion-map add` then
   set `exploring`)
6. the raise recognises a bundled entry — three asks the user could
   accept or reject independently — and walks it: a one-line map of
   the three (titles only), then a breakdown of the first ask alone,
   ending in a single question; the second and third asks are absent
   from that first breakdown
7. each later ask is raised only after the previous one resolves,
   with its own breakdown and its own single question — three
   sequential raises, never two asks in one message
8. after the third ask resolves (the user amends the sampling refresh
   cadence to quarterly), the fold records the entry once — its
   section, its map state `decided`, its single absorb commit — and
   the queue empties
9. the user is out of time and the walk stops there

Further claims:

- the discussion document holds exactly one absorbed subtopic section
  for the concern (its Context opening with the provenance line and
  the full entry body), and its decision content covers all three
  asks — the baseline, the ship gate, and judged sampling with the
  user's quarterly cadence
- the triage queue is empty and git history holds exactly one absorb
  commit, naming the concern's file and origin
- the map holds `measurement-gates-for-ranking-changes` at `decided`
- the manifest holds `discussion.relevance-measurement` as
  `in-progress` — the topic was never completed
- neither sibling discussion document changed
