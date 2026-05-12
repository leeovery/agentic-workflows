# Phase 15 — KB Index Analysis Caches

**Status:** Not started · **Depends on:** Phase 14 (provenance)

## Purpose

The research-analysis and discussion-gap-analysis caches at `.workflows/{wu}/.state/research-analysis.md` and `.workflows/{wu}/.state/discussion-gap-analysis.md` contain the full reasoning behind every surfaced topic — the themes the analysis identified, the evidence it cited, the gaps it found. Right now those files sit on disk as inert artifacts. They're never indexed into the knowledge base, so they can't be searched.

This phase indexes them so a user can later ask the KB "what was the gap analysis on caching about?" and get a coherent answer. It also gives the contextual-query reference (loaded by entry skills before sessions) a richer retrievable surface — the analysis content surfaces alongside research/discussion/spec content during opening-context queries.

## Reference

- [Design](design.md) — KB indexing rules (research, discussion, investigation, specification are indexed; planning, implementation, review are not).
- `src/knowledge/index.js` — `discoverArtifacts()` and `cmdRebuild` are the entry points for indexing logic.
- `skills/workflow-shared/references/research-analysis.md` and `discussion-gap-analysis.md` — write paths for the cache files; this phase adds `knowledge index` calls after each write.
- Phase 8 — established the precedent of indexing imports alongside phase artifacts.

## What ships

### Indexing trigger

After each analysis writes its cache file, invoke `knowledge index` on the cache:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index .workflows/{wu}/.state/research-analysis.md
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index .workflows/{wu}/.state/discussion-gap-analysis.md
```

Idempotent — `knowledge index` already replaces existing chunks on re-indexing. When the cache updates (after re-analysis with fresh source files), the new content replaces the stale chunks.

### Discovery integration

`src/knowledge/index.js` `discoverArtifacts()` learns about the two cache file types. Bulk rebuild picks them up alongside research/discussion/etc.

### Removal on cleanup

When a work unit is cancelled or completed-and-cleaned, the existing `knowledge remove --work-unit {wu}` call drops all chunks for that work unit — analysis caches included. No extra logic needed.

### Cache metadata

Each indexed cache chunk carries:
- `work_unit`: the epic's name
- `phase`: a new value `analysis` (distinct from `research` / `discussion`)
- `topic`: the cache type (`research-analysis` or `gap-analysis`)
- Standard chunk metadata (file path, generated date)

### Source provenance enrichment (optional, defer if risky)

If Phase 14 has shipped, inception items have `description` that came from the analysis output. We could store a back-reference: `description_source: .state/research-analysis.md#themes-section` or similar. This makes the link from inception item to its analysis source explicit. Defer to a follow-up if not trivial — the KB search itself already bridges the gap.

## Files

**Modified:**
- `src/knowledge/index.js` — `discoverArtifacts()` learns the two cache file paths; `cmdRebuild` includes them in the bulk run.
- `skills/workflow-shared/references/research-analysis.md` — adds `knowledge index` step after cache write.
- `skills/workflow-shared/references/discussion-gap-analysis.md` — adds `knowledge index` step after cache write.
- `skills/workflow-knowledge/scripts/knowledge.cjs` — rebuild from source after `src/knowledge/index.js` changes (per project rule).

**Tests:**
- `tests/scripts/test-knowledge-*.{cjs,sh}` — coverage for indexing the two cache file types; coverage for bulk-rebuild picking them up; coverage for removal on work-unit deletion.

## Out of scope

- Indexing other state files (`.state/migrations`, etc.) — those are operational metadata, not knowledge content.
- Per-section chunking of analysis files — Phase 8's chunker already handles this; no special-casing needed.
- Migrating existing in-progress epics to retroactively index their cache files. Stale caches will get indexed naturally the next time the analyses re-run (Phase 7's self-healing triggers on stale cache).

## Verification

1. New analysis run writes both cache file and indexes it (e2e smoke).
2. Re-running an analysis replaces old chunks with new (chunk count stays bounded).
3. Bulk rebuild includes both cache types.
4. Work-unit removal drops analysis chunks.
5. Searching for a term that was in the analysis output returns the analysis file as a hit.
6. Existing KB tests still pass.

## Notes for the implementer

- **Bundle rebuild required.** Editing `src/knowledge/index.js` means `npm run build` and committing the regenerated `skills/workflow-knowledge/scripts/knowledge.cjs` alongside the source change.
- **The `phase: analysis` value is new.** Verify it doesn't collide with any existing metadata constraints in the schema.
- **Re-index timing.** Analyses write the cache file, then re-run — make sure the `knowledge index` call happens *after* the file write completes, not in parallel.
- **No new file conventions.** Caches keep their existing paths under `.state/`. Indexing is the only behaviour change.
