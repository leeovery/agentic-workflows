# Phase 12 — Drop Explore Mode in Research; Finalise start-epic

**Status:** Not started · **Depends on:** Phase 11 (migration must run first so existing epics with `exploration.md` are migrated)

## Purpose

Remove the open-mode (`e`/`explore`) research path. Under the new model, research is always scoped to a map item; topic decomposition happens in inception, not in research. Also collapses `start-epic`'s `route-first-phase.md` since it no longer offers research/discussion/import as a top-level menu — inception is always first.

## Reference

- [Design](design.md) — What Changes In Existing Skills section (start-epic collapse, research drops explore mode, file-strategy simplifies).
- `skills/workflow-research-entry/references/gather-context.md` — current explore-vs-specific menu.
- `skills/workflow-research-process/references/file-strategy.md` — current explore vs specific file logic.
- `skills/workflow-research-process/references/epic-session.md` — current epic session that handles open-mode.
- `skills/start-epic/references/route-first-phase.md` — to be removed.

## What ships

- `workflow-research-entry`'s explore-vs-specific menu is removed. Topic is always required (provided by caller — the inception map item, the bridge from a phase transition, or direct-entry).
- `workflow-research-process/file-strategy.md` simplifies to one-item-one-file regardless of work_type. No more `exploration.md` special case in file-strategy.
- `workflow-research-process/epic-session.md` no longer handles explore-mode logic — epic and feature sessions are now identical (per-topic).
- `start-epic` Step 3 invokes `workflow-inception-entry` directly. No more menu.
- `start-epic/references/route-first-phase.md` is **deleted**.
- The `i`/`import` flow at start-epic time is preserved (Phase 8 wired it through inception with KB indexing).
- Cross-references to removed files cleaned up.

## Files

**Modified:**
- `skills/workflow-research-entry/references/gather-context.md` — remove explore-vs-specific menu. Topic always required from caller.
- `skills/workflow-research-entry/SKILL.md` — adjust validation; topic is no longer optional for epics.
- `skills/workflow-research-process/references/file-strategy.md` — collapse to one-item-one-file. Remove explore-mode branch.
- `skills/workflow-research-process/references/epic-session.md` — drop open-mode handling. Or, if epic-session and feature-session converge, possibly delete one and keep a single session reference.
- `skills/workflow-research-process/SKILL.md` — adjust step references if epic-session is renamed/removed.
- `skills/start-epic/SKILL.md` — Step 3 invokes inception-entry directly. Update workflow-context table if needed.

**Removed:**
- `skills/start-epic/references/route-first-phase.md`.

## Out of scope

- Migrating legacy `exploration.md` files (Phase 11 handled it; legacy stays as a regular topic).
- Removing `surfaced_topics` / `gap_topics` arrays from manifests (a separate cleanup migration if/when it lands).
- Documentation updates (Phase 13).

## Verification

1. Continue from a Phase 11 test epic.
2. `/start-epic` for a brand-new epic goes directly to inception with no intermediate menu.
3. From `continue-epic`, picking a research-routed item (`Start research for "{topic}"`) invokes `workflow-research-entry epic {wu} {topic}` with the topic argument. No explore-vs-specific prompt.
4. Research session proceeds on the topic; file is `research/{topic}.md`. No `exploration.md` is created for new topics.
5. Existing migrated epics with `exploration.md` continue to work — the legacy file is treated as a per-topic research artefact (named "Exploration" on the map).
6. Compliance check passes on touched skill files.

## Notes for the implementer

- **Sequencing matters** — Phase 11 must merge before this so existing epics are already migrated. Otherwise users with legacy state might lose visibility into their `exploration.md` files (the migration registers them; without migration, dropping explore-mode could orphan them).
- **Don't try to retroactively rename legacy "exploration" topics** — the editing-rules matrix forbids rename for items with phase work. Legacy stays as-is. New epics use proper topic names.
- **epic-session.md and feature-session.md may converge** — once explore-mode is gone, the only difference between them is the topic-splitting offer (which exists only in epic). Implementer may want to consolidate; or keep separate for clarity. Either is fine.
- **Cross-references** — search the codebase for any remaining references to `route-first-phase`, `exploration.md`, `e`/`explore` mode and update.
