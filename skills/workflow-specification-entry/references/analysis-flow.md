# Analysis Flow

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

## A. Held Source Check

The analysis reads the completed discussions and rewrites `.state/` staging that is work-unit-wide — a peer session holding a source topic open, however long it has idled, is still working material it would read, and the pass would overwrite whatever an earlier one staged. Check first:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs presence scan {work_unit}
```

#### If the response has `held_sources` greater than `0`

Hold off — the analysis reads the settled record, so it waits for those sessions and runs at the next entry. Emit the response's `DISPLAY: presence deferral` section now, verbatim per its marker.

The stop is the whole answer wherever this fires.

**STOP.** Do not proceed — terminal condition.

#### Otherwise

→ Proceed to **B. Gather Analysis Context**.

---

## B. Gather Analysis Context

A prior pass's cache is about to be superseded by this one. Clear it — only when the file exists:

```bash
rm .workflows/{work_unit}/.state/discussion-consolidation-analysis.md
```

> *Output the next fenced block as a text code block (```text fence):*

```text
Before analyzing, is there anything about how these discussions relate
that would help me group them appropriately?

For example:
- Topics that are part of the same feature
- Dependencies between topics
- Topics that must stay separate

Your context (or 'none'):
```

**STOP.** Wait for user response.

→ Proceed to **C. Analyze Discussions**.

---

## C. Analyze Discussions

**This step is critical. You MUST read every completed discussion document thoroughly.**

For each completed discussion:
1. Read the ENTIRE document using the Read tool (not just the header)
2. Understand the decisions, systems, and concepts it defines — where a Decision block holds dated timeline entries, the top entry is the current decision and earlier entries are lineage
3. Note dependencies on or references to other discussions
4. Identify shared data structures, entities, or behaviors

Then analyze coupling between discussions:
- **Data coupling**: Discussions that define or depend on the same data structures
- **Behavioral coupling**: Discussions where one's implementation requires another
- **Conceptual coupling**: Discussions that address different facets of the same problem

Group discussions into specifications where each grouping represents a **coherent feature or capability that can be independently planned and built** — with clear stages delivering incremental, testable value:

- **Tightly coupled discussions belong together** — their decisions are inseparable and would produce interleaved implementation work
- **Don't group too broadly** — if a grouping mixes unrelated concerns, the resulting specification will produce incoherent stages and tasks
- **Don't group too narrowly** — if a grouping is too thin, it may not warrant its own specification cycle
- **Flag cross-cutting discussions** — discussions about patterns or policies should become cross-cutting specifications rather than being grouped with feature discussions

**Preserve Anchored Names**

**Anchors** are existing specification items whose status is `in-progress`, `completed`, `superseded`, or `promoted`. They are specs the user has already started or finished; reconcile preserves them. Proposed items are not anchors — they are freely regenerated. A **cancelled** specification is neither: it anchors nothing and its sources are free to be regrouped, but its key stays reserved — it comes back only through the epic menu's reactivate. The cancelled set is the DATA section's `cancelled_specifications:` lines — one per cancelled specification, naming the sources it grouped — the one source **D** reads too.

When forming groupings:
- If a grouping contains a majority of the same discussions as an anchor's sources, you MUST reuse that anchor's topic name
- If a grouping contains a majority of the same discussions as a cancelled specification's sources, name it afresh — never the cancelled key — and record the resemblance for **E**: `resembles the cancelled specification {name} — reactivate it from the epic menu if you want it back`
- Only create new names for genuinely new groupings with no overlap
- If an anchor's discussions are now scattered across multiple new groupings, note this as a **naming conflict** to present to the user

**Note Cross-Source Tensions**

The full read also surfaces tensions construction will meet when it extracts. Record each as one `**Tension**` line in the cache (**E**):

