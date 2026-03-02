# Convergence Awareness

*Reference for **[research-session.md](research-session.md)***

---

**Never decide for the user.** Even if the answer seems obvious, flag it and ask.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`p`/`park`** — Mark as discussion-ready and move to another topic
- **`k`/`keep`** — Keep digging, there's more to understand
- Comment — your call
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If the user parks it

Document the convergence point in the research file using this marker:

```markdown
> **Discussion-ready**: {Brief summary of what was explored and why it's ready for decision-making. Key tradeoffs or options identified.}
```

Commit the file.

Set research status to concluded via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.phases.research.status concluded
```

Check work_type from manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.work_type
```

**If work_type is set** (feature or epic):

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
This topic is marked discussion-ready. Would you like to:

- **`c`/`continue`** — Continue exploring
- **`d`/`discuss`** — Transition to discussion phase
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If continue:**

→ Return to **[research-session.md](research-session.md)**.

**If discuss:**

Invoke the `/workflow-bridge` skill:

```
Pipeline bridge for: {work_unit}
Work type: {work_type from manifest}
Completed phase: research

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

**If work_type is not set:**

→ Return to **[research-session.md](research-session.md)**.

#### If the user keeps digging

Continue exploring. The convergence signal isn't a stop sign — it's an awareness check. The user might want to stress-test the emerging conclusion, explore edge cases, or understand the problem more deeply before moving on. That's valid research work.

→ Return to **[research-session.md](research-session.md)**.

## Synthesis vs Decision

This distinction matters:

- **Synthesis** (research): "There are three viable approaches. A is simplest but limited. B scales better but costs more. C is future-proof but complex."
- **Decision** (discussion): "We should go with B because scaling matters more than simplicity for this project."

Synthesis is your job. Decisions are not. Present the landscape, don't pick the destination.
