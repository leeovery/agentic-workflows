# Conclude Implementation

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render conclude-gate {work_unit}.implementation.{topic}
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

#### If `no`

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

#### If `yes`

**If the manifest still holds a `bank`** (`manifest exists {work_unit}.implementation.{topic} bank` — a boundary pass interrupted before it emptied it): delete it — no pass follows implementation:

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
