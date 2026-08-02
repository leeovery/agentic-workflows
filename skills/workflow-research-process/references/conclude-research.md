# Conclude Research

*Reference for **[workflow-research-process](../SKILL.md)***

---

First check the topic's triage queue:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic queue {work_unit} research {topic}
```

**If `count` is non-zero:**

A rerouted concern is still queued — it must be discussed and folded before concluding. Render the blocker and emit its `DISPLAY: triage block` section verbatim as a code block:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render triage-block {work_unit}.research.{topic}
```

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

**If `count` is `0`:**

1. Mark the research completed — the engine sets the status and indexes the artifact into the knowledge base:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} research {topic}
   ```
2. Final commit:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic research/{topic} --kb -m "research({work_unit}): complete {topic} research"
   ```

   Emit the `complete` response's `DISPLAY: kb warning` section when present, verbatim per its marker — the warning never blocks.

3. Clear this session's presence and sweep for leavings:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs presence clear {work_unit} research {topic}
   git status --porcelain -- .workflows
   ```

   **If dirt remains under another topic's paths:** run `node .claude/skills/workflow-engine/scripts/engine.cjs presence scan {work_unit}`. Dirt under a `live` row's topic belongs to that session — leave it. For each dirty topic with no live presence — a crashed session's leavings — commit it action-scoped: `node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic {phase}/{dirty_topic} -m "chore({work_unit}/{dirty_topic}): sweep session leavings"`.

   **Otherwise:** nothing to sweep — continue.

4. Closing recap:

   → Load **[closing-recap.md](../../workflow-shared/references/closing-recap.md)** with phase = `research`, work_unit = `{work_unit}`, topic = `{topic}`.

5. Closure signpost:

> *Output the next fenced block as markdown (not a code block):*

```
> Research complete. The discussion phase will use these findings
> to make decisions about architecture and approach.
```

6. Invoke `/workflow-bridge {work_unit} research`.
