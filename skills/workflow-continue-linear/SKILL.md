---
name: workflow-continue-linear
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-continue-linear/scripts/gateway.cjs), Bash(node .claude/skills/workflow-start/scripts/gateway.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs)
---

Continue an in-progress feature, bugfix, quick-fix or cross-cutting concern. Determines the current phase and hands the work off to its phase skill.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Step 1: Display State and Menu

This skill receives one positional argument:
- `$0` — **work_unit**: the work unit to continue — its type is read from its manifest. Held downstream as `{work_unit}`.

Record where this session is working — the call also labels the tmux session where the user opted in:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs session label {work_unit}
```

Load **[display-and-menu.md](references/display-and-menu.md)** and follow its instructions as written.

→ On return, proceed to **Step 2**.

---

## Step 2: Route Selection

The user's selection carries its `route` — the selected `ACTIONS` entry's route from display-and-menu.md, e.g. `/workflow-specification-process feature {work_unit}`.

Load **[handing-off.md](../workflow-shared/references/handing-off.md)** with route = `{route}`.
