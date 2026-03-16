# Gather Context: From Research

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

Present the analysis summary and source files as-is — do not re-summarize.

> *Output the next fenced block as markdown (not a code block):*

```
New discussion: {topic}

Research sources:
  • .workflows/{work_unit}/research/{filename1}.md
  • .workflows/{work_unit}/research/{filename2}.md

Topic: {summary from analysis cache}

· · · · · · · · · · · ·
Do you have anything to add? Extra context, files, or additional
research you'd like to include — drop them in now.

- **`n`/`no`** — Continue as-is
- **Add context** — Describe what you'd like to include
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `no`

No additional context. Proceed with research sources only.

→ Return to **[gather-context.md](gather-context.md)**.

#### If user provides additional context

Note the additional context provided by the user — it will be included alongside the research sources in the handoff to the processing skill.

→ Return to **[gather-context.md](gather-context.md)**.
