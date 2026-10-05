# Handing Off

*Shared reference. Loaded wherever the work moves into a skill that starts it — the start menu, the continue menus, the bridge's continuations, review's route back to implementation, and the epic menu's backfill.*

---

The engine checks the move and says how it travels: the gate mod carries it into a fresh conversation, or the skill is invoked here.

## Parameters

The caller provides these via context before loading:

- `route` — the move as the skill's slash command and its arguments, `/{skill} {args}`, exactly as the skill is invoked.

## A. Hand Off

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs handoff {route}
```

#### If the call was refused

Tell the person the handoff was refused, quoting the engine's error.

**STOP.** Do not proceed — terminal condition.

#### If DATA reads `handoff: mod` and the result carries no HANDOFF section

The gate mod took the handoff. Emit the DISPLAY section verbatim per its marker. As the turn ends, the mod clears the conversation and carries the work into the next one.

**STOP.** Do not proceed — terminal condition.

#### Otherwise

DATA reads `handoff: inline`, or the HANDOFF section is still in the result — the mod did not take it. Emit the DISPLAY section verbatim per its marker, then invoke the DATA's `skill` with its `args` — `/{skill} {args}`.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
