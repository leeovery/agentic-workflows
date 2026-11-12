# Engine Library & Gateway

*Reference for **[leeway-engine](../SKILL.md)***

---

The require door: adapter scripts `require()` `scripts/lib.cjs` and call in-process. The data owner builds structures and calls the renderer — Claude never assembles render input.

## The library surface

```js
const engine = require('.../skills/leeway-engine/scripts/lib.cjs');

// kernel: pure layout
engine.render.signpost(label, { style, width })   // → string (one line)
engine.render.renderTree(nodes, { width })        // → string (recursive tree)
engine.render.wrapWithPrefix(text, { width, prefix }) // → string[] (prefixed lines)
engine.render.wrap(text, budget)                  // → string[] (segments ≤ budget)
engine.render.fillTo(head, fillChar, width)       // → string (padded)

// kernel: manifest IO (façade over kernel/manifest-io.cjs)
engine.manifest.loadWorkUnitManifest(cwd, wu)     // → parsed manifest (loud on missing/invalid)
engine.manifest.saveWorkUnitManifest(cwd, wu, m)  // atomic write (temp file + rename)
engine.manifest.withWorkUnitLock(cwd, wu, fn)     // → fn() under the state's writer lock, over the work unit's manifest (loud on a missing unit)
engine.manifest.readProjectManifest(cwd)          // → project manifest ({} when absent, loud on corrupt)
engine.manifest.writeProjectManifestAtomic(cwd, m)// atomic write
engine.manifest.withProjectLock(cwd, fn)          // → fn() under the state's writer lock, over the project manifest

// kernel: where the state lives
engine.state.stateRoot(cwd)                       // → `.leeway/` in the main checkout of the repository `cwd` is in — absolute, from any folder or worktree of it; loud where there is no repository

// domain: composition conventions
engine.conventions.title({ glyph, label, tag })   // → "◐ Menu And Admin [discussing]"
engine.conventions.tag('decided')                 // → "[decided]"
engine.conventions.derivedFrom('from exploration')// → "↳ From exploration"
engine.conventions.discoveryGlyph('discussing')   // → "◐"
engine.conventions.titlecase('auth-flow')         // → "Auth Flow"
engine.conventions.TREE_WIDTH                     // 65 — tree content width incl. gutter

// domain: generic reads (reads.cjs — no phase semantics)
engine.reads.listFiles(dir, ext)                  // → sorted filenames with ext ([] on missing dir)
engine.reads.listDirs(dir)                        // → sorted subdirectory names ([] on missing dir)
engine.reads.fileExists(p)                        // → boolean
engine.reads.loadManifest(cwd, wu)                // → parsed manifest, or null (quiet on missing)
engine.reads.filesChecksum(paths)                 // → md5 hex over the files' bytes, or null
engine.reads.loadActiveManifests(cwd)             // → in-progress work-unit manifests

// domain: shared derivations (derivations.cjs — phase joins, lifecycle, cache status)
engine.derivations.phaseData(manifest, phase)     // → phases.{phase} ({} when absent)
engine.derivations.phaseItems(manifest, phase)    // → [{name, …fields}] from phases.{phase}.items
engine.derivations.phaseStatus(manifest, phase)   // → aggregated item status, or null
engine.derivations.computeNextPhase(manifest)     // → { next_phase, phase_label }
engine.derivations.computeTopicLifecycle(manifest, topic) // → { lifecycle, tier, current_phase, discussion_state }
engine.derivations.computeMapSummary(items)       // → tier counts over map rows
engine.derivations.computeSourceProvenance(source) // → "from …" label, or null
engine.derivations.compareMapRows(a, b)           // map-row sort comparator (tier, order, name)
engine.derivations.computeNeedsSequencing(items)  // → true when a live row lacks an order

// domain: background-agent derivations
engine.agents.completedReviewCycles(cwd, wu, topic)   // → number — report-backed discussion review cycles (legacy files counted by existence; tolerant reads)
engine.agents.reviewArming(cwd, wu, topic)        // → { armed, cycles, moves_seen, moves_needed, reason } — discussion review-arming verdict (tolerant reads)

// domain: the product roadmap (roadmap.cjs — lifecycle by join, never stored)
engine.roadmap.roadmapState(cwd)                  // → { exists, horizons, items, archived, totals, session_logs } — each item's kind and its state from its join (waiting / in-flight / shipped / orphaned), the archived items apart, and the product's conversation's logs; a never-born roadmap reads exists:false, and one with a product session's log and no node exists:true

// domain: session presence
engine.presence.scanPresence(cwd, wu)             // → { work_unit, held, held_sources, sessions[] } — one work unit's heartbeats; a row's `age_seconds` is "last active", never a verdict
engine.presence.scanProject(cwd)                  // → the same row shape and `held` total but no `held_sources`, with `scope: "project"` in place of `work_unit` and `work_unit` per row
engine.presence.heldCodeSessions(cwd)             // → the held implementation/review rows working in the caller's checkout, minus the caller's own — the code gate's read
engine.presence.heldDocument(cwd, wu, doc)     // → the freshest held discussion/investigation row a peer holds on `doc`, or null — the spec-side held-doc gate's read
engine.presence.ownsRow(row)                      // → does the calling session own this heartbeat (its session id, or its pid)? Filter with it before marking any row as a peer's
engine.presence.fmtAge(seconds)                   // → a row's age as `40s` / `12m` / `3h` / `2d`

// domain: detail builders + projections
engine.detail.phaseTargets(cwd, manifest, nextPhase) // → { next, revisit } — where each single-topic route enters: next, the {phase, topic} of the next phase, topic naming the phase's item where its items carry names of their own (a promoted unit's moved discussions), null otherwise; revisit, the phases of the revisit candidates (completed phases before nextPhase, pipeline-filtered, never the experiment, a decided discussion or the spec, nor a phase entered at a topic once the unit is past its spec), each entered by the unit alone
engine.detail.WORK_UNIT_TYPES                     // { [type]: config } — single-topic pipeline configs
engine.project.actionsTable(columns, keys, cells) // → the DATA `ACTIONS` table's lines — each key's `key` and `word` (`—` for none), then `cells(key)` under `columns`
engine.project.discussionMap(topic, manifest)     // → Discussion Map display block
engine.project.revisitPhasesSection(phases)       // → labelled `MENU: revisit phases` section over phaseTargets' revisit candidates ('' when none)

// gateway: adapter harness
engine.gateway.runGateway(handlers)               // argv verb dispatch → stdout; the gate the result's MENU states recorded as the gate the conversation was shown
engine.gateway.dataBlock(obj | string)            // → demarcated DATA section
engine.gateway.displayBlock(text)                 // → demarcated DISPLAY section
engine.gateway.menuBlock(name, text)              // → demarcated `MENU: {name}` section stating the gate `name` — the gateway's own, from its table of gates — the GATE block directly ahead of it under LEEWAY_GATE_SURFACE=1 ('' for an empty menu — no gate, no section)
```

`wrapWithPrefix` throws if the prefix leaves no room within the width — a misconfigured gutter fails loudly rather than silently overflowing.

## Gateway contract

Each skill's adapter script registers handlers and calls `runGateway`:

```js
engine.gateway.runGateway({
  index: () => ...,          // no-args call — the head-of-skill `!` insert; never a gate
  view:  (wu) => ...,        // one snapshot: DATA + DISPLAY + MENU
  // skill-specific sub-views by verb; `fallback` catches unmatched argv
});
```

The .md's prescribed call names the verb (`gateway.cjs view {work_unit}`) — the adapter never infers what a call is for. A MENU in a response is a live gate at that call, so a verb returns one only where the prose shows that gate at that call: the head insert runs before any step shows anything and carries none, and a gate a later step shows is that step's own verb.
