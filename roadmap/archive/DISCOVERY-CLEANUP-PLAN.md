# Plan: Clean Up Discovery Scripts — Cache to Manifest + Design Fixes

## Status: COMPLETED

Executed 2026-03-03. All 7 fixes implemented in commit `2ae64d1` on `feat/work-type-architecture-v2`.

## Context

After rewriting 9 bash discovery scripts to Node.js, audit agents found 7 issues: 2 cache files still use YAML frontmatter (should be in the manifest), and 6 inherited design bugs were faithfully ported from the old bash scripts. The user wants these fixed properly — not patched around legacy patterns. We can redesign freely: we own the manifest schema, the discovery output shape, and the reference files that consume them.

## Changes

### 1. Move cache metadata to manifest, eliminate frontmatter

**Problem**: Two `.state/*.md` cache files store `checksum` and `generated` in YAML frontmatter. Discovery scripts parse this via `readFrontmatterField()`. The manifest is the single source of truth for state — cache metadata belongs there.

**Design**: Store analysis cache metadata under the phase that produced the source files:
- Research analysis cache → `phases.research.analysis_cache: { checksum, generated, files }`
- Discussion consolidation cache → `phases.discussion.analysis_cache: { checksum, generated }`

Discovery reads via `phaseData(m, 'research').analysis_cache`. Cache `.md` files become pure markdown (no frontmatter). `readFrontmatterField` is deleted.

The `research_files` list (previously parsed as YAML from the cache file body) moves into the manifest's `analysis_cache.files` array — this also eliminates Fix 5 (parser fragility).

**Files**:
- `skills/start-discussion/scripts/discovery.js` — read cache from `phaseData(m, 'research').analysis_cache` instead of frontmatter. Remove `fs` import (no longer reads cache file). Remove `readFrontmatterField` import. Remove research_files body parser (lines 82-95).
- `skills/start-specification/scripts/discovery.js` — read cache from `phaseData(m, 'discussion').analysis_cache` instead of frontmatter. Remove `readFrontmatterField` import. Keep `fs` import (still reads cache file body for anchored name heading extraction).
- `skills/workflow-shared/scripts/discovery-utils.js` — delete `readFrontmatterField` function and its export.
- `skills/start-discussion/references/research-analysis.md` — change "Save to cache" section: write metadata to manifest via CLI, write `.md` as pure markdown (no frontmatter). Update cache status references from `cache.status` to checking per-entry status.
- `skills/start-specification/references/analysis-flow.md` — change section C: write metadata to manifest via CLI, write `.md` as pure markdown (no frontmatter). Drop `discussion_files` list (never consumed by any discovery script).

### 2. Normalize cache output shape

**Problem**: When cache entries exist: `cache: { entries: [...] }`. When no entries: `cache: { status: 'none', reason: '...', entries: [] }`. The no-cache shape has extra `status`/`reason` fields. Reference files reference `cache.status` ambiguously.

**Design**: Always return `cache: { entries: [...] }`. Consumers check `entries.length`. No top-level `status`/`reason`. Each entry has its own `status` and `reason`.

**Files**:
- `skills/start-discussion/scripts/discovery.js` — simplify cache return to `{ entries: cacheEntries }`. Update `format()` to print `(none)` when empty.
- `skills/start-specification/scripts/discovery.js` — same simplification. Update `format()`.
- `skills/start-discussion/references/research-analysis.md` — update instructions: check if a cache entry exists for the work unit, not `cache.status`.
- `skills/start-specification/SKILL.md` — update cache section documentation.
- `skills/start-discussion/SKILL.md` — update cache section documentation.

### 3. Normalize workflow-start naming

**Problem**: `epic: { work_units: [...] }` vs `features: { topics: [...] }` vs `bugfixes: { topics: [...] }`. Inconsistent key names across work types.

**Design**: Normalize all three to use `items`:
```javascript
epics:    { items: [...], count: N },
features: { items: [...], count: N },
bugfixes: { items: [...], count: N },
```
Also `epic` → `epics` (plural, consistent with others).

