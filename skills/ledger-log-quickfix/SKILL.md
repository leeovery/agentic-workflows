---
name: ledger-log-quickfix
description: Capture a quick-fix in the inbox. Use when the user wants to log settled work needing no decision for later — a tweak, an amendment, a quick update to an existing feature.
allowed-tools: Bash(node .claude/skills/ledger-engine/scripts/engine.cjs inbox capture quick-fix *)
---

This skill captures a quick-fix, settled work needing no decision, into the inbox, for later.

If the conversation already holds the change, write it up without asking. From a cold start, ask what needs changing and draw out its scope in a short back-and-forth, typically one to three exchanges, then wrap up. Capture only: read no code, search neither the code nor the web, and never validate the change, judge its size or suggest how to make it.

Write it as an H1 title and a prose body of 100 to 300 words, with no forced headings: what needs changing, where and why, and any file that came up. Where the change is to another project than the one this session is in, find that project's folder and add `--project {folder}`. Run the line with the text on stdin, and emit its section verbatim per its marker:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs inbox capture quick-fix [--project {folder}] <<'ITEM'
{text}
ITEM
```
