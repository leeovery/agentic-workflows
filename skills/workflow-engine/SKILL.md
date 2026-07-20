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

**`map`** — discussion-map transitions. Both commands load the work unit's manifest, apply the transition, save atomically, and print one decision-ready JSON line: `{"ok": true, "subtopic": "…", "status": "…", "all_decided": false, "unresolved_count": N}` — no follow-up read needed. Errors print `{"ok": false, "error": "…"}` to stderr and exit 1. No git commit — the calling session's commit cadence picks the manifest change up.

```bash
engine map add <work-unit> <topic> <subtopic> [--parent <subtopic>]   # new subtopic, starts pending
engine map set <work-unit> <topic> <subtopic> <state>                 # pending|exploring|converging|decided|deferred
```

Subtopic names are kebab-case slugs; `--parent` nests under an existing top-level subtopic (two levels max).

**`topic`** — epic topic cancel / reactivate, each one transaction: manifest write (stash/restore `previous_status`, cancel also drops the topic's discovery-map `order`), knowledge-base sync (remove on cancel; re-index on reactivate when the restored status is `completed` in research/discussion/investigation/specification), and a commit scoped to `.workflows/{wu}` (`workflow({wu}): cancel {topic} ({phase})` / `… reactivate …`). The knowledge base is a derived index — its failures land in `warnings`, never block. Response: `{"ok": true, "topic": "…", "phase": "…", "status": "…", "committed": "<short-sha>", "warnings": []}` (`committed: null` plus a note when nothing was staged).

```bash
engine topic cancel <work-unit> <phase> <topic>
engine topic reactivate <work-unit> <phase> <topic>
```

**`inbox`** — archive / restore / delete one or more inbox items as a single transaction. Paths are validated strictly against the inbox layout (`.workflows/.inbox/{ideas|bugs|quickfixes}/…`, archived items under `.inbox/.archived/…`) before anything moves; one commit covers the whole set (`workflow(inbox): archive {slug}` for one item, `… archive {N} items` for several — same forms for restore/delete). Response: `{"ok": true, "archived": [paths…], "committed": "<short-sha>"}` (key matches the verb: `archived` / `restored` / `deleted`).

```bash
engine inbox archive <path> [<path> …]   # live → .archived/{folder}/
engine inbox restore <path> [<path> …]   # .archived/{folder}/ → live
engine inbox delete <path> [<path> …]    # git rm archived items
```

**`commit`** — the scoped commit helper: `git add -- .workflows/{wu}` (or `.workflows/.inbox` with `--inbox`) plus commit. A clean tree is fine: `{"ok": true, "committed": null, "note": "nothing to commit"}`, exit 0.

```bash
engine commit <work-unit> -m "<message>"
engine commit --inbox -m "<message>"
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
engine.map.addSubtopic(manifest, topic, name, { parent }) // mutates; new subtopic starts pending
engine.map.setSubtopicState(manifest, topic, name, state) // mutates; enum is the only constraint
engine.map.mapState(manifest, topic)              // → { counts, total, all_decided, unresolved }

// domain: detail builders + projections
engine.detail.epicDetail(cwd, manifest)           // → EpicDetail (the one structured object per epic)
engine.detail.startDetail(cwd)                    // → StartDetail (all work units by type + inbox + closed counts)
engine.project.epicDashboard(wu, detail, { newArrivals }) // → dashboard display block
engine.project.epicKey(detail)                    // → Key block ('' for a brand-new epic)
engine.project.epicMenu(wu, detail)               // → { keys, rendered } — keys carry action + route
engine.project.discussionMap(topic, manifest)     // → Discussion Map display block
engine.project.startOverview(detail)              // → Workflow Overview display block
engine.project.startMenu(detail)                  // → { keys, rendered } — continue entries + start/lifecycle options

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

`tests/scripts/test-render.cjs`, `tests/scripts/test-engine-gateway.cjs`, `tests/scripts/test-engine-epic-projections.cjs`, `tests/scripts/test-engine-start-projections.cjs`, `tests/scripts/test-engine-map.cjs`, and `tests/scripts/test-engine-transactions.cjs` (run via `npm test`). Type contracts are enforced by `npm run typecheck` (JSDoc + `tsc --noEmit`). Add a test alongside any change to engine scripts.
