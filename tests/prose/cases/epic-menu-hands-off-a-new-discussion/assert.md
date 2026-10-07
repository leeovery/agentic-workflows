The prose should have taken this path:

1. continue-epic opens with its phase title and reads the scoped
   snapshot of the epic it was handed — no index of every epic, no
   pick-an-epic menu
2. the backfill checks find nothing, topic discovery reads the
   gap-analysis cache as absent and dispatches nothing, and the map is
   already sequenced, so the sequencing reference is never loaded; the
   epic arrived from no phase, so no banner, and it is not all done,
   so no completion offer
3. the epic dashboard renders with the three-topic map, and the first
   scripted answer picks the `d` command option — start a discussion on
   a new topic. The menu resolves the pick itself: no soft gate is
   fetched for it, and nothing is handed off yet
4. the menu asks what topic to discuss and stops; the second scripted
   answer names it — query intent — kebab-cased to `query-intent`
5. the direct-entry gate is fetched for the discussion phase of that
   name and comes back empty — the map does not hold it
6. the map row lands through the discovery-item ensure: its existence
   check reads empty, then one `discovery-map add` creates
   `query-intent` routed to discussion with source `direct-start`,
   carrying a one-line summary and a short description drawn from the
   answer, and the dismissal override — never the backfill flag
7. the handoff: the route passes to the engine's handoff as
   `/workflow-discussion-process` with epic, the work unit and the topic
   `query-intent`; the line naming where the work goes is the turn's
   last text, and the walk stops at the handoff

Further claims:

- the name is asked for after the pick, and it travels as the
  handoff's topic argument
- nothing is committed, and nothing but the map row is written: no
  discussion or research item, the other three topics and their order
  fields untouched
- the discussion skill is not entered in this context — it starts in
  the next one

EXPECTED WORLD — the delta against the fixture is the work unit's
manifest alone, which gains one discovery-map item: `query-intent`,
carrying `routing: discussion`, `source: direct-start`, and a non-empty
`summary` and `description`, both about query intent. No other file
changes.
