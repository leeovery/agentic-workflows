---
name: leeway-log-bug
description: Capture a bug report in the inbox. Use when the user wants to log, note, or save a bug for later.
allowed-tools: Bash(node .claude/skills/leeway-engine/scripts/engine.cjs inbox capture bug *)
---

This skill captures a bug report into the inbox, for later.

If the conversation already holds what is broken, write it up without asking. From a cold start, ask what is broken and draw out the symptoms in a short back-and-forth, typically two to four exchanges, then wrap up. Capture only: read no code, search neither the code nor the web, and never reproduce the bug, diagnose it or suggest a fix.

Write it as an H1 title and a prose body of 200 to 500 words, with no forced headings: the symptoms, when they show and what they cost, and any file that came up. Where the bug is about another project than the one this session is in, find that project's folder and add `--project {folder}`. Run the line with the text on stdin, and emit its section verbatim per its marker:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs inbox capture bug [--project {folder}] <<'ITEM'
{text}
ITEM
```
