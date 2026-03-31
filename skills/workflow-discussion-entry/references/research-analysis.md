# Research Analysis

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

This step only runs when research files exist.

Use `cache.entries` from discovery to determine the approach. Check if a cache entry exists for this work unit.

#### If a cache entry exists with `status` `valid`

> *Output the next fenced block as a code block:*

```
Using cached research analysis (unchanged since {entry.generated})
```

Load the topics from `.workflows/{work_unit}/.state/research-analysis.md`.

→ Return to caller.

#### If no cache entry exists or entry `status` is `stale`

> *Output the next fenced block as a code block:*

```
Analyzing research documents...
```

Read each research file and extract key themes and potential discussion topics. For each theme:
- Note the source file(s) that contributed to it
- Summarize what the theme covers (as long as needed to convey the topic — no length constraint)

**Be thorough**: This analysis will be cached, so identify ALL potential topics:
- Major architectural decisions
- Technical trade-offs mentioned
- Open questions or concerns raised
- Implementation approaches discussed
- Integration points with external systems
- Security or performance considerations
- Edge cases or error handling mentioned

### Anchor to Existing Discussions

**CRITICAL**: Check `discussions.files` from discovery. These are discussion filenames that already exist for this work unit.

When naming themes:
- If a theme clearly maps to an existing discussion, you MUST use that discussion's filename (converted from kebab-case) as the theme name. E.g., if `data-schema-design.md` exists and you identify a matching theme, name it "Data Schema Design" — not "Database Schema Architecture" or any variation.
- Only create new names for themes with no matching existing discussion.
- For each topic, note if a discussion already exists.

**Save to cache:**

Write cache metadata to manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.research analysis_cache.checksum "{research.checksum from discovery}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.research analysis_cache.generated "{ISO timestamp}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit}.research analysis_cache.files "{filename1}.md"
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit}.research analysis_cache.files "{filename2}.md"
```

Ensure the cache directory exists:
```bash
mkdir -p .workflows/{work_unit}/.state
```

Create/update `.workflows/{work_unit}/.state/research-analysis.md` (pure markdown, no frontmatter):

```markdown
# Research Analysis Cache

## Topics

### {Theme name}
- **Summary**: {as long as needed to convey what this topic covers}
- **Sources**: {filename1}.md, {filename2}.md

### {Another theme}
- **Summary**: {as long as needed to convey what this topic covers}
- **Sources**: {filename1}.md, {filename2}.md
```

### Reconcile Pending Topics

After saving the cache, reconcile manifest entries to reflect the current analysis. This ensures surfaced topics are visible to discovery before the user starts discussing them.

**Create pending entries for new topics:**

For each topic identified in the analysis above:

1. Convert the topic name to kebab-case (e.g., "Data Schema Design" → `data-schema-design`)
2. Check if a discussion entry already exists:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}.discussion.{topic_kebab}
   ```
3. If `false` — create a pending entry:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.discussion.{topic_kebab}
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discussion.{topic_kebab} status pending
   ```
4. If `true` — skip (leave existing entries untouched regardless of their status)

**Remove stale pending entries:**

Using `discussions.files` from discovery, check each discussion with `status === 'pending'`:

1. Convert the topic name back to title case and check if it matches any topic from the new analysis
2. If NOT found in the new analysis — delete the stale pending entry:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.discussion items.{topic_kebab}
   ```

**CRITICAL**: Only delete `pending` entries during reconciliation. Never touch `in-progress`, `completed`, or `skipped` entries.

→ Return to caller.
