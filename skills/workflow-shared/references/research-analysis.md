# Research Analysis

*Shared reference. Loaded by `workflow-shared/references/self-healing.md`.*

---

Identifies discussion-sized topics from completed research files and adds them to the discovery map as fresh inception items with `source: research-analysis` provenance. The orchestrator handles the cache check; this reference is invoked only when the cache is `stale`.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name.
- `tracker` — a list (initially empty) for newly-added topic names. The reference appends names as items are written.

## A. Identify Themes

> *Output the next fenced block as a code block:*

```
Analyzing research documents...
```

**CRITICAL**: This analysis is the foundation for every downstream phase. The themes extracted here drive topic definition, which drives discussion, which drives specification, planning, and implementation. Anything missed here is invisible to the rest of the pipeline.

Read every research file under `.workflows/{work_unit}/research/` end-to-end. Then cross-reference across files — connections, contradictions, and shared concerns that span multiple documents are often the most important themes. Extract every distinct theme, concern, decision point, constraint, risk, open question, or nuance you find. Technical, business, operational, regulatory, user-facing, or otherwise — if the research mentions it, capture it. Even small details matter: a brief aside about a regulatory deadline, a passing mention of a dependency, a footnote about a limitation. These may not become their own topics, but they inform the grouping and ensure nothing is lost.

This analysis is cached and only re-runs when research files change. Be exhaustive — this is the one opportunity to capture the full picture.

For each theme, note the source file(s) that contributed to it.

→ Proceed to **B. Define Discussion Topics**.

## B. Define Discussion Topics

Group the themes from A into discussion topics. Each topic becomes a separate discussion, so the granularity matters.

**Prefer fewer, coarser topics.** The goal is discussion-sized chunks with clear boundaries — not an exhaustive breakdown of every concern. Research that surfaces 10-15 themes should typically yield 3-6 discussion topics. Each topic should be substantial enough for a rich conversation, not so narrow that the discussion is artificially constrained.

**The independence test:** If discussing topic A requires constantly referencing topic B, they belong together. Merge themes that share the same domain, data model, user journey, or decision space. Narrow topics create overhead — separate discussions, separate artifacts, separate scaffolding — and artificially constrain conversations that naturally want to cross boundaries.

**Anti-pattern — splitting implementation details of one domain:**

Research about authentication might surface themes for API authentication, password hashing, session management, OAuth integration, token refresh, and rate limiting. These are NOT six discussion topics. They share the same user, the same security boundary, and the same session lifecycle. You cannot discuss OAuth without discussing tokens, or tokens without sessions. This is one topic: **Authentication**.

**Anti-pattern — one theme per system component:**

Research about a data pipeline might surface themes for ingestion, schema validation, transformation rules, error handling, retry logic, and dead letter queues. Each theme is just a stage in the same pipeline — discussing error handling requires understanding the transformation stage. This is one topic: **Data Pipeline**.

**When to split:**

Split when themes have genuinely different stakeholders, concerns, or decision spaces that can be explored independently. For example, research about a multi-tenant SaaS platform might surface tenant isolation, database strategy, shared infrastructure, billing, onboarding, and admin tooling. These split naturally into two topics: **Tenant Architecture** (isolation, storage, infrastructure — coupled technical decisions) and **Tenant Lifecycle** (onboarding, billing, admin — coupled operational decisions). The architecture discussion doesn't need to reference billing details, and the lifecycle discussion doesn't need to debate isolation strategies.

For each topic, write a one-line summary that covers the constituent themes — used as the inception item's `summary` field.

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
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.inception items
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.inception dismissed
```

`items` is the active map (an object keyed by topic name). `dismissed` is the array of names previously removed via refinement.

For each candidate topic from **B** (kebab-case name + summary):

**If the name is already on the active map** (a key in `items`):

Check if the existing item's `source` field already includes `research-analysis`. If not, the same theme is now surfacing both via the existing source and via research-analysis — extend the source list to record dual provenance:

```bash
existing_source=$(node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.inception.{name} source)
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{name} source "${existing_source},research-analysis"
```

Do not add to `tracker` — the item was already on the map. Do not write a new manifest entry.

**If the name appears in `dismissed`**:

Skip silently. The user removed this topic via refinement; the dismissed semantic is "don't auto-re-propose."

**Otherwise (new candidate)**:

Initialise the inception item and write its fields:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.inception.{name}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{name} summary "{one-line summary}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{name} routing discussion
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{name} source research-analysis
```

Routing is `discussion` — research-surfaced themes are discussion candidates by definition.

Append the name to the caller's `tracker` so the orchestrator can surface it via callout / Self-Healing Arrivals.

→ Proceed to **E. Update Cache**.

## E. Update Cache

Update the existing cache file at `.workflows/{work_unit}/.state/research-analysis.md` (pure markdown, no frontmatter):

```bash
mkdir -p .workflows/{work_unit}/.state
```

Overwrite with the topic list (gap-analysis reads this file as its second input):

```markdown
# Research Analysis Cache

## Topics

### {Topic Name}
- **Summary**: {one-line summary}
- **Sources**: {filename1}.md, {filename2}.md

### {Another Topic}
- **Summary**: {one-line summary}
- **Sources**: {filename1}.md, {filename2}.md
```

List every topic from **B**, even those that filtered out in **D** — the cache file is the analysis output, not the diff. Gap-analysis cross-references this list against existing discussions.

Compute the input checksum from the research files:

```bash
node -e "
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const dir = '.workflows/{work_unit}/research';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort();
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
# Push one entry per research file:
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit}.research analysis_cache.files "{research-file}.md"
```

→ Return to caller.
