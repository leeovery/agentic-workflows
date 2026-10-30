# Code Session Gate

*Shared reference. Loaded by `workflow-implementation-process` and `workflow-review-process` where each starts.*

---

The caller passes `work_type`, `work_unit`, `topic`, and `phase`. Implementation and review run one session at a time per checkout, whatever work unit or topic the other session sits in — so the check reads the whole project, not this work unit. An empty response means the slot is free.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render code-gate {work_unit}.{phase}.{topic}
```

#### If the response is empty

No other session holds the code slot.

→ Return to caller.

#### If the response carried `DISPLAY: code gate`

Emit both sections verbatim per their markers — the blocking fact, then the menu.

**STOP.** Wait for user response.

**If `back` and `work_type` is `epic`:**

> *Output the next fenced block as markdown (not a code block):*

```
> Left as it is — come back once that session has finished, or release its hold if you know it is done.
```

→ Load **[handing-off.md](handing-off.md)** with route = `/workflow-continue-epic {work_unit}`.

**If `back` and `work_type` is not `epic`:**

> *Output the next fenced block as markdown (not a code block):*

```
> Left as it is — come back once that session has finished, or release its hold if you know it is done.
```

→ Load **[start-menu.md](../../workflow-start/references/start-menu.md)**.

**If `yes`:**

The user owns the consequence; nothing further is said about it.

→ Return to caller.
