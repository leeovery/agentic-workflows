# Research Analysis

*Reference for **[start-discussion](../SKILL.md)***

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
- Note the source file and relevant line numbers
- Summarize what the theme is about in 1-2 sentences
- Identify key questions or decisions that need discussion

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
MANIFEST="node .claude/skills/workflow-manifest/scripts/manifest.js"
$MANIFEST set {work_unit} phases.research.analysis_cache '{"checksum":"{research.checksum from discovery}","generated":"{ISO timestamp}","files":["{filename1}.md","{filename2}.md"]}'
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
- **Source**: {filename}.md (lines {start}-{end})
- **Summary**: {1-2 sentence summary}
- **Key questions**: {what needs deciding}

### {Another theme}
- **Source**: {filename}.md (lines {start}-{end})
- **Summary**: {1-2 sentence summary}
- **Key questions**: {what needs deciding}
```

**Cross-reference**: For each topic, note if a discussion already exists (from `discussions.files` in discovery).

→ Return to **[the skill](../SKILL.md)**.
