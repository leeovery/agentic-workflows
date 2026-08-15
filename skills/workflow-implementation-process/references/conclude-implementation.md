# Conclude Implementation

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**`◆ Ready to mark implementation as completed?`**

**`y/yes`** → Mark as completed
**`n/no`**  → Go back and make changes
```

**STOP.** Wait for user response.

#### If `no`

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

#### If `yes`

**If the manifest still holds a `bank`** (`manifest exists {work_unit}.implementation.{topic} bank` — a session exited the analysis loop with residue undecided): delete it — implementation is over and the residue's consumer with it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.implementation.{topic} bank
```

Complete the phase item:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} implementation {topic}
```

Commit:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): complete implementation"
```

**Pipeline continuation**:

> *Output the next fenced block as markdown (not a code block):*

```
> Implementation complete. The review phase will validate your work against the specification and plan.
```

Invoke `/workflow-bridge {work_unit} implementation`.
