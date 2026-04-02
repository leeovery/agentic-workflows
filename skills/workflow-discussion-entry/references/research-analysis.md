# Research Analysis

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

## A. Check Cache

Check `cache.entries` from the discovery output parsed in Step 1. The array contains at most one entry for this work unit. If empty, there is no cache.

#### If a cache entry exists with `status` `valid`

> *Output the next fenced block as a code block:*

```
Using cached research analysis (unchanged since {entry.generated})
```

Load the topics from `.workflows/{work_unit}/.state/research-analysis.md`.

→ Return to caller.

#### If no cache entry exists or entry `status` is `stale`

→ Proceed to **B. Identify Themes**.

---

## B. Identify Themes

> *Output the next fenced block as a code block:*

```
Analyzing research documents...
```

**CRITICAL**: This analysis is the foundation for every downstream phase. The themes extracted here drive topic definition, which drives discussion, which drives specification, planning, and implementation. Anything missed here is invisible to the rest of the pipeline.

Read every research file end-to-end. Then cross-reference across files — connections, contradictions, and shared concerns that span multiple documents are often the most important themes. Extract every distinct theme, concern, decision point, constraint, risk, open question, or nuance you find. Technical, business, operational, regulatory, user-facing, or otherwise — if the research mentions it, capture it. Even small details matter: a brief aside about a regulatory deadline, a passing mention of a dependency, a footnote about a limitation. These may not become their own topics, but they inform the grouping and ensure nothing is lost.

This analysis is cached and only re-runs when research files change. Be exhaustive — this is the one opportunity to capture the full picture.

For each theme, note the source file(s) that contributed to it.

→ Proceed to **C. Define Discussion Topics**.

---

## C. Define Discussion Topics

Group the themes from B into discussion topics. Each topic becomes a separate discussion, so the granularity matters.

**Prefer fewer, coarser topics.** The goal is discussion-sized chunks with clear boundaries — not an exhaustive breakdown of every concern. Research that surfaces 10-15 themes should typically yield 3-6 discussion topics. Each topic should be substantial enough for a rich conversation, not so narrow that the discussion is artificially constrained.

**The independence test:** If discussing topic A requires constantly referencing topic B, they belong together. Merge themes that share the same domain, data model, user journey, or decision space. Narrow topics create overhead — separate discussions, separate artifacts, separate scaffolding — and artificially constrain conversations that naturally want to cross boundaries.

**Anti-pattern — splitting implementation details of one domain:**

Research about authentication might surface themes for API authentication, password hashing, session management, OAuth integration, token refresh, and rate limiting. These are NOT six discussion topics. They share the same user, the same security boundary, and the same session lifecycle. You cannot discuss OAuth without discussing tokens, or tokens without sessions. This is one topic: **Authentication**.

**Anti-pattern — one theme per system component:**

Research about a data pipeline might surface themes for ingestion, schema validation, transformation rules, error handling, retry logic, and dead letter queues. Each theme is just a stage in the same pipeline — discussing error handling requires understanding the transformation stage. This is one topic: **Data Pipeline**.

**When to split:**

Split when themes have genuinely different stakeholders, concerns, or decision spaces that can be explored independently. For example, research about a multi-tenant SaaS platform might surface tenant isolation, database strategy, shared infrastructure, billing, onboarding, and admin tooling. These split naturally into two topics: **Tenant Architecture** (isolation, storage, infrastructure — coupled technical decisions) and **Tenant Lifecycle** (onboarding, billing, admin — coupled operational decisions). The architecture discussion doesn't need to reference billing details, and the lifecycle discussion doesn't need to debate isolation strategies.

For each topic, write a summary that covers all constituent themes — as long as needed to convey the scope.

→ Proceed to **D. Anchor to Existing Discussions**.

---

## D. Anchor to Existing Discussions

**CRITICAL**: Check `discussions.files` from discovery. These are discussion filenames that already exist for this work unit.

When naming topics:
- If a topic clearly maps to an existing discussion, you MUST use that discussion's filename (converted from kebab-case) as the topic name. E.g., if `data-schema-design.md` exists and you identify a matching topic, name it "Data Schema Design" — not "Database Schema Architecture" or any variation.
- Only create new names for topics with no matching existing discussion.
- For each topic, note if a discussion already exists.

→ Proceed to **E. Save Results**.

---

## E. Save Results

Write cache metadata to manifest. The `checksum` and `files` fields record which research input files were analysed, so the cache can detect when research changes.
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.research analysis_cache.checksum "{research.checksum from discovery}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.research analysis_cache.generated "{ISO timestamp}"
# Push one entry per research file that was read:
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit}.research analysis_cache.files "{research-file}.md"
```

Ensure the state directory exists:
```bash
mkdir -p .workflows/{work_unit}/.state
```

Create/update `.workflows/{work_unit}/.state/research-analysis.md` (pure markdown, no frontmatter):

```markdown
# Research Analysis Cache

## Topics

### {Topic Name}
- **Summary**: {covers all constituent themes — as long as needed to convey the full scope}
- **Sources**: {filename1}.md, {filename2}.md

### {Another Topic}
- **Summary**: {covers all constituent themes — as long as needed to convey the full scope}
- **Sources**: {filename1}.md, {filename2}.md
```

Write the list of topic names to the manifest for discovery:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.research surfaced_topics '["topic-a-kebab","topic-b-kebab"]'
```

Construct the JSON array from all topic names defined in C, converted to kebab-case. This overwrites any previous list — no reconciliation needed.

→ Return to caller.
