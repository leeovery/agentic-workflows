# Phase 11 — Migration

**Status:** Not started · **Depends on:** Phase 7 (analyses re-pointed) and Phase 5 (map render)

## Purpose

Seed the discovery map for existing in-progress epics so they continue to work under the new model without losing state. Migration is non-destructive — existing files stay where they are; the manifest gets a new `phases.inception` populated from current research/discussion items plus the legacy `surfaced_topics` and `gap_topics` arrays.

## Reference

- [Design](design.md) — Migration section in full (topic collection — discovery items only; source classification; order of operations; idempotency; what migration does NOT do; post-migration UX; edge cases; legacy `exploration.md` and merged imports).
- `skills/workflow-migrate/scripts/migrate.sh` — orchestrator that runs migrations in order.
- `skills/workflow-migrate/scripts/migrations/` — existing migrations to model on.
- `tests/scripts/test-migration-*.sh` — existing test harness conventions.

## What ships

- Migration script that walks in-progress epic manifests and seeds `phases.inception.items.*` per the rules in the design doc.
- Per-topic idempotency (re-running is safe; partial migrations resume cleanly).
- Edge cases handled: cross-cutting and other non-epic types skipped; completed/cancelled epics filtered out.
- Source classification with sub-tags: `migration-seeded`, `migration-seeded:research-analysis`, `migration-seeded:gap-analysis`.
- Migration test alongside the existing test harness.
- Post-migration UX: `continue-epic` shows a callout when items have empty summaries, prompting the user to populate via refinement.
- First refinement session post-migration walks empty-summary items asking for a one-line summary (with `skip` option per item).

## Files

**New:**
- `skills/workflow-migrate/scripts/migrations/NNN-add-inception-phase.sh` — the migration script. NNN is the next available number. Bash 3.2 compatible (no `mapfile`, no `declare -A`, no `local -n`). Uses `node` or `jq` for JSON manipulation (per CLAUDE.md migration conventions).
- `tests/scripts/test-migration-NNN.sh` — happy path, skip/no-op, idempotency, content preservation per the existing harness convention. Coverage:
  - Empty epic (no research/discussion) → no inception items created (or empty inception phase).
  - Epic with research items → inception items with `routing: research`.
  - Epic with discussion items only → `routing: discussion`.
  - Epic with both research and discussion → single item per topic, `routing: research`.
  - Epic with `surfaced_topics` and `gap_topics` arrays → corresponding inception items with sub-classified sources.
  - Cross-cutting work unit → skipped.
  - Completed epic → skipped.
  - Re-run on partially-migrated epic → completes cleanly.
  - Re-run on fully-migrated epic → no-op.

**Modified:**
- `skills/continue-epic/references/epic-display-and-menu.md` — render post-migration callout: `⚑ Migrated to discovery map. N items have no summary — open f/refine to populate.` Disappears once all items have summaries.
- `skills/workflow-inception-process/references/refinement-session.md` — detect empty summaries on entry; offer to walk through populating them sequentially with `skip` option per item.

## Out of scope

- Removing `surfaced_topics` and `gap_topics` arrays — migration leaves them in place. A follow-up migration after the larger refactor lands can clean up. Not in this phase.
- Retroactively unwinding merged imports from research files — impossible to do cleanly; legacy stays as-is.
- Renaming legacy "exploration" topics — blocked by editing rules (rename only allowed for never-started). User can topic-split if they want.
- Auto-inferring summary content from existing files — migration is bash/node, not LLM-driven.

## Verification

1. Run the migration test (`tests/scripts/test-migration-NNN.sh`). All assertions pass.
2. Hand-craft a fixture: an in-progress epic manifest with research items, discussion items, `surfaced_topics`, `gap_topics`. Run the migration. Verify inception items created with correct routing and source classifications.
3. Run migration twice — second run is a no-op (per-topic idempotency).
4. Test legacy case: an epic with `exploration.md`. After migration, `phases.inception.items.exploration` exists with `routing: research`. Map shows "Exploration" as a topic.
5. Cross-cutting work unit fixture — migration script skips it.
6. Completed epic fixture — migration script skips it.
7. Run `/continue-epic` on a migrated epic. Verify the post-migration callout appears.
8. Open `f`/`refine`; verify the empty-summary walkthrough.
9. Compliance check on touched skill files.

## Notes for the implementer

- **Migration scripts must not use the manifest CLI** (per CLAUDE.md). Read/write `manifest.json` directly with `node` or `jq`. The CLI validates against the current schema, which evolves.
- **Bash 3.2 compatibility** — macOS default. No bash 4+ features.
- **Test harness conventions** in CLAUDE.md — follow them precisely for the migration test file.
- **Topic collection is discovery-only**: research items + discussion items + `surfaced_topics` + `gap_topics`. **Don't include spec/plan/impl/review topics** — spec topics may be regroupings, not standalone discovery items.
- **`migration-seeded` sub-classification** helps future analyses avoid re-proposing items the user accepted via migration.
- **Hard-delete model applies** — no `cancelled` status on migrated inception items. They're all `active`.
- The post-migration empty-summary walkthrough is part of refinement, not the migration script itself. Migration creates items with empty summaries; refinement detects and prompts.
