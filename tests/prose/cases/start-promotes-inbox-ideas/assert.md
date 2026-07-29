The prose should have taken this path:

1. initialisation runs the boot pipeline — no migrations to apply, the
   knowledge base ready — and the discovery dump shows no active work
   but two inbox items, routing to the empty state
2. the empty-state snapshot renders with its start menu; the first
   scripted answer selects the inbox action by its ACTIONS entry
3. the inbox pickup snapshot renders the numbered list of both ideas —
   no archived option, the archived store is empty — and the second
   answer selects both numbers, building a two-item working set
4. the working-set snapshot is fetched with both paths; the set is
   type-uniform (ideas), so the work option is offered; each item gets
   a short synthesised summary in the set display, and the third
   answer chooses work
5. work routes to discovery with work_type none and both inbox paths
   as seeds — the work_unit argument is the literal none
6. discovery's new mode reads both seed files and opens with one
   combined sketch across them — named as ideas with a count, not
   quoted back verbatim — and a targeted question; the fourth answer
   settles the shape decisively
7. the read is stated as prose above the commit gate; the fifth answer
   confirms — the work type is feature
8. name resolution: with multiple seeds the suggestion derives from
   the description, and the sixth answer names it saved-filters; the
   conflict check finds no existing work unit
9. the session log is staged to the cache path with a Seed section
   listing both items as seeds/{filename} (inbox:idea), Imports
   (none), and Map State at Start (n/a — single-topic work)
10. one engine transaction creates the work unit with both --seed
    paths and no --import, and the walk stops as the prose turns to
    first-phase routing — no phase is entered

Further claims:

- both inbox files are gone from .workflows/.inbox/ideas/ and landed
  in .workflows/saved-filters/seeds/ under their collapsed names
  (2026-01-01-saved-search-filters.md, 2026-01-01-filter-default-view.md)
- the manifest records two seeds[] entries, each with
  source inbox:idea, and work_type feature with status in-progress
- the installed session log at
  .workflows/saved-filters/discovery/sessions/session-001.md carries
  the two-line Seed section and a Description matching the shaped
  intent
- nothing was archived, restored, or deleted from the inbox; no
  discovery map exists; no phase item exists in the manifest
