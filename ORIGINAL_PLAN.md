# Inception Self-Healing — Rewire for Correctness and Legacy Recovery

## Context

The inception phase has a bug: research-analysis self-healing fires on in-progress research files and produces a category-error output (broad domain decomposition mis-labelled as derived discussion candidates, all hardcoded to `routing: discussion`). Real-world example: a `galley-v1` epic with one in-progress `exploration.md` got carved into 8 discussion-routed candidate topics on first `continue-epic`, several of which clearly needed research first.

Root cause is two-fold:

1. **Preconditions not enforced** — research-analysis fires when the cache is stale (default state on first run), regardless of whether the research is completed or whether the input files are per-topic. The reference text implies "completed research" but the procedure reads every `.md` under `research/`.
2. **Hardcoded routing** — derived themes always land as `routing: discussion`, which is correct ONLY when the input is completed per-topic research. Under the new inception model (topic-levelled map), the analyses need to make per-candidate routing decisions.

There's also a structural gap: pre-inception epics that migrate via migration 038 end up with a single broad research item (`exploration` or named-equivalent) on the discovery map. Without intervention they get zero benefit from the map until exploration completes — which may never happen since exploration is explorative by nature. The previous attempt at fixing this (auto-analyses on in-progress files) was the bug. The fix is a mandatory user-guided decomposition flow.

**Goals:**

- Auto-analyses (research-analysis + gap-analysis) operate only on completed material, with per-candidate routing.
- New skill normalises legacy epics: in-progress migration-seeded research files are decomposed into topic-scoped files via a mandatory, user-guided flow.
- Continue-epic reorders so summary backfill runs before analyses (so analyses see richer map state).
- Heal-forward any v0.4.0 consumers who already had bad inception items written by the buggy analyses.

## Implementation

### A. Manifest CLI — extend `superseded` to research

`skills/workflow-manifest/scripts/manifest.cjs:23` — add `superseded` to research phase status list (precedent: specification phase already has it, line 27).

`skills/workflow-shared/scripts/discovery-utils.cjs:109` — update `computePhaseStatus` to filter out `superseded` alongside `cancelled` in the status aggregation. Same logical reason: superseded items shouldn't count toward "phase has in-progress items."

No lifecycle tier change needed in `computeTopicLifecycle` — superseded research items have their inception item removed in our flow, so they don't render on the map.

### B. Cache field move + migration

Migration `skills/workflow-migrate/scripts/migrations/039-move-gap-analysis-cache.sh` (next number after 038):
- Delete `phases.discussion.gap_analysis_cache` from all in-progress epic manifests.
- Don't initialize the new location — analyses populate it on next run. Absent = absent under the existing `computeAnalysisCacheStatus` logic.
- Idempotent.
- Test at `tests/scripts/test-migration-039.sh`.

Update `skills/workflow-shared/scripts/discovery-utils.cjs:244` — `computeAnalysisCacheStatus(kind='gap-analysis')` reads from `phases.inception.gap_analysis_cache` and computes input checksum across completed research files + completed discussion files (no longer includes the `research-analysis.md` cache file).

### C. Research-analysis fixes — `skills/workflow-shared/references/research-analysis.md`

Add precondition (new Section A.0 or amend opening): skip if no research-routed inception item has `status: completed`. Skip silently; do not stamp cache.

Update Section A (Identify Themes) — input scope: read only completed research files. Skip files whose corresponding `phases.research.items.{topic}.status` is `superseded`. Skip files with no matching research item.

Section D (Filter and Save) — replace hardcoded `routing: discussion` with per-candidate routing decided by the analysis (model judgment based on theme depth: discussion-ready themes route to discussion, under-explored themes route to research).

Section E (Update Cache) — checksum computed from completed research files only (not all `research/`).

### D. Inception-gap-analysis rewrite

Rename `skills/workflow-shared/references/discussion-gap-analysis.md` → `skills/workflow-shared/references/inception-gap-analysis.md`.

Section A — drop the `research-analysis.md` cache file as input. Read completed research files + completed discussion files directly (filter by manifest status). Same skip-superseded logic as research-analysis.

Add precondition: skip if no completed research or discussion items exist.

Section C/D — per-candidate routing (was hardcoded discussion). Same logic as research-analysis: judge per-theme based on content depth.

Section E — move cache writes from `phases.discussion.gap_analysis_cache` to `phases.inception.gap_analysis_cache`. Update reference text accordingly.

Update `skills/workflow-shared/references/self-healing.md` — load the renamed file. Update `kind: 'gap-analysis'` references to match new structure.