- **Between sources** — two documents' decided ground disagrees, or a term rests on something another document has since moved. Record it on the grouping whose sources carry it: the documents, the collision.
- **From a sibling** — a discussion belonging wholly in one grouping changed something a **sibling** grouping (or an anchored existing spec) depends on, e.g. a decision redesigned in discussion A that supersedes what another grouping's spec documents. Record it on the **receiving** grouping, never as a source: the sibling discussion, what it changed. While grouping, check each discussion for one — a `## Spec hand-offs` section or "reconciliation owed by {spec}" note it carries, a change you observe where it carries neither, a dated revision entry in a Decision timeline whose trigger names a sibling grouping's ground.

Advisory only — never a gate, never resolved here; the specification session holds them from its setup, and its construction raises each.

**Knowledge-Base Advisory Query**

Before finalizing groupings, run one query per grouping to surface sibling changes the read missed:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs knowledge query "<natural-language concern for this grouping>" --work-unit {work_unit} --phase discussion --limit 5
```

Phrase the query as a natural-language description of the grouping's concern, not a topic slug (see **[knowledge-usage.md](../../workflow-shared/references/knowledge-usage.md)** → **B. How to construct queries**).

Treat hits as **candidate** tension lines — a hit from a discussion outside this grouping that changed something the grouping depends on is worth recording on it. **Advisory only**: never auto-add, never gate. You decide which candidates to record.

→ Proceed to **D. Reconcile Proposed Groupings**.

---

## D. Reconcile Proposed Groupings

Persist the analysis by reconciling the manifest's specification items against the freshly-formed groupings. The manifest is the source of truth: each purely-proposed grouping becomes a `proposed` specification item carrying its members as `pending` sources and **no file on disk**. Every mutation uses `set`/`delete` — never `init-phase`. Anchors are preserved; proposed items are freely regenerated.

Work through these steps in order:

1. **Snapshot existing items.** Read the current specification items and their sources:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest get '{work_unit}.specification.*' status
   ```
   Partition them into **anchors** (`in-progress`, `completed`, `superseded`, `promoted`) and **existing-proposed** (`proposed`). The **cancelled** set is the DATA section's `cancelled_specifications:` list — the one **C** read — set aside: never augmented, never deleted, never written to (the engine refuses a `status` write onto a cancelled item and a `delete` of it), its key never reused. Read sources per item as needed (`get {work_unit}.specification.{name} sources`).

2. **Map groupings to anchors.** For each freshly-formed grouping that substantially overlaps an anchor's sources (a majority of members shared), rename it in memory to the anchor's topic key. This splits the groupings into **maps-to-anchor** and **purely-proposed**.

3. **Augment anchors.** For each grouping mapped to an anchor, collect a `set` op for any member discussion not already in that anchor's sources:
   - `{work_unit}.specification.{anchor}` → `sources.{discussion}.status: pending`

   Never change an anchor's `status`. Never prune or overwrite an anchor's existing sources.

4. **Compute the target proposed set.** The target names are the kebab-case names of the **purely-proposed** groupings. An independent discussion is a grouping of one — it becomes a proposed item too, so it is startable and visible.

5. **Delete stale proposed.** For each existing-proposed item whose name is not in the target set, collect a `delete` op removing the whole item:
   - `{work_unit}.specification` → delete `items.{name}`

6. **Collision guard.** If a target proposed name equals an existing anchor key, do NOT write `proposed` over it — rename the colliding target; an anchor is never overwritten by a proposed item. A target name equal to a cancelled specification's key is renamed too — the key is reserved for that specification's reactivation, and the resemblance line from **C** is what the user sees.

7. **Upsert proposed.** For each surviving target name, collect `set` ops — `status: proposed` plus one `sources.{discussion}.status: pending` per grouping member — and, for an existing-proposed item being regenerated, a `delete` op per source no longer in the grouping (pruning is allowed only on proposed items, never anchors). A **rename** of a proposed grouping is just delete-old (step 5) plus upsert-new — lossless, since a proposed item holds no file or extraction.

