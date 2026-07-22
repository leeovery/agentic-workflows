# Conclude Discussion

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

When the discussion session returns here (either through natural convergence or user-initiated conclusion), first check the `## Triage` section of `.workflows/{work_unit}/discussion/{topic}.md`.

**If `## Triage` is not `(none)`:**

A concern was rerouted into this topic after drain ran this session. It must be folded before concluding.

> *Output the next fenced block as a code block:*

```
  ⚑ Triage not empty — {N} rerouted concern(s) awaiting fold.
    Returning to the session to drain and explore them before concluding.
```

→ Return to **[the skill](../SKILL.md)** for **Step 5**.

**If `## Triage` is `(none)`:**

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
2. Mark the discussion completed — the engine sets the status and indexes the artifact into the knowledge base:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} discussion {topic}
   ```
3. Final commit:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "discussion({work_unit}): complete {topic} discussion"
   ```

Emit the `complete` response's `DISPLAY: kb warning` section when present, verbatim per its marker — the warning never blocks.

4. Invoke the **workflow-bridge** skill (Skill tool) — the next fenced block is its arguments:

> *Output the next fenced block as markdown (not a code block):*

```
> Discussion complete. The specification phase will
> synthesise your decisions into a formal document.
```

```
Pipeline bridge for: {work_unit}
Completed phase: discussion
```

**STOP.** Do not proceed — terminal condition.

#### If `no`

→ Return to **[the skill](../SKILL.md)** for **Step 5**.
