# Discovery Gap Analysis

*Shared reference. Loaded by `workflow-shared/references/topic-discovery.md`.*

---

Identifies gap topics across completed research files and completed discussions, and **stages** them as candidates for per-topic approval, with `source: gap-analysis` provenance. The orchestrator ([topic-discovery.md](topic-discovery.md)) handles the cache check and invokes this reference only when the cache is `stale`; it then runs the approval gate ([analysis-approval-gate.md](analysis-approval-gate.md)) and, once the gate completes, re-enters this reference at **E. Update Cache** to stamp.

This reference does not write to the discovery map directly — it resolves the no-gate cases (already-on-map, dismissed) silently at stage time and stages genuinely-new candidates for the gate to approve.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name.

**Precondition.** Collect `completed_research` and `completed_discussion` (items with `status: completed`). If both empty, return — no staging, no cache stamp, no manifest writes.

## A. Read Artifacts

> *Output the next fenced block as a code block:*

```
Analyzing completed research and discussions for coverage gaps...
```

Read `.workflows/{work_unit}/research/{name}.md` for each `completed_research` name and `.workflows/{work_unit}/discussion/{name}.md` for each `completed_discussion` name. Skip files missing on disk. Items with `in-progress`, `superseded`, or `cancelled` status are not in the input set.

For each discussion, note:
- The Discussion Map state (topics and their statuses: pending, exploring, converging, decided)
- Key decisions made and their dependencies on other topics
- Deferred items, open threads, and unresolved questions
- Integration points with other discussions

For each research file, note key themes, open questions, and any threads identified as needing follow-up.

Cross-reference across all documents — connections, contradictions, shared concerns, and gaps that span multiple artifacts are the primary targets.

→ Proceed to **B. Identify Gaps**.

## B. Identify Gaps

Analyse the artifacts from A to identify gaps across four categories:

1. **Cross-artifact themes** — concepts, concerns, or architectural patterns that appear in multiple artifacts but are not the primary focus of any. These often emerge as recurring assumptions or shared constraints that deserve dedicated exploration.

2. **Research themes uncovered** — themes from completed research files that are not addressed by any completed discussion. Only identify themes that are genuinely unaddressed — a theme partially touched in a discussion does not count as a gap.

3. **Emergent topics** — open threads, deferred items, and new subtopics that emerged during work and suggest the need for a top-level topic. Look for "parking lot" items, questions deferred, and new concerns raised but not explored.

4. **Integration gaps** — decisions made in separate artifacts that interact with each other but no existing artifact covers the integration between them. Look for shared data models, overlapping user journeys, competing resource needs, or architectural assumptions that span artifacts.

For each gap, note:
- The gap type (from the four above)
- Which source artifacts contributed to identifying it
- Why it matters — what would be missed without dedicated work
- Depth assessment — is the gap well-scoped (ready for discussion) or under-explored (needs research first)?

→ Proceed to **C. Define Gap Topics**.

## C. Define Gap Topics

Group the identified gaps into topic-sized chunks.

→ Load **[topic-granularity.md](topic-granularity.md)**.

**Gap-specific anti-patterns** (in addition to the shared ones above):
- Splitting integration gaps into per-discussion-pair topics when they share the same integration boundary
- Creating topics so narrow they'd be resolved in a few exchanges

**Anchor to existing discussions:** List existing discussion files under `.workflows/{work_unit}/discussion/`. If a gap topic clearly maps to an existing discussion, use that discussion's filename (without the `.md` extension) as the kebab-case topic name. Only create new names for topics with no matching existing discussion.

For each topic, write a one-line summary covering the constituent gaps — used as the discovery item's `summary` field.

Assign each candidate a `routing` value.

→ Load **[routing-decision.md](routing-decision.md)**.

A single analysis may emit a mix of routings — apply the criteria per candidate.

→ Proceed to **D. Filter and Stage**.

## D. Filter and Stage

Read filter inputs from the work unit's manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discovery items
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discovery dismissed
```

`items` is the active map (an object keyed by topic name). `dismissed` is the array of names previously removed from the map by the user.

Initialise the staging file fresh (overwrite any prior pass) at `.workflows/{work_unit}/.state/discovery-gap-analysis-candidates.md` with frontmatter — this reference is only invoked for staging when no pending candidates remain from a deferred run, so overwriting is safe:

```markdown
---
work_unit: {work_unit}
analysis: discovery-gap-analysis
generated: {ISO timestamp}
gate_mode: gated
---
```

For each candidate topic from **C** (kebab-case name + summary + description + routing), evaluate the conditions below in order. The first two cases are resolved here at stage time without a gate; only genuinely-new candidates are staged for the approval gate. Each branch is self-contained and concludes by moving on to the next candidate.

#### If the name is already on the active map (a key in `items`)

Check if the existing item's `source` field already includes `gap-analysis`. If not, the same theme is now surfacing both via the existing source and via gap-analysis — extend the source list to record dual provenance. This is a silent merge — no staging entry, no gate.

Read the existing source:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discovery.{name} source
```

