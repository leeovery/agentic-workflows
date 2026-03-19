---
name: workflow-log-idea
description: Capture an idea as a markdown file in the workflow inbox. Use when the user wants to log, note, or save an idea for later.
allowed-tools: Bash(mkdir -p), Bash(ls .workflows/inbox/)
---

Capture an idea as a markdown file in the inbox. Fire-and-forget — no manifest, no migrations.

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

---

## Step 1: Detect Mode

Evaluate the current conversation context.

#### If prior conversation context exists that contains an idea worth capturing

The user has been discussing something and wants to log it. No questions needed — proceed directly to **Step 3**.

#### Otherwise

This is a direct invocation. The user wants to capture a new idea.

→ Proceed to **Step 2**.

---

## Step 2: Capture Idea

Load **[capture.md](references/capture.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Write File

Generate a slug from the idea's core concept — short, descriptive, kebab-case (e.g., `smart-retry-logic`, `unified-search`).

Determine today's date in `YYYY-MM-DD` format.

```bash
mkdir -p .workflows/inbox/ideas
```

Write the file to `.workflows/inbox/ideas/{YYYY-MM-DD}--{slug}.md`:
- H1 title (the idea name, titlecased)
- Prose body — 200-500 words
- No forced headings or structured sections — let the content flow naturally
- If codebase files came up in conversation, mention them
- If constraints or goals were discussed, include them

> *Output the next fenced block as a code block:*

```
Logged idea: {slug}
```
