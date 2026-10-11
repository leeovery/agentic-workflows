# A Roadmap Flag That Reaches Every Join

## The Idea

`roadmap flag` tells pulled work that a product session deepened its
item's ground. Today it reaches only a topic join: it sets
`reconcile_needed: "roadmap"` on that topic's live research and
discussion. A join with no topic — a bug or quick-fix riding with an
epic, or anything pulled into a bugfix, quick-fix or feature — reaches
nothing; the verb answers `committed: null` with a note, and the thought
stays only in the roadmap session's log. Make the flag reach those joins
too.

## Where It Came From

Review of the roadmap-kinds PR (#1488), 2026-10-11. Once bugs and
quick-fixes joined the roadmap, more pulled items have no topic for the
flag to land on, and the session can only relay that nothing reached the
work.

## Shape

Needs its own design. Investigation and scoping read no flag at all, and a
riding bug has no phase item of its own in the epic, so there is nowhere
to land the signal yet: decide which item carries it for each join shape,
which phase's start surfaces it, and what the advisory reads.
`flagJoined` in `domain/roadmap.cjs`, `reconcile-advisory.md`, and the
investigation and scoping entries are where it would land.
