# Research: Synonym Handling

What replaces the hand-maintained synonym and misspelling list —
a curated managed list versus behaviour-driven expansion. The
choice turns on two numbers handed to the laboratory 2026-01-01:

- The in-session recovery share of zero-result searches —
  awaiting E1. Behaviour-driven expansion feeds on those
  recoveries; a negligible share sends the choice to a curated
  source.
- How quickly the recoveries land — awaiting E2. Recoveries that
  arrive within the same minute can be mined from in-session
  signals alone; slower ones need cross-session stitching the
  team would have to build first.

A day of sandbox search-session activity is exported at
logs/search-sessions.log. The source choice waits on both.
