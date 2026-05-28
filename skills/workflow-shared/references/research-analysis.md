# Research Analysis

*Shared reference. Loaded by `workflow-shared/references/topic-discovery.md`.*

---

Identifies follow-up topics from completed per-topic research files and adds them to the discovery map as fresh discovery items with `source: research-analysis` provenance. The orchestrator handles the cache check; this reference is invoked only when the cache is `stale`.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name.
- `tracker` — a list (initially empty) for newly-added topic names. The reference appends names as items are written.

**Precondition.** Collect research items where `status == 'completed'`. If empty, return — no cache stamp, no manifest writes, no callout.

## A. Identify Themes

> *Output the next fenced block as a code block:*

```
Analyzing research documents...
```

**CRITICAL**: This analysis is the foundation for every downstream phase. The themes extracted here drive topic definition, which drives discussion, which drives specification, planning, and implementation. Anything missed here is invisible to the rest of the pipeline.

Read `.workflows/{work_unit}/research/{name}.md` for each completed item from the precondition set. Skip files missing on disk. Items with `in-progress`, `superseded`, or `cancelled` status are not in the input set.

Cross-reference across files — connections, contradictions, and shared concerns that span multiple documents are often the most important themes. Extract every distinct theme, concern, decision point, constraint, risk, open question, or nuance you find. Technical, business, operational, regulatory, user-facing, or otherwise — if the research mentions it, capture it. Even small details matter: a brief aside about a regulatory deadline, a passing mention of a dependency, a footnote about a limitation. These may not become their own topics, but they inform the grouping and ensure nothing is lost.

This analysis is cached and only re-runs when completed-research content changes. Be exhaustive — this is the one opportunity to capture the full picture.

For each theme, note the source file(s) that contributed to it and assess its depth: is it well-explored in the source material, or does it surface as an under-explored area that would benefit from its own research pass?

→ Proceed to **B. Define Candidate Topics**.

## B. Define Candidate Topics

Group the themes from A into candidate topics.

→ Load **[topic-granularity.md](topic-granularity.md)**.

For each candidate topic, write a one-line summary that covers the constituent themes — used as the discovery item's `summary` field.

Assign each candidate a `routing` value.

→ Load **[routing-decision.md](routing-decision.md)**.

A single analysis may emit a mix of routings — apply the criteria per candidate.

→ Proceed to **C. Anchor to Existing Discussions**.

## C. Anchor to Existing Discussions

**CRITICAL**: List existing discussion files under `.workflows/{work_unit}/discussion/` (one `.md` per existing discussion).

When naming topics:
- If a topic clearly maps to an existing discussion, you MUST use that discussion's filename (without the `.md` extension) as the kebab-case topic name. E.g., if `data-schema-design.md` exists and you identify a matching topic, name it `data-schema-design` — not `database-schema-architecture` or any variation.
- Only create new names for topics with no matching existing discussion.

→ Proceed to **D. Filter and Save**.

## D. Filter and Save

Read filter inputs from the work unit's manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discovery items
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discovery dismissed
```

`items` is the active map (an object keyed by topic name). `dismissed` is the array of names previously removed from the map by the user.

For each candidate topic from **B** (kebab-case name + summary + routing), evaluate the conditions below in order. Each branch is self-contained and concludes by moving on to the next candidate.

#### If the name is already on the active map (a key in `items`)

Check if the existing item's `source` field already includes `research-analysis`. If not, the same theme is now surfacing both via the existing source and via research-analysis — extend the source list to record dual provenance.

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

Do not change the existing item's routing — the user (or earlier analysis) already set it. Do not add to `tracker`. Do not write a new manifest entry.

#### If the name appears in `dismissed`

Skip silently. The user removed this topic from the map; the dismissed semantic is "don't auto-re-propose."

#### Otherwise (new candidate)

Initialise the discovery item and write its fields:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.discovery.{name}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{name} summary "{one-line summary}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{name} description "{paragraphs}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{name} routing {routing-from-B}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{name} source research-analysis
```

`routing` is the value decided per-candidate in **B** (`discussion` or `research`).

`description` is a paragraph or two extracted from the analysis output for this topic — richer context than the one-line summary, loaded by entry skills as opening context when the user later picks the topic up. Quote with single quotes; description may span multiple paragraphs.

Append the name to the caller's `tracker` so the orchestrator can surface it via callout / Topic Discovery Arrivals.

---

Once all candidates have been evaluated:

→ Proceed to **E. Update Cache**.

## E. Update Cache

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

List every topic from **B**, even those that filtered out in **D** — the cache file is the analysis output, not the diff.

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