8. **Assign the build order.** The analysis just read every grouping holistically — the same read decides which topic to build first. Over the whole live set (every `in-progress` or `completed` anchor, plus every surviving target), assign contiguous integers `1..N` weighing what must physically exist before what: foundational scaffolding first, a topic whose deliverable other groupings assume ahead of the topics that assume it. Ignore the discovery map's `order` — it ranks what to explore, assigned before any discussion concluded. Collect one `set` field per topic — a bare number, never quoted:
   - `{work_unit}.specification.{name}` → `order: {N}` (fold into the topic's existing op where one is already collected; a topic with no op yet — an anchor whose sources are unchanged — gets its own `set` op)

   Check whether a completed specification has flagged the order stale (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest exists {work_unit}.specification build_order_stale`). When `true`, collect one more op — this reconcile is the sequencing, so the flag clears with it:
   - `{work_unit}.specification` → delete `build_order_stale`

9. **Apply the reconcile.** Write the collected ops, in the order gathered (augments, stale deletes, upserts, prunes, order sets, the flag delete), to `.workflows/.cache/{work_unit}/specification/reconcile-ops.json` with the Write tool:
   ```json
   [{"op": "set", "path": "{work_unit}.specification.{name}", "fields": {"status": "proposed", "sources.{discussion}.status": "pending", "order": 2}},
    {"op": "delete", "path": "{work_unit}.specification", "field": "items.{name}"}]
   ```
   Persist the whole reconcile in one atomic call — a failing op means the manifest is untouched, never half-reconciled:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest apply {work_unit} --file .workflows/.cache/{work_unit}/specification/reconcile-ops.json
   ```

→ Proceed to **E. Write the Cache**.

---

## E. Write the Cache

Write the cache **after** all manifest mutations. The checksum is written last — a mid-reconcile crash then leaves a stale checksum, forcing a clean re-reconcile on the next run.

Create the cache directory if needed:
```bash
mkdir -p .workflows/{work_unit}/.state
```

Write to `.workflows/{work_unit}/.state/discussion-consolidation-analysis.md` (pure markdown, no frontmatter) — the manifest holds the authoritative grouping→source mapping, so this file carries only coupling/rationale and tension lines:

```markdown
# Discussion Consolidation Analysis

## Recommended Groupings

### {Suggested Specification Name}
- **{discussion-a}**: {why it belongs in this group}
- **{discussion-b}**: {why it belongs in this group}

**Coupling**: {Brief explanation of what binds these together}
**Tension**: {doc-a} / {doc-b} — {the collision, one line}
**Tension**: {sibling-discussion} — {what it changed, one line}

### {Another Specification Name}
- **{discussion-d}**: {why it belongs}

**Coupling**: {Brief explanation}

## Independent Discussions
- **{discussion-f}**: {Why this stands alone}

## Analysis Notes
{Any additional context about the relationships discovered}
{Note any naming conflicts with anchored specs here}
{Note a grouping that resembles a cancelled specification here, with the route back}
```

List sources under each grouping as bullets. `**Tension**` lines are per-grouping — one per noted tension, omitted when a grouping carries none — and a sibling discussion one names is never listed as a source; the specification session reads them back at setup, and its construction raises each.

Write the cache metadata to the manifest last:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discussion analysis_cache.checksum "{discussions_checksum from the DATA section}"
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.discussion analysis_cache.generated "{ISO date}"
```

Commit the whole reconcile as one commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --state -m "spec({work_unit}): reconcile proposed groupings"
```

When a grouping resembles a cancelled specification (**C**), tell the user in one line: it resembles the cancelled specification {name} — reactivate it from the epic menu if you want it back.

The reconcile moved the scenario — read it afresh:

```bash
node .claude/skills/workflow-specification-entry/scripts/gateway.cjs {work_unit}
```

Route on its `scenario`.

#### If `scenario` is `groupings`

→ Load **[display-groupings.md](display-groupings.md)** and follow its instructions as written.

#### If `scenario` is `specs-menu`

Every grouping mapped to an existing specification — no proposed items remain.

→ Load **[display-specs-menu.md](display-specs-menu.md)** and follow its instructions as written.
