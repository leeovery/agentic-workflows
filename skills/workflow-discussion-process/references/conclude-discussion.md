# Conclude Discussion

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

When the discussion session returns here (either through natural convergence or user-initiated conclusion), first check the topic's triage queue:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic queue {work_unit} discussion {topic}
```

**If `count` is non-zero:**

A rerouted concern is still queued — it must be discussed and folded before concluding. Render the blocker and emit both its sections verbatim per their markers — the red blocker line, then its guidance:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render triage-block {work_unit}.discussion.{topic}
```

→ Return to **[the skill](../SKILL.md)** for **Step 5**.

**If `count` is `0`:**

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**`◆ Conclude this discussion and mark as completed?`**

**`y/yes`** → Conclude discussion
**`n/no`**  → Continue discussing
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
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic discussion/{topic} --kb -m "discussion({work_unit}): complete {topic} discussion"
   ```

   When the `complete` response's `warnings` is non-empty, fetch and emit the `DISPLAY: kb warning` advisory — the warning never blocks:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs render topic-receipt {work_unit}.discussion.{topic} --verb complete --warn
   ```

4. Clear this session's presence and sweep for leavings:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs presence clear {work_unit} discussion {topic}
   git status --porcelain -- .workflows
   ```

   **If dirt remains under another topic's paths:** run `node .claude/skills/workflow-engine/scripts/engine.cjs presence scan {work_unit}`. Dirt under a `held` row's topic belongs to that session — leave it, however long it has idled. For each dirty topic with no held presence — a dead session's leavings — commit it action-scoped: `node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic {phase}/{dirty_topic} -m "chore({work_unit}/{dirty_topic}): sweep session leavings"`.

   **Otherwise:** nothing to sweep — continue.

5. Closing recap:

   → Load **[closing-recap.md](../../workflow-shared/references/closing-recap.md)** with phase = `discussion`, work_unit = `{work_unit}`, topic = `{topic}`.

6. Hand off to the pipeline bridge:

> *Output the next fenced block as markdown (not a code block):*

```
> Discussion complete. The specification phase will synthesise your decisions into a formal document.
```

Invoke `/workflow-bridge {work_unit} discussion`.

#### If `no`

→ Return to **[the skill](../SKILL.md)** for **Step 5**.
