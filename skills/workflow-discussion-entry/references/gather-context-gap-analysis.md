# Gather Context: From Gap Analysis

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

Present the gap analysis summary and source discussions as-is — do not re-summarize.

> *Output the next fenced block as markdown (not a code block):*

```
New discussion: {topic}

Source discussions:
  • .workflows/{work_unit}/discussion/{discussion1}.md
  • .workflows/{work_unit}/discussion/{discussion2}.md

Gap: {summary from gap analysis cache}

· · · · · · · · · · · ·
Do you have anything to add? Extra context, files, or additional
information you'd like to include — drop them in now.

- **`n`/`no`** — Continue as-is
- **Add context** — Describe what you'd like to include
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `no`

No additional context. Proceed with gap analysis sources only.

→ Return to caller.

#### If user provides additional context

Remember the additional context — it will be included alongside the gap analysis sources in the handoff to the processing skill.

→ Return to caller.
