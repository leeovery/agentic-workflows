# Lifecycle Tools

The work type you picked on day one is a starting shape, not a sentence. A feature grows topics; an epic's spec turns out to be a project-wide policy; a finished pipeline needs one more pass. Each of these has a dedicated tool, and each is a single engine transaction: validated fully before anything moves, refused cleanly when the preconditions fail, committed once. All are reached from `workflow-start`'s `m`/manage menu, the completed/cancelled view, or the epic dashboard; the menus offer exactly the actions the selected unit's state allows.

## Pivot: feature → epic

The scope grew: what was one coherent topic is now several. `engine workunit pivot` converts an in-progress feature to an epic in one transaction: flips `work_type` in both the work-unit and project manifests, registers the feature's single topic on the new [discovery map](discovery.md#the-discovery-map) with backfill semantics (routing derived from whether research exists; summary and description left for the next epic entry's backfill pass), re-indexes the unit's knowledge chunks (their metadata carries `work_type`, which is why a re-index is needed), and commits. It refuses a non-feature, a unit not in progress, or a topic name already on (or dismissed from) the target map, all before touching anything.

Pivot is also offered mid-conversation: when a single-topic [discussion](research-and-discussion.md#off-topic-concerns) surfaces a concern that deserves to be its own topic, one menu option converts the feature and lands the concern on the new epic's map without leaving the discussion.

## Absorb: feature → epic topic

The feature turned out to belong inside an epic that already exists. `engine workunit absorb` merges it in as a new topic and deletes the feature, with the judgment (which feature, which epic, what topic name) staying in conversation and the verb taking the decided inputs. Guarded: the feature must have a discussion and no specification-or-beyond phases, the epic must be in progress, and the topic name must be free everywhere it could collide (map, dismissed list, discussion items, files). The transaction moves the discussion, research files, imports, and seeds (suffixing collisions, preserving original timestamps and provenance), mirrors phase statuses onto the epic, registers the map item, moves the knowledge-base chunks to their epic identities, deletes the feature and its registration, and lands one commit staging all three paths. The feature's discovery session logs are deliberately not moved: git history is the provenance.

## Promote: epic spec → cross-cutting unit

An epic topic's completed specification is assessed at [spec conclusion](specification.md#completion) as cross-cutting: it defines how things are done rather than a thing to build. `engine workunit promote` moves it out to its own [cross-cutting](work-types.md#cross-cutting) work unit, arriving already `completed` (the cc pipeline is terminal after spec) with `source_work_unit`/`source_topic` provenance. The spec directory moves, its source discussions move with it, the epic's spec item becomes `status: promoted` with a `promoted_to` pointer, and the knowledge base re-homes the chunks. A refusal leaves the epic byte-pristine.

## Reopen: completed is not immutable

Completion is a status, not a lock, and reopening is a first-class transition rather than a manual status edit:

- **Revisit at the bridge.** After each phase, the [bridge](how-it-fits-together.md#the-bridge) offers completed earlier phases for revisit, computed per work type, and routes the chosen phase's entry skill in a clean context. Entry skills detect the reopen and resume rather than restart.
- **Resume completed topics** from the epic dashboard's dedicated sub-menu.
- **Review remediation** is the loop-scale reopen: [review](review.md#the-remediation-loop) findings become plan tasks, `engine topic reopen` flips the implementation item back to `in-progress`, and a fresh session executes the new tasks. `reopen` is deliberately narrow: it accepts only `completed` items (resuming in-progress work is `start`'s job, cancelled items go through `reactivate`), and it leaves knowledge-base chunks live until re-completion re-indexes over the same identity.

## Finalise, complete, cancel, reactivate

The work-unit-level lifecycle, all single transactions:

- **Finalise.** When every phase is done but the unit is still `in-progress` (a reactivated finished pipeline, or a pipeline whose last phase completed without closing out), the continue view flags it with the engine-rendered callout

  ```
  ⚑ All phases complete — ready to finalise.
  ```

  and a `y`/finalise action that runs `workunit complete`.
- **Complete** (`d`/done in manage, or automatic at pipeline end via the bridge) stamps `completed_at` and commits. Completed units keep their knowledge-base chunks: finished work is exactly what future retrieval wants.
- **Cancel** marks the unit `cancelled` and removes its chunks from the knowledge base, so abandoned reasoning stops surfacing in queries.
- **Reactivate** (from the completed/cancelled view) restores `in-progress`, clears the stale `completed_at`, and, only for previously cancelled units, re-indexes everything cancellation removed: completed artifacts, imports, seeds, analysis caches, and epic session logs. Illegal transitions refuse loudly; the engine routes each closed state through the right verb rather than permitting a raw status write.

Epics additionally get **per-topic cancel and reactivate** from the dashboard: `engine topic cancel` stashes the item's status in `previous_status`, drops its map order, and removes its chunks; reactivate restores exactly what was stashed. Cancelled topics stay visible in the display but leave every aggregation, gate, and routing computation.

---

*Next: the settings that shape all of this, [configuration](configuration.md).*
