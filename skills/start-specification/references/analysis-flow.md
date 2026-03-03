# Analysis Flow

*Reference for **[start-specification](../SKILL.md)***

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

**STOP.** Wait for user response. Note their input for the analysis.

→ Proceed to **B. Analyze Discussions**.

---

## B. Analyze Discussions

**This step is critical. You MUST read every concluded discussion document thoroughly.**

For each concluded discussion:
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

→ Proceed to **C. Save to Cache**.

---

## C. Save to Cache

Write cache metadata to manifest:
```bash
MANIFEST="node .claude/skills/workflow-manifest/scripts/manifest.js"
$MANIFEST set {work_unit} phases.discussion.analysis_cache '{"checksum":"{checksum from current_state.discussions_checksum}","generated":"{ISO date}"}'
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

### {Another Specification Name}
- **{discussion-d}**: {why it belongs}

**Coupling**: {Brief explanation}

## Independent Discussions
- **{discussion-f}**: {Why this stands alone}

## Analysis Notes
{Any additional context about the relationships discovered}
{Note any naming conflicts with anchored specs here}
```

→ Load **[display-groupings.md](display-groupings.md)** and follow its instructions.
