# Validate the Record

*Reference for **[workflow-experiment-entry](../SKILL.md)***

---

Branch on the `record_status` the caller stored in Step 3 — no re-read.

#### If status is `concluded`

> *Output the next fenced block as a properties code block (```properties fence):*

```
⚑ This experiment is concluded — its verdict stands
```

> *Output the next fenced block as markdown (not a code block):*

```
> {id} finished with its verdict on the register. A flawed or superseded result triggers the next experiment — spawned from the research or discussion that needs it, never a reopen.
```

**STOP.** Do not proceed — terminal condition.

#### If status is `abandoned`

> *Output the next fenced block as a properties code block (```properties fence):*

```
⚑ This experiment is abandoned — the row and its reason stand
```

> *Output the next fenced block as markdown (not a code block):*

```
> {id} was abandoned; the register keeps its row. A successor spawns from the conversation that still needs the answer.
```

**STOP.** Do not proceed — terminal condition.

#### If status is `conceived`

A fresh record — the spawn conceived it and no laboratory session has run. Nothing to render.

→ Return to caller.

#### Otherwise

A record in flight (`designed`, `approved`, or `running`). Render and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-note {work_unit}.experiment.{topic} --verb Resuming --noun {id}
```

→ Return to caller.
