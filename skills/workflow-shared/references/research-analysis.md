# Research Analysis

*Shared reference. Loaded by `workflow-shared/references/topic-discovery.md`.*

---

Identifies follow-up topics from completed per-topic research files and **stages** them as candidates for per-topic approval, with `source: research-analysis:{parent}` provenance. The orchestrator ([topic-discovery.md](topic-discovery.md)) handles the cache check and invokes this reference only when the cache is `stale`; it then runs the approval gate ([analysis-approval-gate.md](analysis-approval-gate.md)) and, once the gate completes, re-enters this reference at **E. Update Cache** to stamp.

This reference does not write to the discovery map directly — it resolves the no-gate cases (already-on-map, dismissed) silently at stage time and stages genuinely-new candidates for the gate to approve.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name.

**Precondition.** Collect research items where `status == 'completed'`. If empty, return — no staging, no cache stamp, no manifest writes.

## A. Identify Themes

> *Output the next fenced block as a code block:*

```
Analyzing research documents...
```

**CRITICAL**: This analysis is the foundation for every downstream phase. The themes extracted here drive topic definition, which drives discussion, which drives specification, planning, and implementation. Anything missed here is invisible to the rest of the pipeline.

Read `.workflows/{work_unit}/research/{name}.md` for each completed item from the precondition set. Skip files missing on disk. Items with `in-progress`, `superseded`, or `cancelled` status are not in the input set.

Cross-reference across files — connections, contradictions, and shared concerns that span multiple documents are often the most important themes. Extract every distinct theme, concern, decision point, constraint, risk, open question, or nuance you find. Technical, business, operational, regulatory, user-facing, or otherwise — if the research mentions it, capture it. Even small details matter: a brief aside about a regulatory deadline, a passing mention of a dependency, a footnote about a limitation. These may not become their own topics, but they inform the grouping and ensure nothing is lost.

This analysis is cached and only re-runs when completed-research content changes. Be exhaustive — this is the one opportunity to capture the full picture.

For each theme, note the source file(s) that contributed to it and assess its depth: is it well-explored in the source material, or does it surface as an under-explored area that would benefit from its own research pass? The contributing files drive each candidate's `parent` in **B**.

→ Proceed to **B. Define Candidate Topics**.

## B. Define Candidate Topics

Group the themes from A into candidate topics.

→ Load **[topic-granularity.md](topic-granularity.md)**.

For each candidate topic, write a one-line summary that covers the constituent themes — used as the discovery item's `summary` field.

Record each candidate's `parent` — the completed research file (filename without `.md`) that primarily contributed it. When several files contribute, pick the primary one. The parent drives `source: research-analysis:{parent}` provenance and the fan-out offer in the approval gate.

Assign each candidate a `routing` value.

→ Load **[routing-decision.md](routing-decision.md)**.

A single analysis may emit a mix of routings — apply the criteria per candidate.

→ Proceed to **C. Anchor to Existing Discussions**.

## C. Anchor to Existing Discussions

**CRITICAL**: List existing discussion files under `.workflows/{work_unit}/discussion/` (one `.md` per existing discussion).

When naming topics:
- If a topic clearly maps to an existing discussion, you MUST use that discussion's filename (without the `.md` extension) as the kebab-case topic name. E.g., if `data-schema-design.md` exists and you identify a matching topic, name it `data-schema-design` — not `database-schema-architecture` or any variation.
- Only create new names for topics with no matching existing discussion.

→ Proceed to **D. Filter and Stage**.

## D. Filter and Stage

