# Conclude Research

*Reference for **[workflow-research-process](../SKILL.md)***

---

**Parameters** (provided by caller via Load directive):

- `closure` — which closure applies: `discussion` (the findings feed a discussion) or `dead-end` (the topic is closed as a dead end)

First check the topic's triage queue:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic queue {work_unit} research {topic}
```

**If `count` is non-zero:**

A rerouted concern is still queued — it must be discussed and folded before concluding. Render the blocker and emit both its sections verbatim per their markers — the red blocker line, then its guidance:

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

   When the `complete` response's `warnings` is non-empty, fetch and emit the `DISPLAY: kb warning` advisory — the warning never blocks:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs render topic-receipt {work_unit}.research.{topic} --verb complete --warn
   ```

3. Sweep for leavings:

   ```bash
   git status --porcelain -- .workflows/{work_unit}
   ```

   **If dirt remains under another topic's paths:** run `node .claude/skills/workflow-engine/scripts/engine.cjs presence scan {work_unit}`. Dirt under a `held` row's topic belongs to that session — leave it, however long it has idled. For each dirty topic with no held presence — a dead session's leavings — commit it action-scoped: `node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic {phase}/{dirty_topic} --sweep -m "chore({work_unit}/{dirty_topic}): sweep session leavings"`.

   **Otherwise:** nothing to sweep — continue.

4. Closing recap:

   → Load **[closing-recap.md](../../workflow-shared/references/closing-recap.md)** with phase = `research`, work_unit = `{work_unit}`, topic = `{topic}`.

5. Closure signpost:

**If `closure` is `discussion`:**

> *Output the next fenced block as markdown (not a code block):*

```
> Research complete. The discussion phase will use these findings to make decisions about architecture and approach.
```

**If `closure` is `dead-end`:**

> *Output the next fenced block as markdown (not a code block):*

```
> Research complete — the topic is closed as a dead end, so no discussion follows. It stays on the map and in the knowledge base as record and seed material, and reopening it from the map makes it actionable again.
```

6. Invoke `/workflow-bridge {work_unit} research`.
