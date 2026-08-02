# Conclude Research

*Reference for **[workflow-research-process](../SKILL.md)***

---

First check the topic's triage queue: `.workflows/{work_unit}/research/.triage/{topic}/*.md`.

**If the queue holds entries:**

A concern was rerouted into this topic after drain ran this session. It must be folded before concluding.

> *Output the next fenced block as a code block:*

```
  ⚑ Triage queue not empty — {N} rerouted concern(s) awaiting fold.
    Returning to the session to drain and explore them before concluding.
```

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

**If the queue is missing or empty:**

1. Mark the research completed — the engine sets the status and indexes the artifact into the knowledge base:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} research {topic}
   ```
2. Final commit:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "research({work_unit}): complete {topic} research"
   ```

Emit the `complete` response's `DISPLAY: kb warning` section when present, verbatim per its marker — the warning never blocks.

3. Closing recap:

   → Load **[closing-recap.md](../../workflow-shared/references/closing-recap.md)** with phase = `research`, work_unit = `{work_unit}`, topic = `{topic}`.

4. Closure signpost:

> *Output the next fenced block as markdown (not a code block):*

```
> Research complete. The discussion phase will use these findings
> to make decisions about architecture and approach.
```

5. Invoke `/workflow-bridge {work_unit} research`.
