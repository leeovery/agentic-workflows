The prose should have taken this path:

1. the skill asks the engine whether research is outstanding on the
   topic (it is not), no-ops the discovery-item ensure for a feature,
   reads the discussion status once, finds no discussion recorded, and
   takes the first-start arm — no phase note, no reconcile check, no
   resume choice
2. initialisation reads its inputs — the empty seed, the carrier's
   description and Exploration, the research status (none) and the
   topic's provenance (empty for a feature) — and, the carrier being
   there, runs no interview: the user is asked nothing
3. initialisation then registers the discussion through the engine
   before the file exists, creates it from the template, seeds initial
   subtopics as pending, and commits once
4. the guidelines load and the knowledge base is addressed once as a
   contextual query; with an empty store the session proceeds silently;
   the session loop's mailbox check no-ops on an empty mailbox
5. the session runs as an organic conversation: every thread the user
   engages is driven to a decision, the transitions recorded through
   the engine, the file written and committed at natural pauses
6. the review checkpoint fires where meaningful content lands and the
   map has moved enough to arm: each dispatch is engine-recorded, the
   harness stub stands in for the report, and the discussion never
   waits on it; each returned report, carrying no findings, is
   acknowledged clean — no announce menu, no finding surfaced
7. the last decision's set answers `all_decided: true`, and once its
   write is committed the ceremony opens in the same turn — before
   the user has to say anything, though they may still offer their
   wrap-up: the map is read through the gateway and comes back fully
   decided — and the closing work is still classified and gated: the
   pending closing work is read from the agent store, and the user is
   asked — one more review offered where the discussion moved since
   the last one, or the conclude ask where the review is up to date —
   with the walk ending only after their answer(s). Nothing passes
   silently from the settled map into the final review
8. the walk stops before the final gap review step runs — no review
   executes after the closing gates, document review and the
   compliance check never load, and the discussion is not completed

Further claims:

- no subtopic is deferred — the user drove everything they raised to a
  decision, and the map ends with no pending, exploring, or deferred
  entries
- no perspective agent is ever dispatched — an offer, if the walker
  reads genuine ambiguity somewhere, is legitimate, and the user
  declines it
- the Discussion Map lives in the manifest only — the file never
  contains a map section
- cache files under `.workflows/.cache/` — agent reports and agent
  state — are expected working artifacts

EXPECTED WORLD — from a feature holding only its discovery carrier:

- a discussion file at `.workflows/pay/discussion/pay.md` whose
  decisions match what the user said — webhook capture over polling,
  hosted fields keeping card data off their servers; the topic's
  mailbox is empty
- the manifest holding the discussion in progress with every subtopic
  `decided` — none pending, exploring, or deferred; the discussion is
  NOT completed
- the agent store holding one or more review rows; every review that
  was surfaced during the session is incorporated, while a review
  dispatched at the close itself may still be pending at the stop —
  the walk ends before its findings are walked
- no research, specification, planning, implementation, or review
  artifacts anywhere; the work-unit description unchanged; no second
  work unit
