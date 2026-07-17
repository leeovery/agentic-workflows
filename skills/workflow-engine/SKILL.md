---
name: workflow-engine
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-engine/scripts/engine.cjs)
---

# Workflow Engine

The shared engine behind the workflow skills: deterministic state, derivation, and rendering. Anything fully determined by data is computed here, in code, and consumed by Claude — never re-derived in prose.

Internally layered as rings:

- **Kernel** (`scripts/kernel/`) — mechanism with no workflow vocabulary: render primitives, the wrap/width core. The wrap budget (`width − prefix`) lives here once, so gutter-overflow bugs can exist in only one place.
- **Domain** (`scripts/domain/`) — the workflow ontology: glyph vocabulary, `[tag]` and `↳` composition conventions. Grows queries, projections, and transitions as call sites migrate.
- **Gateway harness** (`scripts/gateway.cjs`) — the uniform verb dispatch every skill's adapter script uses, plus the demarcated output sections.

Two ways in:

- **Library** — scripts `require()` `scripts/lib.cjs` and call functions in-process. The data owner builds structures and calls the renderer; Claude never assembles render input.
- **CLI** — `scripts/engine.cjs`, called from skill .md files at prescribed points.

Output sections are one-directional: DATA is for reasoning and is never displayed; DISPLAY and MENU are emitted to the user verbatim and never parsed for decisions.

## Command grammar

Every command follows six rules — new commands must too:

1. **Identity is positional, in containment order**: `{work-unit}`, then `{topic}`, then `{item}`.
2. **Required values with closed vocabularies are positional enums** (`discussion-map set … {state}`, `cache stamp {wu} research-analysis|gap-analysis`, `workunit create {wu} {work-type}`).
3. **Payloads are always named flags, even when required** (`-m {message}`, `--findings-file {path}`).
4. **Optional modifiers and alternate addressing are flags** (`--skipped`, `--parent`, `--external {id}`).
5. **Mappings are `key=value` pairs** (`discovery-map sequence {wu} {topic}={order} …`).
6. **A reserved word sharing a slot with user-named values must be a flag** — why `commit --inbox`/`--workflows` are flags beside positional `commit {work-unit}`.

