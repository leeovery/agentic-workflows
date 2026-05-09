# Phase 6 — Imports

**Status:** Not started · **Depends on:** Phase 5 (and Phase 2 for inception)

## Purpose

Add the imports machinery: a top-level `imports/` directory, manifest tracking, KB indexing on import, and the new flow whereby imports stay as separate seed material rather than being dumped into a research/discussion file. Inception's first session reads imports as starting context; all other sessions retrieve relevant chunks via the knowledge base.

## Reference

- [Design](design.md) — Imports section in full (what imports are, layout, manifest tracking, flows for epic and feature, KB retrieval, behaviour change for features, why not auto-split).
- `skills/start-epic/references/route-first-phase.md` and `skills/start-epic/references/collect-import.md` — existing import flow (epic).
- `skills/start-feature/references/research-gating.md` and `skills/start-feature/references/collect-import.md` — existing import flow (feature).
- `skills/workflow-knowledge/SKILL.md` and `scripts/knowledge.cjs` — KB indexing API.
- `skills/workflow-knowledge/references/knowledge-usage.md` and `contextual-query.md` — existing query patterns.

## What ships

- New `.workflows/{wu}/imports/` directory convention.
- Manifest top-level `imports[]` array tracks imported files with `path` and `imported_at`.
- `start-epic` and `start-feature` `i`/`import` flows:
  - User provides one or more file paths.
  - Files copied to `.workflows/{wu}/imports/` (filename normalised if needed).
  - Manifest `push imports` for each file.
  - `knowledge.cjs index` invoked on each file with metadata `source: import:{filename}`.
- Inception's first session reads imports directly as starting context for the conversation.
- Research and discussion entry skills query KB at session start with topic name + summary; relevant chunks (including import chunks) surface as context.
- Behaviour change for features: research file starts blank — content is **not** dumped from imports into the research file.
- `continue-epic` displays "N imported seed(s)" beneath the discovery map header if any imports exist.

## Files

**New:**
- `skills/workflow-shared/references/import-files.md` — shared reference: copy files to `imports/`, push manifest entry, run KB index. Used by both `start-epic` and `start-feature`.

**Modified:**
- `skills/start-epic/references/collect-import.md` — drop content into research file; route through inception. Use shared import-files reference.
- `skills/start-epic/references/route-first-phase.md` — `i`/`import` collects files, copies to imports/, then routes to inception (Phase 10 fully removes this file; here we modify it).
- `skills/start-feature/references/collect-import.md` — drop content into research file; copy to imports/, route to research with blank research file.
- `skills/start-feature/references/research-gating.md` — adjust import flow.
- `skills/workflow-inception-process/references/initialize-inception.md` — read imports from manifest at session start; load file content as context.
- `skills/workflow-research-entry/SKILL.md` and references — at session start, query KB with topic name + summary; surface relevant chunks. Read existing `contextual-query.md` for patterns.
- `skills/workflow-discussion-entry/SKILL.md` and references — same KB query at session start.
- `skills/continue-epic/references/epic-display-and-menu.md` — show "N imported seed(s)" line beneath discovery map header when imports exist.
- `skills/workflow-knowledge/SKILL.md` — document `source: import:{filename}` metadata pattern (no API change; convention only).

## Out of scope

- Auto-split imports into per-topic files (deliberately rejected — see design doc).
- Removing imports via refinement (could be added later; not in this phase).
- Migration to relocate legacy merged-import content out of research files (legacy stays — see Phase 9 / design doc Migration section on legacy).

## Verification

1. Create a test markdown file in a temp location with multi-topic, loose content (a fake "iPhone Claude app conversation export").
2. Run `/start-epic` for a new epic; pick `i`/`import`; provide the file path.
3. Verify:
   - File copied to `.workflows/{wu}/imports/{filename}.md`.
   - Manifest contains `imports[]` entry with path and timestamp.
   - KB has indexed the file (`knowledge.cjs query` returns relevant chunks).
4. Inception session starts; should reference imported content as starting context.
5. Walk through inception; create map items.
6. Pick a research-routed topic; start research session.
7. Research session entry queries KB; relevant import chunks surface as context.
8. For features: `/start-feature` → `i`/`import` → research file should be **blank/template**, not pre-populated with import content.
9. `/continue-epic` shows "N imported seed(s)" line beneath the discovery map header.
10. KB query with `source: import:*` filter (or chunk metadata inspection) confirms `source` provenance is correctly tagged.

## Notes for the implementer

- **Shared logic** — the import flow (copy + manifest push + KB index) is identical across epic and feature, so factor it into a shared reference.
- **Filename normalisation** — be deterministic and avoid collisions (e.g. lowercase, replace spaces with hyphens). If a name conflict occurs in `imports/`, suffix with a counter or timestamp.
- **KB metadata** — `source: import:{filename}` tag enables the user to ask "where did this context come from?" in any session. Useful for debugging.
- **Inception reads directly, others use KB.** Inception doesn't have topics yet to query against, so reading imports as raw context makes sense. Once topics exist, KB retrieval is more efficient and per-topic-relevant.
- **Behaviour change for features is real and visible.** Document in changelog when Phase 11 ships.
- **Don't split imports at import time.** Source integrity matters. KB chunking handles per-topic relevance dynamically.
