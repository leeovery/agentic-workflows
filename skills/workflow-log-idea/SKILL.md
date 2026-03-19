---
name: workflow-log-idea
description: Capture an idea as a markdown file in the workflow inbox. Use when the user wants to log, note, or save an idea for later.
allowed-tools: Bash(mkdir -p)
---

This skill captures an idea and writes it to the inbox.

If there's already conversation context about an idea, synthesise it straight into the file without asking questions. If this is a cold start, ask what's on their mind and have a natural back-and-forth to draw the idea out. Recognise when it has enough shape (typically 2-4 exchanges) and wrap up.

**Capture only — these are rules, not guidelines:**
- Do not read code or explore the codebase
- Do not search the web or fetch external resources
- Do not validate feasibility or question viability
- Do not suggest architecture or implementation approaches
- Do not play devil's advocate or challenge the idea
- Do not propose solutions or next steps

When ready, generate a short kebab-case slug from the core concept (e.g., `smart-retry-logic`, `unified-search`) and write the file:

```bash
mkdir -p .workflows/inbox/ideas
```

**File:** `.workflows/inbox/ideas/{YYYY-MM-DD}--{slug}.md` (use today's actual date)
- H1 title, prose body, 200-500 words
- No forced headings — let the content flow naturally
- Mention relevant codebase files, constraints, or goals if they came up

Confirm with a one-liner:

> *Output the next fenced block as a code block:*

```
Logged idea: {slug}
```
