---
name: leeway-continue-epic
user-invocable: false
allowed-tools: Bash(node .claude/skills/leeway-engine/scripts/engine.cjs *)
---

An epic's menu: what waits on the person in it, its topics, and the way on.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Arguments

- `$0` — **work_unit**: the epic.

## Instructions

Load **[framework.md](../leeway-shared/references/framework.md)** and follow its instructions as written.

## The Menu

Fetch the menu and emit its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render epic-menu {work_unit}
```

A refusal names the way on: say it in a line.

The answer goes to `gate`; follow its `next`.
