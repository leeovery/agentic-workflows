# CLAUDE.md

Guidance for Claude Code working in this repo.

## Project Overview

Agentic Engineering Workflows for Claude Code. Installed via `npx agntc add leeovery/agentic-workflows`.

**This project authors the workflow system — it does not use it.** Never invoke workflow skills (`/workflow-start`, `/continue-*`, etc.) for work on this project. Edit skill files, references, and scripts directly. This CLAUDE.md is development documentation that does not ship with the product — installed projects get their own. Skills and agents must be self-contained — never rely on this file for runtime behaviour.

## Git Workflow

Always create a feature branch **before** the first commit. Never commit to main and move commits after. The only exception is when explicitly told to commit to main.

## Workflow Phases

1. **Discovery** (`workflow-discovery`): the universal umbrella entry **above** every work type, not a phase of the epic. Confirm the work type, shape the outline, persist at the work-type commit, route into the pipeline. Two invocation modes dispatched at Step 0: **new** (from `workflow-start`, no work unit yet — decide the type via the universal detection core, then epic → initial topic sketch, feature/cross-cutting → research-vs-discussion routing, bugfix/quick-fix → brief intent capture) and **existing-epic** (from `continue-epic` — skip the macro decision, re-shape the map). The **work-type commit is the durability boundary**: the confirm-trigger creates the manifest, writes the session log, lands imports, archives any inbox seed — uniformly for every type; nothing persists before it. For epics the same conversation continues into topic curation — name topics, classify each as research or discussion, build the discovery map; a populated-map session also edits existing items (add, remove, rename, re-route, edit summary/description) via `map-operations.md`. Session log is created **lazily** for existing-epic edits, written by the confirm-trigger for new work. Resume detection (`resume-detection.md`) handles an interrupted prior epic session. Self-healing analyses (research-analysis, discovery-gap-analysis) are run by `continue-epic` Step 6 and `workflow-bridge` section B via shared `topic-discovery-dispatch.md` — **not** from inside discovery. Continue-epic ordering: Legacy Bridge (`/workflow-legacy-research-split` for pre-discovery epics with migration-seeded broad research files) → Summary Backfill → Self-Healing → Display. Direct-entry items land here with `source: direct-start`.
2. **Research** (`workflow-research-process`): EXPLORE — feasibility, market, viability, early ideas. Scoped per-topic, one file per topic at `.workflows/{work_unit}/research/{topic}.md`. Existing files can be attached as imports during discovery's opener (universal across work types) — imports land in `imports/` and surface via the knowledge base. Background review agent for topical gaps; document review reconciles session against research file to catch undocumented substance (both mandatory before conclusion); deep-dive agents for independent thread investigation.
3. **Discussion** (`workflow-discussion-process`): Organic conversation guided by a live Discussion Map (`pending` → `exploring` → `converging` → `decided`). Background review agent for topical gaps; document review reconciles session against discussion file to catch undocumented substance (both mandatory before conclusion). Topic elevation seeds sibling discussions (epics only). Discovery-gap analysis (epics only, formerly discussion-gap-analysis) reads completed research AND completed discussions holistically to surface cross-artifact themes, elevated-but-uncreated topics, emergent topics, integration gaps — cached and manifest-tracked under `phases.discovery.gap_analysis_cache`.
4. **Investigation** (`workflow-investigation-process`): Bugfix-specific — symptom gathering + code analysis → root cause.
5. **Scoping** (`workflow-scoping-process`): Quick-fix-specific — context, spec, plan in one pass.
6. **Specification** (`workflow-specification-process`): Validate and refine into standalone spec.
7. **Planning** (`workflow-planning-process`): Define HOW — phases, tasks, acceptance criteria.
8. **Implementation** (`workflow-implementation-process`): Execute plan via TDD (or verification workflow for quick-fix).
9. **Review** (`workflow-review-process`): Validate work against discussion, specification, plan.

## Skill Architecture

Skills organised in tiers:

