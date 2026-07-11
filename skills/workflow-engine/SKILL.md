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

## CLI

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs <command> [args]
```

Domain commands (state transitions, queries) land here as they are built.

**`boot`** — the entry pipeline: runs `workflow-migrate/scripts/migrate.sh` (resolved relative to the engine, cwd = project root), then `knowledge check`, then `knowledge compact` when ready — one call in place of the sequential Step 0 commands. Response: `{"ok": true, "migrations": {"changed": false, "output": "<trimmed report>"}, "knowledge": "ready"|"not-ready", "compacted": false, "warnings": []}`. `migrations.changed` mirrors migrate.sh's own files-updated signal; `output` is the report with the prose stop-gate lines stripped (update counts kept). A failing migrate.sh is a hard error (`{ok:false}` on stderr, exit 1) — migrations must never half-run silently. A failing `check` reports `not-ready`; a failing `compact` lands in `warnings`, never blocks. The conversational pieces (migration summary, review gate, not-ready terminal stop) stay in the calling skill.

```bash
engine boot
```

**`discussion-map`** — Discussion Map subtopic writes. `add` and `set` each load the work unit's manifest, apply the transition, save atomically, and print one decision-ready JSON line: `{"ok": true, "subtopic": "…", "status": "…", "all_decided": false, "unresolved_count": N}` — no follow-up read needed, and no git commit (the calling session's commit cadence picks the manifest change up). Errors print `{"ok": false, "error": "…"}` to stderr and exit 1.

```bash
engine discussion-map add <work-unit> <topic> <subtopic> [--parent <subtopic>]   # new subtopic, starts pending
engine discussion-map set <work-unit> <topic> <subtopic> <state>                 # pending|exploring|converging|decided|deferred
```

Subtopic names are kebab-case slugs; `--parent` nests under an existing top-level subtopic (two levels max).

**`discovery-map`** — the Discovery Map's ordering. `sequence` records it as one transaction: validates every topic exists under `phases.discovery.items` and every order is a positive integer, sets each topic's `order`, and commits scoped to the work unit (`discovery({wu}): sequence topic map`); response `{"ok": true, "ordered": {"{topic}": N, …}, "committed": "<short-sha>"}` (`committed: null` plus a note when nothing was staged). Choosing the order is the caller's judgment — the command only records it. Errors print `{"ok": false, "error": "…"}` to stderr and exit 1.

```bash
engine discovery-map sequence <work-unit> <topic>=<order> [<topic>=<order> …]   # suggested execution order, scoped commit
```

**`topic`** — epic topic cancel / reactivate, each one transaction: manifest write (stash/restore `previous_status`, cancel also drops the topic's discovery-map `order`), knowledge-base sync (remove on cancel; re-index on reactivate when the restored status is `completed` in research/discussion/investigation/specification), and a commit scoped to `.workflows/{wu}` (`workflow({wu}): cancel {topic} ({phase})` / `… reactivate …`). The knowledge base is a derived index — its failures land in `warnings`, never block. Response: `{"ok": true, "topic": "…", "phase": "…", "status": "…", "committed": "<short-sha>", "warnings": []}` (`committed: null` plus a note when nothing was staged).

```bash
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

**`commit`** — the scoped commit helper: `git add -- .workflows/{wu}` (`.workflows/.inbox` with `--inbox`, or the whole `.workflows` tree with `--workflows` — migrations touch many work units plus `.workflows/.state`) plus commit. A clean tree is fine: `{"ok": true, "committed": null, "note": "nothing to commit"}`, exit 0.

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
engine.project.epicDashboard(wu, detail, { newArrivals }) // → dashboard display block
engine.project.epicKey(detail)                    // → Key block ('' for a brand-new epic)
engine.project.epicMenu(wu, detail)               // → { keys, rendered } — keys carry action + route
engine.project.discussionMap(topic, manifest)     // → Discussion Map display block
engine.project.startOverview(detail)              // → Workflow Overview display block
engine.project.startMenu(detail)                  // → { keys, rendered } — continue entries + start/lifecycle options
engine.project.workUnitStatus(type, unit)         // → status display block (box + pipeline tree)
engine.project.workUnitMenu(type, unit)           // → { keys, rendered } — proceed/revisit gate; '' rendered when nothing to revisit
engine.project.workUnitData(type, unit, menu)     // → DATA body (flow flags + ACTIONS key table)

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

`tests/scripts/test-render.cjs`, `tests/scripts/test-engine-gateway.cjs`, `tests/scripts/test-engine-epic-projections.cjs`, `tests/scripts/test-engine-start-projections.cjs`, `tests/scripts/test-engine-workunit-projections.cjs`, `tests/scripts/test-engine-discussion-map.cjs`, `tests/scripts/test-engine-discovery-map.cjs`, `tests/scripts/test-engine-tasks.cjs`, `tests/scripts/test-engine-transactions.cjs`, `tests/scripts/test-engine-cache.cjs`, and `tests/scripts/test-engine-boot.cjs` (run via `npm test`). Type contracts are enforced by `npm run typecheck` (JSDoc + `tsc --noEmit`). Add a test alongside any change to engine scripts.
