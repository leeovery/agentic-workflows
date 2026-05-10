# Phase 7 — Self-Healing Analyses Re-point to Map

**Status:** Not started · **Depends on:** Phase 6

## Purpose

Move `research-analysis` and `gap-analysis` from `workflow-discussion-entry` to run at `continue-epic` boot-up (and at inception entry, for refinement). Their output writes inception items directly to the map — no per-proposal approval gate. The user sees auto-added items via a notification callout and removes any unwanted ones via refinement (which adds them to the dismissed list).

## Reference

- [Design](design.md) — Self-Healing section in full (when analysis runs, cache lifecycle, auto-add, notification, content extraction, trigger summary, dismissal persistence, source deduplication).
- `skills/workflow-discussion-entry/references/research-analysis.md` — current implementation (to be relocated and adapted).
- `skills/workflow-discussion-entry/references/discussion-gap-analysis.md` — same.
- `skills/workflow-discussion-entry/references/display-options.md` — current "Suggested topics" rendering (to be removed/simplified).
- `skills/workflow-shared/references/background-agent-surfacing.md` — existing surfacing protocol (kept for findings within a single phase, but not used for map auto-add).

## What ships

- Analyses move out of `workflow-discussion-entry` Steps 4-5 and become shared logic invoked at:
  - `continue-epic` boot-up (before display rendered, cache check first).
  - Inception refinement entry (cache check; runs if stale, covers refinement-without-continue-epic-first case).
- Output writes directly to `phases.inception.items.*` — no `surfaced_topics` array, no `gap_topics` array, no menu of suggested topics.
- Each cache adds a `dismissed` field — removal via refinement adds the name there.
- `⚑ N new topics added to the map from {analysis}` callout in `continue-epic` display when boot-up added items (shown once per add; map render is the persistent surface afterwards).
- `pending_from_research` and `pending_from_gaps` collapse into "map items in `fresh` state" — one concept, one rendering.

## Files

**Relocated / refactored:**
- `skills/workflow-discussion-entry/references/research-analysis.md` — relocate to a shared location (e.g. `skills/workflow-shared/references/research-analysis.md`). Output now writes inception items rather than `surfaced_topics`. Cache shape extended with `dismissed` array. Source provenance: `research-analysis` (or `research-analysis:{topic}` if traceable).
- `skills/workflow-discussion-entry/references/discussion-gap-analysis.md` — same relocation; same output change; `dismissed` field added; source provenance `gap-analysis`.

**Modified:**
- `skills/workflow-discussion-entry/SKILL.md` — remove Steps 4-5. Step 1 (Parse Arguments) flows to validate phase + invoke directly when topic provided. The no-topic scoped path simplifies — discovery happens via `continue-epic`, not here.
- `skills/workflow-discussion-entry/references/display-options.md` — drop or simplify (no suggested-topics menu).
- `skills/workflow-discussion-entry/references/route-scenario.md` — adjust scenarios (no `research_only` / `discussions_only` routing through analyses).
- `skills/continue-epic/scripts/discovery.cjs` — at boot-up, check analysis caches via input checksum; if stale, run analyses; apply results (auto-add inception items unless name conflicts active map or matches dismissed list).
- `skills/continue-epic/references/epic-display-and-menu.md` — render `⚑ N new topics added to the map from {analysis}` callout when boot-up added items.
- `skills/workflow-inception-process/references/refinement-session.md` — self-healing check: read cache; runs analyses if stale; covers entry path that bypasses continue-epic.
- `skills/workflow-inception-process/references/map-operations.md` — remove operation adds name to relevant analysis's dismissed list.

## Out of scope

- Imports as analysis input (Phase 8 — analyses still operate on research/discussion files only).
- Topic-splitting / elevation behaviour change (Phase 9).

## Verification

1. Continue from a Phase 6 test epic.
2. Complete a research session for a topic. Return to `/continue-epic`.
3. Boot-up runs research-analysis (cache stale because new research file). If new themes surface, callout reads `⚑ N new topics added to the map from research-analysis`. New items appear on the map with `source: research-analysis` provenance.
4. Complete a discussion session. Boot-up runs gap-analysis. If new gaps surface, callout shows; new items on the map.
5. Remove an analysis-derived item via refinement. Verify it goes to the dismissed list. Run another iteration of analysis (force a checksum bump) — verify the dismissed item is not re-added.
6. Show-dismissed-items in refinement should surface the removed item; user can recover.
7. Existing analysis-cache invalidation behaviour (input checksum) still works — no re-run if files haven't changed.

## Notes for the implementer

- **Auto-add, not auto-propose.** No approval prompt per item. The user reviews the map and removes anything unwanted via refinement.
- **Shared location for the analyses.** Once they're not specific to discussion-entry, `skills/workflow-shared/references/` is a natural home. Both `continue-epic` and `workflow-inception-process` invoke them.
- **Cache invalidation rules unchanged** — input checksum on the relevant files. Just the output target changes.
- **Source deduplication** — if both analyses produce the same theme, dedupe at the analysis stage so it's added once with both source paths in the inception item's `source` field (e.g. `gap-analysis,research-analysis` or first-source-wins).
- **Notification callout shows once.** When the user has seen the new items, the callout doesn't repeat on subsequent `continue-epic` boots — only when boot-up just added more.
- **`continue` resume bypasses C. Self-Healing Check** (Phase 6 left this as a no-op, so impact deferred to here). When `refinement-session.md` B. Resume Check routes the user's `continue` choice it goes straight to E. Render and Prompt — C and D are skipped because the existing session log is reused. When wiring analyses into C, decide whether continue should re-run them. Recommendation: don't — analyses ran on the prior entry, results are already on the map and recorded under the existing log's **Self-Healing Arrivals**, and re-running on resume would surface duplicate arrivals or churn the cache. The continue path effectively says "pick up the in-flight refinement as it stood"; fresh-entry / restart paths still flow through C and run normally.
