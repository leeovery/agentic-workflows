---
name: workflow-log-quickfix
description: Capture a quick-fix as a markdown file in the workflow inbox. Use when the user wants to log a trivially scoped mechanical change for later.
allowed-tools: Bash(mkdir -p)
---

This skill captures a quick-fix and writes it to the inbox.

If there's already conversation context about a mechanical change, synthesise it straight into the file without asking questions. If this is a cold start, ask what needs changing and have a natural back-and-forth to draw out the scope. Recognise when it has enough detail (typically 1-3 exchanges) and wrap up.

**Capture only — these are rules, not guidelines:**
- Do not read code or explore the codebase
- Do not search the web or fetch external resources
- Do not attempt to validate the change
- Do not suggest approaches or implementation details
- Do not diagnose complexity or recommend work types
- Do not propose next steps

When ready, generate a short kebab-case slug from the core change (e.g., `replace-interface-with-any`, `update-deprecated-api`) and write the file:

```bash
mkdir -p .workflows/.inbox/quickfixes
```

**File:** `.workflows/.inbox/quickfixes/{YYYY-MM-DD}--{slug}.md` (use today's actual date)
- H1 title, prose body, 100-300 words
- No forced headings — let the content flow naturally
- Naturally cover what needs changing, where, and why
- Mention relevant codebase files if they came up

Confirm with a one-liner:

> *Output the next fenced block as a code block:*

```
Logged quick-fix: {slug}
```
