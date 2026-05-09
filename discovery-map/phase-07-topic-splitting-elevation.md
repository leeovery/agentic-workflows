# Phase 7 — Topic Splitting and Elevation

**Status:** Not started · **Depends on:** Phase 5 (and Phase 2 for inception items)

## Purpose

Update the existing `topic-splitting` (research) and `topic-elevation` (discussion) flows to write inception items alongside the per-phase artefacts they already create. Adds name-collision validation against the active map and the dismissed list. User-explicit spawns bypass the dismissed list.

## Reference

- [Design](design.md) — Topic Splitting and Elevation section in full (lifecycle on spawn, content extraction exception, name collision rules, cascade behaviour, asymmetry to enforce, what changes in existing flows).
- `skills/workflow-research-process/references/topic-splitting.md` — current implementation.
- `skills/workflow-discussion-process/references/discussion-session.md` — Section F (Topic Elevation) is the existing implementation.

## What ships

- `topic-splitting` writes a new `phases.inception.items.{new-topic}` alongside the new research file. Source: `research-split:{parent-topic}`.
- `topic-elevation` writes a new `phases.inception.items.{new-topic}` alongside the seed discussion file. Source: `discussion-elevation:{parent-topic}`.
- Name collision validation:
  - Active map item with same name → block; prompt for alternative or merge.
  - Name in dismissed list → allowed; remove from dismissed list, create new active item.
- The flows continue to seed a phase artefact (research file or seeded discussion file) — content extraction is preserved (the explicit exception to the no-content-extraction rule, per design doc).
- Spawned topics appear on the map immediately as `◐ in flight` (not `○ fresh`) because content already exists in the per-phase item.

## Files

**Modified:**
- `skills/workflow-research-process/references/topic-splitting.md` — after extracting content into the new research file, also call manifest CLI to write the inception item with appropriate routing and source. Validate proposed name (active map + dismissed list).
- `skills/workflow-discussion-process/references/discussion-session.md` — Section F (Topic Elevation): same pattern for the seeded discussion file. Inception item with `routing: discussion`, source `discussion-elevation:{parent}`. Same name validation.

**Possibly new — shared validation reference:**
- `skills/workflow-shared/references/topic-name-validation.md` — validates a proposed topic name against active map items and the dismissed list. Returns "ok / collision-active / matches-dismissed". Used by topic-splitting, topic-elevation, refinement adds, direct-entry adds (Phase 8).

## Out of scope

- Direct-entry auto-add for unmapped topics (Phase 8).
- Renaming existing topics that already have phase items (deliberately not supported per the editing-rules matrix — rename is for never-started only).
- Reactivating cancelled phase work via splits (out of scope; user uses existing `e`/`reactivate`).

## Verification

1. Continue from a Phase 5 test epic where research is in progress on a topic with multiple threads.
2. Trigger topic-splitting (research-process detects substantial side-thread; offers to split). Confirm split.
3. Verify:
   - New research file created with extracted content.
   - `phases.research.items.{new-topic}` exists in `in-progress` status.
   - `phases.inception.items.{new-topic}` exists with `routing: research`, `source: research-split:{parent-topic}`.
   - Map render shows the new item as `◐ researching` with provenance line "from {parent-topic}".
4. Try splitting with a name that's already on the map — blocked, prompted for alternative.
5. Remove a topic via refinement (Phase 4) — name now in dismissed list. Try splitting with that name — allowed, dismissed-list entry removed.
6. Repeat for `topic-elevation` in a discussion session: same outcomes with `routing: discussion` and source `discussion-elevation:{parent-topic}`.
7. Compliance self-check passes on touched skill files.

## Notes for the implementer

- **Asymmetry to enforce** — research and discussion *spawn* new map items but never modify existing ones. Don't accidentally add update-existing logic here.
- **User-explicit spawns bypass the dismissed list** — split/elevation are user-initiated; the dismissed list only blocks automatic re-adds by analyses (Phase 5).
- **Cascade behaviour** — provenance is historical metadata, not a live reference. If the parent's phase work is later cancelled, the children stay on the map untouched.
- **Renaming the parent post-split is blocked anyway** — parents of splits/elevations have phase work, so the editing-rules matrix forbids rename. No special-case handling needed.
- **Content extraction is the explicit exception** — these flows do extract content (unlike post-conclusion analysis-derived items). Keep that distinction clear in any code comments and docs touched.
