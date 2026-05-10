# Discussion Gap Analysis

*Shared reference. Loaded by `workflow-shared/references/self-healing.md`.*

---

Identifies gap topics across completed discussions and the cached research-analysis output, and adds them to the discovery map as fresh inception items with `source: gap-analysis` provenance. The orchestrator handles the cache check; this reference is invoked only when the cache is `stale`.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name.
- `tracker` — a list (initially empty) for newly-added topic names. The reference appends names as items are written.

## A. Read Discussion Artifacts

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

→ Proceed to **B. Identify Gaps**.

## B. Identify Gaps

Analyse the artifacts from A to identify gaps across five categories:

1. **Cross-discussion themes** — concepts, concerns, or architectural patterns that appear in multiple discussions but are not the primary focus of any. These often emerge as recurring assumptions or shared constraints that deserve dedicated exploration.

2. **Elevated but uncreated** — `→ Elevated: {topic}` markers in Discussion Maps where no corresponding discussion file or manifest entry exists. These are topics explicitly flagged during discussion as needing their own conversation.

3. **Research themes uncovered** — themes from the research analysis (if it exists) that are not addressed by any existing discussion. Compare each research topic's constituent themes against the scope of existing discussions. Only identify themes that are genuinely unaddressed — a theme partially touched in a discussion does not count as a gap.

4. **Emergent topics** — open threads, deferred items, and new subtopics that emerged during discussions and suggest the need for a top-level discussion. Look for "parking lot" items, questions deferred to future discussions, and new concerns raised but not explored.

5. **Integration gaps** — decisions made in separate discussions that interact with each other but no existing discussion covers the integration between them. Look for shared data models, overlapping user journeys, competing resource needs, or architectural assumptions that span discussions.

For each gap, note:
- The gap type (from the five above)
- Which source discussions contributed to identifying it
- Why it matters — what would be missed without a dedicated discussion

→ Proceed to **C. Define Gap Topics**.

## C. Define Gap Topics

Group the identified gaps into discussion-sized topics using the same coarseness principles as research analysis.

**Prefer fewer, coarser topics.** Gaps that share the same domain, decision space, or stakeholder concerns should be merged into a single topic. The goal is discussion-sized chunks — not an exhaustive breakdown of every gap.

**The independence test:** If discussing gap A requires constantly referencing gap B, they belong together. Merge gaps that share the same integration boundary, data model, or user journey.

**Anti-patterns:**
- Creating a topic for each individual elevated marker when they relate to the same area
- Splitting integration gaps into per-discussion-pair topics when they share the same integration boundary
- Creating topics so narrow they'd be resolved in a few exchanges

**When to split:** Split when gaps have genuinely different stakeholders, concerns, or decision spaces. Cross-discussion themes about performance may be distinct from integration gaps about data flow, even if they share source discussions.

**Anchor to existing discussions:** List existing discussion files under `.workflows/{work_unit}/discussion/`. If a gap topic clearly maps to an existing discussion, use that discussion's filename (without the `.md` extension) as the kebab-case topic name. Only create new names for topics with no matching existing discussion.

For each topic, write a one-line summary covering the constituent gaps — used as the inception item's `summary` field.

→ Proceed to **D. Filter and Save**.

## D. Filter and Save

Read filter inputs from the work unit's manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.inception items
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.inception dismissed
```

`items` is the active map (an object keyed by topic name). `dismissed` is the array of names previously removed via refinement.

For each candidate topic from **C** (kebab-case name + summary), evaluate the conditions below in order. Each branch is self-contained and concludes by moving on to the next candidate.

#### If the name is already on the active map (a key in `items`)

Check if the existing item's `source` field already includes `gap-analysis`. If not, the same theme is now surfacing both via the existing source and via gap-analysis — extend the source list to record dual provenance:

```bash
existing_source=$(node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.inception.{name} source)
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{name} source "${existing_source},gap-analysis"
```

Do not add to `tracker` — the item was already on the map. Do not write a new manifest entry.

#### If the name appears in `dismissed`

Skip silently. The user removed this topic via refinement; the dismissed semantic is "don't auto-re-propose."

#### Otherwise (new candidate)

Initialise the inception item and write its fields:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.inception.{name}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{name} summary "{one-line summary}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{name} routing discussion
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{name} source gap-analysis
```

Routing is `discussion` — gap topics are discussion candidates by definition.

Append the name to the caller's `tracker` so the orchestrator can surface it via callout / Self-Healing Arrivals.

---

Once all candidates have been evaluated:

→ Proceed to **E. Update Cache**.

## E. Update Cache

Update the existing cache file at `.workflows/{work_unit}/.state/discussion-gap-analysis.md` (pure markdown, no frontmatter):

```bash
mkdir -p .workflows/{work_unit}/.state
```

Overwrite with the topic list:

```markdown
# Discussion Gap Analysis Cache

## Topics

### {Topic Name}
- **Summary**: {one-line summary}
- **Source discussions**: {discussion1}.md, {discussion2}.md
- **Gap type**: {cross-discussion|elevated|emergent|integration|uncovered}

### {Another Topic}
- **Summary**: {one-line summary}
- **Source discussions**: {discussion1}.md, {discussion2}.md
- **Gap type**: {cross-discussion|elevated|emergent|integration|uncovered}
```

Compute the input checksum from the discussion files plus research-analysis cache:

```bash
node -e "
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const dir = '.workflows/{work_unit}/discussion';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort();
const inputs = files.map(f => path.join(dir, f));
const ra = '.workflows/{work_unit}/.state/research-analysis.md';
if (fs.existsSync(ra)) inputs.push(ra);
const hash = crypto.createHash('md5');
for (const f of inputs) hash.update(fs.readFileSync(f));
console.log(hash.digest('hex'));
"
```

Update the manifest's gap_analysis_cache:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discussion gap_analysis_cache.checksum "{computed-checksum}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discussion gap_analysis_cache.generated "{ISO timestamp}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discussion gap_analysis_cache.discussion_files '[]'
# Push one entry per discussion file:
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit}.discussion gap_analysis_cache.discussion_files "{discussion-file}.md"
# If research-analysis.md was read, push it too:
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit}.discussion gap_analysis_cache.discussion_files "research-analysis.md"
```

→ Return to caller.
