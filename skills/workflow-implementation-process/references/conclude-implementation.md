# Conclude Implementation

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render conclude-gate {work_unit}.implementation.{topic}
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

#### If ask

Answer from the record the session already holds — the plan, the task results, the analysis reports, the code — then fetch the gate again and emit its MENU section as above.

**STOP.** Wait for user response.

#### If `yes`

**If the manifest still holds a `bank`** (`manifest exists {work_unit}.implementation.{topic} bank` — a boundary pass interrupted before it emptied it): delete it — the bank never crosses the conclude:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.implementation.{topic} bank
```

Complete the phase item:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} implementation {topic}
```

Commit:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): complete implementation" --topic implementation/{topic}
```

**Pipeline continuation**:

> *Output the next fenced block as markdown (not a code block):*

```
> Implementation complete. The review phase will validate your work against the specification and plan.
```

Invoke `/workflow-bridge {work_unit} implementation`.
