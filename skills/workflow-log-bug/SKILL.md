---
name: workflow-log-bug
description: Capture a bug report as a markdown file in the workflow inbox. Use when the user wants to log, note, or save a bug for later.
allowed-tools: Bash(mkdir -p)
---

This skill captures a bug report and writes it to the inbox.

If there's already conversation context about something broken, synthesise it straight into the file without asking questions. If this is a cold start, ask what's broken and have a natural back-and-forth to draw out the symptoms. Recognise when it has enough detail (typically 2-4 exchanges) and wrap up.

**Capture only — these are rules, not guidelines:**
- Do not read code or explore the codebase
- Do not search the web or fetch external resources
- Do not attempt to reproduce or validate the bug
- Do not suggest fixes or workarounds
- Do not diagnose root causes or theorise about what's wrong
- Do not propose solutions or next steps

When ready, generate a short kebab-case slug from the core symptom (e.g., `stale-cache-on-deploy`, `login-timeout`) and write the file:

```bash
mkdir -p .workflows/inbox/bugs
```

**File:** `.workflows/inbox/bugs/{YYYY-MM-DD}--{slug}.md`
- H1 title, prose body, 200-500 words
- No forced headings — let the content flow naturally
- Naturally cover symptoms, conditions, and impact as discussed
- Mention relevant codebase files if they came up

Confirm with a one-liner:

> *Output the next fenced block as a code block:*

```
Logged bug: {slug}
```
