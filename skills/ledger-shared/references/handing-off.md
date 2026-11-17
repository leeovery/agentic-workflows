# Handing Off

*Shared reference. Loaded wherever the work moves into a skill that starts it — the start menu, the moves into discovery from the start and from the roadmap, and a decided topic's way back to its epic's menu.*

---

The engine checks the move and says how it travels: the gate mod carries it into a fresh conversation, or the skill is invoked here.

## Parameters

The caller provides these via context before loading:

- `route` — the move: the skill's slash command and its arguments, `/{skill} {args}`, exactly as the skill is invoked; a topic named by its unit and name, `topic {work_unit} {topic}`, which the engine opens in the phase its topics are talked through; or a unit, `unit {work_unit}`, which the engine opens where it stands.

## A. Hand Off

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs handoff {route}
```

#### If the call was refused

Tell the person the handoff was refused, quoting the engine's error.

**STOP.** Do not proceed — terminal condition.

#### If DATA reads `handoff: mod` and the result carries no HANDOFF section

The gate mod took the handoff. As the turn ends, the mod clears the conversation and carries the work into the next one.

**STOP.** Do not proceed — terminal condition.

#### Otherwise

DATA reads `handoff: inline`, or the HANDOFF section is still in the result — the mod did not take it. Invoke the DATA's `skill` with its `args` — `/{skill} {args}`.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
