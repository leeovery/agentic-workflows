The prose should have taken this path:

1. the start screen renders the harvested-no-work state, not an empty
   one: the overview names the roadmap's horizons with their waiting
   counts, and the menu carries the `r/roadmap` row
2. the roadmap row hands off: the engine's handoff names
   `workflow-roadmap` with `open`, and the line naming where the work
   goes is the turn's last text; the walk stops at the handoff

Further claims:

- at no point does any surface describe the project as having no work
  to show — the roadmap is the work, banked
- the roadmap starts in the next context, not this one: its gateway is
  never read and nothing labels the session for it
- every display is emitted from an engine snapshot; nothing is redrawn
  by hand

EXPECTED WORLD — the walk should have changed nothing that matters:

- the roadmap node, its four items, and the closed session log exactly
  as the fixture left them — same horizons, same waiting states, no
  joins, no new sessions, no active-session marker
- no work units, no inbox items, no new files under `.workflows/`
  beyond any bookkeeping the boot itself owns
