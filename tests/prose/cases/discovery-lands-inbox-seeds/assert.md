The prose should have taken this path:

1. discovery reads the mode from the work unit given as `none`, takes
   the new-work path, and splits the seeds argument on its comma into
   the two inbox paths
2. discovery's new mode reads both seed files and opens with one
   combined sketch across them — named as ideas with a count, not
   quoted back verbatim — and a targeted question; the first answer
   settles the shape decisively
3. the read is stated as prose above the commit gate; the second answer
   confirms — the work type is feature
4. the name is the one the user gave while shaping, saved-filters —
   neither derived from the seeds nor put back to them at a gate, and
   nothing checks it against existing work before the transaction
5. the session log is staged to the cache path with a Seed section
   listing both items as seeds/{filename} (inbox:idea), Imports
   (none), and Map State at Start (n/a — single-topic work)
6. one engine transaction creates the work unit with both --seed
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
