The prose should have taken this path:

1. the start screen renders the harvested-no-work state, not an empty
   one: the overview names the roadmap's horizons with their waiting
   counts, and the menu carries the `r/roadmap` row
2. the roadmap row lands in the roadmap's home: the map is rendered
   from its snapshot (horizons, items, waiting states) with the
   converse/pull menu beneath — pull offered, since waiting items exist
3. the user leaves via `b/back` and the flow ends at a terminal
   condition — no session opened, nothing pulled, nothing edited

Further claims:

- at no point does any surface describe the project as having no work
  to show — the roadmap is the work, banked
- every display is emitted from an engine snapshot; nothing is redrawn
  by hand

EXPECTED WORLD — the walk should have changed nothing that matters:

- the roadmap node, its four items, and the closed session log exactly
  as the fixture left them — same horizons, same waiting states, no
  joins, no new sessions, no active-session marker
- no work units, no inbox items, no new files under `.workflows/`
  beyond any bookkeeping the boot itself owns
