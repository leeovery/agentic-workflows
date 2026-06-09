# Analysis Flow

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

## A. Gather Analysis Context

> *Output the next fenced block as a code block:*

```
Before analyzing, is there anything about how these discussions relate
that would help me group them appropriately?

For example:
- Topics that are part of the same feature
- Dependencies between topics
- Topics that must stay separate

Your context (or 'none'):
```

**STOP.** Wait for user response.

→ Proceed to **B. Analyze Discussions**.

---

## B. Analyze Discussions

**This step is critical. You MUST read every completed discussion document thoroughly.**

For each completed discussion:
1. Read the ENTIRE document using the Read tool (not just the header)
2. Understand the decisions, systems, and concepts it defines
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

### Preserve Anchored Names

**Anchors** are existing specification items whose status is anything other than `proposed` — `in-progress`, `completed`, `superseded`, or `promoted` — from the discovery `specifications` array. They are specs the user has already started or finished; reconcile preserves them. Proposed items are not anchors — they are freely regenerated.

When forming groupings:
- If a grouping contains a majority of the same discussions as an anchor's sources, you MUST reuse that anchor's topic name
- Only create new names for genuinely new groupings with no overlap
- If an anchor's discussions are now scattered across multiple new groupings, note this as a **naming conflict** to present to the user

### Identify Cross-Grouping Hand-offs

A discussion can belong wholly in one grouping yet still impose corrections on a **sibling** grouping (or on an anchored existing spec) — e.g. a decision redesigned in discussion A that supersedes what another grouping's spec documents. Carry these in as **consult references**, not sources: the receiving spec reads only the named slice for the correction and cites it; it does not extract the discussion wholesale.

While grouping, for each discussion check whether it hands work to another grouping:
- Harvest any `## Spec hand-offs` section or "reconciliation owed by {spec}" note in the discussion, if present
- Note cross-grouping corrections you observe even when no such section exists

Record each as a consult reference on the **receiving** grouping (never as a source), capturing which slice/decisions and why.

### Knowledge-Base Advisory Query

Before finalizing groupings, run one query per grouping to surface sibling discussions that may owe it corrections you missed:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs query "<natural-language concern for this grouping>" --work-unit {work_unit} --phase discussion --limit 5
```

Phrase the query as a natural-language description of the grouping's concern, not a topic slug (see **[workflow-knowledge SKILL.md](../../workflow-knowledge/SKILL.md)** → Query construction).

Treat hits as **candidate** consult references — a hit from a discussion outside this grouping that names a correction it owes is worth promoting onto the receiving grouping. **Advisory only**: never auto-add, never gate. You decide which candidates to record; the user confirms at the grouping menu.

→ Proceed to **C. Reconcile Proposed Groupings**.

---

## C. Reconcile Proposed Groupings

Persist the analysis by reconciling the manifest's specification items against the freshly-formed groupings. The manifest is the source of truth: each purely-proposed grouping becomes a `proposed` specification item carrying its members as `pending` sources and **no file on disk**. Every mutation uses `set`/`delete` — never `init-phase`. Anchors are preserved; proposed items are freely regenerated.

Work through these steps in order:

1. **Snapshot existing items.** Read the current specification items and their sources:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs get '{work_unit}.specification.*' status
   ```
   Partition them into **anchors** (status ∉ `proposed`) and **existing-proposed** (status `proposed`). Read sources per item as needed (`get {work_unit}.specification.{name} sources`).

2. **Map groupings to anchors.** For each freshly-formed grouping that substantially overlaps an anchor's sources (a majority of members shared), rename it in memory to the anchor's topic key. This splits the groupings into **maps-to-anchor** and **purely-proposed**.

3. **Augment anchors.** For each grouping mapped to an anchor, add any member discussion not already in that anchor's sources:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.specification.{anchor} sources.{discussion}.status pending
   ```
   Never change an anchor's `status`. Never prune or overwrite an anchor's existing sources.

4. **Compute the target proposed set.** The target names are the kebab-case names of the **purely-proposed** groupings. An independent discussion is a grouping of one — it becomes a proposed item too, so it is startable and visible.

5. **Delete stale proposed.** For each existing-proposed item whose name is not in the target set, remove the whole item:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.specification items.{name}
   ```

6. **Collision guard.** If a target proposed name equals an existing anchor key, do NOT write `proposed` over it. Surface it as a **naming conflict** to the user and drop or rename the colliding target. This protects the invariant — an anchor is never overwritten by a proposed item.

7. **Upsert proposed.** For each surviving target name:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.specification.{name} status proposed
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.specification.{name} sources.{discussion}.status pending
   ```
   Set one `sources.{discussion}.status pending` per grouping member. For an existing-proposed item being regenerated, prune any source no longer in the grouping (allowed only on proposed items, never anchors):
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.specification.{name} sources.{old-discussion}
   ```
   A **rename** of a proposed grouping is just delete-old (step 5) plus upsert-new — lossless, since a proposed item holds no file or extraction.

→ Proceed to **D. Write the Cache**.

---

## D. Write the Cache

Write the cache **after** all manifest mutations. The checksum is written last — a mid-reconcile crash then leaves a stale checksum, forcing a clean re-reconcile on the next run.

Create the cache directory if needed:
```bash
mkdir -p .workflows/{work_unit}/.state
```

Write to `.workflows/{work_unit}/.state/discussion-consolidation-analysis.md` (pure markdown, no frontmatter) — the manifest holds the authoritative grouping→source mapping, so this file carries only coupling/rationale and consult-slice hints:

```markdown
# Discussion Consolidation Analysis

## Recommended Groupings

### {Suggested Specification Name}
- **{discussion-a}**: {why it belongs in this group}
- **{discussion-b}**: {why it belongs in this group}

**Coupling**: {Brief explanation of what binds these together}
**Consult**: {ref-topic} — {slice/why the correction is owed}

### {Another Specification Name}
- **{discussion-d}**: {why it belongs}

**Coupling**: {Brief explanation}

## Independent Discussions
- **{discussion-f}**: {Why this stands alone}

## Analysis Notes
{Any additional context about the relationships discovered}
{Note any naming conflicts with anchored specs here}
```

The `**Consult**` line is per-grouping — one line per consult reference, omitted entirely when a grouping owes none. List sources under each grouping as bullets; consult references stay on their own `**Consult**` line so they are never mistaken for sources.

Write the cache metadata to the manifest last:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discussion analysis_cache.checksum "{checksum from current_state.discussions_checksum}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discussion analysis_cache.generated "{ISO date}"
```

Commit the whole reconcile as one commit: `spec({work_unit}): reconcile proposed groupings`

→ Load **[display-groupings.md](display-groupings.md)** and follow its instructions as written.
