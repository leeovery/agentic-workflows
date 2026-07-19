# Engine Library & Gateway

*Reference for **[workflow-engine](../SKILL.md)***

---

The require door: adapter scripts `require()` `scripts/lib.cjs` and call in-process. The data owner builds structures and calls the renderer — Claude never assembles render input.

## The library surface

```js
const engine = require('.../skills/workflow-engine/scripts/lib.cjs');

// kernel: pure layout
engine.render.signpost(label, { style, width })   // → string (one line)
engine.render.box(title, { width })               // → string (block)
engine.render.renderTree(nodes, { width })        // → string (recursive tree)
engine.render.wrapWithPrefix(text, { width, prefix }) // → string[] (prefixed lines)
engine.render.wrap(text, budget)                  // → string[] (segments ≤ budget)
engine.render.fillTo(head, fillChar, width)       // → string (padded)

// kernel: manifest IO (façade over kernel/manifest-io.cjs)
engine.manifest.loadWorkUnitManifest(cwd, wu)     // → parsed manifest (loud on missing/invalid)
engine.manifest.saveWorkUnitManifest(cwd, wu, m)  // atomic write (temp file + rename)
engine.manifest.withWorkUnitLock(cwd, wu, fn)     // → fn() under the work unit's manifest lock
engine.manifest.readProjectManifest(cwd)          // → project manifest ({} when absent, loud on corrupt)
engine.manifest.writeProjectManifestAtomic(cwd, m)// atomic write
engine.manifest.withProjectLock(cwd, fn)          // → fn() under the project manifest lock

// domain: composition conventions
engine.conventions.title({ glyph, label, tag })   // → "◐ Menu And Admin [researching]"
engine.conventions.tag('decided')                 // → "[decided]"
engine.conventions.derivedFrom('from exploration')// → "↳ From exploration"
engine.conventions.discoveryGlyph('researching')  // → "◐"
engine.conventions.titlecase('auth-flow')         // → "Auth Flow"
engine.conventions.TREE_WIDTH                     // 65 — tree content width incl. gutter

// domain: generic reads (reads.cjs — no phase semantics)
engine.reads.listFiles(dir, ext)                  // → sorted filenames with ext ([] on missing dir)
engine.reads.listDirs(dir)                        // → sorted subdirectory names ([] on missing dir)
engine.reads.fileExists(p)                        // → boolean
engine.reads.loadManifest(cwd, wu)                // → parsed manifest, or null (quiet on missing)
engine.reads.filesChecksum(paths)                 // → md5 hex over the files' bytes, or null
engine.reads.loadActiveManifests(cwd)             // → in-progress work-unit manifests
engine.reads.loadAllManifests(cwd)                // → every readable work-unit manifest

// domain: shared derivations (derivations.cjs — phase joins, lifecycle, cache status)
engine.derivations.phaseData(manifest, phase)     // → phases.{phase} ({} when absent)
engine.derivations.phaseItems(manifest, phase)    // → [{name, …fields}] from phases.{phase}.items
engine.derivations.phaseStatus(manifest, phase)   // → aggregated item status, or null
engine.derivations.computeNextPhase(manifest)     // → { next_phase, phase_label }
engine.derivations.computeAnalysisCacheStatus(manifest, workflowsDir, kind) // → { status, generated, files[, reason] }
engine.derivations.computeTopicLifecycle(manifest, topic) // → { lifecycle, tier, current_phase }
engine.derivations.computeMapSummary(items)       // → tier counts over map rows
engine.derivations.computeSourceProvenance(source) // → "from …" label, or null
engine.derivations.compareMapRows(a, b)           // map-row sort comparator (tier, order, name)
engine.derivations.computeNeedsSequencing(items)  // → true when a live row lacks an order

// domain: discussion-map transitions + queries
engine.discussionMap.addSubtopic(manifest, topic, name, { parent }) // mutates; new subtopic starts pending
engine.discussionMap.setSubtopicState(manifest, topic, name, state) // mutates; enum is the only constraint
engine.discussionMap.mapState(manifest, topic)    // → { counts, total, all_decided, unresolved }

// domain: detail builders + projections
engine.detail.epicDetail(cwd, manifest)           // → EpicDetail (the one structured object per epic)
engine.detail.startDetail(cwd)                    // → StartDetail (all work units by type + inbox + closed counts)
engine.detail.combinedInbox(scan, { archived })   // → PickupItem[] (one inbox scan combined, date-ordered, numbered)
engine.detail.workingSetDetail(cwd, paths)        // → WorkingSetDetail (held selection: uniformity, pre-seed type, addable items)
engine.detail.manageDetail(cwd, wu)               // → ManageDetail (lifecycle-action availability), or null
engine.detail.workUnitDetail(cwd, type)           // → WorkUnitDetail (single-topic types: feature | bugfix | quick-fix | cross-cutting)
engine.detail.workUnitIndex(type, detail)         // → labelled dump for the head-of-skill insert (thin DATA index)
engine.detail.specificationDetail(wu, result, { consultHints }) // → SpecificationDetail (entry scenario + grouping rows over one discover() result)
engine.project.epicDashboard(wu, detail, { newArrivals }) // → dashboard display block
engine.project.epicKey(detail)                    // → Key block ('' for a brand-new epic)
engine.project.epicMenu(wu, detail)               // → { keys, rendered } — keys carry action + route
engine.project.discoveryMapView(wu, map)          // → Discovery Map display block (box + tier header + rows)
engine.project.discoverySynthesisView(wu, map, proposed) // → harvest proposal block (proposed set over the existing map)
engine.project.discussionMap(topic, manifest)     // → Discussion Map display block
engine.project.startOverview(detail)              // → Workflow Overview display block
engine.project.startMenu(detail)                  // → { keys, rendered } — continue entries + start/lifecycle options
engine.project.emptyOverview(detail)              // → empty-state overview block
engine.project.emptyMenu(detail)                  // → { keys, rendered } — empty-state start menu
engine.project.inboxPickupView(items, hasArchived)// → { data, display, menu } — inbox pickup snapshot bodies
engine.project.archivedView(items)                // → { data, display, menu } — archived store snapshot bodies
engine.project.workingSetView(ws)                 // → { data, menu, sections } — set menu + deferred add/drop gates
engine.project.manageListView(detail)             // → { data, display, menu, rows } — manage selection snapshot
engine.project.manageUnitView(md)                 // → { data, menu, sections } — action menu + deferred absorb/plan gates
engine.project.completedView(detail, filter)      // → { data, display, menu, rows } — completed & cancelled snapshot
engine.project.workUnitStatus(type, unit)         // → status display block (box + pipeline tree)
engine.project.workUnitMenu(type, unit)           // → { keys, rendered } — proceed/revisit gate; '' rendered when nothing to revisit
engine.project.workUnitData(type, unit, menu)     // → DATA body (flow flags + ACTIONS key table)
engine.project.revisitablePhases(type, unit)      // → string[] — completed phases before next_phase, pipeline-filtered
engine.project.revisitPhasesSection(phases)       // → labelled `MENU: revisit phases` section ('' when none)
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

The .md's prescribed call names the verb (`gateway.cjs view {work_unit}`) — the adapter never infers what a call is for.
