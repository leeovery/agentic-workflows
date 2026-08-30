# Conclude Experiments

*Reference for **[workflow-experiment-process](../SKILL.md)***

---

**Parameters** (provided by caller via Load directive):

- `closure` — which closure applies: `discussion` (the evidence feeds a discussion) or `dead-end` (the topic is closed as a dead end)

First check the topic's triage queue:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic queue {work_unit} experiment {topic}
```

**If `count` is non-zero:**

A rerouted concern is still queued — it must be worked and folded before concluding. Render the blocker and emit both its sections verbatim per their markers — the red blocker line, then its guidance:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render triage-block {work_unit}.experiment.{topic}
```

→ Return to **[the skill](../SKILL.md)** for **Step 5**.

**If `count` is `0`:**

1. Mark the phase completed — the engine refuses while any series row is unfinished; surface a refusal verbatim, the open rows are the walk's to finish:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} experiment {topic}
   ```
2. Index the series into the knowledge base — for each experiment in the register, its `design.md` and its `report.md` where the file exists:
   ```bash
   node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index .workflows/{work_unit}/experiment/{topic}/{id}-{slug}/design.md
   ```
   An index failure never blocks the conclusion — note it in one line and continue; the store catches up on a later index.
3. Final commit:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} --kb -m "experiment({work_unit}): complete {topic} experiments"
   ```
4. Sweep for leavings:

   ```bash
   git status --porcelain -- .workflows/{work_unit}
   ```

   **If dirt remains under another topic's paths:** run `node .claude/skills/workflow-engine/scripts/engine.cjs presence scan {work_unit}`. Dirt under a `held` row's topic belongs to that session — leave it, however long it has idled. For each dirty topic with no held presence — a dead session's leavings — commit it action-scoped: `node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic {phase}/{dirty_topic} --sweep -m "chore({work_unit}/{dirty_topic}): sweep session leavings"`.

   **Otherwise:** nothing to sweep — continue.

5. Closing recap:

   → Load **[closing-recap.md](../../workflow-shared/references/closing-recap.md)** with phase = `experiment`, work_unit = `{work_unit}`, topic = `{topic}`.

6. Closure signpost:

**If `closure` is `discussion`:**

> *Output the next fenced block as markdown (not a code block):*

```
> Experiments complete. The discussion phase will read the reports as evidence — the verdicts execute the pre-registered rules, and the discussion makes the decisions.
```

**If `closure` is `dead-end`:**

> *Output the next fenced block as markdown (not a code block):*

```
> Experiments complete — the topic is closed as a dead end, so no discussion follows. It stays on the map and in the knowledge base as record and seed material, and reopening it from the map makes it actionable again.
```

7. Invoke `/workflow-bridge {work_unit} experiment`.