Update `skills/workflow-shared/scripts/discovery-utils.cjs:243-269` — `computeAnalysisCacheStatus(kind='gap-analysis')` reads new cache location, computes new input checksum.

### E. New skill — `workflow-legacy-research-split`

Create `skills/workflow-legacy-research-split/` with:

**SKILL.md** — frontmatter `user-invocable: false`, `allowed-tools` includes manifest CLI, knowledge CLI, file ops. Loaded by continue-epic's new Step 5 (see Section F).

**References:**

- `detect-trigger.md` — read manifest. Find inception items where `source: migration-seeded` AND `routing: research`. For each, check if `phases.research.items.{name}.status` is `in-progress` AND `.workflows/{wu}/research/{name}.md` exists. Return the list of qualifying items.

- `session-loop.md` — process each qualifying source file in sequence within the same session. Per source file:
  1. Read source file end-to-end.
  2. Read existing inception map (all-state items + dismissed list).
  3. Identify themes exhaustively. For each theme, classify:
     - `stays` — theme name matches source file's topic name. Default; no action.
     - `merges` — theme name matches another existing inception item. Append content to that item's research file. Duplication allowed.
     - `creates` — theme name doesn't match any existing item. Becomes a new topic candidate.
  4. Present `creates` candidates to user (proposed name, routing, summary, description). User can edit names, routing, merge two candidates into one, split one into two, reassign content. Cannot reject outright — content must land somewhere.
  5. On confirmation:
     - Create new research files for accepted `creates` (use `skills/workflow-research-process/references/template.md`). Content moved verbatim. Init research + inception items, status `in-progress`, source `legacy-split`.
     - Append content to existing research files for `merges`. Verbatim. No dedup.
     - Source file: if at least one `stays`, source untouched. If no `stays` (all create/merge), source becomes superseded — set `phases.research.items.{source}.status = 'superseded'`, remove `phases.inception.items.{source}` entirely, KB removal via `knowledge remove --work-unit {wu} --phase research --topic {source}`. Source file stays on disk untouched.
  6. Single commit per source file (or one commit covering all, TBD during implementation).

- `apply-split.md` — the manifest/file write steps factored out from session-loop.

- `propose-candidates.md` — the user-facing display + edit loop.

Use `skills/workflow-shared/references/topic-name-validation.md` for collision-resolution on `creates` candidates (precedent in `topic-splitting.md`).

Idempotency: trigger naturally becomes false once `legacy-split` sourced items exist or migration-seeded items have their status changed. No flag needed.

### F. Continue-epic flow update — `skills/continue-epic/SKILL.md`

Insert new step + reorder. Current order: Self-Healing (5) → Summary Backfill (6) → Display (7) → Route (8).

New order:
- **Step 5: Legacy Bridge** (NEW) — check trigger via `detect-trigger.md` logic (or inline manifest read). If qualifying items exist, invoke `/workflow-legacy-research-split` for the work unit. Re-run discovery after return.
- **Step 6: Summary Backfill** — was Step 6, position now after legacy bridge.
- **Step 7: Self-Healing** — was Step 5, moved after backfill so analyses see filled-in summaries.
- **Step 8: Display State and Menu** — was Step 7.
- **Step 9: Route Selection** — was Step 8.

Update menu-routing references (e.g. `skills/continue-epic/SKILL.md:307+` table) and any internal step number references in `references/epic-display-and-menu.md` etc.

Refinement (in `skills/workflow-inception-process/references/refinement-session.md`) Section D also runs self-healing. Its self-healing invocation needs no change beyond what we're doing in `self-healing.md` itself — analyses get the new preconditions automatically.

### G. In-research drift trigger loosening

`skills/workflow-research-process/references/epic-session.md` Section D — change the convergence routing trigger from "threads emerging as distinct topics (different scopes, stakeholders, or timelines)" to a drift-based trigger: "sustained off-topic content over multiple exchanges in this research session."

`skills/workflow-research-process/references/topic-splitting.md` — update the opening prose and the "I've noticed distinct threads emerging" display block to match the drift framing. Same flow downstream; only the trigger language changes.

### H. Migration 040 — heal-forward for v0.4.0 consumers

`skills/workflow-migrate/scripts/migrations/040-cleanup-premature-inception-items.sh`:
- Iterate in-progress epic manifests.
- For each inception item where `source` contains `research-analysis`:
  - SKIP if `phases.research.items.{name}` exists.
  - SKIP if `phases.discussion.items.{name}` exists.
  - SKIP if any downstream phase work exists for this topic (specification, planning, implementation, review).
  - Otherwise: delete the inception item.
