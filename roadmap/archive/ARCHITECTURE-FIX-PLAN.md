# Fix Plan: Topic/Work Unit Architecture Corrections

## Context

The V2 architecture PR (`feat/work-type-architecture-v2`) introduced work-unit-first directories and manifest CLI. During implementation, three related errors were made:

1. **{topic} was wholesale-replaced with {work_unit}** — These are different concepts. `{work_unit}` is the top-level directory (epic name). `{topic}` is the item within a phase (discussion name, spec name, plan name). For feature/bugfix they share the same value, but for epic they're distinct.

2. **Feature/bugfix paths were flattened** — The plan had different directory structures per work type (flat for feature/bugfix, topic subdirs for epic). This creates conditional path logic everywhere. The fix: uniform `{topic}` in all paths regardless of work type — flat `{topic}.md` for phases without metafiles (discussion, investigation), topic subdirs for phases with metafiles (specification onward).

3. **Analysis files left at global scope** — `research-analysis.md` and `discussion-consolidation-analysis.md` should be per-work-unit under `.workflows/{work_unit}/.state/`, not global under `.workflows/.state/`.

Additionally: the manifest CLI should become domain-aware — skills provide logical coordinates (work_unit, phase, topic, field) via flags, and the CLI routes to the correct JSON path internally based on work_type. Skills never know or care about the manifest's internal structure (flat for feature/bugfix, items for epic).

---

## Uniform Path Pattern

Nesting matches the phase's needs — flat files where no metafiles exist, topic subdirs where they do. Same pattern regardless of work type.

**Flat file phases** (no metafiles — file IS the topic):
```
.workflows/{work_unit}/research/*.md                              (exempt — freeform)
.workflows/{work_unit}/discussion/{topic}.md
.workflows/{work_unit}/investigation/{topic}.md
```

**Topic subdir phases** (metafiles live alongside the primary artifact):
```
.workflows/{work_unit}/specification/{topic}/specification.md     (+ review tracking files)
.workflows/{work_unit}/planning/{topic}/planning.md               (+ tasks/)
.workflows/{work_unit}/implementation/{topic}/implementation.md   (+ analysis files)
.workflows/{work_unit}/review/{topic}/r{N}/review.md
```

For feature "auth-flow": `{work_unit}` = `auth-flow`, `{topic}` = `auth-flow` (same value).
For epic "payments-overhaul" item "payment-processing": `{work_unit}` = `payments-overhaul`, `{topic}` = `payment-processing`.

## Domain-Aware Manifest CLI

Skills provide logical coordinates via flags. The CLI routes to the correct JSON path internally based on work_type. Skills never know or care about the manifest's internal structure (flat for feature/bugfix, items for epic).

**Grammar:**

```bash
MANIFEST="node .claude/skills/workflow-manifest/scripts/manifest.js"

# Phase operations (--phase and --topic flags):
$MANIFEST get {work_unit} --phase discussion --topic {topic} [field.path]
$MANIFEST set {work_unit} --phase discussion --topic {topic} field.path value
$MANIFEST add-item {work_unit} --phase discussion --topic {topic}

# Work-unit operations (no flags):
$MANIFEST get {work_unit} [field]
$MANIFEST set {work_unit} field value

# Management (unchanged):
$MANIFEST init name --work-type type --description "..."
$MANIFEST list [--status s] [--work-type t]
$MANIFEST archive name
```

**`--topic` is optional** — if omitted, returns the whole phase object. Discovery scripts use this to iterate items:
```bash
$MANIFEST get {work_unit} --phase discussion              # whole phase (for iteration)
$MANIFEST get {work_unit} --phase discussion --topic {topic} status  # specific item field
```