**If the existing source is empty or the literal string `null`:**

The manifest CLI prints `"null"` for fields that exist with a JSON null value (intentional — `exists` is the way to distinguish missing from null). Treat both empty and `"null"` as "no real source" and set the new value alone:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{name} source "gap-analysis"
```

**Otherwise:**

Set source to `{existing},gap-analysis` (comma-joined):

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{name} source "{existing},gap-analysis"
```

Do not change the existing item's routing. Do not stage a candidate.

#### If the name appears in `dismissed`

Skip silently. The user removed this topic from the map; the dismissed semantic is "don't auto-re-propose." No staging entry.

#### Otherwise (new candidate)

Stage it for the approval gate by appending a block to the staging file:

```markdown
## {name}
status: pending
summary: {one-line summary}
description: |
  {paragraphs}
routing: {routing-from-C}
source: gap-analysis
```

`routing` is the value decided per-candidate in **C** (`discussion` or `research`). Gap-analysis keeps the bare `gap-analysis` source (no single-parent semantics — it synthesises across artifacts) and stages no `parent` or `fanout_offer`. `description` is a paragraph or two extracted from the gap analysis for this topic — richer context than the one-line summary, loaded by entry skills as opening context when the user later picks the topic up. Do not write to the discovery map and do not append to any tracker here — the approval gate writes approved candidates and tracks them.

---

Once all candidates have been evaluated:

→ Return to caller.

## E. Update Cache

Invoked by [topic-discovery.md](topic-discovery.md) after the approval gate has run, regardless of how many candidates were approved — a decline-all pass still stamps, so the analysis won't re-fire on every boot. Not reached when the gate is deferred (the host skips this section so the staging file is re-presented next boot).

Update the existing cache file at `.workflows/{work_unit}/.state/discovery-gap-analysis.md` (pure markdown, no frontmatter):

```bash
mkdir -p .workflows/{work_unit}/.state
```

Overwrite with the topic list:

```markdown
# Discovery Gap Analysis Cache

## Topics

### {Topic Name}
- **Summary**: {one-line summary}
- **Routing**: {discussion|research}
- **Source artifacts**: {filename1}.md, {filename2}.md
- **Gap type**: {cross-artifact|emergent|integration|uncovered}

### {Another Topic}
- **Summary**: {one-line summary}
- **Routing**: {discussion|research}
- **Source artifacts**: {filename1}.md, {filename2}.md
- **Gap type**: {cross-artifact|emergent|integration|uncovered}
```

List every topic from **C**, even those that filtered out in **D** — the cache file is the analysis output, not the diff. If re-entered on a reuse boot where **C** did not run this session (a deferred staging file was picked up), source the topic list from the staging file's candidate blocks instead.

Compute the input checksum from completed research files plus completed discussion files only:

```bash
node -e "
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const manifest = JSON.parse(fs.readFileSync('.workflows/{work_unit}/manifest.json', 'utf8'));
const rItems = ((manifest.phases || {}).research || {}).items || {};
const dItems = ((manifest.phases || {}).discussion || {}).items || {};
const rDir = '.workflows/{work_unit}/research';
const dDir = '.workflows/{work_unit}/discussion';
const inputs = [];
for (const [k, v] of Object.entries(rItems)) {
  if (v && v.status === 'completed') {
    const p = path.join(rDir, k + '.md');
    if (fs.existsSync(p)) inputs.push(p);
  }
}
for (const [k, v] of Object.entries(dItems)) {
  if (v && v.status === 'completed') {
    const p = path.join(dDir, k + '.md');
    if (fs.existsSync(p)) inputs.push(p);
  }
}
inputs.sort();
const hash = crypto.createHash('md5');
for (const f of inputs) hash.update(fs.readFileSync(f));
console.log(hash.digest('hex'));
"
```

Update the manifest's gap_analysis_cache (note: now lives under `phases.discovery`, not `phases.discussion`):

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery gap_analysis_cache.checksum "{computed-checksum}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery gap_analysis_cache.generated "{ISO timestamp}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery gap_analysis_cache.input_files '[]'
# Push one entry per input file (completed research + completed discussion):
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit}.discovery gap_analysis_cache.input_files "{file}.md"
```

Index the cache file into the knowledge base so its content surfaces in future contextual queries:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index .workflows/{work_unit}/.state/discovery-gap-analysis.md
```

If the index call fails, surface the error to the user but do not abort — the cache file is already on disk and the manifest is updated; the user can re-run `knowledge index` manually or wait for the next analysis re-run to retry.

→ Return to caller.