- Do NOT add to `phases.inception.dismissed[]` — topics may legitimately re-surface via the corrected analyses later.
- Idempotent.
- Test at `tests/scripts/test-migration-040.sh`.

### I. Tests

- `tests/scripts/test-migration-039.sh` — cache field move idempotency, content preservation, skip-when-already-moved.
- `tests/scripts/test-migration-040.sh` — orphan cleanup, skip-when-sibling-exists, skip-when-downstream-exists, idempotency, no-dismissed-add.
- New test for legacy-research-split: `tests/scripts/test-legacy-research-split.cjs` covering: single-topic file (stays case → file untouched, no supersede), broad file (no stays, full supersede), multi-source-file batch, theme-name-matches-existing (merge case), name collision resolution.
- Update existing tests for analyses' new preconditions — anything that asserted analysis fires on absent cache may need to assert it also requires completed material.
- Manifest CLI test for `superseded` status validation on research phase.

### J. Documentation

- Update `CLAUDE.md` Workflow Phases description for inception — mention legacy-research-split skill and reordered continue-epic steps.
- No README changes anticipated unless it documents the analyses externally.

## Files Created

- `skills/workflow-legacy-research-split/SKILL.md`
- `skills/workflow-legacy-research-split/references/detect-trigger.md`
- `skills/workflow-legacy-research-split/references/session-loop.md`
- `skills/workflow-legacy-research-split/references/propose-candidates.md`
- `skills/workflow-legacy-research-split/references/apply-split.md`
- `skills/workflow-shared/references/inception-gap-analysis.md` (renamed from discussion-gap-analysis.md)
- `skills/workflow-migrate/scripts/migrations/039-move-gap-analysis-cache.sh`
- `skills/workflow-migrate/scripts/migrations/040-cleanup-premature-inception-items.sh`
- `tests/scripts/test-migration-039.sh`
- `tests/scripts/test-migration-040.sh`
- `tests/scripts/test-legacy-research-split.cjs`

## Files Modified

- `skills/workflow-manifest/scripts/manifest.cjs` — add `superseded` to research phase status list.
- `skills/workflow-shared/scripts/discovery-utils.cjs` — `computePhaseStatus` filters superseded; `computeAnalysisCacheStatus(gap-analysis)` reads new cache location, drops research-analysis.md from input checksum.
- `skills/workflow-shared/references/research-analysis.md` — preconditions, input scoping, per-candidate routing.
- `skills/workflow-shared/references/self-healing.md` — reference renamed file, no behavioural change.
- `skills/workflow-shared/references/discussion-gap-analysis.md` — DELETED (replaced by `inception-gap-analysis.md`).
- `skills/continue-epic/SKILL.md` — new Step 5, reordered steps 6/7.
- `skills/continue-epic/references/epic-display-and-menu.md` — step number references (if any).
- `skills/workflow-research-process/references/epic-session.md` — Section D trigger language.
- `skills/workflow-research-process/references/topic-splitting.md` — opening prose and display block.
- `CLAUDE.md` — Workflow Phases inception description.

## Verification

1. **Unit tests**: run `bash tests/scripts/test-workflow-manifest.sh` (covers superseded status), `bash tests/scripts/test-migration-039.sh`, `bash tests/scripts/test-migration-040.sh`, `node tests/scripts/test-legacy-research-split.cjs`. All should pass.
2. **Existing test sweep**: full `tests/scripts/` runs to confirm no regressions in discovery/refinement/knowledge tests.
3. **Manual scenario — clean epic**: create a fresh epic via `/start-epic`, complete inception with several topics. Confirm `continue-epic` renders the map normally, doesn't trigger legacy-split. Run analyses by completing a research item; verify per-candidate routing.
4. **Manual scenario — legacy epic with broad research**: create an in-progress epic with one broad research file named `exploration` (or simulate via manifest manipulation matching migration 038's output). Run `/continue-epic {wu}`. Confirm legacy-split fires, presents candidates, user-guided flow works, source file gets superseded, new topic files created, inception map populates.
5. **Manual scenario — legacy epic with topic-named file**: create an epic with `authentication.md` containing content for auth + caching + api-structure themes. Run `/continue-epic`. Confirm legacy-split fires, identifies three themes, "authentication" stays (file untouched), caching + api-structure create new files. Original inception item unchanged.
6. **Manual scenario — v0.4.0 consumer heal**: simulate a manifest with 8 premature `source: research-analysis` items (no sibling research/discussion, no downstream work). Run migration 040 via `/workflow-migrate`. Confirm orphans deleted, no dismissed-add.
7. **Build check**: `npm run build` succeeds (knowledge bundle rebuild).
