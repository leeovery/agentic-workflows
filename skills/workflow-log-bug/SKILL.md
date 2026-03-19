---
name: workflow-log-bug
description: Capture a bug report as a markdown file in the workflow inbox. Use when the user wants to log, note, or save a bug for later.
allowed-tools: Bash(mkdir -p), Bash(ls .workflows/inbox/)
---

Capture a bug as a markdown file in the inbox. Fire-and-forget — no manifest, no migrations.

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

---

## Step 1: Detect Mode

Evaluate the current conversation context.

#### If prior conversation context exists that describes a bug worth capturing

The user has been discussing something broken and wants to log it. No questions needed — proceed directly to **Step 3**.

#### Otherwise

This is a direct invocation. The user wants to capture a new bug.

→ Proceed to **Step 2**.

---

## Step 2: Capture Bug

Load **[capture.md](references/capture.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Write File

Generate a slug from the bug's core symptom — short, descriptive, kebab-case (e.g., `stale-cache-on-deploy`, `login-timeout`).

Determine today's date in `YYYY-MM-DD` format.

```bash
mkdir -p .workflows/inbox/bugs
```

Write the file to `.workflows/inbox/bugs/{YYYY-MM-DD}--{slug}.md`:
- H1 title (the bug name, titlecased)
- Prose body — 200-500 words
- No forced headings or structured sections — let the content flow naturally
- Naturally cover symptoms, conditions, and impact as discussed
- If codebase files came up in conversation, mention them

> *Output the next fenced block as a code block:*

```
Logged bug: {slug}
```