**Entry skill** (`workflow-start`): the sole user-invocable entry. Shows all work; routes new work into discovery and existing work into the per-type `continue-*` skills. Hosts the full Step 0 (casing · migrations · knowledge-check · knowledge-compact), run once. `/workflow-migrate` is model-invoked only (Step 0 of `workflow-start`).

**Discovery umbrella** (`workflow-discovery`): model-only (`user-invocable: false`). The universal shaping entry between `workflow-start` and the phases (see Workflow Phases #1). Two modes — new (decide the work type, persist at the commit, route out) and existing-epic (re-shape the map, delegated from `continue-epic`).

**Navigation skills** (`continue-{epic,feature,bugfix,quickfix,cross-cutting}`): model-only (`user-invocable: false`). Per-type resume/dashboard — show state and route to the right phase. `continue-epic` also delegates map refinement to discovery and triggers the analytical bridge enrichment. Step 0 is casing-only (migrations + knowledge-check are guaranteed by `workflow-start`).

**Phase entry skills** (`workflow-*-entry`): internal (`user-invocable: false`). Invoked by discovery, `continue-*`, and the bridge with work_type and work_unit always provided. Handle phase-specific validation, bootstrap questions, processing skill invocation. New single-phase work seeds from the durable carrier (session log + manifest `description`).

**Processing skills** (`workflow-*-process`): model-invocable. Assume pipeline context — work_type set, prior phases complete, artifacts in expected locations.

**Capture skills** (`workflow-log-idea`, `workflow-log-bug`, `workflow-log-quickfix`): model-invocable, lightweight, outside the pipeline. Capture ideas, bugs, or quick-fixes as markdown files in the inbox (`.workflows/.inbox/`). No manifest, no migrations, no step/reference structure — just natural-language instructions with capture-only constraints.

**Shared references** (`skills/workflow-shared/references/`): loaded by multiple skills across phases. Define protocols and checks that apply uniformly regardless of the calling skill. Current: compliance self-check, convergence analysis, background agent surfacing protocol, natural break detection.

### Phase Entry Skill Routing

Phase entry skills (`workflow-*-entry`) receive positional arguments: `$0` = work_type, `$1` = work_unit, `$2` = topic (optional). Topic resolution: `topic = $2 || (wt !== 'epic' ? $1 : null)`.

**With topic** (feature/bugfix always; epic when caller provides it):
- Check manifest phase status → new entry (bootstrap questions) / resume / reopen
- No discovery needed — topic is already determined

**Without topic** (epic only — scoped path):
- Run discovery scoped to work_unit → analysis/selection flow → determine topic
- Only used by discussion and specification (research also, but simpler — just asks seed questions)
- Planning, implementation, review always receive a topic

## Key Conventions

**Work types and work units**: *Work type* = one of five pipeline shapes: epic, feature, bugfix, quick-fix, cross-cutting. *Work unit* = named instance of a work type (e.g., "auth-flow" is a feature work unit, "payments-overhaul" an epic work unit). Each work unit gets its own directory under `.workflows/` and its own `manifest.json`.

- **Epic**: Multi-topic, multi-session, phase-centric (Discovery → Research → Discussion → Specification → Planning → Implementation → Review)
- **Feature**: Single-topic, single-session, linear (Discussion → Specification → Planning → Implementation → Review)
- **Bugfix**: Single-topic, investigation-centric (Investigation → Specification → Planning → Implementation → Review)
- **Quick-fix**: Single-topic, scoping-centric (Scoping → Implementation → Review)
- **Cross-cutting**: Single-topic, project-level (Research (opt.) → Discussion → Specification — terminal)

**Topics**: *Topic* = the item within a phase. For feature/bugfix/quick-fix, topic name equals work unit name. For epic, topics are distinct from the work unit name. All work types use per-topic manifest items (unified structure).

Work-unit-first directory structure with uniform `{topic}` in all paths (`{topic}` = `{work_unit}` for feature/bugfix/quick-fix).

- Project manifest: `.workflows/manifest.json` (work unit registry + project defaults)
- Manifest: `.workflows/{work_unit}/manifest.json`
- Discovery sessions: `.workflows/{work_unit}/discovery/session-NNN.md`
- Research: `.workflows/{work_unit}/research/`
- Discussion: `.workflows/{work_unit}/discussion/{topic}.md` (flat file)
- Investigation: `.workflows/{work_unit}/investigation/{topic}.md` (flat file)
- Specification: `.workflows/{work_unit}/specification/{topic}/specification.md`
- Planning: `.workflows/{work_unit}/planning/{topic}/planning.md` (+ `phase-{N}-tasks.md` + task files in output format)
- Implementation: `.workflows/{work_unit}/implementation/{topic}/`
- Review: `.workflows/{work_unit}/review/{topic}/report.md`
- State: `.workflows/{work_unit}/.state/` (per-work-unit analysis files)
- Global state: `.workflows/.state/` (migrations, environment-setup.md)
- Cache: `.workflows/.cache/{work_unit}/{phase}/{topic}/` (scratch files for any phase)
- Imports: `.workflows/{work_unit}/imports/` (tracked via the `imports[]` manifest field; KB-indexed at copy time)
- Inbox: `.workflows/.inbox/{ideas,bugs,quickfixes}/` (pre-pipeline capture; archived to `.archived/` subfolder when entering pipeline)

**Work unit lifecycle**: Each work unit has a `status` field in its manifest tracking lifecycle state:
- `in-progress` — actively being worked on (default on creation)
- `completed` — pipeline finished (set automatically on pipeline completion, or manually via manage menu)
- `cancelled` — abandoned (set manually via manage menu)

Discovery filters by status — active work by default, with options to view completed/cancelled or manage lifecycle. Work units can be reactivated.

**Feature-to-epic pivot**: Convert features to epics via manage menu (`p`/`pivot`). After pivot, continue immediately as an epic or return to the previous view.

**Feature absorption**: Merge a feature into an in-progress epic via manage menu (`a`/`absorb`). Moves the feature's discussion and research into the epic as a new topic, then deletes the feature. Guarded: requires a discussion, no spec-or-beyond, at least one in-progress epic. Git history serves as provenance.

**Epic topic cancellation**: Cancel/reactivate individual topics via continue-epic menu (`a`/`cancel`, `e`/`reactivate`). Cancellation sets item's phase status to `cancelled` and stashes prior status in `previous_status`. Cancelled items remain visible in state display but excluded from phase aggregation (`phaseStatus`), gating flags, next-phase-ready logic, and discussion/spec entry discovery. Reactivation restores `previous_status` and deletes the field. Epic-only — other work types use work-unit-level cancellation since topic = work unit.

**Epic soft gates**: Forward navigation between epic phases warns if prerequisite items still in-progress. Informational, not blocking — system recovers via re-analysis if user proceeds early.

**Discovery map (epics)**: Discovery builds a manifest-backed map at `phases.discovery.items.{topic}` that drives auto-routing for research and discussion. Each item carries a `source` provenance field recording how the topic landed on the map — one of `discovery`, `research-analysis`, `gap-analysis`, `research-split:{parent}`, `discussion-elevation:{parent}`, `direct-start`, `migration-seeded`, `legacy-split:{parent}`. Multi-source items are comma-accumulated (e.g. `discovery,research-analysis`). A `legacy_split_state` sentinel field (`in-progress` or `applied`) is set by `workflow-legacy-research-split` to prevent re-qualification — items with this field set are excluded by `detect-trigger`. Map items have no `status` field — lifecycle (`fresh`, `researching`, `ready for discussion`, `discussing`, `decided`, `cancelled`) is computed at render time by joining the discovery item against per-phase items. Removal during an discovery session hard-deletes the item and adds its name to a *dismissed list* so analyses won't auto-re-add it (a "show dismissed" recovery option is available in any discovery session). Hard-delete is only allowed for items with no per-phase work; once research or discussion items exist, the map item is preserved as historical anchor. Auto-routing operates at the map-item level — research vs discussion is determined by the item's `routing` field (initial intent) overlaid with whichever per-phase items actually exist.

Commit docs frequently (natural breaks, before context refresh). Skills capture context, don't implement.

## Adding New Output Formats

Use `/create-output-format` to scaffold a new format adapter. Each format is a directory of 5 files:

```
skills/workflow-planning-process/references/output-formats/{format}/
├── about.md        # Benefits, setup, output location
├── authoring.md    # Task storage, flagging, cleanup
├── reading.md      # Extracting tasks, next available task
├── updating.md     # Marking complete/skipped
└── graph.md        # Task graph — priority + dependencies
```

Contract and scaffolding templates live in `.claude/skills/create-output-format/references/`.

## Output Format References (IMPORTANT)

**NEVER list output format names (tick, linear, local-markdown, etc.) anywhere except:**
- `skills/workflow-planning-process/references/output-formats.md` - the authoritative list
- `skills/workflow-planning-process/references/output-formats/{format}/` - individual format directories
- `README.md` - user-facing documentation where format options are presented

**How other phases reference formats:**
- Plans include a `format` field in their manifest
- Consumers load only the per-concern file they need (e.g., `{format}/reading.md` for implementation)

## Migrations

`/workflow-migrate` keeps workflow files in sync with current system design (runs via Step 0 of every entry-point skill).

**How it works:**
- `skills/workflow-migrate/scripts/migrate.sh` runs all migration scripts in `skills/workflow-migrate/scripts/migrations/` in numeric order
- Each migration is idempotent — safe to run multiple times
- Progress tracked in `.workflows/.state/migrations`
- Delete log file to force re-running all migrations

**Adding new migrations:**
1. Create `skills/workflow-migrate/scripts/migrations/NNN-description.sh` (e.g., `002-spec-frontmatter.sh`)
2. Script runs automatically in numeric order
3. Orchestrator handles tracking — once a migration ID appears in the log, the script never runs again
4. Use helper functions: `report_update`, `report_skip` (display only)

Migration `038-add-discovery-phase.sh` seeds discovery items for existing in-progress epics so legacy work units pick up the discovery map without manual intervention.

**Critical: Migration scripts must not use the manifest CLI**

Migration scripts are point-in-time snapshots. The manifest CLI validates against the current schema, which changes over time — a migration using it today may break silently later. Always read/write `manifest.json` directly with `node` or `jq`.

**Bash 3.2 compatibility** (macOS default): Avoid `mapfile`/`readarray`, `declare -A`, `local -n` (all bash 4+).

**Testing migrations:**

Every migration must have a corresponding test file at `tests/scripts/test-migration-NNN.sh`. Follow the harness structure in existing test files (`set -euo pipefail`, `PASS`/`FAIL` counters, `report_update`/`report_skip` stubs, `assert_eq` function, `setup`/`teardown` with temp dir). Conventions:
- **Invocation**: Use `source "$MIGRATION"` for migrations that use `return 0`. Use `bash "$MIGRATION"` with `export -f report_update report_skip` for migrations that use `exit 0`.
- **Isolation**: Each test function calls `setup` at the start and `teardown` at the end. No shared state between tests.
- **Assertions**: Use only `assert_eq`. Parameter order: `label`, `expected`, `actual`. Convert other checks inline:
  - File exists: `assert_eq "desc" "true" "$([ -f "$path" ] && echo true || echo false)"`
  - Content match: `assert_eq "desc" "true" "$(echo "$content" | grep -q 'pattern' && echo true || echo false)"`
  - Fixed-string match: `assert_eq "desc" "true" "$(echo "$content" | grep -qF 'text' && echo true || echo false)"`
- **grep with leading dashes**: Always use `--` before patterns starting with `-` (e.g., `grep -qF -- '- item'`).
- **Test naming**: Functions prefixed `test_`, comments `# --- Test N: Description ---`.
- **Summary**: `echo "Results: $PASS passed, $FAIL failed"` then `[ "$FAIL" -eq 0 ] || exit 1`.
- **Coverage**: Every migration test must cover at minimum: happy path, skip/no-op conditions, idempotency (run twice, same result), and content preservation where applicable.

## Manifest CLI

Manifest CLI at `skills/workflow-manifest/scripts/manifest.cjs` is the single source of truth for all workflow state. Dot-path syntax: `command <work-unit>[.<phase>[.<topic>]] [field] [value]`. Segment count determines access level (1 = work unit, 2 = phase, 3 = topic). Reserved prefix `project` routes to project manifest — e.g., `get project.defaults.plan_format`.

**Project defaults cascade**: `project.defaults` → topic level. Project defaults are suggestions (user confirms or overrides). Topic level records the actual value in use. No phase-level storage for settings like `plan_format`, `project_skills`, or `linters`.

**Shell quoting**: Always single-quote values that zsh would interpret — `'[]'`, `'[...]'`, `'{}'`, `'~'`. Bare `[]` is a glob pattern (causes `no matches found` errors) and bare `~` expands to the home directory.

## Knowledge Base Subsystem

Retrieval-augmented store of completed workflow artifacts (research, discussion, investigation, specification — never planning/implementation/review). Every entry-point skill gates on knowledge base initialisation before any phase runs.

**Source vs bundle**: Source lives in `src/knowledge/` (multi-file Node.js — `index.js`, `store.js`, `chunker.js`, `embeddings.js`, `config.js`, `setup.js`, `providers/openai.js`). Committed CLI at `skills/workflow-knowledge/scripts/knowledge.cjs` is a single-file esbuild bundle. AGNTC installs from git tags with no build step, so the bundle must be present and current at tag time.

**Building**: `npm run build` runs `node build/knowledge.build.js`, which esbuild-bundles `src/knowledge/index.js` into `skills/workflow-knowledge/scripts/knowledge.cjs`. Always rebuild after editing `src/knowledge/` and commit the bundle alongside the source change.

**Allowed tools**: Skills that invoke the CLI must declare `Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs)` in their frontmatter. SKILL.md is the authoritative API reference — read it before adding a new call site.

**Mandatory Step 0.3 gate**: Every entry-point skill ends Step 0 with `Load **[knowledge-check.md](../workflow-knowledge/references/knowledge-check.md)**`. The reference runs `knowledge check` → if `not-ready`, terminal stop directing the user to `knowledge setup`; if `ready`, runs `knowledge compact` (TTL-based decay) and returns. Setup is human-only (interactive readline) — Claude cannot run it.

**Phase-completion indexing**: Processing skills invoke `knowledge index <path>` at phase completion to add the new artifact. Spec promotion and work-unit cancellation invoke `knowledge remove --work-unit ... [--phase ...] [--topic ...]` to clean up. Pending queue handles transient failures with retry on next `index` call.

**Stub mode**: When no embedding provider is configured, CLI runs in keyword-only mode (BM25). Treat as supported degraded mode, not broken state. `query` output prepends `[keyword-only mode — ...]` note.

**Tests**: `tests/scripts/test-knowledge-*.{cjs,sh}` cover the subsystem — store, chunker, embeddings, config, OpenAI provider, integration, retry, build, CLI surface. Run via the same harness as migration tests. Add a test alongside any `src/knowledge/` change.

**Project layout**: `.workflows/.knowledge/` (per-project store + metadata + config), `~/.config/workflows/config.json` (system defaults), `~/.config/workflows/credentials.json` (mode 0600, optional API key store).

## Skill Authoring

Skill authoring rules — display/output conventions, structural conventions, skill file structure, navigation patterns, reference file naming — live in [CONVENTIONS.md](CONVENTIONS.md).

**MANDATORY**: Read [CONVENTIONS.md](CONVENTIONS.md) in full **before** creating or editing any file matching `skills/**/SKILL.md`, `skills/**/references/**/*.md`, or any new skill scaffold. Do not rely on memory or pattern-matching from sibling files — the conventions are dense, exact, and frequently updated. Skipping this step has produced silently non-compliant skills in the past.

Not needed for general project work (scripts, tests, manifest CLI, knowledge base, docs).
