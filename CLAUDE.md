# CLAUDE.md

Guidance for Claude Code working in this repo.

## Project Overview

Agentic Engineering Workflows for Claude Code. Installed via `npx agntc add leeovery/agentic-workflows`.

**This project authors the workflow system — it does not use it.** Never invoke workflow skills (`/workflow-start`, `/workflow-continue-*`, etc.) for work on this project. Edit skill files, references, and scripts directly. This CLAUDE.md is development documentation that does not ship with the product — installed projects get their own. Skills and agents must be self-contained — never rely on this file for runtime behaviour.

## Git Workflow

Always create a feature branch **before** the first commit. Never commit to main and move commits after. The only exception is when explicitly told to commit to main.

## Workflow Phases

The phases group into three stages (the **three D's**), used as the top-level grouping in the epic dashboard (`workflow-continue-epic/references/epic-display-and-menu.md`): **Discovery** (Discovery, Research, Discussion, Investigation) — explore and decide; **Definition** (Scoping, Specification, Planning) — specify and plan; **Delivery** (Implementation, Review) — build and verify. The dashboard renders each stage as a `── STAGE ──` divider with the phases beneath it.

1. **Discovery** (`workflow-discovery`): the universal **first phase** — every work type begins here. Confirm the work type, shape the outline, persist at the work-type commit, route into the pipeline. Two invocation modes dispatched at Step 0: **new** (from `workflow-start`, no work unit yet — decide the type via the universal detection core, then epic → initial topic sketch, feature/cross-cutting → research-vs-discussion routing, bugfix/quick-fix → brief intent capture) and **existing-epic** (from `workflow-continue-epic` — skip the macro decision, re-shape the map). The **work-type commit is the durability boundary**: the confirm-trigger creates the manifest, writes the session log, lands imports, lands the promoted inbox item(s) as the work unit's **seed(s)** — uniformly for every type; nothing persists before it. For epics the same conversation continues into topic curation — name topics, classify each as research or discussion, build the discovery map, and at the harvest synthesise per-topic **briefs** (soft decisions, rejected paths, open questions) that seed each topic's research/discussion read-in-full — regenerating a brief over in-flight downstream work sets `reconcile_needed`, surfaced non-destructively (never overwriting). A populated-map session also edits existing items (remove, rename, re-route, edit summary/description) via `map-operations.md`. Session log is created **lazily** for existing-epic edits, written by the confirm-trigger for new work. Resume detection (`resume-detection.md`) handles an interrupted prior epic session. Self-healing analyses (research-analysis, discovery-gap-analysis) are run by `workflow-continue-epic` Step 6 and `workflow-bridge` section B via shared `topic-discovery-dispatch.md` — **not** from inside discovery. `workflow-continue-epic` ordering: Legacy Bridge (`/workflow-legacy-research-split` for pre-discovery epics with migration-seeded broad research files) → Summary Backfill → Self-Healing → Display. Direct-entry items land here with `source: direct-start`.
2. **Research** (`workflow-research-process`): EXPLORE — feasibility, market, viability, early ideas. Scoped per-topic, one file per topic at `.workflows/{work_unit}/research/{topic}.md`. Existing files can be attached as imports during discovery's opener (universal across work types) — imports land in `imports/` and surface via the knowledge base. Background review agent for topical gaps; document review reconciles session against research file to catch undocumented substance (both mandatory before conclusion); deep-dive agents for independent thread investigation.
3. **Discussion** (`workflow-discussion-process`): Organic conversation guided by a live Discussion Map (`pending` → `exploring` → `converging` → `decided`/`deferred`). Background review agent for topical gaps; document review reconciles session against discussion file to catch undocumented substance (both mandatory before conclusion). Off-topic concerns reroute into the target topic's Triage section, landing with `source: reroute:{origin}` on an existing or newly-created map item (epics only). Discovery-gap analysis (epics only, formerly discussion-gap-analysis) reads completed research AND completed discussions holistically to surface cross-artifact themes, research themes no discussion addressed, emergent topics, integration gaps — cached and manifest-tracked under `phases.discovery.gap_analysis_cache`.
4. **Investigation** (`workflow-investigation-process`): Bugfix-specific — symptom gathering + code analysis → root cause.
5. **Scoping** (`workflow-scoping-process`): Quick-fix-specific — context, spec, plan in one pass.
6. **Specification** (`workflow-specification-process`): Validate and refine into standalone spec. A spec declares two input types: **sources** (discussions extracted wholesale, gated by `incorporated`) and **consult references** (a sibling discussion read narrowly for an owed correction — cite the hand-off slice, don't extract; gated by `addressed`). Consult references are declared at grouping time (consolidation analysis + a KB advisory query surfaces candidates), carried into the handoff, tracked in the manifest under `specification.{topic}.consult_references.{name}.status`, and block completion until addressed.
7. **Planning** (`workflow-planning-process`): Define HOW — phases, tasks, acceptance criteria.
8. **Implementation** (`workflow-implementation-process`): Execute plan via TDD (or verification workflow for quick-fix).
9. **Review** (`workflow-review-process`): Validate work against discussion, specification, plan.

## Skill Architecture

Skills organised in tiers:

**Entry skill** (`workflow-start`): the sole user-invocable entry. Shows all work; routes new work into discovery and existing work into the per-type `workflow-continue-*` skills. Also hosts the inbox pickup — a **working set** (multi-select promotion, single-type-gated) with an `.archived` lifecycle (archive · restore · delete). Hosts the full Step 0 (casing, then `engine boot` — migrations + knowledge check + compact in one call), run once.

**Discovery** (`workflow-discovery`): model-only (`user-invocable: false`). The universal first phase (see Workflow Phases #1) — new work is shaped and its type settled here before the pipeline branches into the type-specific phases. Two modes — new (decide the work type, persist at the commit, route out) and existing-epic (re-shape the map, delegated from `workflow-continue-epic`).

**Navigation skills** (`workflow-continue-{epic,feature,bugfix,quickfix,cross-cutting}`): model-only (`user-invocable: false`). Per-type resume/dashboard — show state and route to the right phase. `workflow-continue-epic` also delegates map refinement to discovery and triggers the analytical bridge enrichment. Step 0 is casing-only (migrations + the knowledge gate are guaranteed by `workflow-start`).

**Phase entry skills** (`workflow-*-entry`): internal (`user-invocable: false`). Invoked by discovery, `workflow-continue-*`, and the bridge with work_type and work_unit always provided. Handle phase-specific validation, bootstrap questions, processing skill invocation. New single-phase work seeds from the durable carrier (session log + manifest `description`).

**Processing skills** (`workflow-*-process`): model-invocable. Assume pipeline context — work_type set, prior phases complete, artifacts in expected locations.

**Capture skills** (`workflow-log-idea`, `workflow-log-bug`, `workflow-log-quickfix`): model-invocable, lightweight, outside the pipeline. Capture ideas, bugs, or quick-fixes as markdown files in the inbox (`.workflows/.inbox/`). No manifest, no migrations, no step/reference structure — just natural-language instructions with capture-only constraints.

**Shared references** (`skills/workflow-shared/references/`): loaded by multiple skills across phases. Define protocols and checks that apply uniformly regardless of the calling skill — casing conventions, compliance self-check, topic discovery and dispatch, analysis approval gates, convergence analysis, background agent surfacing, natural break detection, and more; the directory is the authoritative list.

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

- **Epic**: Multi-topic, multi-session, phase-centric (Discovery → Research (opt.) → Discussion → Specification → Planning → Implementation → Review)
- **Feature**: Single-topic, single-session, linear (Discovery → Research (opt.) → Discussion → Specification → Planning → Implementation → Review)
- **Bugfix**: Single-topic, investigation-centric (Discovery → Investigation → Specification → Planning → Implementation → Review)
- **Quick-fix**: Single-topic, scoping-centric (Discovery → Scoping → Implementation → Review)
- **Cross-cutting**: Single-topic, project-level (Discovery → Research (opt.) → Discussion → Specification — terminal)

**Topics**: *Topic* = the item within a phase. For feature/bugfix/quick-fix, topic name equals work unit name. For epic, topics are distinct from the work unit name. All work types use per-topic manifest items (unified structure).

Work-unit-first directory structure with uniform `{topic}` in all paths (`{topic}` = `{work_unit}` for feature/bugfix/quick-fix).

- Project manifest: `.workflows/manifest.json` (work unit registry + project defaults)
- Manifest: `.workflows/{work_unit}/manifest.json`
- Discovery sessions: `.workflows/{work_unit}/discovery/sessions/session-NNN.md`
- Discovery briefs: `.workflows/{work_unit}/discovery/briefs/{topic}.md` (per-topic views synthesised at the epic harvest — soft decisions, rejected paths, open questions; regenerable, never records; pointed to by the discovery item's `brief_path`, read in full by the topic's research/discussion and tracked via `brief_incorporated`; a regenerated brief over in-flight downstream work sets `reconcile_needed`)
- Research: `.workflows/{work_unit}/research/`
- Discussion: `.workflows/{work_unit}/discussion/{topic}.md` (flat file)
- Investigation: `.workflows/{work_unit}/investigation/{topic}.md` (flat file)
- Specification: `.workflows/{work_unit}/specification/{topic}/specification.md`
- Planning: `.workflows/{work_unit}/planning/{topic}/planning.md` (+ `phase-{N}-tasks.md` + task files in output format)
- Implementation: `.workflows/{work_unit}/implementation/{topic}/`
- Review: `.workflows/{work_unit}/review/{topic}/report.md`
- State: `.workflows/{work_unit}/.state/` (per-work-unit analysis files)
- Global state: `.workflows/.state/` (migrations, environment-setup.md)
- Cache: `.workflows/.cache/{work_unit}/{phase}/{topic}/` (scratch files for any phase; gitignored via `.workflows/.gitignore`, purged when the work unit closes — complete/cancel/absorb — and backfilled for already-closed units by migration 050)
- Imports: `.workflows/{work_unit}/imports/` (user-shared reference files copied in during discovery's opener; tracked via the `imports[]` manifest field; KB-indexed at copy time)
- Seeds: `.workflows/{work_unit}/seeds/` (the work unit's **origin** — the promoted inbox item, or several items of one type, *moved* here at the work-type commit; tracked via the `seeds[]` manifest field, one entry per item, each with a `source: inbox:{idea|bug|quickfix}` tag; KB-indexed under the `seeds` phase. Distinct from imports: the trigger the work was spawned from, not reference material it pulled in)
- Inbox: `.workflows/.inbox/{ideas,bugs,quickfixes}/` (pre-pipeline capture. The inbox pickup is a **working set** — select one or more items *of a single type* to promote, moving them into the work unit's `seeds/`; or archive any selection, regardless of type, to `.archived/{type}/`. The `.archived/` store is live: archived items can be restored to the inbox or hard-deleted (`git rm`) from the archived sub-view. It holds *declined* items, never promoted ones)

**Work unit lifecycle**: Each work unit has a `status` field in its manifest tracking lifecycle state:
- `in-progress` — actively being worked on (default on creation)
- `completed` — pipeline finished (set automatically on pipeline completion, or manually via manage menu)
- `cancelled` — abandoned (set manually via manage menu)

Discovery filters by status — active work by default, with options to view completed/cancelled or manage lifecycle. Work units can be reactivated.

**Feature-to-epic pivot**: Convert features to epics via manage menu (`p`/`pivot`). After pivot, continue immediately as an epic or return to the previous view.

**Feature absorption**: Merge a feature into an in-progress epic via manage menu (`a`/`absorb`). Moves the feature's discussion and research into the epic as a new topic, then deletes the feature. Guarded: requires a discussion, no spec-or-beyond, at least one in-progress epic. Git history serves as provenance.

**Epic topic cancellation**: Cancel/reactivate individual topics via workflow-continue-epic menu (`a`/`cancel`, `e`/`reactivate`). Cancellation sets item's phase status to `cancelled` and stashes prior status in `previous_status`. Cancelled items remain visible in state display but excluded from phase aggregation (`phaseStatus`), gating flags, next-phase-ready logic, and discussion/spec entry discovery. Reactivation restores `previous_status` and deletes the field. Epic-only — other work types use work-unit-level cancellation since topic = work unit.

**Epic soft gates**: Forward navigation between epic phases warns if prerequisite items still in-progress. Informational, not blocking — system recovers via re-analysis if user proceeds early.

**Discovery map (epics)**: Discovery builds a manifest-backed map at `phases.discovery.items.{topic}` that drives auto-routing for research and discussion. Each item carries a `source` provenance field recording how the topic landed on the map — one of `discovery`, `research-analysis`, `gap-analysis`, `research-split:{parent}`, `direct-start`, `migration-seeded`, `legacy-split:{parent}`, `reroute:{origin}` (off-topic concern rerouted in from another topic). Multi-source items are comma-accumulated (e.g. `discovery,research-analysis`). A `legacy_split_state: in-progress` sentinel field is set by `workflow-legacy-research-split` while an apply runs — the success path deletes the sentinel-bearing source item, so a surviving sentinel marks a crashed apply (surfaced by detect as `stranded_sentinels`); items with this field set are excluded by `detect-trigger`. Map items have no `status` field — lifecycle (`fresh`, `researching`, `ready for discussion`, `discussing`, `decided`, `cancelled`) is computed at render time by joining the discovery item against per-phase items. Removal during an discovery session hard-deletes the item and adds its name to a *dismissed list* so analyses won't auto-re-add it (a "show dismissed" recovery option is available in any discovery session). Hard-delete is only allowed for items with no per-phase work; once research or discussion items exist, the map item is preserved as historical anchor. Auto-routing operates at the map-item level — research vs discussion is determined by the item's `routing` field (initial intent) overlaid with whichever per-phase items actually exist.

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

Migrations keep workflow files in sync with current system design (run via `engine boot` in Step 0 of `workflow-start`).

**How it works:**
- `skills/workflow-migrate/scripts/migrate.cjs` (Node) runs every script in `skills/workflow-migrate/scripts/migrations/` — both the frozen `*.sh` fleet and modern `*.cjs` migrations — in one strict numeric-prefix ordering
- Each migration is idempotent — safe to run multiple times
- Progress tracked in `.workflows/.state/migrations`: numeric-only IDs, one per line, extension-independent. An ID is recorded only after its migration completes; any failure aborts the whole run without recording (boot treats a non-zero exit as fatal — migrations must never half-run silently)
- Delete the log file to force re-running all migrations

**Two migration formats:**
- **`*.sh` — the frozen fleet (001–046).** Shipped and already run by real installs; treat as immutable. Edit only to harden a failure path, **never** to change semantics — fix forward with a new numbered `.cjs` migration instead. The orchestrator sources each in a spawned bash with `report_update`/`report_skip` helpers, `PROJECT_DIR` pinned to `.`, cwd = project root, under `set -eo pipefail` (`return 0` semantics preserved).
- **`*.cjs` — all new migrations.** A `.cjs` migration is a module exporting `id`, `description`, and a `run` function, executed in-process:
  ```js
  module.exports = {
    id: '050',
    description: 'short summary',
    run({ projectDir, reportUpdate, reportSkip }) { /* ... */ },
  };
  ```
  Read/write files under `path.join(projectDir, '.workflows')` (`projectDir` is always `.`). Signal outcome only through `reportUpdate()` / `reportSkip()` (display counters — call `reportUpdate()` once per changed unit); never write to stdout. A thrown error aborts the run; if a migration should instead degrade to a skip on unexpected input, catch internally and `reportSkip()`.

**Adding a new migration:**
1. Create `skills/workflow-migrate/scripts/migrations/NNN-description.cjs` (next number after the highest existing)
2. It runs automatically in numeric order; once its ID is in the log it never runs again

Migration `038-add-inception-phase.sh` seeds the phase for existing in-progress epics (`040-rename-inception-to-discovery.sh` then renames it to `discovery`) so legacy work units pick up the discovery map without manual intervention.

**Critical: Migrations must not use `engine manifest`**

Migrations are point-in-time snapshots. The engine's field surface validates against the current schema, which changes over time — a migration using it today may break silently later. Always read/write `manifest.json` directly (`node`/`fs` in `.cjs`; `node`/`jq` in the frozen `.sh` fleet).

**Bash 3.2 compatibility** (frozen `.sh` fleet only): the shipped bash migrations must run under stock macOS `/bin/bash` 3.2 — avoid `mapfile`/`readarray`, `declare -A`, `local -n` (all bash 4+). New `.cjs` migrations run under Node and are exempt.

**Testing migrations:**

Every migration has a matching test suite.

*New `.cjs` migrations* — a node:test suite at `tests/scripts/test-migration-NNN.cjs`, registered in `package.json`'s `test` script (runs under `npm test`). `require` the migration module and drive `run({ projectDir, reportUpdate, reportSkip })` directly against a temp `projectDir`. Follow the sibling suites (`test-migration-047/048/049.cjs`): `describe`/`it`, `node:assert`, per-test `setup`/`teardown` with a `mkdtemp` dir, counting `reportUpdate`/`reportSkip` stubs. Cover at minimum happy path, skip/no-op, idempotency (run twice), content preservation, and every defensive guard. The Node orchestrator itself is covered by `tests/scripts/test-migration-orchestrator.cjs` (mixed `.sh`/`.cjs` ordering, legacy tracking-log compatibility, failure-aborts-without-recording, the `.sh` path under stock `/bin/bash` 3.2, `PROJECT_DIR` pinning).

*Frozen `.sh` fleet* — the existing `tests/scripts/test-migration-NNN.sh` suites (run under `npm run test:migrations`) stay as-is. Their harness: `set -euo pipefail`, `PASS`/`FAIL` counters, `report_update`/`report_skip` stubs, an `assert_eq` function, `setup`/`teardown` with a temp dir. Conventions:
- **Invocation**: `source "$MIGRATION"` (the fleet uses `return 0`).
- **Isolation**: each test function calls `setup` at the start and `teardown` at the end. No shared state.
- **Assertions**: only `assert_eq` (`label`, `expected`, `actual`). File exists → `assert_eq "desc" "true" "$([ -f "$path" ] && echo true || echo false)"`; content match → `... "$(echo "$content" | grep -q 'pattern' && echo true || echo false)"`; fixed-string → `grep -qF`.
- **grep with leading dashes**: always use `--` before patterns starting with `-`.
- **Test naming**: functions prefixed `test_`, comments `# --- Test N: Description ---`.
- **Summary**: `echo "Results: $PASS passed, $FAIL failed"` then `[ "$FAIL" -eq 0 ] || exit 1`.
- **Coverage**: happy path, skip/no-op, idempotency (run twice), and content preservation where applicable.

## Manifest Field Surface

`engine manifest` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest <command> …`, implemented in `skills/workflow-engine/scripts/domain/fields.cjs`) is the single source of truth for all workflow state. Dot-path syntax: `command <work-unit>[.<phase>[.<topic>]] [field] [value]`. Segment count determines access level (1 = work unit, 2 = phase, 3 = topic). Reserved prefix `project` routes to project manifest — e.g., `get project.defaults.plan_format`. Reads (`get`, `exists`, `list`, `key-of`, `resolve`) print bare stdout; mutations (`set`, `push`, `pull`, `delete`, `apply`) answer with the engine's one-line JSON response; `set` takes one positional pair or a uniform `<field>=<value>` batch (never mixed) in one locked write, and `apply <work-unit> --file <ops.json>` batches set/delete ops across dotpaths in one atomic write. The engine `SKILL.md` is the authoritative API reference. Contract suite: `tests/scripts/test-engine-manifest.sh`.

**Project defaults cascade**: `project.defaults` → topic level. Project defaults are suggestions (user confirms or overrides). Topic level records the actual value in use. No phase-level storage for settings like `plan_format`, `project_skills`, or `linters`.

**Shell quoting**: Always single-quote values that zsh would interpret — `'[]'`, `'[...]'`, `'{}'`, `'~'`. Bare `[]` is a glob pattern (causes `no matches found` errors) and bare `~` expands to the home directory.

## Test Gates

- `npm test` — node suites (`node --test`): engine, gateway adapters, knowledge subsystem. `package.json` is the authoritative list.
- `npm run test:cli` — shell contract suites: manifest field surface, inbox promotion, knowledge CLI and build.
- `npm run test:migrations` — every `tests/scripts/test-migration-*.sh`.
- `npm run typecheck` — JSDoc type contracts (`tsc --noEmit`).

Add or update a test alongside any change to engine scripts, adapters, migrations, or `src/knowledge/`.

## Pipeline Simulation

`tests/scripts/test-pipeline-simulation.cjs` (under `npm test`) drives the engine CLI end-to-end through the call sequences the skill prose prescribes — every work type's mainline plus the supported edges (reopen, supersession, cancel/reactivate, pivot, absorption, promotion, restarts) — auditing the whole state after every mutation: schema-valid manifests, no shadow roots, every derivation computes, every navigation gateway discovers and formats, render surfaces hold. It is the detector for silent state corruption — writes that succeed and only break a menu phases later.

**Any change to the workflows must update the simulation** — a new engine verb, a changed prose call sequence, a new phase ordering, a new manifest field: extend an existing scenario, add a new permutation, or re-pin changed expectations. A red simulation is the design speaking — decide deliberately whether the flow or the scenario is wrong, never paper over it. New permutations are cheap: a scenario is an ordered list of engine calls with assertions.

## Knowledge Base Subsystem

Retrieval-augmented store of completed workflow artifacts (research, discussion, investigation, specification — never planning/implementation/review), plus epic discovery **session logs** (indexed under a `discovery` phase — the running exploration record) and seed material for early-phase context: user-shared `imports` and the inbox-promoted `seeds` (the work unit's origin). Every entry-point skill gates on knowledge base initialisation before any phase runs.

**Source vs bundle**: Source lives in `src/knowledge/` (multi-file Node.js — `index.js`, `store.js`, `chunker.js`, `embeddings.js`, `config.js`, `setup.js`, `setup-forms.js`, `providers/openai.js`, `providers/openai-engine.js`, `providers/openai-compatible.js`). Committed CLI at `skills/workflow-knowledge/scripts/knowledge.cjs` is a single-file esbuild bundle. AGNTC installs from git tags with no build step, so the bundle must be present and current at tag time.

**Building**: `npm run build` runs `node build/knowledge.build.js`, which esbuild-bundles `src/knowledge/index.js` into `skills/workflow-knowledge/scripts/knowledge.cjs`. Always rebuild after editing `src/knowledge/` and commit the bundle alongside the source change.

**Allowed tools**: Skills that invoke the CLI must declare `Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs)` in their frontmatter. SKILL.md is the authoritative API reference — read it before adding a new call site.

**Mandatory boot gate**: `engine boot` (Step 0 of `workflow-start`) runs `knowledge check` and, when ready, `knowledge compact` (progress-based decay). A `not-ready` response carries a `system_config` report (valid/absent/invalid + active provider/model, never secrets) and routes into `workflow-start`'s knowledge gate (`references/knowledge-gate.md`), which initialises the store conversationally via the non-interactive `knowledge setup` forms (`--from-system`, `--keyword-only`, `--provider ...`) — boot itself never initialises anything. API keys never transit chat or argv: they resolve from `$OPENAI_API_KEY` or `credentials.json`, written by the `--key-only` terminal detour or the interactive wizard (which remains human-only). When the store is ready, boot commits any store dirt scoped to `.workflows/.knowledge` — `chore(knowledge): initialise store` on the first boot after setup, `chore(knowledge): compact store` otherwise.

**Phase-completion indexing**: Processing skills invoke `knowledge index <path>` at phase completion to add the new artifact. Spec promotion and work-unit cancellation invoke `knowledge remove --work-unit ... [--phase ...] [--topic ...]` to clean up. Pending queue handles transient failures with retry on next `index` call.

**Stub mode**: When no embedding provider is configured, CLI runs in keyword-only mode (BM25). Treat as supported degraded mode, not broken state. `query` output prepends `[keyword-only mode — ...]` note.

**Tests**: `tests/scripts/test-knowledge-*.{cjs,sh}` cover the subsystem — store, chunker, embeddings, config, OpenAI provider, integration, retry, build, CLI surface. Node suites run under `npm test`, shell suites under `npm run test:cli`. Add a test alongside any `src/knowledge/` change.

**Project layout**: `.workflows/.knowledge/` (per-project store + metadata + config), `~/.config/workflows/config.json` (system defaults), `~/.config/workflows/credentials.json` (mode 0600, optional API key store).

## Skill Authoring

Skill authoring rules — prose economy, display/output conventions, structural conventions, skill file structure, navigation patterns, reference file naming — live in [CONVENTIONS.md](CONVENTIONS.md).

**MANDATORY**: Read [CONVENTIONS.md](CONVENTIONS.md) in full **before** creating or editing any file matching `skills/**/SKILL.md`, `skills/**/references/**/*.md`, or any new skill scaffold. Do not rely on memory or pattern-matching from sibling files — the conventions are dense, exact, and frequently updated. Skipping this step has produced silently non-compliant skills in the past.

Not needed for general project work (scripts, tests, engine internals, knowledge base, docs).
