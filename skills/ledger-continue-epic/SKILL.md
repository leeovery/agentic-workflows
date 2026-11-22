---
name: ledger-continue-epic
description: Ledger's menu for an epic. Reached only through a Ledger handoff, never invoked directly; work comes into Ledger through /ledger.
user-invocable: false
allowed-tools: Bash(node .claude/skills/ledger-engine/scripts/engine.cjs *)
---

An epic's menu: what waits on the person in it, its topics, and the way on.

## Arguments

- `$0` — **work_unit**: the epic.

## Instructions

Load **[framework.md](../ledger-shared/references/framework.md)** and follow its instructions as written.

## The Menu

Fetch the menu:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render epic-menu {work_unit}
```

A refusal names the way on: say it in a line.

The legacy files' row leads to `asset legacy {work_unit}`. Run it, then sort them:

Load **[legacy-files.md](../ledger-shared/references/legacy-files.md)** and follow its instructions as written.

On return, run **The Menu** again.

A `next` that draws the start menu, `render start-menu`, hands the conversation to the start menu: Load **[start-menu.md](../ledger/references/start-menu.md)** and follow its instructions as written.
