# Convergence Awareness

*Reference for **[research-session.md](research-session.md)***

---

**Never decide for the user.** Even if the answer seems obvious, flag it and ask.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`c`/`conclude`** — Conclude research and move forward
- **`k`/`keep`** — Keep digging, there's more to understand
- Comment — your call
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If the user concludes

Set research status to completed via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase research status completed
```

Invoke the `/workflow-bridge` skill:

```
Pipeline bridge for: {work_unit}
Completed phase: research

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

**STOP.** Do not proceed — terminal condition.

#### If the user keeps digging

Continue exploring. The convergence signal isn't a stop sign — it's an awareness check. The user might want to stress-test the emerging conclusion, explore edge cases, or understand the problem more deeply before moving on. That's valid research work.

→ Return to **[research-session.md](research-session.md)**.

## Synthesis vs Decision

This distinction matters:

- **Synthesis** (research): "There are three viable approaches. A is simplest but limited. B scales better but costs more. C is future-proof but complex."
- **Decision** (discussion): "We should go with B because scaling matters more than simplicity for this project."

Synthesis is your job. Decisions are not. Present the landscape, don't pick the destination.
