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

**CRITICAL**: Check the `cache.anchored_names` from discovery state. These are grouping names that have existing specifications.

When forming groupings:
- If a grouping contains a majority of the same discussions as an anchored name's spec, you MUST reuse that anchored name
- Only create new names for genuinely new groupings with no overlap
- If an anchored spec's discussions are now scattered across multiple new groupings, note this as a **naming conflict** to present to the user

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

→ Proceed to **C. Save to Cache**.

---

## C. Save to Cache

Write cache metadata to manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discussion analysis_cache.checksum "{checksum from current_state.discussions_checksum}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discussion analysis_cache.generated "{ISO date}"
```

Create the cache directory if needed:
```bash
mkdir -p .workflows/{work_unit}/.state
```

Write to `.workflows/{work_unit}/.state/discussion-consolidation-analysis.md` (pure markdown, no frontmatter):

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

→ Load **[display-groupings.md](display-groupings.md)** and follow its instructions as written.