**Files**:
- `skills/workflow-start/scripts/discovery.js` — rename return keys.
- `skills/workflow-start/references/work-type-selection.md` — `epic.work_units` → `epics.items`, `features.topics` → `features.items`, `bugfixes.topics` → `bugfixes.items`.
- `skills/workflow-start/references/epic-routing.md` — `epic.work_units` → `epics.items`, `epic.count` → `epics.count`.
- `skills/workflow-start/references/feature-routing.md` — `features.topics` → `features.items`.
- `skills/workflow-start/references/bugfix-routing.md` — `bugfixes.topics` → `bugfixes.items`.
- `skills/workflow-start/SKILL.md` — update documentation of discovery shape.

### 4. Fix resolved dep without task_id

**Problem**: In start-implementation dep resolution, if `dep.state === 'resolved'` but no `task_id`, the condition `dep.state === 'resolved' && dep.task_id` is falsy, so the dep silently falls through as satisfied. This is a bug — a resolved dependency without a task reference cannot be verified.

**Design**: Add else clause that blocks with reason `'resolved dependency missing task reference'`.

**File**: `skills/start-implementation/scripts/discovery.js` — add `else if (dep.state === 'resolved' && !dep.task_id)` branch after line 95.

### 5. Fix requires_setup mixed type

**Problem**: Returns string `'unknown'` when file is missing, boolean `true`/`false` when file exists. Mixed types.

**Design**: Use `null` instead of `'unknown'`. The consumer (`environment-check.md`) already handles the three-state logic — just change `'unknown'` to `null` and update the reference.

**Files**:
- `skills/start-implementation/scripts/discovery.js` — `let requiresSetup = null;`
- `skills/start-implementation/references/environment-check.md` — `unknown` → `null`.
- `skills/start-implementation/SKILL.md` — update docs.

### 6. Remove dead state counts from start-implementation

**Problem**: `plans_concluded_count`, `plans_with_unresolved_deps`, `plans_ready_count`, `plans_in_progress_count`, `plans_completed_count` exist in state but are NEVER consumed by any reference file. Only `scenario` is consumed (by `route-scenario.md`). The counts are documented in SKILL.md but serve no purpose — the reference files classify plans by iterating the arrays directly.

**Design**: Remove all five count fields from state. Keep only `has_plans`, `plan_count`, and `scenario`. Remove the variables that compute them. Update SKILL.md documentation. Update `format()`.

**Files**:
- `skills/start-implementation/scripts/discovery.js` — remove count variables and their state fields. Simplify `format()`.
- `skills/start-implementation/SKILL.md` — remove count field documentation.

### 7. Flatten dependency resolution into plan entries

**Problem**: Dependency info is duplicated: `external_deps` on each plan + a separate top-level `dependency_resolution` array. The reference files need per-plan dep status. Having it in two places is redundant.

**Design**: Move `deps_satisfied` and `deps_blocking` directly onto each plan entry. Remove the top-level `dependency_resolution` array. Simplify the SKILL.md docs.

**Files**:
- `skills/start-implementation/scripts/discovery.js` — compute dep resolution inline per plan instead of in a separate pass. Add `deps_satisfied` and `deps_blocking` to each plan entry. Remove `depResolution` array and `dependency_resolution` from return.
- `skills/start-implementation/SKILL.md` — remove `dependency_resolution` section, document `deps_satisfied`/`deps_blocking` on plans.
- `skills/start-implementation/references/check-dependencies.md` — reference plan's `deps_satisfied`/`deps_blocking` directly instead of `dependency_resolution`.

## Verification

All passed:
1. `node --test tests/scripts/test-discovery-*.js` — 97/97 pass
2. `bash tests/scripts/test-migration-016.sh` — 118/118 pass
3. `grep -r 'readFrontmatterField' skills/` — zero results
4. `grep -r 'frontmatter' skills/*/scripts/` — zero results
5. `grep -r 'work_units\|\.topics' skills/workflow-start/` — zero results
6. `grep -r 'plans_in_progress_count\|plans_completed_count\|plans_concluded_count\|plans_ready_count\|plans_with_unresolved' skills/start-implementation/` — zero results
7. `grep -r 'dependency_resolution' skills/start-implementation/` — zero results
