# Conclude Implementation

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Ready to mark implementation as completed?

- **`y`/`yes`** — Mark as completed
- **`n`/`no`** — Go back and make changes
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `no`

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

#### If `yes`

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
> Implementation complete. The review phase will validate
> your work against the specification and plan.
```

Invoke the **workflow-bridge** skill (Skill tool) — the next fenced block is its arguments:

```
Pipeline bridge for: {work_unit}
Completed phase: implementation
```

**STOP.** Do not proceed — terminal condition.
