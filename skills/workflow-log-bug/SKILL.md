---
name: workflow-log-bug
description: Capture a bug report as a markdown file in the workflow inbox. Use when the user wants to log, note, or save a bug for later.
allowed-tools: Bash(mkdir -p), Bash(ls .workflows/inbox/)
---

This skill captures a bug and writes it to the inbox. No manifest, no migrations, no pipeline — just capture and file.

If there's already conversation context about something broken, synthesise it straight into the file without asking questions. If this is a cold start, ask what's broken and have a natural back-and-forth to draw out the symptoms. Recognise when it has enough detail (typically 2-4 exchanges) and wrap up.

**Capture, don't explore.** Don't read code, search the web, validate or reproduce the bug, suggest fixes, diagnose root causes, or propose solutions. The goal is to record what's broken, not to investigate it.

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
