# Phase 16 — Final Review and Cleanup

**Status:** Not started · **Depends on:** Phase 15 (KB index analysis caches) — runs at the very end of the initiative

## Purpose

Catch-all phase for small bug fixes, behavioural gaps, UX tightening, and stale wording surfaced during review of earlier phases. None of these are critical enough to block their parent phase, but each was deferred either because it crossed the parent phase's scope boundary or because it touches a flow the parent phase did not intend to modify.

This phase exists so the findings don't get lost. Each item has a one-paragraph rationale plus a pointer to where it was originally surfaced.

## Reference

- [Design](design.md) — Imports section (line 574-648) for items 1-2 below; "All other sessions: KB retrieval, no auto-read" (line 638) for item 4.
- Phase 8 review notes in PR #273 — the originating audit pass.

## What ships

A small set of independent fixes — each can be its own commit, no ordering dependencies between them.

### Item 1 — Feature absorption handles imports/

**Surfaced in:** Phase 8 comprehensive review.

**Problem:** `skills/workflow-start/references/absorb-into-epic.md` moves `discussion/` and `research/` files from the absorbed feature to the target epic, then runs `rm -rf .workflows/{feature}/`. The `imports/` directory is silently deleted; the user gets no warning that seed material is being thrown away. Pre-Phase-8, features had no `imports/` folder, so this was not a concern. Post-Phase-8, features can have imports, and the absorption flow has no logic for them.

**What ships:**
- One of two options (decide during implementation):
  1. **Move forward**: copy `imports/` contents to the target epic's `imports/` directory; rebase manifest entries (`{path: "imports/{filename}.md", imported_at: ...}`); re-index under the target epic's identity. The KB cleanup step (`remove --work-unit {feature}`) already drops the source's imports chunks, so post-move the new chunks live under the target identity.
  2. **Surface and delete**: extend the **E. Confirm** summary to list import filenames being deleted; require explicit confirmation. Simpler but loses source material.
- Recommendation: option 1 — imports are persistent context that informed the feature's research; carrying them forward respects "imports persist for the work unit's life" by remapping the work-unit identity.

**Files:**
- `skills/workflow-start/references/absorb-into-epic.md` — new section between **G. Move Research** and **H. Cleanup**, plus an **Imports** line in the **E. Confirm** summary.
- `tests/scripts/test-knowledge-cli.sh` (or new test file) — fixture covers absorption of a feature with imports; verify chunks land under target identity, source identity has no chunks.

### Item 2 — continue-feature surfaces imports_count

**Surfaced in:** Phase 8 doc explicitly deferred ("Out of scope: continue-feature display of N imported seed(s)").

**Problem:** Post-Phase-8, features can have imports just like epics. `continue-feature` doesn't display the count, so a user who imported seed material at `start-feature` time has no indicator after returning. Asymmetric with `continue-epic`.

**What ships:**
- `continue-feature/scripts/discovery.cjs` — surface `imports_count` on the work-unit detail (mirror Phase 8's `continue-epic/scripts/discovery.cjs:205`).
- `continue-feature/references/feature-display-and-menu.md` (or whichever reference renders the feature header) — render the same `· N imported seed(s)` line beneath the header summary.
- Tests: extend `tests/scripts/test-discovery-for-continue-feature.cjs` with the same shape assertions Phase 8 added for continue-epic.

### Item 3 — cmdRebuild error message stale wording

**Surfaced in:** Phase 8 comprehensive review.

**Problem:** When `discoverArtifacts()` returns zero items, `src/knowledge/index.js:1654` aborts with "No completed artifacts found to index". Post-Phase-8, the discovery pipeline also emits imports (which aren't "completed" in any phase sense). The message is technically still accurate (rebuild won't fire if there's nothing to index) but the wording suggests phase-completion only.

**What ships:**
- `src/knowledge/index.js` — change the message to "No artifacts to index" or "No indexable content found in any active work unit". Trivial change; rebuild bundle.
- No new tests required — existing rebuild tests still pass; this is a wording-only change.

### Item 4 — Subsequent inception / refinement sessions query the KB

**Surfaced in:** Phase 8 comprehensive review against the design doc.

**Problem:** The design (line 638) says "All other sessions (research, discussion, refinement, subsequent inception): KB retrieval, no auto-read." The four processing skills that wire the contextual query (`workflow-research-process`, `workflow-discussion-process`, `workflow-investigation-process`, `workflow-scoping-process`) follow the design. **Inception does not** — its session-loop reads `manifest.imports[]` directly on first session and has no KB query for refinement or second-session-onwards entry.

This is a pre-existing gap from Phase 4, not Phase 8 — but Phase 8's KB indexing of imports is what makes the gap visible. Without a contextual query at refinement entry, the user re-encounters the same seed material verbatim instead of through the curated chunk view.

**What ships:**
- `skills/workflow-inception-process/SKILL.md` — add a new step before the session loop that loads `workflow-knowledge/references/contextual-query.md` when entering refinement (source = `refinement`) or any subsequent first-session resume (when prior session-NNN logs exist). First-session-on-fresh-epic still reads imports directly per the design's launchpad rationale.
- `skills/workflow-inception-process/references/refinement-session.md` — Step 0 of refinement entry calls the query before the menu renders.
- Allowed-tools: confirm `workflow-inception-process/SKILL.md` declares `Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs)`.
- Tests: add a smoke check that refinement entry triggers a `knowledge query` invocation with the work unit's description as the seed prompt.

## Out of scope

- New behaviour beyond the four items above. If a fifth gap surfaces during this phase's implementation, capture it and decide: ship in this phase, or open a follow-up.
- Reworking design choices that are explicitly final (the no-content-extraction rule, hard-delete model for inception items, etc.). This phase is mop-up, not redesign.
- Removing legacy `surfaced_topics` / `gap_topics` arrays — Phase 11's note already defers this to a separate cleanup migration.

## Verification

1. **Item 1**: end-to-end smoke — create a feature with imports, absorb into an epic. Verify imports are carried forward (or warned and deleted, per chosen option). KB chunks under the target identity exist; source-feature chunks gone.
2. **Item 2**: end-to-end smoke — create a feature with imports via `start-feature` `i`/`import`. Run `/continue-feature`. Verify the imports callout renders beneath the header.
3. **Item 3**: trigger a rebuild on an empty project (no work units). Confirm the new wording is more accurate.
4. **Item 4**: enter a refinement session on an epic with completed phase artefacts. Confirm `knowledge query` fires before the menu renders. Inspect the surfaced chunks for relevance.
5. Existing tests still pass (no regressions).
6. Compliance self-check on every touched skill file.

## Notes for the implementer

- **Items are independent.** Pick them off one at a time; commit per item; no ordering dependency. If any item turns out to be larger than expected, split it into its own follow-up phase rather than letting it bloat this one.
- **Item 4 is the most consequential.** Wiring the contextual query into inception sessions is more than a one-line change — refinement entry, first-session-resume, and the conditional that distinguishes them all need touching. Allow for review and a separate test pass.
- **No migration scripts needed.** All four items are runtime/behaviour changes; manifests don't gain or lose fields.
- **No phase-numbering changes.** Phase 13's documentation cleanup is the canonical phase-renumbering pass; this phase is purely additive bug fixes.
