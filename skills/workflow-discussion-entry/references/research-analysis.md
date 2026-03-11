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

Load the topics from `.workflows/{work_unit}/.state/research-analysis.md` and proceed.

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

**Save to cache:**

Write cache metadata to manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} phases.research.analysis_cache.checksum "{research.checksum from discovery}"
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} phases.research.analysis_cache.generated "{ISO timestamp}"
node .claude/skills/workflow-manifest/scripts/manifest.js push {work_unit} phases.research.analysis_cache.files "{filename1}.md"
node .claude/skills/workflow-manifest/scripts/manifest.js push {work_unit} phases.research.analysis_cache.files "{filename2}.md"
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

**Cross-reference**: For each topic, note if a discussion already exists (from `discussions.files` in discovery).

→ Return to **[the skill](../SKILL.md)**.