Read filter inputs from the work unit's manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discovery items
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discovery dismissed
```

`items` is the active map (an object keyed by topic name). `dismissed` is the array of names previously removed from the map by the user.

Initialise the staging file fresh (overwrite any prior pass) at `.workflows/{work_unit}/.state/research-analysis-candidates.md` with frontmatter — this reference is only invoked for staging when no pending candidates remain from a deferred run, so overwriting is safe:

```markdown
---
work_unit: {work_unit}
analysis: research-analysis
generated: {ISO timestamp}
gate_mode: gated
---
```

For each candidate topic from **B** (kebab-case name + summary + description + routing + parent), evaluate the conditions below in order. The first two cases are resolved here at stage time without a gate; only genuinely-new candidates are staged for the approval gate. Each branch is self-contained and concludes by moving on to the next candidate.

#### If the name is already on the active map (a key in `items`)

Check if the existing item's `source` field already includes `research-analysis`. If not, the same theme is now surfacing both via the existing source and via research-analysis — extend the source list to record dual provenance. This is a silent merge — no staging entry, no gate.

Read the existing source:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discovery.{name} source
```

**If the existing source is empty or the literal string `null`:**

The manifest CLI prints `"null"` for fields that exist with a JSON null value (intentional — `exists` is the way to distinguish missing from null). Treat both empty and `"null"` as "no real source" and set the new value alone:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{name} source "research-analysis"
```

**Otherwise:**

Set source to `{existing},research-analysis` (comma-joined):

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{name} source "{existing},research-analysis"
```

Do not change the existing item's routing — the user (or earlier analysis) already set it. Do not stage a candidate.

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
routing: {routing-from-B}
source: research-analysis:{parent}
parent: {parent}
fanout_offer: pending
```

`routing` is the value decided per-candidate in **B** (`discussion` or `research`). `source` carries the `parent` so provenance renders as `from {parent}`. `description` is a paragraph or two extracted from the analysis output for this topic — richer context than the one-line summary, loaded by entry skills as opening context when the user later picks the topic up. Do not write to the discovery map and do not append to any tracker here — the approval gate writes approved candidates and tracks them.

---

Once all candidates have been evaluated:

→ Return to caller.

## E. Update Cache

Invoked by [topic-discovery.md](topic-discovery.md) after the approval gate has run, regardless of how many candidates were approved — a decline-all pass still stamps, so the analysis won't re-fire on every boot. Not reached when the gate is deferred (the host skips this section so the staging file is re-presented next boot).

Update the existing cache file at `.workflows/{work_unit}/.state/research-analysis.md` (pure markdown, no frontmatter):

```bash
mkdir -p .workflows/{work_unit}/.state
```

Overwrite with the topic list:

```markdown
# Research Analysis Cache

## Topics

### {Topic Name}
- **Summary**: {one-line summary}
- **Routing**: {discussion|research}
- **Sources**: {filename1}.md, {filename2}.md

### {Another Topic}
- **Summary**: {one-line summary}
- **Routing**: {discussion|research}
- **Sources**: {filename1}.md, {filename2}.md
```

List every topic from **B**, even those that filtered out in **D** — the cache file is the analysis output, not the diff. If re-entered on a reuse boot where **B** did not run this session (a deferred staging file was picked up), source the topic list from the staging file's candidate blocks instead.

Compute the input checksum from the completed research files only:

```bash
node -e "
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const manifest = JSON.parse(fs.readFileSync('.workflows/{work_unit}/manifest.json', 'utf8'));
const items = ((manifest.phases || {}).research || {}).items || {};
const dir = '.workflows/{work_unit}/research';
const files = Object.entries(items)
  .filter(([_, v]) => v && v.status === 'completed')
  .map(([k]) => k + '.md')
  .filter(f => fs.existsSync(path.join(dir, f)))
  .sort();
const hash = crypto.createHash('md5');
for (const f of files) hash.update(fs.readFileSync(path.join(dir, f)));
console.log(hash.digest('hex'));
"
```

Update the manifest's analysis_cache:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.research analysis_cache.checksum "{computed-checksum}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.research analysis_cache.generated "{ISO timestamp}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.research analysis_cache.files '[]'
# Push one entry per completed research file:
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit}.research analysis_cache.files "{research-file}.md"
```

Index the cache file into the knowledge base so its content surfaces in future contextual queries:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index .workflows/{work_unit}/.state/research-analysis.md
```

If the index call fails, surface the error to the user but do not abort — the cache file is already on disk and the manifest is updated; the user can re-run `knowledge index` manually or wait for the next analysis re-run to retry.

→ Return to caller.
