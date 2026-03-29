# Conclude Discussion

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

When the discussion session returns here (either through natural convergence or user-initiated conclusion):

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Conclude this discussion and mark as completed?

- **`y`/`yes`** — Conclude discussion
- **`n`/`no`** — Continue discussing
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

1. Ensure the Summary section is populated — Key Insights, Open Threads, Current State
2. Set discussion status to completed via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discussion.{topic} status completed
   ```
3. Final commit
4. Invoke the bridge:

> *Output the next fenced block as markdown (not a code block):*

```
> **Discussion complete.** The specification phase will synthesise your decisions into a formal document.
```

```
Pipeline bridge for: {work_unit}
Completed phase: discussion

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

**STOP.** Do not proceed — terminal condition.

#### If `no`

→ Return to **[the skill](../SKILL.md)** for **Step 3**.