**Internal routing (CLI handles, skills don't know):**
- Feature/bugfix: `--phase discussion --topic auth-flow status` → `phases.discussion.status`
- Epic: `--phase discussion --topic payment-processing status` → `phases.discussion.items.payment-processing.status`
- Phase-only (no topic): returns `phases.discussion` as-is (structure varies by work type)

**Field dot-paths** (e.g., `sources.auth-flow.status`) are domain knowledge within the phase context — acceptable for skills to use as trailing positional args.

## State/Cache Directory Structure

```
.workflows/.state/migrations                                       (global, committed)
.workflows/.state/environment-setup.md                             (global, committed)
.workflows/.cache/sessions/{id}.yaml                               (global, gitignored)
.workflows/.cache/planning/{work_unit}/{topic}/phase-{N}.md        (scoped, gitignored)
.workflows/{work_unit}/.state/research-analysis.md                 (per work unit, committed, epic only)
.workflows/{work_unit}/.state/discussion-consolidation-analysis.md (per work unit, committed, epic only)
```

---

## Fix 1: Manifest CLI (`manifest.js`)

**File:** `skills/workflow-manifest/scripts/manifest.js`

Refactor `cmdGet` and `cmdSet` to accept `--phase` and `--topic` flags instead of dot-path syntax:

1. **Add flag parser** — extract `--phase` and `--topic` from args, return remaining positional args
2. **Rewrite `cmdGet`**:
   - No flags: `get {name} [field]` → reads from manifest root (unchanged logic)
   - With flags: `get {name} --phase {phase} --topic {topic} [field.path]` → read manifest work_type, route to `phases[phase][field]` (feature/bugfix) or `phases[phase].items[topic][field]` (epic)
3. **Rewrite `cmdSet`**:
   - No flags: `set {name} field value` → writes to manifest root (unchanged logic)
   - With flags: `set {name} --phase {phase} --topic {topic} field.path value` → same internal routing as get
4. **Rewrite `cmdAddItem`**:
   - `add-item {name} --phase {phase} --topic {topic}` → for epic: create `phases[phase].items[topic]` with `{status: "in-progress"}`; for feature/bugfix: create `phases[phase]` with `{status: "in-progress"}`
5. **Update `validateSet`** — the segments now come from internal routing, not user-provided dot paths. Validation logic stays but operates on the resolved internal path.
6. **Remove old dot-path parsing** from cmdGet/cmdSet (the `args[0].split('.')` pattern)

**File:** `skills/workflow-manifest/SKILL.md`

Replace all dot-path examples with domain-aware flag syntax:
- `set {work_unit}.phases.discussion.status concluded` → `set {work_unit} --phase discussion --topic {topic} status concluded`
- `get {work_unit}.phases.discussion.status` → `get {work_unit} --phase discussion --topic {topic} status`
- Document the grammar with examples for both work-unit-level and phase-level operations
- Document that field.path trailing args are domain-level paths within the phase context

---

## Fix 2: Processing Skills — Paths + Manifest Calls

Every processing skill needs paths corrected and manifest CLI calls updated to domain-aware flag syntax.

**IMPORTANT**: Path changes are NOT a find-and-replace. The V2 rewrite restructured paths from phase-first to work-unit-first, and in that process `{topic}` was dropped (not simply replaced by `{work_unit}`). Example from `implementation-analysis-architecture.md`:
- **Before (main)**: `.workflows/implementation/{topic}/...`
- **Current (broken)**: `.workflows/{work_unit}/implementation/...`
- **Correct**: `.workflows/{work_unit}/implementation/{topic}/...`

The `{work_unit}` prefix is correct — it stays. The `{topic}` needs to be **restored** in the correct position (between phase dir and artifact). Each file must be assessed individually against the correct path pattern. Do NOT use global search-and-replace. Use search to FIND files that need updating, then fix each one contextually.

### technical-discussion

**`SKILL.md`** (lines 73, 89-99):
- Step 0 resume: `.workflows/{work_unit}/discussion/{topic}.md` (uniform — flat file, no conditional)
- Step 1 init: ensure `.workflows/{work_unit}/discussion/` exists (no topic subdir)
- Step 1 manifest: `add-item {work_unit} --phase discussion --topic {topic}` (all work types)
- Remove flat `set {work_unit}.phases.discussion.status in-progress` — use `add-item` instead

**`references/conclude-discussion.md`**:
- Remove flat/items conditional — one CLI call: `set {work_unit} --phase discussion --topic {topic} status concluded`

**`references/template.md`** (lines 7-8):
- Update path: `.workflows/{work_unit}/discussion/{topic}.md`

### technical-investigation

**`SKILL.md`**:
- Update paths: `.workflows/{work_unit}/investigation/{topic}.md` (flat file, no subdir)
- Manifest: `add-item {work_unit} --phase investigation --topic {topic}`

### technical-specification

**`SKILL.md`** (lines 38, 50, 100, 131, 150):
- All spec paths: `.workflows/{work_unit}/specification/{topic}/specification.md`
- Review tracking: `.workflows/{work_unit}/specification/{topic}/review-*-tracking-c*.md`
- Manifest: `add-item {work_unit} --phase specification --topic {topic}`

**`references/specification-format.md`** (line 7):
- Update canonical path

**`references/review-tracking-format.md`** (line 11):
- Update tracking file location

**`references/spec-construction.md`** (line 94):
- Source status: `set {work_unit} --phase specification --topic {topic} sources.{source-name}.status incorporated`

**`references/spec-completion.md`** (lines 100-103):
- All manifest calls: `set {work_unit} --phase specification --topic {topic} status concluded`

**`references/spec-review.md`**:
- Review cycle: `get/set {work_unit} --phase specification --topic {topic} review_cycle`

**`references/verify-source-material.md`** (line 18-19):
- Update example paths

### technical-planning

**`SKILL.md`** (lines 38, 63, 79, 92, 162, 214):
- Plan Index File: `.workflows/{work_unit}/planning/{topic}/planning.md`
- Scratch files: `.workflows/.cache/planning/{work_unit}/{topic}/phase-{N}.md`
- Manifest: `add-item {work_unit} --phase planning --topic {topic}`

**`references/author-tasks.md`** (lines 13, 15, 30, 35, 198, 200):
- All scratch and spec paths get topic subdir

**`references/plan-index-schema.md`** (line 7):
- Update canonical path

**`references/define-phases.md`**, **`references/define-tasks.md`**, **`references/task-design.md`**:
- Spec reference paths: `.workflows/{work_unit}/specification/{topic}/specification.md`

**`references/invoke-review-*.md`**, **`references/analyze-task-graph.md`**:
- Plan and spec paths get topic subdir

**`references/review-integrity.md`**, **`references/review-traceability.md`**:
- Tracking file paths get topic subdir

**`references/output-formats/local-markdown/*.md`** (about, authoring, reading, updating):
- All task file paths: `.workflows/{work_unit}/planning/{topic}/tasks/{task-id}.md`

### technical-implementation

**`SKILL.md`** (lines 39, 110, 131, 139, 161, 191):
- Implementation tracking: `.workflows/{work_unit}/implementation/{topic}/implementation.md`
- Environment setup refs: `.workflows/.state/environment-setup.md`
- Manifest: `add-item {work_unit} --phase implementation --topic {topic}`

**`references/invoke-task-writer.md`** (line 18):
- Staging file: `.workflows/{work_unit}/implementation/{topic}/analysis-tasks-c{N}.md`

**`references/analysis-loop.md`** (line 130):
- Staging file path

**`references/environment-setup.md`** (lines 20, 45, 47):
- Fix: `.workflows/environment-setup.md` → `.workflows/.state/environment-setup.md`

### technical-review

- Review paths: `.workflows/{work_unit}/review/{topic}/r{N}/review.md`
- Verify all path references include topic subdir
- Manifest: `add-item {work_unit} --phase review --topic {topic}`

---

## Fix 3: Agents — Paths

Same as Fix 2 — `{topic}` was dropped during the phase-first → work-unit-first rewrite. `{work_unit}` prefix is correct, `{topic}` needs restoring. Assess each file individually. ~10 agent files affected:

- `implementation-analysis-synthesizer.md` — implementation paths
- `implementation-analysis-duplication.md` — implementation paths
- `implementation-analysis-standards.md` — implementation paths
- `implementation-analysis-architecture.md` — implementation paths
- `implementation-analysis-task-writer.md` — planning + implementation paths (line 35, 41+)
- `review-task-verifier.md` — review paths
- `review-findings-synthesizer.md` — implementation paths
- `specification-review-gap-analysis.md` — specification paths
- `specification-review-input.md` — specification paths
- `planning-phase-designer.md`, `planning-task-designer.md`, etc. — planning paths

Agents mostly reference specification/planning/implementation/review paths — all topic-subdir phases. Restore `{topic}` in the correct position for each path. Assess each file individually.

---

## Fix 4: Entry-Point Skills — Paths, Discovery, Analysis Scoping

### start-discussion

**`SKILL.md`** (line 3):
- Remove `Bash(mkdir -p .workflows/.state)` and `Bash(rm .workflows/.state/research-analysis.md)` from allowed-tools
- Add patterns for per-work-unit .state dirs

**`scripts/discovery.sh`** (line 13):
- `CACHE_FILE` needs to be dynamic per work unit, not hardcoded global path
- Cache section: must accept work_unit parameter or scan per work unit

**`references/research-analysis.md`** (lines 17, 43, 46):
- Update cache path: `.workflows/{work_unit}/.state/research-analysis.md`
- Update mkdir: `mkdir -p .workflows/{work_unit}/.state`

**`references/handle-selection.md`** (line 69):
- Update rm path

**`references/invoke-skill.md`**:
- Update session state artifact path to include topic subdir

### start-specification

**`SKILL.md`** (line 3):
- Same allowed-tools cleanup as start-discussion

**`scripts/discovery.sh`** (line 16):
- Dynamic cache path per work unit

**`references/analysis-flow.md`** (lines 68, 71):
- Update mkdir and write path

**`references/display-groupings.md`** (lines 11, 163, 173):
- Update all cache path references

**`references/display-specs-menu.md`** (line 142):
- Update rm path

**`references/display-analyze.md`** (line 90):
- Update rm path

### start-feature, start-bugfix, start-epic

- All artifact path references need topic subdir
- `references/invoke-skill.md` — session state artifact paths
- `references/topic-name-check.md` — manifest check paths

### start-planning, start-implementation, start-review

- All artifact path references need topic subdir
- Discovery scripts: update manifest CLI calls to flag-based syntax

### start-investigation

- Artifact paths need topic subdir

### start-research

- Research is exempt — paths stay as-is

### status

- Discovery script: update manifest CLI calls to flag-based syntax

### view-plan, link-dependencies

- Update artifact path references

### workflow-start, workflow-bridge

- Update all path references and manifest CLI calls to flag-based syntax

### start-implementation

**`references/environment-check.md`** (lines 26, 42, 43):
- Fix: `.workflows/environment-setup.md` → `.workflows/.state/environment-setup.md`

**`scripts/discovery.sh`** (line 12):
- Fix: environment file path

---

## Fix 5: Migration Script (016)

**`skills/migrate/scripts/migrations/016-work-unit-restructure.sh`**:

- **Phase 2 (move files)**: All work types use `{topic}` in paths. Discussion/investigation get flat `{topic}.md` files (e.g., `.workflows/auth-flow/discussion/auth-flow.md`). Specification onward get topic subdirs (e.g., `.workflows/auth-flow/specification/auth-flow/specification.md`).
- **Phase 3 (build manifest)**: Feature/bugfix manifests stay flat (`phases.discussion.status`), epic manifests use items (`phases.discussion.items.{topic}.status`). The CLI abstracts this — migration just needs correct internal structure per work type.
- **Analysis file migration** (line 397-400): Move to `.workflows/{name}/.state/research-analysis.md`, not `.workflows/{name}/.cache/`.

---

## Fix 6: Hooks

**`hooks/workflows/compact-recovery.sh`**:
- Verify artifact path patterns include topic subdir

---

## Fix 7: Tests

### Manifest CLI tests (`test-workflow-manifest.sh`)
- Rewrite tests for domain-aware flag syntax (`--phase`, `--topic`)
- Test both feature (flat internal routing) and epic (items internal routing)
- Test field.path trailing args (e.g., `sources.auth-flow.status`)
- Test work-unit-level operations (no flags)

### Migration 016 tests (`test-migration-016.sh`)
- Update expected output paths: all have topic subdirs
- Update expected manifest structure: flat for feature/bugfix, items for epic
- Update analysis file migration assertions: `.state/` not `.cache/`

### Discovery tests (9 scripts: `test-discovery-for-*.sh`)
- Update manifest fixtures: flat for feature/bugfix, items for epic
- Update manifest CLI calls in fixture setup to flag syntax
- Update path assertions: topic subdirs
- Update cache file paths: per-work-unit `.state/`

### Existing migration tests (001-015)
- Should be unaffected — they test old migrations

---

## Fix 8: Documentation

**`CLAUDE.md`**:
- Key Conventions section: update all path examples with topic subdir
- Document domain-aware manifest CLI grammar (flag syntax, not dot-paths)
- Update cache/state section with per-work-unit `.state/` paths

**`README.md`**:
- Update path examples

**`workflow-explorer.html`**:
- Update all path references

---

## Execution Order

1. **manifest.js** — refactor to domain-aware flag syntax, update SKILL.md docs
2. **Processing skills** — fix paths, restore {topic}, flag-based manifest calls (start with technical-discussion as pattern, then remaining)
3. **Agents** — fix paths
4. **Entry-point skills** — fix paths, discovery scripts, analysis file scoping, flag-based CLI calls
5. **Migration 016** — fix structure (uniform topic subdirs, correct internal manifest per work type), analysis paths
6. **Hooks** — verify/fix paths
7. **Tests** — update all fixtures, assertions, and CLI call syntax
8. **Documentation** — CLAUDE.md, README, workflow-explorer

Commit at each numbered step.

---

## Verification

1. `tests/scripts/test-workflow-manifest.sh` — all pass with flag-based CLI
2. `tests/scripts/test-migration-016.sh` — all pass with uniform topic subdirs + correct internal manifest structure
3. All 9 `tests/scripts/test-discovery-for-*.sh` — all pass
4. Existing migration tests (001-015) — no regressions
5. Grep audit: zero occurrences of dot-path manifest syntax (`{name}.phases.` or `.items.{topic}.`) in skills/agents — all replaced with flag syntax
6. Grep audit: zero occurrences of flat artifact paths (`.workflows/{work_unit}/{phase}/{artifact}` without `{topic}`) in skills/agents, excluding research. Discussion/investigation: `{topic}.md` flat file. Specification onward: `{topic}/` subdir.
7. Grep audit: zero occurrences of global `.workflows/.state/research-analysis.md` or `.workflows/.state/discussion-consolidation-analysis.md`

---

## Status: COMPLETED

All 8 fixes implemented and committed on `feat/work-type-architecture-v2`. See git log for details.
