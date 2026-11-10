---
name: leeway-log-idea
description: Capture an idea in the inbox. Use when the user wants to log, note, or save an idea for later.
allowed-tools: Bash(node .claude/skills/leeway-engine/scripts/engine.cjs inbox capture idea *)
---

This skill captures an idea into the inbox, for later.

If the conversation already holds the idea, write it up without asking. From a cold start, ask what is on their mind and draw the idea out in a short back-and-forth, typically two to four exchanges, then wrap up. Capture only: read no code, search nothing, and never weigh its feasibility, challenge it or suggest how to build it.

Write it as an H1 title and a prose body of 200 to 500 words, with no forced headings: the idea, and any constraint, goal or file that came up. Where the idea is about another project than the one this session is in, find that project's folder and add `--project {folder}`. Run the line with the text on stdin, and emit its section verbatim per its marker:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs inbox capture idea [--project {folder}] <<'ITEM'
{text}
ITEM
```
