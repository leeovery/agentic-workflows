# Research Analysis

*Reference for **[start-discussion](../SKILL.md)***

---

This step only runs when research files exist.

Use `cache.status` from discovery to determine the approach:

#### If `cache.status` is `valid`

```
Using cached research analysis (unchanged since {cache.generated})
```

Load the topics from `.workflows/.state/research-analysis.md` and proceed.

#### If `cache.status` is `stale` or `none`

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

Ensure the cache directory exists:
```bash
mkdir -p .workflows/.state
```

Create/update `.workflows/.state/research-analysis.md`:

```markdown
---
checksum: {research.checksum from discovery}
generated: YYYY-MM-DDTHH:MM:SS  # Use current ISO timestamp
research_files:
  - {filename1}.md
  - {filename2}.md
---

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
