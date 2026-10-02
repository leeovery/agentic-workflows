# Handing Off

*Shared reference. Loaded by the bridge's continuations and review's route back to implementation.*

---

The engine checks the move and says how it travels: the gate mod carries it into a fresh conversation, or the skill is invoked here.

## Parameters

The caller provides these via context before loading:

- `skill` — the skill the work moves into.
- `args` — its arguments, space-separated, exactly as the skill takes them.

## A. Hand Off

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs handoff {skill} {args}
```

#### If the call was refused

Tell the person the handoff was refused, quoting the engine's error.

**STOP.** Do not proceed — terminal condition.

#### If DATA reads `handoff: mod`

Emit the DISPLAY section verbatim per its marker. As the turn ends, the gate mod clears the conversation and carries the work into the next one.

**STOP.** Do not proceed — terminal condition.

#### If DATA reads `handoff: inline`

Emit the DISPLAY section verbatim per its marker, then invoke the DATA's `skill` with its `args` — `/{skill} {args}`.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
