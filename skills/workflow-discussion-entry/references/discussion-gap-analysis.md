# Discussion Gap Analysis

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

## A. Check Prerequisites

#### If `state.has_discussions` is false

There are no discussions to analyse for gaps.

→ Return to caller.

#### Otherwise

→ Proceed to **B. Check Cache**.

---

## B. Check Cache

Check `gap_cache.entries` from the discovery output parsed in Step 1. The array contains at most one entry for this work unit. If empty, there is no cache.

#### If a cache entry exists with `status` `valid`

> *Output the next fenced block as a code block:*

```
Using cached gap analysis (unchanged since {entry.generated})
```

Load the topics from `.workflows/{work_unit}/.state/discussion-gap-analysis.md`.

→ Return to caller.

#### If no cache entry exists or entry `status` is `stale`

→ Proceed to **C. Read Discussion Artifacts**.

---

## C. Read Discussion Artifacts

> *Output the next fenced block as a code block:*

```
Analyzing discussions for coverage gaps...
```

Read every discussion file in `.workflows/{work_unit}/discussion/` end-to-end. For each discussion, note:
- The Discussion Map state (topics and their statuses: pending, exploring, converging, decided)
- Any `→ Elevated: {topic}` markers
- Key decisions made and their dependencies on other topics
- Deferred items, open threads, and unresolved questions
- Integration points with other discussions

Also read `.workflows/{work_unit}/.state/research-analysis.md` if it exists. Note the research themes and which discussions they map to.

Cross-reference across all documents — connections, contradictions, shared concerns, and gaps that span multiple discussions are the primary targets.

→ Proceed to **D. Identify Gaps**.

---

## D. Identify Gaps

Analyse the artifacts from C to identify gaps across five categories:

1. **Cross-discussion themes** — concepts, concerns, or architectural patterns that appear in multiple discussions but are not the primary focus of any. These often emerge as recurring assumptions or shared constraints that deserve dedicated exploration.

2. **Elevated but uncreated** — `→ Elevated: {topic}` markers in Discussion Maps where no corresponding discussion file or manifest entry exists. These are topics explicitly flagged during discussion as needing their own conversation.

3. **Research themes uncovered** — themes from the research analysis (if it exists) that are not addressed by any existing discussion. Compare each research topic's constituent themes against the scope of existing discussions. Only identify themes that are genuinely unaddressed — a theme partially touched in a discussion does not count as a gap.

4. **Emergent topics** — open threads, deferred items, and new subtopics that emerged during discussions and suggest the need for a top-level discussion. Look for "parking lot" items, questions deferred to future discussions, and new concerns raised but not explored.

5. **Integration gaps** — decisions made in separate discussions that interact with each other but no existing discussion covers the integration between them. Look for shared data models, overlapping user journeys, competing resource needs, or architectural assumptions that span discussions.

For each gap, note:
- The gap type (from the five above)
- Which source discussions contributed to identifying it
- Why it matters — what would be missed without a dedicated discussion

→ Proceed to **E. Define Gap Topics**.

---

## E. Define Gap Topics

Group the identified gaps into discussion-sized topics using the same coarseness principles as research analysis.

**Prefer fewer, coarser topics.** Gaps that share the same domain, decision space, or stakeholder concerns should be merged into a single topic. The goal is discussion-sized chunks — not an exhaustive breakdown of every gap.

**The independence test:** If discussing gap A requires constantly referencing gap B, they belong together. Merge gaps that share the same integration boundary, data model, or user journey.

**Anti-patterns:**
- Creating a topic for each individual elevated marker when they relate to the same area
- Splitting integration gaps into per-discussion-pair topics when they share the same integration boundary
- Creating topics so narrow they'd be resolved in a few exchanges

**When to split:** Split when gaps have genuinely different stakeholders, concerns, or decision spaces. Cross-discussion themes about performance may be distinct from integration gaps about data flow, even if they share source discussions.

**Anchor to existing discussions:** Check `discussions.files` from discovery. If a gap topic clearly maps to an existing discussion, use that discussion's filename (converted from kebab-case) as the topic name. Only create new names for topics with no matching existing discussion.

For each topic, write a summary covering all constituent gaps — as long as needed to convey the scope.

→ Proceed to **F. Save Results**.

---

## F. Save Results

Use `gap_input_checksum` from the discovery output parsed in Step 1. This checksum covers all discussion `.md` files + `.workflows/{work_unit}/.state/research-analysis.md` (if it exists) and is pre-computed by the discovery script.

Write cache metadata to manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.research gap_analysis_cache.checksum "{gap_input_checksum from discovery}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.research gap_analysis_cache.generated "{ISO timestamp}"
# Push one entry per discussion file that was read:
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit}.research gap_analysis_cache.discussion_files "{discussion-file}.md"
```

If the research analysis file was also read, push it too:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit}.research gap_analysis_cache.discussion_files "research-analysis.md"
```

Ensure the state directory exists:
```bash
mkdir -p .workflows/{work_unit}/.state
```

Create/update `.workflows/{work_unit}/.state/discussion-gap-analysis.md` (pure markdown, no frontmatter):

```markdown
# Discussion Gap Analysis Cache

## Topics

### {Topic Name}
- **Summary**: {what this gap covers and why it matters}
- **Source discussions**: {discussion1}.md, {discussion2}.md
- **Gap type**: {cross-discussion|elevated|emergent|integration|uncovered}

### {Another Topic}
- **Summary**: {what this gap covers and why it matters}
- **Source discussions**: {discussion1}.md, {discussion2}.md
- **Gap type**: {cross-discussion|elevated|emergent|integration|uncovered}
```

Write the list of gap topic names to the manifest for discovery:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.research gap_topics '["topic-a-kebab","topic-b-kebab"]'
```

Construct the JSON array from all topic names defined in E, converted to kebab-case. This overwrites any previous list — no reconciliation needed.

→ Return to caller.