Responses: one decision-ready JSON line — `{"ok": true, …}` carrying the derived state the calling flow needs next (no follow-up read); failures are `{"ok": false, "error": …}` on stderr with exit 1; recoverable side-effect failures ride in `warnings` (warn-don't-block).

## CLI

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs <command> [args]
```

Domain commands (state transitions, queries) land here as they are built.

**`boot`** — the entry pipeline: runs `workflow-migrate/scripts/migrate.sh` (resolved relative to the engine, cwd = project root), then `knowledge check`, then `knowledge compact` when ready — one call in place of the sequential Step 0 commands. Response: `{"ok": true, "migrations": {"changed": false, "output": "<trimmed report>"}, "knowledge": "ready"|"initialised-keyword-only"|"not-ready", "compacted": false, "kb_committed": null, "warnings": []}`. `migrations.changed` mirrors migrate.sh's own files-updated signal; `output` is the report with the prose stop-gate lines stripped (update counts kept). A failing migrate.sh is a hard error (`{ok:false}` on stderr, exit 1) — migrations must never half-run silently. A not-ready `check` triggers `knowledge init --keyword-only` (no human input needed): success reports `initialised-keyword-only` plus a `note` line the calling skill surfaces; only a failing init still reports `not-ready` (detail in `warnings`). A failing `compact` lands in `warnings`, never blocks. Knowledge-store dirt boot found or created is committed scoped to `.workflows/.knowledge` (`chore(knowledge): initialise store` after an init, `chore(knowledge): compact store` otherwise; sha in `kb_committed`, commit failure a warning). The conversational pieces (migration summary, review gate, not-ready terminal stop) stay in the calling skill.

```bash
engine boot
```

**`workunit`** — work-unit lifecycle. `create` is the work-type commit — discovery's durability boundary as one transaction. It creates the manifest exactly as `manifest.cjs init` writes it (same document, same project-manifest registration; an existing manifest is reused as-is, `created: false`), copies each `--import` into `imports/`, moves each `--seed` — a live inbox path, its folder deriving the `inbox:{idea|bug|quickfix}` source tag — into `seeds/`, installs the `--session-log-file` content verbatim as `discovery/sessions/session-001.md` (the content is model-authored — the engine never writes prose), sets `phases.discovery.active_session = "001"` for an epic, and commits scoped to the work unit plus `.workflows/.inbox` when seeds moved out of it (`discovery({wu}): create work unit ({work_type})` — engine-owned message). Landing filenames are normalised (lowercase; whitespace/punctuation runs → `-`; repeats collapsed; `.md` forced; imports normalising to dotfiles are skipped and reported in `skipped_imports`, seeds fall back to `seed.md`) and collisions are suffixed `-2`, `-3` against both the destination directory and the batch; every landing gets an `imports[]`/`seeds[]` manifest entry with a fresh ISO-8601 UTC timestamp and a knowledge-base index (warn-don't-block). Validation completes before any mutation — a missing import fails the whole call with `{"ok": false, "error": …, "missing_imports": […]}` so the calling flow can re-prompt and re-run against untouched state. Response: `{"ok": true, "work_unit": …, "work_type": …, "created": bool, "imports": [{"path": …}…], "seeds": [{"path": …, "source": …}…], "skipped_imports": […], "session_log": …, "committed": "<short-sha>", "warnings": []}`.

`complete`, `cancel`, and `reactivate` are the lifecycle transactions, each one transaction: manifest write, knowledge-base sync (warn-don't-block), scoped commit (`.workflows/{wu}`). `complete` sets `status: completed` and stamps `completed_at` (today, UTC — same form as `created`); its commit message rides on `-m` because it varies by caller (manual completion vs pipeline-terminal vs review-skipped — the engine can't derive how completion happened). No knowledge-base action — completed units retain their chunks. `cancel` sets `status: cancelled` and removes the unit's chunks (`knowledge remove --work-unit`); commit message engine-owned: `workflow({wu}): mark as cancelled`. `reactivate` restores `status: in-progress` from completed **or** cancelled, clears a stale `completed_at`, and — only from cancelled, whose removal emptied the index — re-indexes what cancellation removed (every completed artifact in an indexed phase, shape-valid `imports/` and `seeds/` entries, on-disk analysis caches, and — epics — the on-disk `discovery/sessions/session-*.md` logs); commit message engine-owned: `workflow({wu}): reactivate work unit`. Illegal transitions refuse loudly: complete/cancel refuse an already-completed/cancelled unit respectively and route the opposite closed state through reactivate; reactivate refuses an in-progress unit. Statuses are validated against the shared schema's work-unit vocabulary — the engine is never the permissive path. Responses: `{"ok": true, "work_unit": …, "status": …, "committed": "<short-sha>", "warnings": []}` plus `completed_at` (complete) or `previous_status` (reactivate); `committed: null` plus a note when nothing was staged.

`pivot` converts an in-progress feature to an epic as one transaction: flips `work_type: epic` in the work-unit manifest **and** the project manifest's registration (upserted when a legacy unit predates registration), registers the feature's single topic (topic name = work unit name) on the discovery map with backfill semantics (`routing` = `research` when the research phase exists, else `discussion`; summary/description left for the next epic entry's summary-backfill), re-indexes the whole unit via the same walk reactivate uses — chunk metadata carries `work_type`, which is why pivot re-indexes — and commits both manifests (`workflow({wu}): pivot to epic`, engine-owned). Refuses a non-feature, a unit that isn't in-progress, and a topic already on (or dismissed from) the map — all before anything is touched. Response: `{"ok": true, "work_unit": …, "work_type": "epic", "routing": …, "committed": "<short-sha>", "warnings": []}`.

`absorb` merges a feature into an in-progress epic as a new topic, then deletes the feature — one transaction owning the mechanical tail; the judgment (choosing the feature, the epic, and the topic name with the user) stays in the calling prose, and the verb takes the decided inputs. Validation completes before any mutation — feature exists and is a feature with a discussion (item **and** file) and no specification-or-beyond phases; epic exists, is an epic, is in-progress; the topic name is dot/slash-free and free in the epic (map item, dismissed list, discussion item, discussion file) — so a refusal leaves both work units byte-identical: no crash window between the feature's deletion and the commit. It moves the discussion to `discussion/{topic}.md`, research files (topic collisions suffix `-{feature}`, then numbered), and imports/seeds (filename collisions suffix `-2`, `-3` — create's dedupe — with manifest entries carrying their **original** timestamps and seed provenance); mirrors each phase item's status onto the epic; registers the map item with backfill semantics (`routing` = `research` when the feature did research); removes the feature's knowledge-base chunks and indexes the moved artifacts at their epic identities (completed phase artifacts; imports and seeds always — warn-don't-block); deletes the feature directory and its project-manifest registration; and lands ONE commit staging `.workflows/{feature}`, `.workflows/{epic}`, and `.workflows/manifest.json` (`workflow({feature}): absorb into {epic}`, engine-owned). Response: `{"ok": true, "feature": …, "epic": …, "topic": …, "discussion": {"path": …, "status": …}, "research": […], "imports": […], "seeds": […], "routing": …, "committed": "<short-sha>", "warnings": []}`.

```bash
engine workunit create <work-unit> <work-type> --description <text> --session-log-file <path> [--import <path> …] [--seed <path> …]
engine workunit complete <work-unit> -m "<message>"
engine workunit cancel <work-unit>
engine workunit reactivate <work-unit>
engine workunit pivot <work-unit>
engine workunit absorb <feature> --into <epic> --topic <name>
```

**`discussion-map`** — Discussion Map subtopic writes. `add` and `set` each load the work unit's manifest, apply the transition, save atomically, and print one decision-ready JSON line: `{"ok": true, "subtopic": "…", "status": "…", "all_decided": false, "unresolved_count": N}` — no follow-up read needed, and no git commit (the calling session's commit cadence picks the manifest change up). Errors print `{"ok": false, "error": "…"}` to stderr and exit 1.

```bash
engine discussion-map add <work-unit> <topic> <subtopic> [--parent <subtopic>]   # new subtopic, starts pending
engine discussion-map set <work-unit> <topic> <subtopic> <state>                 # pending|exploring|converging|decided|deferred
```

Subtopic names are kebab-case slugs; `--parent` nests under an existing top-level subtopic (two levels max).

**`discovery-map`** — the Discovery Map's writes. `sequence` records the suggested execution order as one transaction: validates every topic exists under `phases.discovery.items` and every order is a positive integer, sets each topic's `order`, and commits scoped to the work unit (`discovery({wu}): sequence topic map`); response `{"ok": true, "ordered": {"{topic}": N, …}, "committed": "<short-sha>"}` (`committed: null` plus a note when nothing was staged). Choosing the order is the caller's judgment — the command only records it.

The per-item map operations write the manifest with no git commit (the calling session's commit cadence picks the change up) and enforce the map's lifecycle gates in the engine, deriving each item's lifecycle with the same join the epic detail builder uses. `add` creates a map item as `{routing, source, summary[, description]}` — never a `status` field (map-item lifecycle is computed at render time, not stored); `--source` defaults to `discovery`, the name follows rename's dot/slash-free rule, an active duplicate is refused, and a dismissed name is refused unless `--force-dismissed` carries the user's confirmed re-add decision (the entry is then pulled off the dismissed list); the response carries `map_total` so the calling flow needs no follow-up read. `--backfill` (mutually exclusive with `--summary`/`--description`) lands the item without either field — keys absent, not `""` — so the next epic entry's summary-backfill drafts them from the topic's artifacts; for topics arriving with work already done (absorb, pivot). `edit` sets `summary` and/or `description` — at least one flag, any lifecycle. `remove` hard-deletes a **fresh** item and pushes its name onto `phases.discovery.dismissed`. `rename` moves a **fresh** item to a new key preserving every field and its map position; the new name must not collide with an active item (a dismissed-list match is allowed — the entry is left alone) and must be dot/slash-free. `reroute` sets a **fresh** item's `routing`. `handle` sets `handled: true` (any lifecycle except handled/cancelled); `reactivate` clears the marker (handled only). Gate refusals name the blocking lifecycle and the recovery path (e.g. `"X" can't be removed — research is in flight on it; cancel from the epic menu instead`). Responses: `{"ok": true, "work_unit": …, "name": …, "op": …, "lifecycle": …}` plus op-specific fields — add and edit echo the values written (add also `undismissed` when forced past a dismissed match), remove carries `dismissed: true`, rename carries `renamed_from`/`preserved_fields`/`matches_dismissed`, reroute `routing`, handle/reactivate `handled`. Errors print `{"ok": false, "error": "…"}` to stderr and exit 1.

```bash
engine discovery-map sequence <work-unit> <topic>=<order> [<topic>=<order> …]   # suggested execution order, scoped commit
engine discovery-map add <work-unit> <name> --routing <research|discussion> (--summary <text> [--description <text>] | --backfill) [--source <tag>] [--force-dismissed]
engine discovery-map edit <work-unit> <name> [--summary <text>] [--description <text>]
engine discovery-map remove <work-unit> <name>       # fresh only; name lands on the dismissed list
engine discovery-map rename <work-unit> <old> <new>  # fresh only; every field preserved
engine discovery-map reroute <work-unit> <name> <research|discussion>   # fresh only
engine discovery-map handle <work-unit> <name>       # any lifecycle except handled/cancelled
engine discovery-map reactivate <work-unit> <name>   # handled only
```

**`topic`** — phase-item transitions. `start`, `complete`, and `supersede` are lifecycle bookkeeping with no git commit — the calling flow's commit cadence picks the manifest change up. `start` creates the phase item with `status: in-progress` when absent (init-phase semantics: `phases.{phase}.items.{topic}`, status only) or sets an existing item back to `in-progress`; a completed item errors — resuming is not starting — and a cancelled item must go through `reactivate`. Response: `{"ok": true, "phase": "…", "topic": "…", "status": "in-progress", "created": bool}`. `complete` sets `status: completed` on an existing item and, when the phase is research/discussion/investigation/specification, indexes the phase artifact into the knowledge base. Response: `{"ok": true, "phase": "…", "topic": "…", "status": "completed", "warnings": []}`. `supersede` sets `status: superseded` and `superseded_by: {topic}` (always the absorbing **topic** name) and removes the item's chunks from the knowledge base — legal only in phases whose shared-schema status vocabulary contains `superseded` (schema-driven, no hardcoded list). The `--by` topic must already exist in the same phase; a proposed item is refused (no artifact — reconcile deletes it instead), an already-superseded item is refused, and a cancelled item must go through `reactivate`. No commit — supersession is batch-oriented; the calling flow supersedes the set, then commits once. Response: `{"ok": true, "phase": "…", "topic": "…", "status": "superseded", "superseded_by": "…", "warnings": []}`.

`cancel` and `reactivate` are the epic transactions, each one transaction: manifest write (stash/restore `previous_status`, cancel also drops the topic's discovery-map `order`), knowledge-base sync (remove on cancel; re-index on reactivate when the restored status is `completed` in an indexed phase), and a commit scoped to `.workflows/{wu}` (`workflow({wu}): cancel {topic} ({phase})` / `… reactivate …`). Response: `{"ok": true, "topic": "…", "phase": "…", "status": "…", "committed": "<short-sha>", "warnings": []}` (`committed: null` plus a note when nothing was staged).

Across all five, the knowledge base is a derived index — its failures land in `warnings`, never block.

```bash
engine topic start <work-unit> <phase> <topic>
engine topic complete <work-unit> <phase> <topic>
engine topic supersede <work-unit> <phase> <topic> --by <topic>
engine topic cancel <work-unit> <phase> <topic>
engine topic reactivate <work-unit> <phase> <topic>
```

**`task`** — implementation-task bookkeeping: format-blind, manifest-side only. The engine never reads or writes a task backend and knows no plan-format names — the session does the plan surgery, these commands record it against `phases.implementation.items.{topic}`. Each command is load → apply → save plus one decision-ready JSON line; no git commit (the session's per-task commit cadence picks the manifest change up).

```bash
engine task init <work-unit> <topic>                       # create-or-resume the implementation item
engine task start <work-unit> <topic> <internal-id>        # reset fix_attempts, drop the task's fix-tracking cache file
engine task fix-attempt <work-unit> <topic> <internal-id> --findings-file <path>
engine task complete <work-unit> <topic> (<internal-id> | --external <id>) [--skipped] [--next-task <id|~>] [--phase <N>] [--phase-complete]
engine task analysis-cycle <work-unit> <topic>             # increment both analysis counters
```

`init` creates the item with `status: in-progress`, gated gate modes, zeroed counters, empty `linters`/`project_skills`, `current_phase: 1`, `current_task: null` — or, when it already exists, performs a session-only reset (three gate modes → `gated`, `fix_attempts`/`analysis_cycle_session` → 0; `analysis_cycle_total`, arrays, and progress fields untouched). Response: `{"ok": true, "mode": "created"|"resumed", "gates": {…}, "counters": {…}}`. `fix-attempt` increments `fix_attempts` and appends the findings file's content verbatim under a `## Attempt {N}` section in `.workflows/.cache/{wu}/implementation/{topic}/fix-tracking-{internal-id}.md`; response carries `attempts`, `threshold_reached` (≥ 3), and `fix_gate_mode`. `complete` pushes the internal id to `completed_tasks` (skips included — the plan carries the skip distinction), resolves `--external` by mirroring manifest `key-of` over `{wu}.planning.{topic}.task_map`, sets `current_phase`/`current_task` (`~` = null) when flagged, and pushes to `completed_phases` on `--phase-complete` (`--phase`, or the phase embedded in the internal id). `analysis-cycle` responds with `cycle_total`, `cycle_session`, `over_session_limit` (> 3), and `analysis_gate_mode`.

**`inbox`** — archive / restore / delete one or more inbox items as a single transaction. Paths are validated strictly against the inbox layout (`.workflows/.inbox/{ideas|bugs|quickfixes}/…`, archived items under `.inbox/.archived/…`) before anything moves; one commit covers the whole set (`workflow(inbox): archive {slug}` for one item, `… archive {N} items` for several — same forms for restore/delete). Response: `{"ok": true, "archived": [paths…], "committed": "<short-sha>"}` (key matches the verb: `archived` / `restored` / `deleted`).

```bash
engine inbox archive <path> [<path> …]   # live → .archived/{folder}/
engine inbox restore <path> [<path> …]   # .archived/{folder}/ → live
engine inbox delete <path> [<path> …]    # git rm archived items
```

**`cache`** — analysis-cache stamping: record that an analysis ran over the current completed inputs. Collects and checksums the input files exactly as the read side (`computeAnalysisCacheStatus` in workflow-shared/discovery-utils) does — a fresh stamp is `valid` by construction. Writes `checksum`, `generated` (current ISO timestamp), and the input file names to the kind's manifest home: `phases.research.analysis_cache` (`files`) for `research-analysis`, `phases.discovery.gap_analysis_cache` (`input_files`) for `gap-analysis`. Errors when no qualifying inputs exist — the analyses' preconditions skip the stamp in that case. Response: `{"ok": true, "kind": "…", "checksum": "…", "files": N}`. No git commit — the calling flow's commit cadence picks the manifest change up.

```bash
engine cache stamp <work-unit> (research-analysis|gap-analysis)
```

**`commit`** — the scoped commit helper: `git add -- .workflows/{wu}` (`.workflows/.inbox` with `--inbox`, or the whole `.workflows` tree with `--workflows` — migrations touch many work units plus `.workflows/.state`) plus commit. Every engine-made commit — this helper and every transaction — also stages `.workflows/.knowledge` when it exists (exists-guarded, `domain/commit.cjs`): transactions dirty the store as a side effect of their knowledge sync, and that dirt belongs with the write that produced it. A clean tree is fine: `{"ok": true, "committed": null, "note": "nothing to commit"}`, exit 0.

```bash
engine commit <work-unit> -m "<message>"
engine commit --inbox -m "<message>"
engine commit --workflows -m "<message>"
```

**Rendering is not a runtime CLI concern.** Static chrome (signposts, boxes, gate rules) lives as literal blocks in skill prose; parameterised chrome is rendered in-process by projections. No skill flow calls a render command at runtime — the `render` command group in `engine.cjs` is a development/debugging utility only (e.g. generating a correct literal while authoring prose).

## Library — `scripts/lib.cjs`

```js
const engine = require('.../skills/workflow-engine/scripts/lib.cjs');

// kernel: pure layout
engine.render.signpost(label, { style, width })   // → string (one line)
engine.render.box(title, { width })               // → string (block)
engine.render.renderTree(nodes, { width })        // → string (recursive tree)
engine.render.wrapWithPrefix(text, { width, prefix }) // → string[] (prefixed lines)
engine.render.wrap(text, budget)                  // → string[] (segments ≤ budget)
engine.render.fillTo(head, fillChar, width)       // → string (padded)

// kernel: manifest IO
engine.manifest.loadWorkUnitManifest(cwd, wu)     // → parsed manifest (loud on missing/invalid)
engine.manifest.saveWorkUnitManifest(cwd, wu, m)  // atomic write (temp file + rename)

// domain: composition conventions
engine.conventions.title({ glyph, label, tag })   // → "◐ Menu And Admin [researching]"
engine.conventions.tag('decided')                 // → "[decided]"
engine.conventions.derivedFrom('from exploration')// → "↳ From exploration"
engine.conventions.discoveryGlyph('researching')  // → "◐"
engine.conventions.titlecase('auth-flow')         // → "Auth Flow"
engine.conventions.TREE_WIDTH                     // 65 — tree content width incl. gutter

// domain: discussion-map transitions + queries
engine.discussionMap.addSubtopic(manifest, topic, name, { parent }) // mutates; new subtopic starts pending
engine.discussionMap.setSubtopicState(manifest, topic, name, state) // mutates; enum is the only constraint
engine.discussionMap.mapState(manifest, topic)    // → { counts, total, all_decided, unresolved }

// domain: detail builders + projections
engine.detail.epicDetail(cwd, manifest)           // → EpicDetail (the one structured object per epic)
engine.detail.startDetail(cwd)                    // → StartDetail (all work units by type + inbox + closed counts)
engine.detail.workUnitDetail(cwd, type)           // → WorkUnitDetail (single-topic types: feature | bugfix | quick-fix | cross-cutting)
engine.detail.workUnitIndex(type, detail)         // → labelled dump for the head-of-skill insert (byte-stable legacy format)
engine.detail.specificationDetail(wu, result, { consultHints }) // → SpecificationDetail (entry scenario + grouping rows over one discover() result)
engine.project.epicDashboard(wu, detail, { newArrivals }) // → dashboard display block
engine.project.epicKey(detail)                    // → Key block ('' for a brand-new epic)
engine.project.epicMenu(wu, detail)               // → { keys, rendered } — keys carry action + route
engine.project.discoveryMapView(wu, map)          // → Discovery Map display block (box + tier header + rows)
engine.project.discoverySynthesisView(wu, map, proposed) // → harvest proposal block (proposed set over the existing map)
engine.project.discussionMap(topic, manifest)     // → Discussion Map display block
engine.project.startOverview(detail)              // → Workflow Overview display block
engine.project.startMenu(detail)                  // → { keys, rendered } — continue entries + start/lifecycle options
engine.project.workUnitStatus(type, unit)         // → status display block (box + pipeline tree)
engine.project.workUnitMenu(type, unit)           // → { keys, rendered } — proceed/revisit gate; '' rendered when nothing to revisit
engine.project.workUnitData(type, unit, menu)     // → DATA body (flow flags + ACTIONS key table)
engine.project.specificationDisplay(detail)       // → scenario overview block ('' when the scenario renders nothing)
engine.project.specificationMenu(detail)          // → { keys, rendered } — grouping/spec menu; both empty for menu-less scenarios
engine.project.specificationCompletedMenu(detail) // → { keys, display, rendered } — concluded-specs Refine sub-view

// gateway: adapter harness
engine.gateway.runGateway(handlers)               // argv verb dispatch → stdout
engine.gateway.dataBlock(obj | string)            // → demarcated DATA section
engine.gateway.displayBlock(text)                 // → demarcated DISPLAY section
engine.gateway.menuBlock(text)                    // → demarcated MENU section
```

`wrapWithPrefix` throws if the prefix leaves no room within the width — a misconfigured gutter fails loudly rather than silently overflowing.

## Gateway contract

Each skill's adapter script registers handlers and calls `runGateway`:

```js
engine.gateway.runGateway({
  index: () => ...,          // no-args call — the head-of-skill `!` insert
  data:  (wu) => ...,        // reasoning-only flags for housekeeping steps
  view:  (wu) => ...,        // one snapshot: DATA + DISPLAY + MENU
  // skill-specific sub-views by verb; `fallback` catches unmatched argv
});
```

The .md's prescribed call names the verb (`discovery.cjs view {work_unit}`) — the adapter never infers what a call is for.

## Tests

`tests/scripts/test-render.cjs`, `tests/scripts/test-engine-gateway.cjs`, `tests/scripts/test-engine-epic-projections.cjs`, `tests/scripts/test-engine-start-projections.cjs`, `tests/scripts/test-engine-workunit-projections.cjs`, `tests/scripts/test-engine-specification-projections.cjs`, `tests/scripts/test-engine-discovery-projections.cjs`, `tests/scripts/test-engine-discussion-map.cjs`, `tests/scripts/test-engine-discovery-map.cjs`, `tests/scripts/test-engine-tasks.cjs`, `tests/scripts/test-engine-transactions.cjs`, `tests/scripts/test-engine-workunit-create.cjs`, `tests/scripts/test-engine-workunit-pivot.cjs`, `tests/scripts/test-engine-workunit-absorb.cjs`, `tests/scripts/test-engine-cache.cjs`, and `tests/scripts/test-engine-boot.cjs` (run via `npm test`). Type contracts are enforced by `npm run typecheck` (JSDoc + `tsc --noEmit`). Add a test alongside any change to engine scripts.
